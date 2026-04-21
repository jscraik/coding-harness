#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"

if [[ $# -eq 0 ]]; then
	echo "Usage: bash scripts/run-harness-gate.sh <harness-subcommand> [args...]" >&2
	exit 2
fi

if [[ -f "$REPO_ROOT/src/cli.ts" ]]; then
	if command -v pnpm >/dev/null 2>&1; then
		exec pnpm exec tsx "$REPO_ROOT/src/cli.ts" "$@"
	else
		echo "Warning: pnpm not found; skipping repo-local harness CLI at $REPO_ROOT/src/cli.ts" >&2
	fi
fi

if [[ -x "$REPO_ROOT/scripts/harness-cli.sh" ]]; then
	exec bash "$REPO_ROOT/scripts/harness-cli.sh" "$@"
fi

if command -v mise >/dev/null 2>&1; then
	MISE_RESOLVED="$(mise which harness 2>/dev/null || true)"
	if [[ -n "$MISE_RESOLVED" && -x "$MISE_RESOLVED" ]]; then
		exec "$MISE_RESOLVED" "$@"
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