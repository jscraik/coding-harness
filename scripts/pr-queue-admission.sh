#!/usr/bin/env bash
set -euo pipefail

usage() {
	cat <<'USAGE' >&2
Usage: bash scripts/pr-queue-admission.sh [--json] [--require-ready] [--require-review-artifact]

Collect a read-only queue snapshot for every open PR. The snapshot joins
current PR metadata, required-check state, GraphQL review-thread state, and
optional provider-review evidence so the next mutation is chosen from live
evidence instead of stale summaries.
USAGE
}

json_output=false
require_ready=false
require_review_artifact=false
if [[ "${1:-}" == "--" ]]; then
	shift
fi
while [[ $# -gt 0 ]]; do
	case "$1" in
		--json) json_output=true ;;
		--require-ready) require_ready=true ;;
		--require-review-artifact) require_review_artifact=true ;;
		--help|-h) usage; exit 0 ;;
		*) echo "[pr-queue] unknown argument: $1" >&2; usage; exit 2 ;;
	esac
	shift
done

for binary in gh jq; do
	if ! command -v "$binary" >/dev/null 2>&1; then
		echo "[pr-queue] missing required binary: $binary" >&2
		exit 1
	fi
done

repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
owner="${repo%%/*}"
name="${repo#*/}"
tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/pr-queue.XXXXXX")"
trap 'rm -rf "$tmp_dir"' EXIT INT TERM

prs_pages_file="$tmp_dir/prs-pages.json"
prs_file="$tmp_dir/prs.json"
gh api graphql --paginate --slurp \
	-f query='query($owner:String!,$repo:String!,$endCursor:String){repository(owner:$owner,name:$repo){pullRequests(first:100,states:OPEN,after:$endCursor,orderBy:{field:UPDATED_AT,direction:DESC}){nodes{number,title,url,headRefName,headRefOid,baseRefName,state,isDraft,mergeable,mergeStateStatus,reviewDecision,updatedAt}pageInfo{hasNextPage,endCursor}}}}' \
	-f owner="$owner" -f repo="$name" \
	>"$prs_pages_file"
jq '[.[].data.repository.pullRequests.nodes[]?]' "$prs_pages_file" >"$prs_file"

