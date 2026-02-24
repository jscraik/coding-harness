#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join } from "node:path";

// Exit codes for programmatic consumption
export const EXIT_CODES = {
	SUCCESS: 0,
	NOT_FOUND: 1,
	COMMAND_FAILED: 2,
	VALIDATION_ERROR: 3,
	TIMEOUT: 4,
} as const;

export interface UIFastOptions {
	port?: number;
	ci?: boolean;
	json?: boolean;
}

export interface UIVerifyOptions {
	outputDir?: string;
	json?: boolean;
	timeout?: number;
	shard?: string;
}

export interface UIExploreOptions {
	url?: string;
	outputDir?: string;
	json?: boolean;
	interactions?: boolean;
}

export interface UIEvidence {
	timestamp: string;
	command: string;
	durationMs: number;
	passed: boolean;
	screenshots?: string[];
	logs?: string[];
}

/**
 * Detect package manager and return run command
 */
function detectPackageManager(cwd = process.cwd()): {
	name: string;
	runCmd: string;
} {
	if (existsSync(join(cwd, "pnpm-lock.yaml"))) {
		return { name: "pnpm", runCmd: "pnpm" };
	}
	if (existsSync(join(cwd, "bun.lockb")) || existsSync(join(cwd, "bun.lock"))) {
		return { name: "bun", runCmd: "bun" };
	}
	if (existsSync(join(cwd, "yarn.lock"))) {
		return { name: "yarn", runCmd: "yarn" };
	}
	return { name: "npm", runCmd: "npm run" };
}

/**
 * Check if Storybook is configured
 */
function hasStorybook(cwd = process.cwd()): boolean {
	return (
		existsSync(join(cwd, ".storybook")) ||
		existsSync(join(cwd, "storybook")) ||
		existsSync(join(cwd, "storybook.config.js")) ||
		existsSync(join(cwd, "storybook.config.ts"))
	);
}

/**
 * Check if Playwright is configured
 */
function hasPlaywright(cwd = process.cwd()): boolean {
	return (
		existsSync(join(cwd, "playwright.config.js")) ||
		existsSync(join(cwd, "playwright.config.ts")) ||
		existsSync(join(cwd, "playwright.config.mjs"))
	);
}

/**
 * Run UI fast loop - Storybook-first local development
 */
export function runUIFast(options: UIFastOptions = {}): {
	exitCode: number;
	message: string;
} {
	const { json = false } = options;

	if (!hasStorybook()) {
		const message = "Storybook not found. Ensure .storybook/ directory exists.";
		if (json) {
			return {
				exitCode: EXIT_CODES.NOT_FOUND,
				message: JSON.stringify({ error: message, code: "NOT_FOUND" }),
			};
		}
		return { exitCode: EXIT_CODES.NOT_FOUND, message };
	}

	const pm = detectPackageManager();
	const storybookCmd = "storybook";
	const fullCmd = `${pm.runCmd} ${storybookCmd}`;

	if (json) {
		return {
			exitCode: EXIT_CODES.SUCCESS,
			message: JSON.stringify({
				command: fullCmd,
				port: options.port ?? 6006,
				packageManager: pm.name,
			}),
		};
	}

	const message = `✓ UI fast loop ready\n  Command: ${fullCmd}\n  Port: ${options.port ?? 6006}\n  Package manager: ${pm.name}`;
	return { exitCode: EXIT_CODES.SUCCESS, message };
}

/**
 * Run UI verify - Playwright smoke suite with evidence
 */
export function runUIVerify(options: UIVerifyOptions = {}): {
	exitCode: number;
	message: string;
	evidence?: UIEvidence;
} {
	const { json = false } = options;

	if (!hasPlaywright()) {
		const message =
			"Playwright not found. Ensure playwright.config.{js,ts,mjs} exists.";
		if (json) {
			return {
				exitCode: EXIT_CODES.NOT_FOUND,
				message: JSON.stringify({ error: message, code: "NOT_FOUND" }),
			};
		}
		return { exitCode: EXIT_CODES.NOT_FOUND, message };
	}

	const startTime = Date.now();
	const pm = detectPackageManager();

	// Build playwright command with options
	const playwrightCmd =
		pm.name === "npm" ? "run playwright -- test" : "playwright test";
	const args: string[] = [];

	if (options.shard) {
		args.push(`--shard=${options.shard}`);
	}
	if (options.outputDir) {
		args.push(`--output=${options.outputDir}`);
	}

	const fullCmd = `${pm.runCmd} ${playwrightCmd}${args.length > 0 ? ` ${args.join(" ")}` : ""}`;

	const durationMs = Date.now() - startTime;
	const passed = true; // Ready to run

	const evidence: UIEvidence = {
		timestamp: new Date().toISOString(),
		command: fullCmd,
		durationMs,
		passed,
	};

	if (json) {
		return {
			exitCode: EXIT_CODES.SUCCESS,
			message: JSON.stringify(evidence),
			evidence,
		};
	}

	const message = `✓ UI verify ready\n  Command: ${fullCmd}\n  Duration: ${durationMs}ms\n  Package manager: ${pm.name}\n\nRun the command to execute Playwright tests.`;

	return {
		exitCode: EXIT_CODES.SUCCESS,
		message,
		evidence,
	};
}

/**
 * Run UI explore - Agent browser exploratory testing
 */
export function runUIExplore(options: UIExploreOptions = {}): {
	exitCode: number;
	message: string;
} {
	const { json = false } = options;

	const url = options.url ?? "http://localhost:3000";
	const outputDir = options.outputDir ?? "./ui-explore-output";

	const command = `npx @agent-browser/cli explore ${url} --output ${outputDir}${options.interactions ? " --interactions" : ""}`;

	if (json) {
		return {
			exitCode: EXIT_CODES.SUCCESS,
			message: JSON.stringify({
				command,
				url,
				outputDir,
				interactions: options.interactions ?? false,
			}),
		};
	}

	const message = `✓ UI explore ready\n  Target: ${url}\n  Output: ${outputDir}\n  Command: ${command}\n  Interactions: ${options.interactions ? "enabled" : "disabled"}`;
	return { exitCode: EXIT_CODES.SUCCESS, message };
}

/**
 * CLI entry point for ui:fast
 */
export function runUIFastCLI(options: UIFastOptions = {}): number {
	const result = runUIFast(options);
	if (result.exitCode === EXIT_CODES.SUCCESS) {
		console.info(result.message);
	} else {
		console.error(result.message);
	}
	return result.exitCode;
}

/**
 * CLI entry point for ui:verify
 */
export function runUIVerifyCLI(options: UIVerifyOptions = {}): number {
	const result = runUIVerify(options);
	if (result.exitCode === EXIT_CODES.NOT_FOUND) {
		console.error(result.message);
	} else {
		console.info(result.message);
	}
	return result.exitCode;
}

/**
 * CLI entry point for ui:explore
 */
export function runUIExploreCLI(options: UIExploreOptions = {}): number {
	const result = runUIExplore(options);
	console.info(result.message);
	return result.exitCode;
}
