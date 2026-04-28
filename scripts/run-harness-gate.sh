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
	command -v node >/dev/null 2>&1 || return 1

	node -e '
		const { readFileSync } = require("node:fs");
		const packageJson = JSON.parse(readFileSync(process.argv[1], "utf8"));
		process.exit(packageJson.name === "@brainwav/coding-harness" ? 0 : 1);
	' "$REPO_ROOT/package.json" >/dev/null 2>&1
}

if is_harness_source_repo; then
	if ! command -v pnpm >/dev/null 2>&1; then
		echo "Error: source checkout detected but pnpm is unavailable; refusing fallback to avoid stale harness binaries." >&2
		exit 1
	fi
	if ! pnpm --dir "$REPO_ROOT" exec -- tsx --version >/dev/null 2>&1; then
		echo "Error: source checkout detected but tsx is unavailable via pnpm exec; refusing fallback to avoid stale harness binaries." >&2
		exit 1
	fi
	tsx_stderr_file="$(mktemp "${TMPDIR:-/tmp}/harness-gate-tsx-stderr.XXXXXX")"
	tsx_exit=0
	if pnpm --dir "$REPO_ROOT" exec tsx "$REPO_ROOT/src/cli.ts" "$@" 2>"$tsx_stderr_file"; then
		rm -f "$tsx_stderr_file"
		exit 0
	else
		tsx_exit=$?
	fi
	if [[ -f "$REPO_ROOT/dist/cli.js" ]] && command -v node >/dev/null 2>&1; then
		if rg -q 'listen EPERM: operation not permitted.*(/tmp/tsx-|\.pipe)' "$tsx_stderr_file"; then
			echo "Warning: tsx IPC startup failed with EPERM; falling back to node dist/cli.js." >&2
			rm -f "$tsx_stderr_file"
			exec node "$REPO_ROOT/dist/cli.js" "$@"
		fi
	fi
	cat "$tsx_stderr_file" >&2
	rm -f "$tsx_stderr_file"
	exit "$tsx_exit"
fi

if [[ -f "$REPO_ROOT/dist/cli.js" ]] && command -v node >/dev/null 2>&1; then
	exec node "$REPO_ROOT/dist/cli.js" "$@"
fi

if [[ -f "$REPO_ROOT/scripts/harness-cli.sh" && -r "$REPO_ROOT/scripts/harness-cli.sh" ]]; then
	wrapper_exit=0
	bash "$REPO_ROOT/scripts/harness-cli.sh" "$@" || wrapper_exit=$?
	if [[ "$wrapper_exit" -eq 0 ]]; then
		exit 0
	fi
	if [[ "$wrapper_exit" -eq 126 || "$wrapper_exit" -eq 127 ]]; then
		echo "Warning: scripts/harness-cli.sh unavailable (exit $wrapper_exit); attempting fallback runners." >&2
	else
		exit "$wrapper_exit"
	fi
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
