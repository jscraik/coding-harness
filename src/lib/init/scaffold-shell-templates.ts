/**
 * Shell script renderers used by the init scaffold.
 *
 * This module owns packaged shell templates and small package-manager-specific
 * shell runners so `scaffold.ts` can stay focused on template inventory.
 *
 * @module lib/init/scaffold-shell-templates
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function renderPackagedTemplate(relativePath: string): string {
	const templatePath = fileURLToPath(
		new URL(`../../templates/${relativePath}`, import.meta.url),
	);
	return readFileSync(templatePath, "utf-8");
}

/**
 * Builds the package-manager-specific install command used in scaffolded scripts.
 *
 * @param packageManager - Package manager executable name.
 * @returns A shell command that installs dependencies with the selected package manager.
 */
export function renderInstallCommand(packageManager: string): string {
	return `${packageManager} install`;
}

/**
 * Builds the package-manager-specific command that adds a development package.
 *
 * @param packageManager - Package manager executable name.
 * @param packageName - Package name to install as a development dependency.
 * @returns A shell command that adds the requested package.
 */
export function renderAddPackageCommand(
	packageManager: string,
	packageName: string,
): string {
	if (packageManager === "npm") {
		return `npm install --save-dev ${packageName}`;
	}
	if (packageManager === "yarn") {
		return `yarn add --dev ${packageName}`;
	}
	return `${packageManager} add -D ${packageName}`;
}

/**
 * Builds the package-manager-specific command for invoking the local harness binary.
 *
 * @param packageManager - Package manager executable name.
 * @returns The shell command form for executing `harness` locally.
 */
export function renderLocalHarnessExecCommand(packageManager: string): string {
	if (packageManager === "npm") {
		return "npm exec harness --";
	}
	if (packageManager === "yarn") {
		return "yarn harness";
	}
	return `${packageManager} exec harness`;
}

/**
 * Load the packaged Codex preflight shell template.
 *
 * @returns The UTF-8 contents of `templates/codex-preflight.sh`.
 */
export function renderCodexPreflightTemplate(): string {
	return renderPackagedTemplate("codex-preflight.sh");
}

/**
 * Load the legacy Codex preflight shell template used for local memory workflows.
 *
 * @returns The UTF-8 contents of `templates/codex-preflight-local-memory-legacy.sh`.
 */
export function renderCodexPreflightLegacyLocalMemoryTemplate(): string {
	return renderPackagedTemplate("codex-preflight-local-memory-legacy.sh");
}

/**
 * Load the packaged Codex learn shell template.
 *
 * @returns The UTF-8 contents of `templates/codex-learn.sh`.
 */
export function renderCodexLearnTemplate(): string {
	return renderPackagedTemplate("codex-learn.sh");
}

/**
 * Load the packaged Codex enforced shell template.
 *
 * @returns The UTF-8 contents of `templates/codex-enforced.sh`.
 */
export function renderCodexEnforcedTemplate(): string {
	return renderPackagedTemplate("codex-enforced.sh");
}

/**
 * Load the packaged repository verification script.
 *
 * @param _packageManager - Ignored; kept for compatibility with scaffold render callbacks.
 * @returns The UTF-8 contents of `scripts/verify-work.sh`.
 */
export function renderVerifyWorkScript(_packageManager: string): string {
	const templatePath = fileURLToPath(
		new URL("../../../scripts/verify-work.sh", import.meta.url),
	);
	return readFileSync(templatePath, "utf-8");
}

/**
 * Generate a bash wrapper that resolves and executes the repository-local harness CLI.
 *
 * @param packageManager - Package manager executable name.
 * @returns The complete `scripts/harness-cli.sh` contents.
 */
export function renderHarnessCliWrapper(packageManager: string): string {
	const installCommand = renderInstallCommand(packageManager);
	const addCommand = renderAddPackageCommand(
		packageManager,
		"@brainwav/coding-harness",
	);
	const execCommand = renderLocalHarnessExecCommand(packageManager);
	const packageExecCommand =
		packageManager === "pnpm"
			? 'pnpm --dir "$REPO_ROOT" exec'
			: `${packageManager} exec`;

	return `#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${"${"}BASH_SOURCE[0]}")" && pwd)"
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
	if command -v ${packageManager} >/dev/null 2>&1; then
		exec ${packageExecCommand} tsx "$REPO_ROOT/src/cli.ts" "$@"
	fi
	echo "Error: coding-harness source checkout detected but no local runner is available." >&2
	echo "Build the repo or install dependencies, then rerun:" >&2
	echo "  ${installCommand}" >&2
	echo "  ${packageManager} build" >&2
	exit 1
fi

CLI_PATH="$REPO_ROOT/node_modules/@brainwav/coding-harness/dist/cli.js"

if [[ ! -f "$CLI_PATH" ]]; then
	echo "Error: local @brainwav/coding-harness could not be resolved from this repo." >&2
	echo "This is a local install/bootstrap problem, not a harness command failure." >&2
	echo "Repair from the repo root with one of:" >&2
	echo "  ${installCommand}" >&2
	echo "  ${addCommand}" >&2
	echo "After the package is installed, rerun:" >&2
	echo "  bash scripts/harness-cli.sh <command>" >&2
	echo "  ${execCommand} <command>" >&2
	exit 1
fi

exec node "$CLI_PATH" "$@"
`;
}

/**
 * Generate the bash runner that resolves and runs the repository's harness CLI.
 *
 * @param packageManager - Package manager executable name.
 * @returns The complete `scripts/run-harness-gate.sh` contents.
 */
export function renderHarnessGateRunner(packageManager: string): string {
	const installCommand = renderInstallCommand(packageManager);
	const localExecCommand = renderLocalHarnessExecCommand(packageManager);
	return `#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${"${"}BASH_SOURCE[0]}")" && pwd)"
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
	exec pnpm --dir "$REPO_ROOT" exec tsx "$REPO_ROOT/src/cli.ts" "$@"
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
echo "  ${installCommand}" >&2
echo "or run with a local harness install via:" >&2
echo "  ${localExecCommand} <command>" >&2
exit 1
`;
}
