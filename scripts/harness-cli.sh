#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"

if ! command -v node >/dev/null 2>&1; then
	echo "Error: node is required to run scripts/harness-cli.sh." >&2
	echo "Install Node.js and retry." >&2
	exit 1
fi

is_harness_source_repo() {
	[[ -f "$REPO_ROOT/src/cli.ts" ]] || return 1
	[[ -f "$REPO_ROOT/package.json" ]] || return 1

	node -e '
		const { readFileSync } = require("node:fs");
		const packageJson = JSON.parse(readFileSync(process.argv[1], "utf8"));
		process.exit(packageJson.name === "@brainwav/coding-harness" ? 0 : 1);
	' "$REPO_ROOT/package.json" >/dev/null 2>&1
}

if is_harness_source_repo; then
	if [[ -f "$REPO_ROOT/dist/cli.js" ]]; then
		exec node "$REPO_ROOT/dist/cli.js" "$@"
	fi
	if command -v pnpm >/dev/null 2>&1; then
		exec pnpm --dir "$REPO_ROOT" exec tsx "$REPO_ROOT/src/cli.ts" "$@"
	fi
	echo "Error: coding-harness source checkout detected but no local runner is available." >&2
	echo "Build the repo or install dependencies, then rerun:" >&2
	echo "  pnpm install" >&2
	echo "  pnpm build" >&2
	exit 1
fi

CLI_PATH="$REPO_ROOT/node_modules/@brainwav/coding-harness/dist/cli.js"

if [[ ! -f "$CLI_PATH" ]]; then
	echo "Error: local @brainwav/coding-harness could not be resolved from this repo." >&2
	echo "This is a local install/bootstrap problem, not a harness command failure." >&2
	echo "Repair from the repo root with one of:" >&2
	echo "  pnpm install" >&2
	echo "  pnpm add -D @brainwav/coding-harness" >&2
	echo "After the package is installed, rerun:" >&2
	echo "  bash scripts/harness-cli.sh <command>" >&2
	echo "  pnpm exec harness <command>" >&2
	exit 1
fi

exec node "$CLI_PATH" "$@"
