#!/usr/bin/env bash
set -euo pipefail

GH_BIN="${GH_BIN:-gh}"
check_name="${HARNESS_CIRCLECI_PR_REF_CHECK_NAME:-pull request context}"
max_attempts="${HARNESS_CIRCLECI_PR_REF_MAX_ATTEMPTS:-18}"
sleep_seconds="${HARNESS_CIRCLECI_PR_REF_SLEEP_SECONDS:-10}"
network_timeout="${HARNESS_CIRCLECI_PR_REF_NETWORK_TIMEOUT:-30}"

if [[ ! "$max_attempts" =~ ^[0-9]+$ || "$max_attempts" -lt 1 ]]; then
	max_attempts=18
fi

if [[ ! "$sleep_seconds" =~ ^[0-9]+$ ]]; then
	sleep_seconds=10
fi

if [[ ! "$network_timeout" =~ ^[0-9]+$ || "$network_timeout" -lt 1 ]]; then
	network_timeout=30
fi

run_with_timeout() {
	local timeout_seconds="$1"
	shift
	if command -v timeout >/dev/null 2>&1; then
		timeout "$timeout_seconds" "$@"
	elif command -v gtimeout >/dev/null 2>&1; then
		gtimeout "$timeout_seconds" "$@"
	elif command -v python3 >/dev/null 2>&1; then
		python3 -c '
import subprocess
import sys

try:
    completed = subprocess.run(sys.argv[2:], timeout=int(sys.argv[1]))
except subprocess.TimeoutExpired:
    raise SystemExit(124)

raise SystemExit(completed.returncode)
' "$timeout_seconds" "$@"
	else
		return 124
	fi
}

normalize_github_slug() {
	local slug="$1"
	slug="${slug#https://github.com/}"
	slug="${slug#git@github.com:/}"
	slug="${slug#git@github.com:}"
	slug="${slug%.git}"
	printf '%s' "$slug"
}

resolve_repo_slug() {
	local slug=""
	if [[ -n "${CIRCLE_PROJECT_USERNAME:-}" && -n "${CIRCLE_PROJECT_REPONAME:-}" ]]; then
		slug="${CIRCLE_PROJECT_USERNAME}/${CIRCLE_PROJECT_REPONAME}"
	fi
	if [[ -z "$slug" && -n "${CIRCLE_REPOSITORY_URL:-}" ]]; then
		slug="$(normalize_github_slug "$CIRCLE_REPOSITORY_URL")"
	fi
	if [[ -z "$slug" ]]; then
		local remote_url=""
		remote_url="$(git config --get remote.origin.url 2>/dev/null || true)"
		if [[ -n "$remote_url" ]]; then
			slug="$(normalize_github_slug "$remote_url")"
		fi
	fi
	if [[ -z "$slug" ]]; then
		local gh_path=""
		if [[ -x "$GH_BIN" ]]; then
			gh_path="$GH_BIN"
		else
			gh_path="$(command -v "$GH_BIN" 2>/dev/null || true)"
		fi
		if [[ -n "$gh_path" ]]; then
			slug="$(run_with_timeout "$network_timeout" "$gh_path" repo view --json nameWithOwner --jq '.nameWithOwner // ""' 2>/dev/null || true)"
		fi
	fi
	printf '%s' "$slug"
}

resolve_direct_pr_ref() {
	if [[ -n "${CIRCLE_PULL_REQUEST:-}" ]]; then
		printf '%s' "$CIRCLE_PULL_REQUEST"
		return 0
	fi
	if [[ -n "${CIRCLE_PULL_REQUESTS:-}" ]]; then
		printf '%s' "${CIRCLE_PULL_REQUESTS%%,*}"
		return 0
	fi
	return 1
}

