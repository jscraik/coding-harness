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
	type UILoopMode,
	hasUnsafeShellChars,
} from "./ui-loop-shared.js";
import {
	buildScriptCommand,
	detectPackageManager,
	hasPlaywright,
	hasStorybook,
} from "./ui-loop-tooling.js";

export const EXIT_CODES = {
	SUCCESS: 0,
	NOT_FOUND: 1,
	COMMAND_FAILED: 2,
	VALIDATION_ERROR: 3,
	TIMEOUT: 4,
	EXECUTION_DISABLED: 5,
} as const;

/** Normalized UI loop command specification. */
export type CommandSpec = UILoopCommandSpec;

/** Contract-derived context for a UI loop execution. */
export interface UILoopContractContext {
	policy: UILoopPolicy | undefined;
	contractVersion: string;
}

/** Shared execution context containing head SHA and contract version. */
export interface UIExecutionContext {
	headSha: string;
	contractVersion: string;
}

export const EXECUTION_DISABLE_ENV = "HARNESS_UI_EXECUTION_DISABLED";
const EXECUTION_DISABLED_CODE = "execution_disabled";
export const EXECUTION_DISABLED_MESSAGE =
	"UI execution backend disabled by kill switch";

/**
 * Parse a UI loop command string into a structured command spec.
 *
 * @param command - The command string to parse
 * @returns A result containing the parsed `CommandSpec` or an error message
 */
export function parseCommandSpec(
	command: string,
): { ok: true; value: CommandSpec } | { ok: false; error: string } {
	return parseUILoopCommandSpec(command);
}

/**
 * Append forwarded arguments to a policy command spec, inserting `--` separator
 * for npm run commands when needed.
 *
 * @param spec - The base command spec from policy
 * @param forwardedArgs - Arguments to append
 * @returns A new command spec with forwarded args merged
 */
export function appendForwardedArgsToPolicyCommand(
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

/**
 * Format a single command argument for display, JSON-stringifying when necessary.
 *
 * @param arg - The argument to format
 * @returns The formatted argument string
 */
export function formatCommandArg(arg: string): string {
	return /^[A-Za-z0-9_./:@%+=,-]+$/.test(arg) ? arg : JSON.stringify(arg);
}

/**
 * Format a command spec into a human-readable display string.
 *
 * @param spec - The command spec to format
 * @returns A shell-like command string
 */
export function formatCommandDisplay(spec: CommandSpec): string {
	return [spec.command, ...spec.args.map(formatCommandArg)].join(" ");
}

/**
 * Execute a command spec with the given timeout.
 *
 * @param spec - The command to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param treatTimeoutAsSuccess - When true, treat timeout as success
 * @returns The execution result
 */
export function executeCommand(
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

/**
 * Persist a JSON artifact to the artifacts/ui-loop directory.
 *
 * @param commandName - Name used to build the artifact filename
 * @param artifactBody - Object to serialize and persist
 * @returns The artifact URI and SHA-256 checksum
 */
export function persistArtifact(
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

/**
 * Create a UIEvidence record from execution results and persist the artifact.
 *
 * @param commandName - The UI loop command name
 * @param mode - Execution mode
 * @param command - Display command string
 * @param execution - Execution result
 * @param context - Additional context to include
 * @param executionContext - Shared execution context (head SHA, contract version)
 * @returns A UIEvidence record
 */
export function createEvidence(
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
export function getContractUILoopContext(
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

/**
 * Resolve the current HEAD SHA from the GITHUB_SHA environment variable.
 *
 * @returns The SHA string, or `"unknown"` when not available
 */
export function resolveHeadSha(): string {
	const envHeadSha = process.env.GITHUB_SHA?.trim();
	if (envHeadSha && envHeadSha.length > 0) {
		return envHeadSha;
	}
	return "unknown";
}

/**
 * Attach an execution-disabled error to a payload when the exit code indicates
 * the backend was disabled by kill switch.
 *
 * @param payload - The base payload to augment
 * @param exitCode - The process exit code
 * @returns The payload, possibly with an `error` field attached
 */
export function withExecutionDisabledError<T extends Record<string, unknown>>(
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
export function resolveFastCommandSpec(
	options: import("./ui-loop-shared.js").UIFastOptions,
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
				...(options.ci ? ["--ci"] : []),
				...(typeof options.port === "number"
					? ["--port", String(options.port)]
					: []),
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
		...(options.ci ? ["--ci"] : []),
		...(typeof options.port === "number"
			? ["--port", String(options.port)]
			: []),
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
 * Resolve the command spec for ui:verify.
 */
export function resolveVerifyCommandSpec(
	options: import("./ui-loop-shared.js").UIVerifyOptions,
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
 * Resolve the command spec for ui:explore.
 */
export function resolveExploreCommandSpec(
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
	return { ok: true, commandSpec, fullCmd: formatCommandDisplay(commandSpec) };
}
