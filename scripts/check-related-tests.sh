#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

mode_staged=0
while (( $# > 0 )); do
	case "$1" in
		--staged)
			mode_staged=1
			shift
			;;
		-h|--help)
			cat <<'USAGE'
Usage: scripts/check-related-tests.sh [--staged]

Runs Vitest related mode for changed production src/** files.
By default this includes staged changes, unstaged changes, and the branch diff
against origin/main or main. Use --staged from commit hooks to restrict the
gate to staged implementation files.
USAGE
			exit 0
			;;
		*)
			echo "[check-related-tests] unknown argument: $1" >&2
			exit 2
			;;
	esac
done

related_sources=()
declare -A seen=()

collect_path() {
	local path="$1"
	[[ -n "$path" ]] || return 0
	if [[ "$path" =~ ^src/.*\.(ts|tsx|js|jsx|mts|cts)$ ]] && \
		[[ ! "$path" =~ \.d\.ts$ ]] && \
		[[ ! "$path" =~ \.(test|spec)\.(ts|tsx|js|jsx|mts|cts)$ ]] && \
		[[ -f "$path" ]] && \
		[[ -z "${seen[$path]:-}" ]]; then
		seen["$path"]=1
		related_sources+=("$path")
	fi
}

while IFS= read -r path; do
	collect_path "$path"
done < <(git diff --cached --name-only --diff-filter=ACMR)

if [[ "$mode_staged" -eq 0 ]]; then
	while IFS= read -r path; do
		collect_path "$path"
	done < <(git diff --name-only --diff-filter=ACMR)

	base_ref="$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null || true)"
	if [[ -n "$base_ref" ]]; then
		while IFS= read -r path; do
			collect_path "$path"
		done < <(git diff --name-only --diff-filter=ACMR "$base_ref"...HEAD)
	fi
fi

if [[ ${#related_sources[@]} -eq 0 ]]; then
	echo "No changed src/** implementation files detected for related tests."
	exit 0
fi

pnpm exec vitest related --run "${related_sources[@]}"
