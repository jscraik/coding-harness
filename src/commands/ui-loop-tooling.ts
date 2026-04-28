import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Detect package manager and return run command.
 */
export function detectPackageManager(cwd = process.cwd()): {
	name: string;
	command: string;
} {
	const packageJsonPath = join(cwd, "package.json");
	if (existsSync(packageJsonPath)) {
		try {
			const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
				packageManager?: string;
			};
			if (pkg.packageManager?.startsWith("pnpm@")) {
				return { name: "pnpm", command: "pnpm" };
			}
			if (pkg.packageManager?.startsWith("bun@")) {
				return { name: "bun", command: "bun" };
			}
			if (pkg.packageManager?.startsWith("yarn@")) {
				return { name: "yarn", command: "yarn" };
			}
			if (pkg.packageManager?.startsWith("npm@")) {
				return { name: "npm", command: "npm" };
			}
		} catch {
			// Fall through to lockfile detection.
		}
	}
	if (existsSync(join(cwd, "pnpm-lock.yaml"))) {
		return { name: "pnpm", command: "pnpm" };
	}
	if (existsSync(join(cwd, "bun.lockb")) || existsSync(join(cwd, "bun.lock"))) {
		return { name: "bun", command: "bun" };
	}
	if (existsSync(join(cwd, "yarn.lock"))) {
		return { name: "yarn", command: "yarn" };
	}
	return { name: "npm", command: "npm" };
}

/**
 * Build package-manager command for script execution.
 */
export function buildScriptCommand(
	pm: { name: string; command: string },
	script: string,
	args: string[] = [],
): { command: string; args: string[] } {
	if (pm.name === "npm") {
		return {
			command: pm.command,
			args: ["run", script, ...(args.length > 0 ? ["--", ...args] : [])],
		};
	}
	return {
		command: pm.command,
		args: [script, ...args],
	};
}

/**
 * Check if Storybook is configured.
 */
export function hasStorybook(cwd = process.cwd()): boolean {
	return (
		existsSync(join(cwd, ".storybook")) ||
		existsSync(join(cwd, "storybook")) ||
		existsSync(join(cwd, "storybook.config.js")) ||
		existsSync(join(cwd, "storybook.config.ts"))
	);
}

/**
 * Check if Playwright is configured.
 */
export function hasPlaywright(cwd = process.cwd()): boolean {
	return (
		existsSync(join(cwd, "playwright.config.js")) ||
		existsSync(join(cwd, "playwright.config.ts")) ||
		existsSync(join(cwd, "playwright.config.mjs")) ||
		existsSync(join(cwd, "playwright.config.cjs"))
	);
}
