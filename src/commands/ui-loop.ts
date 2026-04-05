#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadContract } from "../lib/contract/loader.js";
import type { UILoopPolicy } from "../lib/contract/types.js";

// Exit codes for programmatic consumption
export const EXIT_CODES = {
	SUCCESS: 0,
	NOT_FOUND: 1,
	COMMAND_FAILED: 2,
	VALIDATION_ERROR: 3,
	TIMEOUT: 4,
	EXECUTION_DISABLED: 5,
} as const;

export type UILoopMode = "execute" | "prepare";

interface UIBaseOptions {
	mode?: UILoopMode;
	dryRun?: boolean;
}

export interface UIFastOptions extends UIBaseOptions {
	port?: number;
	ci?: boolean;
	json?: boolean;
	contractPath?: string;
}

export interface UIVerifyOptions extends UIBaseOptions {
	outputDir?: string;
	json?: boolean;
	timeout?: number;
	shard?: string;
	contractPath?: string;
}

export interface UIExploreOptions extends UIBaseOptions {
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
	mode: UILoopMode;
	executed: boolean;
	exitCode: number;
	headSha: string;
	contractVersion: string;
	artifactUri: string;
	artifactChecksum: string;
	timedOut?: boolean;
	stdout?: string;
	stderr?: string;
	screenshots?: string[];
	logs?: string[];
}

interface CommandExecutionResult {
	executed: boolean;
	passed: boolean;
	exitCode: number;
	durationMs: number;
	timedOut: boolean;
	stdout?: string;
	stderr?: string;
}

interface CommandSpec {
	command: string;
	args: string[];
}

interface UILoopContractContext {
	policy: UILoopPolicy | undefined;
	contractVersion: string;
}

interface UIExecutionContext {
	headSha: string;
	contractVersion: string;
}

const EXECUTION_DISABLE_ENV = "HARNESS_UI_EXECUTION_DISABLED";
const EXECUTION_DISABLED_CODE = "execution_disabled";
const EXECUTION_DISABLED_MESSAGE =
	"UI execution backend disabled by kill switch";

