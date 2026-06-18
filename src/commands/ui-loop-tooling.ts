import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type PackageManager = {
	name: string;
	command: string;
};

const PACKAGE_MANAGER_PREFIXES: PackageManager[] = [
	{ name: "pnpm", command: "pnpm" },
	{ name: "bun", command: "bun" },
	{ name: "yarn", command: "yarn" },
	{ name: "npm", command: "npm" },
];

const LOCKFILE_PACKAGE_MANAGERS: Array<{
	paths: string[];
	packageManager: PackageManager;
}> = [
	{
		paths: ["pnpm-lock.yaml"],
		packageManager: { name: "pnpm", command: "pnpm" },
	},
	{
		paths: ["bun.lockb", "bun.lock"],
		packageManager: { name: "bun", command: "bun" },
	},
	{ paths: ["yarn.lock"], packageManager: { name: "yarn", command: "yarn" } },
];

function packageManagerFromPackageJson(
	cwd: string,
): PackageManager | undefined {
	const packageJsonPath = join(cwd, "package.json");
	if (!existsSync(packageJsonPath)) {
		return undefined;
	}
	try {
		const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
			packageManager?: string;
		};
		return PACKAGE_MANAGER_PREFIXES.find((pm) =>
			pkg.packageManager?.startsWith(`${pm.name}@`),
		);
	} catch {
		return undefined;
	}
}

function packageManagerFromLockfile(cwd: string): PackageManager | undefined {
	return LOCKFILE_PACKAGE_MANAGERS.find((entry) =>
		entry.paths.some((path) => existsSync(join(cwd, path))),
	)?.packageManager;
}

/**
 * Detect package manager and return run command.
 */
export function detectPackageManager(cwd = process.cwd()): PackageManager {
	const configured = packageManagerFromPackageJson(cwd);
	if (configured) {
		return configured;
	}
	const detected = packageManagerFromLockfile(cwd);
	if (detected) {
		return detected;
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
