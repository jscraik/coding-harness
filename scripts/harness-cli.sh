#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
PACKAGE_NAME="@brainwav/coding-harness"
PACKAGE_SPEC="${PACKAGE_NAME}@latest"
NPM_REGISTRY="https://registry.npmjs.org/"

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

npm_auth_is_available() {
	command -v npm >/dev/null 2>&1 || return 1
	npm whoami --registry="$NPM_REGISTRY" >/dev/null 2>&1
}

print_npm_auth_hint() {
	echo "The repo .npmrc only routes @brainwav packages to npm; it does not carry credentials." >&2
	echo "Provide npm auth in this process with NPM_TOKEN or a user-level ~/.npmrc, then retry." >&2
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
	if [[ ! -f "$REPO_ROOT/package.json" ]]; then
		echo "Error: local @brainwav/coding-harness could not be resolved because this is not a local npm package root." >&2
		echo "Detected repo root: $REPO_ROOT" >&2
		echo "Create or restore package.json before relying on node_modules, or run from the intended project root." >&2
		echo "To allow an authenticated private npm fallback instead, rerun with:" >&2
		echo "  HARNESS_CLI_ALLOW_NPM_EXEC=1 bash scripts/harness-cli.sh <command>" >&2
		exit 1
	fi

	if [[ "${HARNESS_CLI_ALLOW_NPM_EXEC:-}" == "1" ]]; then
		if ! command -v npm >/dev/null 2>&1; then
			echo "Error: npm is required for HARNESS_CLI_ALLOW_NPM_EXEC=1 but is not on PATH." >&2
			exit 1
		fi
		if ! npm_auth_is_available; then
			echo "Error: npm auth is missing in this process; cannot fetch $PACKAGE_NAME." >&2
			print_npm_auth_hint
			exit 1
		fi
		exec npm exec --yes --package "$PACKAGE_SPEC" -- harness "$@"
	fi

	echo "Error: local $PACKAGE_NAME could not be resolved from this repo." >&2
	echo "This is a local install/bootstrap problem, not a harness command failure." >&2
	echo "Private npm fallback is disabled by default so repo checks do not silently download tooling." >&2
	echo "Repair from the repo root with one of:" >&2
	echo "  pnpm install" >&2
	echo "  pnpm add -D $PACKAGE_NAME" >&2
	echo "After the package is installed, rerun:" >&2
	echo "  bash scripts/harness-cli.sh <command>" >&2
	echo "  pnpm exec harness <command>" >&2
	echo "To use the private npm fallback instead, set HARNESS_CLI_ALLOW_NPM_EXEC=1 after npm auth is available." >&2
	exit 1
fi

exec node "$CLI_PATH" "$@"
