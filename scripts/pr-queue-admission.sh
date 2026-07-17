#!/usr/bin/env bash
set -euo pipefail

usage() {
	cat <<'USAGE' >&2
Usage: bash scripts/pr-queue-admission.sh [--json] [--require-ready]

Collect a read-only queue snapshot for every open PR. The snapshot joins
current PR metadata, required-check state, and GraphQL review-thread state so
the next mutation is chosen from live evidence instead of stale summaries.
USAGE
}

json_output=false
require_ready=false
if [[ "${1:-}" == "--" ]]; then
	shift
fi
while [[ $# -gt 0 ]]; do
	case "$1" in
		--json) json_output=true ;;
		--require-ready) require_ready=true ;;
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

prs_file="$tmp_dir/prs.json"
gh pr list --repo "$repo" --state open --limit 100 \
	--json number,title,url,headRefName,headRefOid,baseRefName,state,isDraft,mergeable,mergeStateStatus,reviewDecision,updatedAt \
	>"$prs_file"

rows_file="$tmp_dir/rows.jsonl"
: >"$rows_file"
while IFS= read -r pr; do
	number="$(jq -r '.number' <<<"$pr")"
	checks_file="$tmp_dir/checks-$number.json"
	checks_error_file="$tmp_dir/checks-error-$number.txt"
	set +e
	gh pr checks "$number" --repo "$repo" --json name,state,bucket,link,completedAt,startedAt >"$checks_file" 2>"$checks_error_file"
	checks_status="$?"
	set -e
	if ! jq -e 'type == "array"' "$checks_file" >/dev/null 2>&1; then
		printf '[]\n' >"$checks_file"
	fi
	threads_file="$tmp_dir/threads-$number.json"
	query='query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads(first:100){nodes{isResolved isOutdated}}}}}'
	set +e
	gh api graphql -f query="$query" -f owner="$owner" -f repo="$name" -F number="$number" >"$threads_file" 2>/dev/null
	threads_status="$?"
	set -e
	if [[ "$threads_status" -ne 0 ]]; then
		printf '{"status":"blocked","unresolved":null}\n' >"$threads_file"
	else
		jq '{status:"observed",unresolved:([.data.repository.pullRequest.reviewThreads.nodes[]? | select(.isResolved != true and .isOutdated != true)] | length)}' "$threads_file" >"$threads_file.normalized"
		mv "$threads_file.normalized" "$threads_file"
	fi
	jq -n \
		--argjson pr "$pr" \
		--slurpfile checks "$checks_file" \
		--slurpfile threads "$threads_file" \
		--arg checkError "$(tr '\n' ' ' <"$checks_error_file" | sed 's/[[:space:]]*$//')" \
		--argjson checkStatus "$checks_status" \
		'{
			pr: $pr,
			checks: {
				status: (if ($checkStatus == 0 and ($checks[0] | type) == "array") then "observed" else "blocked" end),
				failureCount: ([$checks[0][]? | select(.state == "FAILURE" or .state == "ERROR" or .state == "CANCELLED" or .state == "CANCELED" or .bucket == "fail" or .bucket == "cancel")] | length),
				pendingCount: ([$checks[0][]? | select(.state == "PENDING" or .bucket == "pending")] | length),
				error: (if $checkStatus == 0 then null else {status:$checkStatus,reason:$checkError} end)
			},
			reviewThreads: $threads[0],
				nextAction: (
					if $checkStatus != 0 then "classify_checks_unavailable"
					elif ([$checks[0][]? | select(.state == "FAILURE" or .state == "ERROR" or .state == "CANCELLED" or .state == "CANCELED" or .bucket == "fail" or .bucket == "cancel")] | length) > 0 then "fix_failing_checks_first"
					elif ([$checks[0][]? | select(.state == "PENDING" or .bucket == "pending")] | length) > 0 then "wait_or_triage_pending_checks"
					elif ($threads[0].status // "blocked") != "observed" then "classify_review_threads_unavailable"
					elif (($threads[0].unresolved // 0) > 0) then "resolve_review_threads"
					elif ($pr.reviewDecision // "") == "CHANGES_REQUESTED" then "address_required_reviews"
					elif ($pr.mergeStateStatus // "") != "CLEAN" and ($pr.mergeStateStatus // "") != "HAS_HOOKS" then "classify_merge_blocker"
					elif ($pr.isDraft == true) then "await_ready_authorization"
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