is_valid_pr_ref() {
	local ref="${1%%[?#]*}"
	ref="${ref%/}"
	[[ "$ref" =~ ^https://github[.]com/[^/]+/[^/]+/pull/[0-9]+$ || "$ref" =~ ^[0-9]+$ ]]
}

resolve_unique_pr_ref() {
	local response="$1"
	local resolved=""
	resolved="$(
		jq -r '[.[] | .html_url] | if length == 1 then .[0] else "" end' \
			<<<"$response" 2>/dev/null || true
	)"
	if is_valid_pr_ref "$resolved"; then
		printf '%s' "$resolved"
	fi
}

resolve_unique_open_pr_ref() {
	local response="$1"
	local open_response=""
	open_response="$(jq -c '[.[] | select(.state == "open")]' <<<"$response" 2>/dev/null || true)"
	resolve_unique_pr_ref "$open_response"
}

resolve_github_pr_ref() {
	local repo_slug="$1"
	local resolved=""
	local gh_repo_args=()
	if [[ -n "$repo_slug" ]]; then
		gh_repo_args=(--repo "$repo_slug")
	fi
	if [[ -n "${CIRCLE_BRANCH:-}" && -n "${CIRCLE_PROJECT_USERNAME:-}" ]]; then
		resolved="$(run_with_timeout "$network_timeout" "$GH_BIN" pr list "${gh_repo_args[@]}" --head "${CIRCLE_PROJECT_USERNAME}:${CIRCLE_BRANCH}" --state open --json url --jq 'if length == 1 then .[0].url else "" end' 2>/dev/null || true)"
	fi
	if [[ -z "$resolved" && -n "${CIRCLE_BRANCH:-}" ]]; then
		resolved="$(run_with_timeout "$network_timeout" "$GH_BIN" pr list "${gh_repo_args[@]}" --head "$CIRCLE_BRANCH" --state open --json url --jq 'if length == 1 then .[0].url else "" end' 2>/dev/null || true)"
	fi
	if [[ -z "$resolved" && -n "${CIRCLE_SHA1:-}" && -n "$repo_slug" ]]; then
		resolved="$(run_with_timeout "$network_timeout" "$GH_BIN" api -H "Accept: application/vnd.github+json" "/repos/${repo_slug}/commits/${CIRCLE_SHA1}/pulls" --jq '[.[] | select(.state == "open") | .html_url] | if length == 1 then .[0] else "" end' 2>/dev/null || true)"
	fi
	if is_valid_pr_ref "$resolved"; then
		printf '%s' "$resolved"
	fi
}

resolve_commit_sha() {
	if [[ -n "${CIRCLE_SHA1:-}" ]]; then
		printf '%s' "$CIRCLE_SHA1"
		return 0
	fi

	git rev-parse --verify HEAD 2>/dev/null || true
}

resolve_public_pr_ref() {
	local repo_slug="$1"
	local response=""
	local repo_owner="${repo_slug%%/*}"
	local head_owner="${CIRCLE_PROJECT_USERNAME:-$repo_owner}"
	local commit_sha=""
	if [[ -z "$repo_slug" ]] ||
		! command -v curl >/dev/null 2>&1 ||
		! command -v jq >/dev/null 2>&1; then
		return 0
	fi
	if [[ -n "${CIRCLE_BRANCH:-}" ]]; then
		response="$(curl -fsSL --max-time "$network_timeout" -H "Accept: application/vnd.github+json" --get \
			--data-urlencode "state=open" \
			--data-urlencode "head=${head_owner}:${CIRCLE_BRANCH}" \
			"https://api.github.com/repos/${repo_slug}/pulls" 2>/dev/null || true)"
		local branch_ref=""
		branch_ref="$(resolve_unique_pr_ref "$response")"
		if [[ -n "$branch_ref" ]]; then
			printf '%s' "$branch_ref"
			return 0
		fi
	fi

	commit_sha="$(resolve_commit_sha)"
	if [[ ! "$commit_sha" =~ ^[0-9a-fA-F]{7,64}$ ]]; then
		return 0
	fi
	response="$(curl -fsSL --max-time "$network_timeout" -H "Accept: application/vnd.github+json" \
		"https://api.github.com/repos/${repo_slug}/commits/${commit_sha}/pulls" 2>/dev/null || true)"
	resolve_unique_open_pr_ref "$response"
}

repo_slug="$(resolve_repo_slug)"

attempt=1
while [[ "$attempt" -le "$max_attempts" ]]; do
	if pr_ref="$(resolve_direct_pr_ref)" && is_valid_pr_ref "$pr_ref"; then
		printf '%s' "$pr_ref"
		exit 0
	fi

	pr_ref="$(resolve_github_pr_ref "$repo_slug")"
	if [[ -z "$pr_ref" ]]; then
		pr_ref="$(resolve_public_pr_ref "$repo_slug")"
	fi
	if [[ -n "$pr_ref" ]]; then
		printf '%s' "$pr_ref"
		exit 0
	fi

	if [[ "$attempt" -lt "$max_attempts" ]]; then
		echo "PR context not available yet for ${check_name}; retrying (${attempt}/${max_attempts})." >&2
		if [[ "$sleep_seconds" -gt 0 ]]; then
			sleep "$sleep_seconds"
		fi
	fi
	attempt=$(( attempt + 1 ))
done

echo "Error: unable to resolve pull request context for ${check_name}." >&2
echo "This can happen on branch-only pipelines or immediately after PR creation before CircleCI/GitHub PR metadata is visible." >&2
exit 1
