#!/usr/bin/env bash
set -euo pipefail

usage() {
	cat <<'USAGE' >&2
Usage: bash scripts/pr-triage-snapshot.sh <pr-number>

Collects a read-only PR triage snapshot so agents batch review comments, check
failures, and mergeability blockers before patching.
USAGE
}

if [[ $# -ne 1 ]]; then
	usage
	exit 2
fi

pr_number="$1"
case "$pr_number" in
	*[!0-9]* | "")
		echo "[pr-triage] PR number must be numeric: $pr_number" >&2
		exit 2
		;;
esac

if ! command -v gh >/dev/null 2>&1; then
	echo "[pr-triage] missing required binary: gh" >&2
	exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
	echo "[pr-triage] missing required binary: jq" >&2
	exit 1
fi

repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/pr-triage.XXXXXX")"
cleanup() {
	rm -rf "$tmp_dir"
}
trap cleanup EXIT INT TERM

pr_json="$tmp_dir/pr.json"
checks_json="$tmp_dir/checks.json"
checks_error_json="$tmp_dir/checks-error.json"
review_comments_json="$tmp_dir/review-comments.json"
reviews_json="$tmp_dir/reviews.json"

gh pr view "$pr_number" \
	-R "$repo" \
	--json number,title,url,headRefName,headRefOid,baseRefName,state,isDraft,mergeable,mergeStateStatus,reviewDecision,updatedAt \
	>"$pr_json"

checks_stderr="$tmp_dir/checks.stderr"
set +e
gh pr checks "$pr_number" -R "$repo" --json name,state,link,description,bucket,completedAt,startedAt >"$checks_json" 2>"$checks_stderr"
checks_status="$?"
set -e
if jq -e 'type == "array"' "$checks_json" >/dev/null 2>&1; then
	printf 'null\n' >"$checks_error_json"
else
	printf '[]\n' >"$checks_json"
	jq -n --arg status "$checks_status" --rawfile stderr "$checks_stderr" '{status: ($status | tonumber), reason: ($stderr | gsub("\\s+$"; ""))}' >"$checks_error_json"
fi

gh api --paginate --slurp "repos/$repo/pulls/$pr_number/comments" >"$review_comments_json"
gh api --paginate --slurp "repos/$repo/pulls/$pr_number/reviews" >"$reviews_json"

jq -n \
	--slurpfile pr "$pr_json" \
	--slurpfile checks "$checks_json" \
	--slurpfile checksError "$checks_error_json" \
	--slurpfile reviewComments "$review_comments_json" \
	--slurpfile reviews "$reviews_json" \
	'{
		schemaVersion: "pr-triage-snapshot/v1",
		generatedAt: now | todateiso8601,
		repository: $pr[0].url | capture("github.com/(?<repo>[^/]+/[^/]+)/pull").repo,
		pr: $pr[0],
		checkSummary: {
			total: ($checks[0] | length),
			unavailable: $checksError[0],
			failing: [ $checks[0][] | select(.state == "FAILURE" or .state == "ERROR" or .bucket == "fail") ],
			pending: [ $checks[0][] | select(.state == "PENDING" or .bucket == "pending") ]
		},
		openReviewThreads: [
			($reviewComments[0] | add // [])[]
			| select(.position != null)
			| {
				id,
				path,
				line,
				originalLine: .original_line,
				user: .user.login,
				body: (.body | gsub("\\r?\\n"; " ") | .[0:500]),
				createdAt: .created_at,
				updatedAt: .updated_at
			}
		],
		reviews: [
			($reviews[0] | add // [])[]
			| {
				id,
				state,
				user: .user.login,
				submittedAt: .submitted_at,
				body: ((.body // "") | gsub("\\r?\\n"; " ") | .[0:500])
			}
		],
		nextAction: (
			if $checksError[0] != null then
				"classify_checks_unavailable"
			elif ([ $checks[0][] | select(.state == "FAILURE" or .state == "ERROR" or .bucket == "fail") ] | length) > 0 then
				"fix_failing_checks_first"
			elif ([ $checks[0][] | select(.state == "PENDING" or .bucket == "pending") ] | length) > 0 then
				"wait_or_triage_pending_checks"
			elif ($pr[0].reviewDecision // "") == "CHANGES_REQUESTED" then
				"address_required_reviews"
			elif ($pr[0].mergeStateStatus // "") != "CLEAN" and ($pr[0].mergeStateStatus // "") != "HAS_HOOKS" then
				"classify_merge_blocker"
			else
				"ready_for_owner_merge_review"
			end
		)
	}'
