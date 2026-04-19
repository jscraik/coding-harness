#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"

if [[ $# -eq 0 ]]; then
	echo "Usage: bash scripts/run-harness-gate.sh <harness-subcommand> [args...]" >&2
	exit 2
fi

if [[ -f "$REPO_ROOT/src/cli.ts" ]]; then
	if ! command -v pnpm >/dev/null 2>&1; then
		echo "Error: pnpm is required to run the repo-local harness CLI." >&2
		echo "Install pnpm and retry." >&2
		exit 1
	fi
	exec pnpm exec tsx "$REPO_ROOT/src/cli.ts" "$@"
fi

if [[ -x "$REPO_ROOT/scripts/harness-cli.sh" ]]; then
	exec bash "$REPO_ROOT/scripts/harness-cli.sh" "$@"
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
