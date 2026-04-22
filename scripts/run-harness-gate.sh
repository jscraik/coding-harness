#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"

if [[ $# -eq 0 ]]; then
	echo "Usage: bash scripts/run-harness-gate.sh <harness-subcommand> [args...]" >&2
	exit 2
fi

is_harness_source_repo() {
	[[ -f "$REPO_ROOT/src/cli.ts" ]] || return 1
	[[ -f "$REPO_ROOT/package.json" ]] || return 1
	awk '
		/"name"[[:space:]]*:[[:space:]]*"@brainwav\/coding-harness"/ {
			found = 1
			exit
		}
		END {
			exit(found ? 0 : 1)
		}
	' "$REPO_ROOT/package.json" >/dev/null
}

if is_harness_source_repo; then
	if command -v pnpm >/dev/null 2>&1; then
		tsx_available=false
		if pnpm exec -- tsx --version >/dev/null 2>&1; then
			tsx_available=true
			if pnpm exec tsx "$REPO_ROOT/src/cli.ts" "$@"; then
				exit 0
			fi
			echo "Warning: pnpm tsx runner failed; falling back to alternate harness runners." >&2
		fi
		if [[ "$tsx_available" == false ]]; then
			echo "Warning: pnpm is installed but tsx is unavailable; falling back to alternate harness runners." >&2
		fi
	else
		echo "Warning: pnpm is unavailable; falling back to alternate harness runners." >&2
	fi
fi

if is_harness_source_repo && [[ -f "$REPO_ROOT/dist/cli.js" ]] && command -v node >/dev/null 2>&1; then
	exec node "$REPO_ROOT/dist/cli.js" "$@"
fi

if [[ -r "$REPO_ROOT/scripts/harness-cli.sh" && -f "$REPO_ROOT/node_modules/@brainwav/coding-harness/dist/cli.js" ]]; then
	exec bash "$REPO_ROOT/scripts/harness-cli.sh" "$@"
fi

if command -v mise >/dev/null 2>&1; then
	mise_harness_bin="$(mise which harness 2>/dev/null || true)"
	if [[ -n "$mise_harness_bin" && -x "$mise_harness_bin" ]]; then
		exec "$mise_harness_bin" "$@"
	fi
fi

if command -v harness >/dev/null 2>&1; then
	exec harness "$@"
fi

echo "Error: unable to resolve a harness runner for this repository." >&2
echo "Install dependencies with:" >&2
echo "  pnpm install" >&2
echo "or run with a local harness install via:" >&2
echo "  pnpm exec harness <command>" >&2
exit 1