rows_file="$tmp_dir/rows.jsonl"
: >"$rows_file"
while IFS= read -r pr; do
	number="$(jq -r '.number' <<<"$pr")"
	checks_file="$tmp_dir/checks-$number.json"
	checks_error_file="$tmp_dir/checks-error-$number.txt"
	set +e
	gh pr checks "$number" --repo "$repo" --required --json name,state,bucket,link,completedAt,startedAt >"$checks_file" 2>"$checks_error_file"
	checks_status="$?"
	set -e
	if ! jq -e 'type == "array"' "$checks_file" >/dev/null 2>&1; then
		printf 'null\n' >"$checks_file"
	fi
	threads_file="$tmp_dir/threads-$number.json"
	comments_file="$tmp_dir/comments-$number.json"
	reviews_file="$tmp_dir/reviews-$number.json"
	threads_query='query($owner:String!,$repo:String!,$number:Int!,$endCursor:String){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads(first:100,after:$endCursor){nodes{isResolved isOutdated}pageInfo{hasNextPage,endCursor}}}}}'
	comments_query='query($owner:String!,$repo:String!,$number:Int!,$endCursor:String){repository(owner:$owner,name:$repo){pullRequest(number:$number){comments(first:100,after:$endCursor){nodes{author{login} body createdAt url}pageInfo{hasNextPage,endCursor}}}}}'
	reviews_query='query($owner:String!,$repo:String!,$number:Int!,$endCursor:String){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviews(first:100,after:$endCursor){nodes{author{login} state body submittedAt}pageInfo{hasNextPage,endCursor}}}}}'
	set +e
	gh api graphql --paginate --slurp -f query="$threads_query" -f owner="$owner" -f repo="$name" -F number="$number" >"$threads_file" 2>/dev/null
	threads_status="$?"
	gh api graphql --paginate --slurp -f query="$comments_query" -f owner="$owner" -f repo="$name" -F number="$number" >"$comments_file" 2>/dev/null
	comments_status="$?"
	gh api graphql --paginate --slurp -f query="$reviews_query" -f owner="$owner" -f repo="$name" -F number="$number" >"$reviews_file" 2>/dev/null
	reviews_status="$?"
	set -e
	if [[ "$threads_status" -ne 0 ]]; then
		printf '{"status":"blocked","unresolved":null}\n' >"$threads_file"
	elif [[ "$comments_status" -ne 0 || "$reviews_status" -ne 0 ]]; then
		jq '
			def threads: [.[].data.repository.pullRequest.reviewThreads.nodes[]?];
			{status:"observed",
			 unresolved:([threads[] | select(.isResolved != true and .isOutdated != true)] | length),
			 reviewArtifacts:{status:"blocked",substantiveCount:0,coderabbit:"unknown",codex:"unknown"}}' "$threads_file" >"$threads_file.normalized"
		mv "$threads_file.normalized" "$threads_file"
	else
		jq --slurpfile comments "$comments_file" --slurpfile reviews "$reviews_file" '
			def threads: [.[].data.repository.pullRequest.reviewThreads.nodes[]?];
			def provider_signals($provider):
				([$comments[][]?.data.repository.pullRequest.comments.nodes[]?,
					$reviews[][]?.data.repository.pullRequest.reviews.nodes[]?]
					| map(select((.author.login // "" | ascii_downcase | contains($provider))))
					| sort_by((.createdAt // .submittedAt // "")));
			def provider_signal($root; $provider):
				($root | provider_signals($provider)) as $signals
				| if any($signals[]?; ((.body // "") | test("## summary|## findings|no actionable findings|review completed"; "i"))) then "substantive"
				  elif any($signals[]?; ((.body // "") | test("review limit reached|rate limit"; "i"))) then "rate_limited"
				  elif ($signals | length) > 0 then "action_only"
				  else "missing" end;
			. as $root |
			{status:"observed",
			 unresolved:([threads[] | select(.isResolved != true and .isOutdated != true)] | length),
			 reviewArtifacts:{
				coderabbit:(provider_signal($root; "coderabbit")),
				codex:(provider_signal($root; "codex")),
				substantiveCount:([provider_signal($root; "coderabbit"), provider_signal($root; "codex")] | map(select(. == "substantive")) | length),
				status:(
					[provider_signal($root; "coderabbit"), provider_signal($root; "codex")] as $signals
					| if any($signals[]; . == "substantive") then "observed"
					  elif any($signals[]; . == "rate_limited") then "rate_limited"
					  elif any($signals[]; . == "action_only") then "action_only"
					  else "missing" end)
			 }}' "$threads_file" >"$threads_file.normalized"
		mv "$threads_file.normalized" "$threads_file"
	fi
	jq -n \
		--argjson pr "$pr" \
		--slurpfile checks "$checks_file" \
		--slurpfile threads "$threads_file" \
		--arg checkError "$(tr '\n' ' ' <"$checks_error_file" | sed 's/[[:space:]]*$//')" \
		--argjson checkStatus "$checks_status" \
		--argjson requireReviewArtifact "$([[ "$require_review_artifact" == true ]] && printf 'true' || printf 'false')" \
		'{
			pr: $pr,
			checks: {
				status: (if (($checks[0] | type) == "array") then "observed" else "blocked" end),
				failureCount: ([$checks[0][]? | select(.state == "FAILURE" or .state == "ERROR" or .state == "CANCELLED" or .state == "CANCELED" or .bucket == "fail" or .bucket == "cancel")] | length),
				pendingCount: ([$checks[0][]? | select(.state == "PENDING" or .bucket == "pending")] | length),
				error: (if (($checks[0] | type) == "array") then null else {status:$checkStatus,reason:$checkError} end)
			},
			reviewThreads: {
				status: ($threads[0].status // "blocked"),
				unresolved: ($threads[0].unresolved // null)
			},
			reviewArtifacts: ($threads[0].reviewArtifacts // {status:"blocked",substantiveCount:0,coderabbit:"unknown",codex:"unknown"}),
			nextAction: (
					if (($checks[0] | type) != "array") then "classify_checks_unavailable"
					elif ([$checks[0][]? | select(.state == "FAILURE" or .state == "ERROR" or .state == "CANCELLED" or .state == "CANCELED" or .bucket == "fail" or .bucket == "cancel")] | length) > 0 then "fix_failing_checks_first"
					elif ([$checks[0][]? | select(.state == "PENDING" or .bucket == "pending")] | length) > 0 then "wait_or_triage_pending_checks"
					elif ($threads[0].status // "blocked") != "observed" then "classify_review_threads_unavailable"
					elif (($threads[0].unresolved // 0) > 0) then "resolve_review_threads"
					elif ($pr.reviewDecision // "") == "CHANGES_REQUESTED" then "address_required_reviews"
					elif ($pr.reviewDecision // "") == "REVIEW_REQUIRED" then "obtain_required_review"
					elif ($pr.mergeStateStatus // "") != "CLEAN" and ($pr.mergeStateStatus // "") != "HAS_HOOKS" then "classify_merge_blocker"
					elif ($pr.isDraft == true) then "await_ready_authorization"
					elif ($requireReviewArtifact == true and ($threads[0].reviewArtifacts.status // "missing") == "rate_limited") then "wait_or_triage_review_provider"
					elif ($requireReviewArtifact == true and ($threads[0].reviewArtifacts.status // "missing") != "observed") then "obtain_review_artifact"
					else "ready_for_owner_merge_review" end)
		}' >>"$rows_file"
done < <(jq -c '.[]' "$prs_file")

report="$(jq -s --arg repo "$repo" '{schemaVersion:"pr-queue-admission/v1",generatedAt:(now | todateiso8601),repository:$repo,prCount:length,prs:.,overall:(if length == 0 then "empty" elif any(.[]; .nextAction != "ready_for_owner_merge_review") then "blocked" else "ready" end)}' "$rows_file")"
if [[ "$json_output" == true ]]; then
	printf '%s\n' "$report"
else
	jq -r '"PR queue: " + .overall + " (" + (.prCount|tostring) + " open)" , (.prs[] | "#" + (.pr.number|tostring) + " -> " + .nextAction)' <<<"$report"
fi

queue_state="$(jq -r '.overall' <<<"$report")"
if [[ "$require_ready" == true ]] && [[ "$queue_state" != "ready" && "$queue_state" != "empty" ]]; then
	exit 1
fi
