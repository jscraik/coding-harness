#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadContract } from "../lib/contract/loader.js";
import type { UILoopPolicy } from "../lib/contract/types.js";
import {
	type UILoopCommandSpec,
	parseUILoopCommandSpec,
} from "../lib/contract/ui-loop-command.js";
import {
	type CommandExecutionResult,
	type UIEvidence,
	type UIExploreOptions,
	type UIFastOptions,
	type UILoopMode,
	type UIVerifyOptions,
	buildExecutionDisabledResult,
	buildPrepareResult,
	hasUnsafeShellChars,
	isExecutionDisabled,
	resolveMode,
} from "./ui-loop-shared.js";
import {
	buildScriptCommand,
	detectPackageManager,
	hasPlaywright,
	hasStorybook,
} from "./ui-loop-tooling.js";
export type {
	UIEvidence,
	UIExploreOptions,
	UIFastOptions,
	UILoopMode,
	UIVerifyOptions,
} from "./ui-loop-shared.js";

// Exit codes for programmatic consumption
export const EXIT_CODES = {
	SUCCESS: 0,
	NOT_FOUND: 1,
	COMMAND_FAILED: 2,
	VALIDATION_ERROR: 3,
	TIMEOUT: 4,
	EXECUTION_DISABLED: 5,
} as const;

type CommandSpec = UILoopCommandSpec;

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

function parseCommandSpec(
	command: string,
): { ok: true; value: CommandSpec } | { ok: false; error: string } {
	return parseUILoopCommandSpec(command);
}

