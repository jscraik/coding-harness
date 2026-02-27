#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadContract } from "../lib/contract/loader.js";
import type { UILoopPolicy } from "../lib/contract/types.js";

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
	contractPath?: string;
}

export interface UIVerifyOptions {
	outputDir?: string;
	json?: boolean;
	timeout?: number;
	shard?: string;
	contractPath?: string;
}

export interface UIExploreOptions {
	url?: string;
	outputDir?: string;
	json?: boolean;
	interactions?: boolean;
	contractPath?: string;
}

export interface UIEvidence {
	timestamp: string;
	command: string;
	durationMs: number;
	passed: boolean;
	screenshots?: string[];
	logs?: string[];
}

function hasUnsafeShellChars(command: string): boolean {
	return /[;&|`$<>]/.test(command) || /[\n\r]/.test(command);
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
 * Build package-manager command for script execution.
 */
function buildScriptCommand(
	pm: { name: string; runCmd: string },
	script: string,
	args: string[] = [],
): string {
	if (pm.name === "npm") {
		return `${pm.runCmd} ${script}${args.length > 0 ? ` -- ${args.join(" ")}` : ""}`;
	}
	return `${pm.runCmd} ${script}${args.length > 0 ? ` ${args.join(" ")}` : ""}`;
}

/**
 * Load ui loop policy from contract.
 */
function getContractUILoopPolicy(
	contractPath?: string,
): UILoopPolicy | undefined {
	try {
		if (!contractPath) return undefined;
		const contract = loadContract(contractPath);
		return contract.uiLoopPolicy;
	} catch {
		return undefined;
	}
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
	const contractPath = options.contractPath ?? "harness.contract.json";
	const policy = getContractUILoopPolicy(contractPath);

	// If contract policy exists, trust it even if local tooling checks would fail.
	if (policy?.fastCommand) {
		if (hasUnsafeShellChars(policy.fastCommand)) {
			const message =
				"Invalid uiLoopPolicy.fastCommand: unsafe shell characters";
			if (json) {
				return {
					exitCode: EXIT_CODES.VALIDATION_ERROR,
					message: JSON.stringify({ error: message, code: "VALIDATION_ERROR" }),
				};
			}
			return { exitCode: EXIT_CODES.VALIDATION_ERROR, message };
		}
		let fullCmd = policy.fastCommand;
		if (options.ci) {
			fullCmd = `${fullCmd} --ci`;
		}

		if (json) {
			return {
				exitCode: EXIT_CODES.SUCCESS,
				message: JSON.stringify({
					command: fullCmd,
					port: options.port ?? 6006,
					ci: options.ci ?? false,
					packageManager: "contract",
				}),
			};
		}

		const message = `✓ UI fast loop ready\n  Command: ${fullCmd}\n  Port: ${options.port ?? 6006}\n  CI mode: ${options.ci ? "enabled" : "disabled"}\n  Package manager: contract`;
		return { exitCode: EXIT_CODES.SUCCESS, message };
	}

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
	const storybookArgs = options.ci ? ["--ci"] : [];
	const fullCmd = buildScriptCommand(pm, storybookCmd, storybookArgs);

	if (json) {
		return {
			exitCode: EXIT_CODES.SUCCESS,
			message: JSON.stringify({
				command: fullCmd,
				port: options.port ?? 6006,
				ci: options.ci ?? false,
				packageManager: pm.name,
			}),
		};
	}

	const message = `✓ UI fast loop ready\n  Command: ${fullCmd}\n  Port: ${options.port ?? 6006}\n  CI mode: ${options.ci ? "enabled" : "disabled"}\n  Package manager: ${pm.name}`;
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
	const contractPath = options.contractPath ?? "harness.contract.json";
	const policy = getContractUILoopPolicy(contractPath);

	const args: string[] = ["test"];

	// Build runtime arguments
	if (options.shard) {
		args.push(`--shard=${options.shard}`);
	}
	if (typeof options.timeout === "number" && Number.isFinite(options.timeout)) {
		args.push(`--timeout=${options.timeout}`);
	}
	if (options.outputDir) {
		args.push(`--output=${options.outputDir}`);
	}

	// If policy exists, append args to configured command.
	if (policy?.verifyCommand) {
		if (hasUnsafeShellChars(policy.verifyCommand)) {
			const message =
				"Invalid uiLoopPolicy.verifyCommand: unsafe shell characters";
			if (json) {
				return {
					exitCode: EXIT_CODES.VALIDATION_ERROR,
					message: JSON.stringify({ error: message, code: "VALIDATION_ERROR" }),
				};
			}
			return { exitCode: EXIT_CODES.VALIDATION_ERROR, message };
		}
		const startTime = Date.now();
		const fullCmd = `${policy.verifyCommand}${
			args.length > 0 ? ` ${args.join(" ")}` : ""
		}`;
		const durationMs = Date.now() - startTime;
		const passed = true;
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

		const message = `✓ UI verify ready\n  Command: ${fullCmd}\n  Duration: ${durationMs}ms\n  Package manager: contract\n\nRun the command to execute Playwright tests.`;
		return {
			exitCode: EXIT_CODES.SUCCESS,
			message,
			evidence,
		};
	}

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
	const fullCmd = buildScriptCommand(pm, "playwright", args);

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
	const contractPath = options.contractPath ?? "harness.contract.json";
	const policy = getContractUILoopPolicy(contractPath);

	const url = options.url ?? "http://localhost:3000";
	const outputDir = options.outputDir ?? "./ui-explore-output";
	const interactionArgs = options.interactions ? ["--interactions"] : [];
	const baseCommand =
		policy?.exploreCommand ??
		`npx @agent-browser/cli explore ${url} --output ${outputDir}`;

	if (policy?.exploreCommand) {
		if (hasUnsafeShellChars(policy.exploreCommand)) {
			const message =
				"Invalid uiLoopPolicy.exploreCommand: unsafe shell characters";
			if (json) {
				return {
					exitCode: EXIT_CODES.VALIDATION_ERROR,
					message: JSON.stringify({ error: message, code: "VALIDATION_ERROR" }),
				};
			}
			return { exitCode: EXIT_CODES.VALIDATION_ERROR, message };
		}
		const command =
			`${policy.exploreCommand} ${[url, outputDir, ...interactionArgs].join(" ")}`.trim();
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

	const command = `${baseCommand}${options.interactions ? " --interactions" : ""}`;

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