function isExecutionDisabled(): boolean {
	const raw = process.env[EXECUTION_DISABLE_ENV]?.trim().toLowerCase();
	if (!raw) {
		return false;
	}
	return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function buildExecutionDisabledResult(): CommandExecutionResult {
	return {
		executed: false,
		passed: false,
		exitCode: EXIT_CODES.EXECUTION_DISABLED,
		durationMs: 0,
		timedOut: false,
		stderr: EXECUTION_DISABLED_MESSAGE,
	};
}

function hasUnsafeShellChars(command: string): boolean {
	return /[;&|`$<>]/.test(command) || /[\n\r]/.test(command);
}

function resolveMode(mode?: UILoopMode, dryRun?: boolean): UILoopMode {
	if (dryRun) {
		return "prepare";
	}
	return mode ?? "execute";
}

function buildPrepareResult(): CommandExecutionResult {
	return {
		executed: false,
		passed: true,
		exitCode: EXIT_CODES.SUCCESS,
		durationMs: 0,
		timedOut: false,
	};
}

function parseCommandSpec(
	command: string,
): { ok: true; value: CommandSpec } | { ok: false; error: string } {
	const trimmed = command.trim();
	if (trimmed.length === 0) {
		return { ok: false, error: "command must not be empty" };
	}
	if (/[\n\r\0]/.test(trimmed)) {
		return {
			ok: false,
			error: "command contains unsupported control characters",
		};
	}
	if (/["'\\]/.test(trimmed)) {
		return {
			ok: false,
			error:
				"quoted or escaped command tokens are not supported; use simple argv-safe tokens",
		};
	}
	const tokens = trimmed.split(/\s+/).filter((token) => token.length > 0);
	if (tokens.length === 0) {
		return { ok: false, error: "command must include an executable" };
	}
	return {
		ok: true,
		value: {
			command: tokens[0] ?? "",
			args: tokens.slice(1),
		},
	};
}

function formatCommandArg(arg: string): string {
	return /^[A-Za-z0-9_./:@%+=,-]+$/.test(arg) ? arg : JSON.stringify(arg);
}

function formatCommandDisplay(spec: CommandSpec): string {
	return [spec.command, ...spec.args.map(formatCommandArg)].join(" ");
}

function executeCommand(
	spec: CommandSpec,
	timeoutMs: number,
	treatTimeoutAsSuccess = false,
): CommandExecutionResult {
	const startedAt = Date.now();
	const result = spawnSync(spec.command, spec.args, {
		encoding: "utf-8",
		shell: false,
		stdio: ["ignore", "pipe", "pipe"],
		timeout: timeoutMs,
	});
	const durationMs = Date.now() - startedAt;

	const stdout = typeof result.stdout === "string" ? result.stdout.trim() : "";
	const stderr = typeof result.stderr === "string" ? result.stderr.trim() : "";
	const timedOut =
		result.error instanceof Error &&
		(result.error as NodeJS.ErrnoException).code === "ETIMEDOUT";
	let exitCode =
		typeof result.status === "number"
			? result.status
			: timedOut
				? EXIT_CODES.TIMEOUT
				: EXIT_CODES.COMMAND_FAILED;
	let passed = exitCode === 0;

	if (timedOut && treatTimeoutAsSuccess) {
		passed = true;
		exitCode = EXIT_CODES.SUCCESS;
	}

	if (result.error && !timedOut) {
		passed = false;
	}

	return {
		executed: true,
		passed,
		exitCode,
		durationMs,
		timedOut,
		...(stdout.length > 0 ? { stdout } : {}),
		...(stderr.length > 0 ? { stderr } : {}),
	};
}

function persistArtifact(
	commandName: string,
	artifactBody: object,
): {
	artifactUri: string;
	artifactChecksum: string;
} {
	const artifactDir = resolve(process.cwd(), "artifacts", "ui-loop");
	mkdirSync(artifactDir, { recursive: true });
	const artifactPath = join(
		artifactDir,
		`${commandName.replace(/[:/]/g, "-")}-${Date.now()}.json`,
	);
	const payload = JSON.stringify(artifactBody, null, 2);
	writeFileSync(artifactPath, payload, "utf-8");
	const artifactChecksum = createHash("sha256").update(payload).digest("hex");
	return {
		artifactUri: pathToFileURL(artifactPath).toString(),
		artifactChecksum,
	};
}

function createEvidence(
	commandName: "ui:fast" | "ui:verify" | "ui:explore",
	mode: UILoopMode,
	command: string,
	execution: CommandExecutionResult,
	context: Record<string, unknown>,
	executionContext: UIExecutionContext,
): UIEvidence {
	const timestamp = new Date().toISOString();
	const artifactPayload = {
		schemaVersion: "ui-loop-execution/v1",
		commandName,
		timestamp,
		headSha: executionContext.headSha,
		contractVersion: executionContext.contractVersion,
		mode,
		command,
		executed: execution.executed,
		durationMs: execution.durationMs,
		passed: execution.passed,
		exitCode: execution.exitCode,
		timedOut: execution.timedOut,
		...(execution.stdout ? { stdout: execution.stdout } : {}),
		...(execution.stderr ? { stderr: execution.stderr } : {}),
		context,
	};
	const { artifactUri, artifactChecksum } = persistArtifact(
		commandName,
		artifactPayload,
	);

	return {
		timestamp,
		command,
		durationMs: execution.durationMs,
		passed: execution.passed,
		mode,
		executed: execution.executed,
		exitCode: execution.exitCode,
		headSha: executionContext.headSha,
		contractVersion: executionContext.contractVersion,
		artifactUri,
		artifactChecksum,
		...(execution.timedOut ? { timedOut: true } : {}),
		...(execution.stdout ? { stdout: execution.stdout } : {}),
		...(execution.stderr ? { stderr: execution.stderr } : {}),
	};
}

/**
 * Detect package manager and return run command
 */
function detectPackageManager(cwd = process.cwd()): {
	name: string;
	command: string;
} {
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
function buildScriptCommand(
	pm: { name: string; command: string },
	script: string,
	args: string[] = [],
): CommandSpec {
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
 * Resolve shared execution context used for parity fields.
 */
function getContractUILoopContext(
	contractPath?: string,
): UILoopContractContext {
	try {
		if (!contractPath) {
			return { policy: undefined, contractVersion: "unknown" };
		}
		const contract = loadContract(contractPath);
		return {
			policy: contract.uiLoopPolicy,
			contractVersion: contract.version,
		};
	} catch {
		return { policy: undefined, contractVersion: "unknown" };
	}
}

function resolveHeadSha(): string {
	const envHeadSha = process.env.GITHUB_SHA?.trim();
	if (envHeadSha && envHeadSha.length > 0) {
		return envHeadSha;
	}
	return "unknown";
}

function withExecutionDisabledError<T extends Record<string, unknown>>(
	payload: T,
	exitCode: number,
): T & {
	error?: { code: string; message: string };
} {
	if (exitCode !== EXIT_CODES.EXECUTION_DISABLED) {
		return payload;
	}

	return {
		...payload,
		error: {
			code: EXECUTION_DISABLED_CODE,
			message: EXECUTION_DISABLED_MESSAGE,
		},
	};
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
	artifact?: UIEvidence;
} {
	const { json = false } = options;
	const mode = resolveMode(options.mode, options.dryRun);
	const contractPath = options.contractPath ?? "harness.contract.json";
	const contractContext = getContractUILoopContext(contractPath);
	const policy = contractContext.policy;
	const executionContext: UIExecutionContext = {
		headSha: resolveHeadSha(),
		contractVersion: contractContext.contractVersion,
	};

	let fullCmd: string;
	let packageManager: string;
	let commandSpec: CommandSpec;

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
		const parsedPolicyCommand = parseCommandSpec(policy.fastCommand);
		if (!parsedPolicyCommand.ok) {
			const message = `Invalid uiLoopPolicy.fastCommand: ${parsedPolicyCommand.error}`;
			if (json) {
				return {
					exitCode: EXIT_CODES.VALIDATION_ERROR,
					message: JSON.stringify({ error: message, code: "VALIDATION_ERROR" }),
				};
			}
			return { exitCode: EXIT_CODES.VALIDATION_ERROR, message };
		}
		commandSpec = {
			command: parsedPolicyCommand.value.command,
			args: [
				...parsedPolicyCommand.value.args,
				...(options.ci ? ["--ci"] : []),
			],
		};
		fullCmd = formatCommandDisplay(commandSpec);
		packageManager = "contract";
	} else {
		if (!hasStorybook()) {
			const message =
				"Storybook not found. Ensure .storybook/ directory exists.";
			if (json) {
				return {
					exitCode: EXIT_CODES.NOT_FOUND,
					message: JSON.stringify({ error: message, code: "NOT_FOUND" }),
				};
			}
			return { exitCode: EXIT_CODES.NOT_FOUND, message };
		}
		const pm = detectPackageManager();
		packageManager = pm.name;
		const storybookArgs = options.ci ? ["--ci"] : [];
		commandSpec = buildScriptCommand(pm, "storybook", storybookArgs);
		fullCmd = formatCommandDisplay(commandSpec);
	}

	const execution =
		mode === "execute"
			? isExecutionDisabled()
				? buildExecutionDisabledResult()
				: executeCommand(commandSpec, 8000, true)
			: buildPrepareResult();
	const artifact = createEvidence(
		"ui:fast",
		mode,
		fullCmd,
		execution,
		{
			port: options.port ?? 6006,
			ci: options.ci ?? false,
			packageManager,
		},
		executionContext,
	);
	const exitCode =
		artifact.exitCode === EXIT_CODES.EXECUTION_DISABLED
			? EXIT_CODES.EXECUTION_DISABLED
			: artifact.passed
				? EXIT_CODES.SUCCESS
				: EXIT_CODES.COMMAND_FAILED;

	if (json) {
		const payload = withExecutionDisabledError(
			{
				command: fullCmd,
				port: options.port ?? 6006,
				ci: options.ci ?? false,
				mode,
				executed: artifact.executed,
				passed: artifact.passed,
				exitCode: artifact.exitCode,
				head_sha: artifact.headSha,
				contract_version: artifact.contractVersion,
				artifact_uri: artifact.artifactUri,
				artifact_checksum: artifact.artifactChecksum,
				packageManager,
				...(artifact.timedOut ? { timedOut: true } : {}),
			},
			exitCode,
		);
		return {
			exitCode,
			message: JSON.stringify(payload),
			artifact,
		};
	}

	const statusLabel = artifact.passed ? "✓" : "✗";
	const message = `${statusLabel} UI fast ${mode} ${artifact.executed ? "executed" : "prepared"}\n  Command: ${fullCmd}\n  Port: ${options.port ?? 6006}\n  CI mode: ${options.ci ? "enabled" : "disabled"}\n  Package manager: ${packageManager}\n  Artifact: ${artifact.artifactUri}\n  Checksum: ${artifact.artifactChecksum}`;
	return { exitCode, message, artifact };
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
	const mode = resolveMode(options.mode, options.dryRun);
	const contractPath = options.contractPath ?? "harness.contract.json";
	const contractContext = getContractUILoopContext(contractPath);
	const policy = contractContext.policy;
	const executionContext: UIExecutionContext = {
		headSha: resolveHeadSha(),
		contractVersion: contractContext.contractVersion,
	};

	const args: string[] = ["test"];
	if (options.shard) {
		args.push(`--shard=${options.shard}`);
	}
	if (typeof options.timeout === "number" && Number.isFinite(options.timeout)) {
		args.push(`--timeout=${options.timeout}`);
	}
	if (options.outputDir) {
		args.push(`--output=${options.outputDir}`);
	}

	let fullCmd: string;
	let packageManager: string;
	let commandSpec: CommandSpec;
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
		const parsedPolicyCommand = parseCommandSpec(policy.verifyCommand);
		if (!parsedPolicyCommand.ok) {
			const message = `Invalid uiLoopPolicy.verifyCommand: ${parsedPolicyCommand.error}`;
			if (json) {
				return {
					exitCode: EXIT_CODES.VALIDATION_ERROR,
					message: JSON.stringify({ error: message, code: "VALIDATION_ERROR" }),
				};
			}
			return { exitCode: EXIT_CODES.VALIDATION_ERROR, message };
		}
		commandSpec = {
			command: parsedPolicyCommand.value.command,
			args: [...parsedPolicyCommand.value.args, ...args],
		};
		fullCmd = formatCommandDisplay(commandSpec);
		packageManager = "contract";
	} else {
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
		const pm = detectPackageManager();
		packageManager = pm.name;
		commandSpec = buildScriptCommand(pm, "playwright", args);
		fullCmd = formatCommandDisplay(commandSpec);
	}

	const execution =
		mode === "execute"
			? isExecutionDisabled()
				? buildExecutionDisabledResult()
				: executeCommand(commandSpec, 10 * 60 * 1000)
			: buildPrepareResult();
	const evidence = createEvidence(
		"ui:verify",
		mode,
		fullCmd,
		execution,
		{
			outputDir: options.outputDir,
			shard: options.shard,
			timeout: options.timeout,
			packageManager,
		},
		executionContext,
	);
	const exitCode =
		evidence.exitCode === EXIT_CODES.EXECUTION_DISABLED
			? EXIT_CODES.EXECUTION_DISABLED
			: evidence.passed
				? EXIT_CODES.SUCCESS
				: EXIT_CODES.COMMAND_FAILED;

	if (json) {
		const payload = withExecutionDisabledError(
			{
				timestamp: evidence.timestamp,
				command: evidence.command,
				durationMs: evidence.durationMs,
				mode: evidence.mode,
				executed: evidence.executed,
				passed: evidence.passed,
				exitCode: evidence.exitCode,
				head_sha: evidence.headSha,
				contract_version: evidence.contractVersion,
				artifact_uri: evidence.artifactUri,
				artifact_checksum: evidence.artifactChecksum,
				...(evidence.timedOut ? { timedOut: true } : {}),
				...(evidence.stdout ? { stdout: evidence.stdout } : {}),
				...(evidence.stderr ? { stderr: evidence.stderr } : {}),
			},
			exitCode,
		);
		return {
			exitCode,
			message: JSON.stringify(payload),
			evidence,
		};
	}

	const statusLabel = evidence.passed ? "✓" : "✗";
	const message = `${statusLabel} UI verify ${mode} ${evidence.executed ? "executed" : "prepared"}\n  Command: ${fullCmd}\n  Duration: ${evidence.durationMs}ms\n  Package manager: ${packageManager}\n  Artifact: ${evidence.artifactUri}\n  Checksum: ${evidence.artifactChecksum}`;
	return {
		exitCode,
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
	evidence?: UIEvidence;
} {
	const { json = false } = options;
	const mode = resolveMode(options.mode, options.dryRun);
	const contractPath = options.contractPath ?? "harness.contract.json";
	const contractContext = getContractUILoopContext(contractPath);
	const policy = contractContext.policy;
	const executionContext: UIExecutionContext = {
		headSha: resolveHeadSha(),
		contractVersion: contractContext.contractVersion,
	};

	const url = options.url ?? "http://localhost:3000";
	const outputDir = options.outputDir ?? "./ui-explore-output";
	const interactionArgs = options.interactions ? ["--interactions"] : [];

	let fullCmd: string;
	let commandSpec: CommandSpec;
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
		const parsedPolicyCommand = parseCommandSpec(policy.exploreCommand);
		if (!parsedPolicyCommand.ok) {
			const message = `Invalid uiLoopPolicy.exploreCommand: ${parsedPolicyCommand.error}`;
			if (json) {
				return {
					exitCode: EXIT_CODES.VALIDATION_ERROR,
					message: JSON.stringify({ error: message, code: "VALIDATION_ERROR" }),
				};
			}
			return { exitCode: EXIT_CODES.VALIDATION_ERROR, message };
		}
		commandSpec = {
			command: parsedPolicyCommand.value.command,
			args: [
				...parsedPolicyCommand.value.args,
				url,
				outputDir,
				...interactionArgs,
			],
		};
		fullCmd = formatCommandDisplay(commandSpec);
	} else {
		commandSpec = {
			command: "npx",
			args: [
				"@agent-browser/cli",
				"explore",
				url,
				"--output",
				outputDir,
				...interactionArgs,
			],
		};
		fullCmd = formatCommandDisplay(commandSpec);
	}

	const execution =
		mode === "execute"
			? isExecutionDisabled()
				? buildExecutionDisabledResult()
				: executeCommand(commandSpec, 5 * 60 * 1000)
			: buildPrepareResult();
	const evidence = createEvidence(
		"ui:explore",
		mode,
		fullCmd,
		execution,
		{
			url,
			outputDir,
			interactions: options.interactions ?? false,
		},
		executionContext,
	);
	const exitCode =
		evidence.exitCode === EXIT_CODES.EXECUTION_DISABLED
			? EXIT_CODES.EXECUTION_DISABLED
			: evidence.passed
				? EXIT_CODES.SUCCESS
				: EXIT_CODES.COMMAND_FAILED;

	if (json) {
		const payload = withExecutionDisabledError(
			{
				timestamp: evidence.timestamp,
				command: evidence.command,
				durationMs: evidence.durationMs,
				mode: evidence.mode,
				executed: evidence.executed,
				passed: evidence.passed,
				exitCode: evidence.exitCode,
				head_sha: evidence.headSha,
				contract_version: evidence.contractVersion,
				artifact_uri: evidence.artifactUri,
				artifact_checksum: evidence.artifactChecksum,
				url,
				outputDir,
				interactions: options.interactions ?? false,
				...(evidence.timedOut ? { timedOut: true } : {}),
				...(evidence.stdout ? { stdout: evidence.stdout } : {}),
				...(evidence.stderr ? { stderr: evidence.stderr } : {}),
			},
			exitCode,
		);
		return {
			exitCode,
			message: JSON.stringify(payload),
			evidence,
		};
	}

	const statusLabel = evidence.passed ? "✓" : "✗";
	const message = `${statusLabel} UI explore ${mode} ${evidence.executed ? "executed" : "prepared"}\n  Target: ${url}\n  Output: ${outputDir}\n  Command: ${fullCmd}\n  Interactions: ${options.interactions ? "enabled" : "disabled"}\n  Artifact: ${evidence.artifactUri}\n  Checksum: ${evidence.artifactChecksum}`;
	return { exitCode, message, evidence };
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
	if (result.exitCode === EXIT_CODES.SUCCESS) {
		console.info(result.message);
	} else {
		console.error(result.message);
	}
	return result.exitCode;
}

/**
 * CLI entry point for ui:explore
 */
export function runUIExploreCLI(options: UIExploreOptions = {}): number {
	const result = runUIExplore(options);
	if (result.exitCode === EXIT_CODES.SUCCESS) {
		console.info(result.message);
	} else {
		console.error(result.message);
	}
	return result.exitCode;
}