function appendForwardedArgsToPolicyCommand(
	spec: CommandSpec,
	forwardedArgs: string[],
): CommandSpec {
	if (forwardedArgs.length === 0) {
		return {
			command: spec.command,
			args: [...spec.args],
		};
	}
	const isNpmRunCommand = spec.command === "npm" && spec.args[0] === "run";
	if (!isNpmRunCommand) {
		return {
			command: spec.command,
			args: [...spec.args, ...forwardedArgs],
		};
	}
	const hasSeparator = spec.args.includes("--");
	return {
		command: spec.command,
		args: hasSeparator
			? [...spec.args, ...forwardedArgs]
			: [...spec.args, "--", ...forwardedArgs],
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
 * Resolve the command spec for ui:fast.
 */
function resolveFastCommandSpec(
	options: UIFastOptions,
	policy: UILoopPolicy | undefined,
	json: boolean,
):
	| {
			ok: true;
			commandSpec: CommandSpec;
			fullCmd: string;
			packageManager: string;
	  }
	| { ok: false; exitCode: number; message: string } {
	if (policy?.fastCommand) {
		if (hasUnsafeShellChars(policy.fastCommand)) {
			const message =
				"Invalid uiLoopPolicy.fastCommand: unsafe shell characters";
			if (json) {
				return {
					ok: false,
					exitCode: EXIT_CODES.VALIDATION_ERROR,
					message: JSON.stringify({ error: message, code: "VALIDATION_ERROR" }),
				};
			}
			return { ok: false, exitCode: EXIT_CODES.VALIDATION_ERROR, message };
		}
		const parsedPolicyCommand = parseCommandSpec(policy.fastCommand);
		if (!parsedPolicyCommand.ok) {
			const message = `Invalid uiLoopPolicy.fastCommand: ${parsedPolicyCommand.error}`;
			if (json) {
				return {
					ok: false,
					exitCode: EXIT_CODES.VALIDATION_ERROR,
					message: JSON.stringify({ error: message, code: "VALIDATION_ERROR" }),
				};
			}
			return { ok: false, exitCode: EXIT_CODES.VALIDATION_ERROR, message };
		}
		const commandSpec = appendForwardedArgsToPolicyCommand(
			parsedPolicyCommand.value,
			[
				...(typeof options.port === "number"
					? ["--port", String(options.port)]
					: []),
				...(options.ci ? ["--ci"] : []),
			],
		);
		return {
			ok: true,
			commandSpec,
			fullCmd: formatCommandDisplay(commandSpec),
			packageManager: "contract",
		};
	}

	if (!hasStorybook()) {
		const message = "Storybook not found. Ensure .storybook/ directory exists.";
		if (json) {
			return {
				ok: false,
				exitCode: EXIT_CODES.NOT_FOUND,
				message: JSON.stringify({ error: message, code: "NOT_FOUND" }),
			};
		}
		return { ok: false, exitCode: EXIT_CODES.NOT_FOUND, message };
	}
	const pm = detectPackageManager();
	const storybookArgs = [
		...(typeof options.port === "number"
			? ["--port", String(options.port)]
			: []),
		...(options.ci ? ["--ci"] : []),
	];
	const commandSpec = buildScriptCommand(pm, "storybook", storybookArgs);
	return {
		ok: true,
		commandSpec,
		fullCmd: formatCommandDisplay(commandSpec),
		packageManager: pm.name,
	};
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

	const resolved = resolveFastCommandSpec(options, policy, json);
	if (!resolved.ok) {
		return { exitCode: resolved.exitCode, message: resolved.message };
	}
	const { commandSpec, fullCmd, packageManager } = resolved;

	const execution =
		mode === "execute"
			? isExecutionDisabled(EXECUTION_DISABLE_ENV)
				? buildExecutionDisabledResult(
						EXIT_CODES.EXECUTION_DISABLED,
						EXECUTION_DISABLED_MESSAGE,
					)
				: executeCommand(commandSpec, 8000, true)
			: buildPrepareResult(EXIT_CODES.SUCCESS);
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
 * Resolve the command spec for ui:verify.
 */
function resolveVerifyCommandSpec(
	options: UIVerifyOptions,
	policy: UILoopPolicy | undefined,
	json: boolean,
):
	| {
			ok: true;
			commandSpec: CommandSpec;
			fullCmd: string;
			packageManager: string;
	  }
	| { ok: false; exitCode: number; message: string } {
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

	if (policy?.verifyCommand) {
		if (hasUnsafeShellChars(policy.verifyCommand)) {
			const message =
				"Invalid uiLoopPolicy.verifyCommand: unsafe shell characters";
			if (json) {
				return {
					ok: false,
					exitCode: EXIT_CODES.VALIDATION_ERROR,
					message: JSON.stringify({ error: message, code: "VALIDATION_ERROR" }),
				};
			}
			return { ok: false, exitCode: EXIT_CODES.VALIDATION_ERROR, message };
		}
		const parsedPolicyCommand = parseCommandSpec(policy.verifyCommand);
		if (!parsedPolicyCommand.ok) {
			const message = `Invalid uiLoopPolicy.verifyCommand: ${parsedPolicyCommand.error}`;
			if (json) {
				return {
					ok: false,
					exitCode: EXIT_CODES.VALIDATION_ERROR,
					message: JSON.stringify({ error: message, code: "VALIDATION_ERROR" }),
				};
			}
			return { ok: false, exitCode: EXIT_CODES.VALIDATION_ERROR, message };
		}
		const commandSpec = appendForwardedArgsToPolicyCommand(
			parsedPolicyCommand.value,
			args,
		);
		return {
			ok: true,
			commandSpec,
			fullCmd: formatCommandDisplay(commandSpec),
			packageManager: "contract",
		};
	}

	if (!hasPlaywright()) {
		const message =
			"Playwright not found. Ensure playwright.config.{js,ts,mjs} exists.";
		if (json) {
			return {
				ok: false,
				exitCode: EXIT_CODES.NOT_FOUND,
				message: JSON.stringify({ error: message, code: "NOT_FOUND" }),
			};
		}
		return { ok: false, exitCode: EXIT_CODES.NOT_FOUND, message };
	}
	const pm = detectPackageManager();
	const commandSpec = buildScriptCommand(pm, "playwright", args);
	return {
		ok: true,
		commandSpec,
		fullCmd: formatCommandDisplay(commandSpec),
		packageManager: pm.name,
	};
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

	const resolved = resolveVerifyCommandSpec(options, policy, json);
	if (!resolved.ok) {
		return { exitCode: resolved.exitCode, message: resolved.message };
	}
	const { commandSpec, fullCmd, packageManager } = resolved;

	const execution =
		mode === "execute"
			? isExecutionDisabled(EXECUTION_DISABLE_ENV)
				? buildExecutionDisabledResult(
						EXIT_CODES.EXECUTION_DISABLED,
						EXECUTION_DISABLED_MESSAGE,
					)
				: executeCommand(commandSpec, 10 * 60 * 1000)
			: buildPrepareResult(EXIT_CODES.SUCCESS);
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
 * Resolve the command spec for ui:explore.
 */
function resolveExploreCommandSpec(
	policy: UILoopPolicy | undefined,
	url: string,
	outputDir: string,
	interactionArgs: string[],
	json: boolean,
):
	| { ok: true; commandSpec: CommandSpec; fullCmd: string }
	| { ok: false; exitCode: number; message: string } {
	if (policy?.exploreCommand) {
		if (hasUnsafeShellChars(policy.exploreCommand)) {
			const message =
				"Invalid uiLoopPolicy.exploreCommand: unsafe shell characters";
			if (json) {
				return {
					ok: false,
					exitCode: EXIT_CODES.VALIDATION_ERROR,
					message: JSON.stringify({ error: message, code: "VALIDATION_ERROR" }),
				};
			}
			return { ok: false, exitCode: EXIT_CODES.VALIDATION_ERROR, message };
		}
		const parsedPolicyCommand = parseCommandSpec(policy.exploreCommand);
		if (!parsedPolicyCommand.ok) {
			const message = `Invalid uiLoopPolicy.exploreCommand: ${parsedPolicyCommand.error}`;
			if (json) {
				return {
					ok: false,
					exitCode: EXIT_CODES.VALIDATION_ERROR,
					message: JSON.stringify({ error: message, code: "VALIDATION_ERROR" }),
				};
			}
			return { ok: false, exitCode: EXIT_CODES.VALIDATION_ERROR, message };
		}
		const commandSpec = appendForwardedArgsToPolicyCommand(
			parsedPolicyCommand.value,
			[url, outputDir, ...interactionArgs],
		);
		return {
			ok: true,
			commandSpec,
			fullCmd: formatCommandDisplay(commandSpec),
		};
	}

	const commandSpec: CommandSpec = {
		command: "pnpm",
		args: [
			"exec",
			"@agent-browser/cli",
			"explore",
			url,
			"--output",
			outputDir,
			...interactionArgs,
		],
	};
	return { ok: true, commandSpec, fullCmd: formatCommandDisplay(commandSpec) };
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

	const resolved = resolveExploreCommandSpec(
		policy,
		url,
		outputDir,
		interactionArgs,
		json,
	);
	if (!resolved.ok) {
		return { exitCode: resolved.exitCode, message: resolved.message };
	}
	const { commandSpec, fullCmd } = resolved;

	const execution =
		mode === "execute"
			? isExecutionDisabled(EXECUTION_DISABLE_ENV)
				? buildExecutionDisabledResult(
						EXIT_CODES.EXECUTION_DISABLED,
						EXECUTION_DISABLED_MESSAGE,
					)
				: executeCommand(commandSpec, 5 * 60 * 1000)
			: buildPrepareResult(EXIT_CODES.SUCCESS);
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
