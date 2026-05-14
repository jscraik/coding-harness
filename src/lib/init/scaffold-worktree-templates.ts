/**
 * Worktree helper script renderers used by the init scaffold.
 *
 * This module owns the task/worktree shell helpers so `scaffold.ts` can keep
 * its template inventory separate from long generated script bodies.
 *
 * @module lib/init/scaffold-worktree-templates
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderInstallCommand } from "./scaffold-shell-templates.js";

/**
 * Read a text file from the repository and return its contents.
 *
 * @param relativePath - Path to the file relative to the repository root (for example `"scripts/prepare-worktree.sh"`)
 * @returns The file contents decoded as UTF-8
 */
function readRepoScript(relativePath: string): string {
	const scriptPath = fileURLToPath(
		new URL(`../../../${relativePath}`, import.meta.url),
	);
	return readFileSync(scriptPath, "utf-8");
}

/**
 * Generate a bash script that prepares a git worktree for local hooks and checks.
 *
 * @param packageManager - Package manager executable name.
 * @returns The complete `scripts/prepare-worktree.sh` contents.
 */
export function renderPrepareWorktreeScript(packageManager: string): string {
	const installCommand = renderInstallCommand(packageManager);
	return readRepoScript("scripts/prepare-worktree.sh")
		.replace("Run pnpm install even if", `Run ${installCommand} even if`)
		.replace(
			"pnpm is required but not on PATH",
			`${packageManager} is required but not on PATH`,
		)
		.replace("command -v pnpm", `command -v ${packageManager}`)
		.replace(
			"installing dependencies (pnpm install)",
			`installing dependencies (${installCommand})`,
		)
		.replace("\tpnpm install\n", `\t${installCommand}\n`);
}

/**
 * Return the `new-task` bash script with its default branch prefix customized.
 *
 * The returned script is sourced from the repository template and has the default
 * branch prefix and its prompt adjusted to `jscraik/feature`.
 *
 * @returns The complete `scripts/new-task.sh` contents with the default branch prefix set to `jscraik/feature`.
 */
export function renderNewTaskScript(): string {
	return readRepoScript("scripts/new-task.sh")
		.replace(
			"Branch prefix (default: codex)",
			"Branch prefix (default: jscraik/feature)",
		)
		.replace('branch_prefix="codex"', 'branch_prefix="jscraik/feature"');
}
