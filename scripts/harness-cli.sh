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

resolve_package_spec() {
	if [[ ! -f "$REPO_ROOT/package.json" ]]; then
		printf '%s\n' "$PACKAGE_SPEC"
		return 0
	fi
	node -e '
		const { readFileSync } = require("node:fs");
		const packageName = process.argv[2];
		const fallback = process.argv[3];
		const packageJson = JSON.parse(readFileSync(process.argv[1], "utf8"));
		const version =
			packageJson.dependencies?.[packageName] ??
			packageJson.devDependencies?.[packageName] ??
			packageJson.optionalDependencies?.[packageName];
		if (typeof version !== "string") {
			console.log(fallback);
		} else if (/^(file:|link:|workspace:|portal:|git:|git\+)/.test(version)) {
			console.log(fallback);
		} else {
			console.log(packageName + "@" + version.replace(/^[~^]/, ""));
		}
	' "$REPO_ROOT/package.json" "$PACKAGE_NAME" "$PACKAGE_SPEC"
}

run_npm_fallback() {
	if [[ "${HARNESS_CLI_ALLOW_NPM_EXEC:-}" != "1" ]]; then
		return 1
	fi
	if ! command -v npm >/dev/null 2>&1; then
		echo "Error: npm is required for HARNESS_CLI_ALLOW_NPM_EXEC=1 but is not on PATH." >&2
		exit 1
	fi
	exec npm exec --yes --registry="$NPM_REGISTRY" --package "$(resolve_package_spec)" -- harness "$@"
}

if is_harness_source_repo; then
	if (cd "$REPO_ROOT" && node --import tsx --eval "" >/dev/null 2>&1); then
		cd "$REPO_ROOT"
		exec node --import tsx src/cli.ts "$@"
	fi
	if [[ -f "$REPO_ROOT/dist/cli.js" ]]; then
		exec node "$REPO_ROOT/dist/cli.js" "$@"
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
		run_npm_fallback "$@" || true
		echo "Error: local @brainwav/coding-harness could not be resolved because this is not a local npm package root." >&2
		echo "Detected repo root: $REPO_ROOT" >&2
		echo "Create or restore package.json before relying on node_modules, or run from the intended project root." >&2
		echo "To allow the public npm fallback, rerun with:" >&2
		echo "  HARNESS_CLI_ALLOW_NPM_EXEC=1 bash scripts/harness-cli.sh <command>" >&2
		exit 1
	fi

	run_npm_fallback "$@" || true

	echo "Error: local $PACKAGE_NAME could not be resolved from this repo." >&2
	echo "This is a local install/bootstrap problem, not a harness command failure." >&2
	echo "Public npm fallback is disabled by default so repo checks do not silently download tooling." >&2
	echo "Repair from the repo root with one of:" >&2
	echo "  pnpm install" >&2
	echo "  pnpm add -D $PACKAGE_NAME" >&2
	echo "After the package is installed, rerun:" >&2
	echo "  bash scripts/harness-cli.sh <command>" >&2
	echo "  pnpm exec harness <command>" >&2
	echo "To use the public npm fallback, set HARNESS_CLI_ALLOW_NPM_EXEC=1; no npm registry credential is required." >&2
	exit 1
fi

exec node "$CLI_PATH" "$@"
