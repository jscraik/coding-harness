#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ "${BASH_VERSINFO[0]:-0}" -lt 4 && -z "${CHECK_RELATED_TESTS_REEXECED:-}" ]]; then
	if [[ -x "/opt/homebrew/bin/bash" ]]; then
		export CHECK_RELATED_TESTS_REEXECED=1
		exec "/opt/homebrew/bin/bash" "$0" "$@"
	fi
fi

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

Runs tests related to changed production src/** files.
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
related_tests=()
TEST_KINDS=(test spec)
TEST_EXTENSIONS=(ts tsx js jsx mts cts)

has_related_source() {
	local candidate="$1"
	local existing
	if [[ ${#related_sources[@]} -eq 0 ]]; then
		return 1
	fi
	for existing in "${related_sources[@]}"; do
		if [[ "$existing" == "$candidate" ]]; then
			return 0
		fi
	done
	return 1
}

has_related_test() {
	local candidate="$1"
	local existing
	if [[ ${#related_tests[@]} -eq 0 ]]; then
		return 1
	fi
	for existing in "${related_tests[@]}"; do
		if [[ "$existing" == "$candidate" ]]; then
			return 0
		fi
	done
	return 1
}

collect_path() {
	local path="$1"
	[[ -n "$path" ]] || return 0
	if [[ "$path" =~ ^src/.*\.(ts|tsx|js|jsx|mts|cts)$ ]] && \
		[[ ! "$path" =~ \.d\.ts$ ]] && \
		[[ ! "$path" =~ \.(test|spec)\.(ts|tsx|js|jsx|mts|cts)$ ]] && \
		[[ -f "$path" ]] && \
		! has_related_source "$path"; then
		related_sources+=("$path")
	fi
}

collect_test_path() {
	local path="$1"
	[[ -n "$path" ]] || return 0
	if [[ "$path" =~ ^src/.*\.(test|spec)\.(ts|tsx|js|jsx|mts|cts)$ ]] && \
		[[ -f "$path" ]] && \
		! has_related_test "$path"; then
		related_tests+=("$path")
	fi
}

collect_candidate_tests() {
	local source="$1"
	local dirname_source basename_source stem candidate import_path import_term kind ext matches rg_status
	local rg_globs=()
	local import_terms=()

	dirname_source="$(dirname -- "$source")"
	basename_source="$(basename -- "$source")"
	stem="${basename_source%.*}"

	for kind in "${TEST_KINDS[@]}"; do
		for ext in "${TEST_EXTENSIONS[@]}"; do
			collect_test_path "$dirname_source/$stem.$kind.$ext"
		done
	done

	case "$stem" in
		*-core)
			for kind in "${TEST_KINDS[@]}"; do
				for ext in "${TEST_EXTENSIONS[@]}"; do
					collect_test_path "$dirname_source/${stem%-core}.$kind.$ext"
				done
			done
			;;
	esac

	for kind in "${TEST_KINDS[@]}"; do
		for ext in "${TEST_EXTENSIONS[@]}"; do
			rg_globs+=(--glob "*.$kind.$ext")
		done
	done

	import_path="${source#src/}"
	import_path="${import_path%.*}.js"
	for import_term in "./${stem}.js"; do
		set +e
		matches="$(rg -l --fixed-strings "$import_term" "$dirname_source" "${rg_globs[@]}" 2>&1)"
		rg_status=$?
		set -e
		if [[ "$rg_status" -ne 0 && "$rg_status" -ne 1 ]]; then
			echo "[check-related-tests] rg failed while discovering tests for $source:" >&2
			printf '%s\n' "$matches" >&2
			exit "$rg_status"
		fi
		while IFS= read -r candidate; do
			collect_test_path "$candidate"
		done <<< "$matches"
	done
	while [[ "$import_path" == */* ]]; do
		import_terms+=("$import_path")
		import_path="${import_path#*/}"
	done

	for import_term in "${import_terms[@]}"; do
		set +e
		matches="$(rg -l --fixed-strings "$import_term" src "${rg_globs[@]}" 2>&1)"
		rg_status=$?
		set -e
		if [[ "$rg_status" -ne 0 && "$rg_status" -ne 1 ]]; then
			echo "[check-related-tests] rg failed while discovering tests for $source:" >&2
			printf '%s\n' "$matches" >&2
			exit "$rg_status"
		fi
		while IFS= read -r candidate; do
			collect_test_path "$candidate"
		done <<< "$matches"
	done
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

for source in "${related_sources[@]}"; do
	collect_candidate_tests "$source"
done

echo "[check-related-tests] changed implementation files:"
printf '  %s\n' "${related_sources[@]}"

if [[ ${#related_tests[@]} -eq 0 ]]; then
	echo "[check-related-tests] no related test files found for changed implementation files" >&2
	exit 1
fi

echo "[check-related-tests] running related test files:"
printf '  %s\n' "${related_tests[@]}"

pnpm exec vitest run "${related_tests[@]}"
