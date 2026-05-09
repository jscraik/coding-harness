#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
MODE_STAGED=0
BASE_REF=""

while (( $# > 0 )); do
	case "$1" in
		--repo-root)
			REPO_ROOT="$2"
			shift 2
			;;
		--staged)
			MODE_STAGED=1
			shift
			;;
		--base)
			BASE_REF="$2"
			shift 2
			;;
		-h|--help)
			cat <<'USAGE'
Usage: scripts/check-test-masking.sh [--repo-root PATH] [--staged] [--base REF]

Fails when a diff adds test-masking constructs such as .skip, .only, .todo, or
dangerouslyIgnoreUnhandledErrors. Failing behavior should be fixed or the test
assertion should be upgraded; it should not be hidden from the validation lane.
USAGE
			exit 0
			;;
		*)
			echo "[check-test-masking] unknown argument: $1" >&2
			exit 2
			;;
	esac
done

cd "$REPO_ROOT"

TEST_PATHS=(
	"*.test.ts"
	"*.test.tsx"
	"*.spec.ts"
	"*.spec.tsx"
	"test/**"
	"tests/**"
	"e2e/**"
)

scan_diff() {
	local label="$1"
	shift

	git diff --unified=0 --diff-filter=ACMR "$@" -- "${TEST_PATHS[@]}" | \
	awk -v label="$label" '
		BEGIN {
			found = 0
			pattern = "(^|[^[:alnum:]_$])(describe|it|test)\\.(skip|only|todo)([[:space:]]*\\(|\\.each([^[:alnum:]_$]|$))|dangerouslyIgnoreUnhandledErrors"
		}
		/^\+\+\+ b\// {
			file = substr($0, 7)
			next
		}
		/^@@ / {
			if (match($0, /\+([0-9]+)/)) {
				line = substr($0, RSTART + 1, RLENGTH - 1) + 0
			}
			next
		}
		/^\+/ && !/^\+\+\+/ {
			content = substr($0, 2)
			if (content ~ pattern) {
				printf "%s:%s:%d:%s\n", label, file, line, content
				found = 1
			}
			line++
			next
		}
		!/^\-/ {
			line++
		}
		END {
			exit found ? 1 : 0
		}
	'
}

violations=()
collect_violations() {
	local output status
	set +e
	output="$(scan_diff "$@" 2>/dev/null)"
	status=$?
	set -e
	if [[ "$status" -eq 1 && -n "$output" ]]; then
		while IFS= read -r line; do
			violations+=("$line")
		done <<< "$output"
	elif [[ "$status" -gt 1 ]]; then
		echo "[check-test-masking] failed to scan diff: $*" >&2
		exit "$status"
	fi
}

collect_violations "staged" --cached

if [[ "$MODE_STAGED" -eq 0 ]]; then
	collect_violations "unstaged"

	if [[ -n "$BASE_REF" ]]; then
		collect_violations "branch" "$BASE_REF"...HEAD
	fi
fi

if [[ "${#violations[@]}" -gt 0 ]]; then
	cat >&2 <<'MSG'
[check-test-masking] blocked added test-masking constructs.

Failing tests must be upgraded or the implementation must be fixed; do not
hide regressions with .skip, .only, .todo, or dangerouslyIgnoreUnhandledErrors.

Findings:
MSG
	printf '  %s\n' "${violations[@]}" >&2
	exit 1
fi

echo "No added test-masking constructs detected."
