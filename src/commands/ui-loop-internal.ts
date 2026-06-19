import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadContract } from "../lib/contract/loader.js";
import type { UILoopPolicy } from "../lib/contract/types.js";
import type { CommandSpec } from "./ui-loop-command-spec.js";
import { EXIT_CODES } from "./ui-loop-exit-codes.js";
import type {
	CommandExecutionResult,
	UIEvidence,
	UILoopMode,
} from "./ui-loop-shared.js";
export {
	appendForwardedArgsToPolicyCommand,
	formatCommandArg,
	formatCommandDisplay,
	parseCommandSpec,
} from "./ui-loop-command-spec.js";
export type { CommandSpec } from "./ui-loop-command-spec.js";
export {
	resolveExploreCommandSpec,
	resolveFastCommandSpec,
	resolveVerifyCommandSpec,
} from "./ui-loop-resolution.js";
export { EXIT_CODES } from "./ui-loop-exit-codes.js";

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

function trimmedOutput(output: unknown): string {
	return typeof output === "string" ? output.trim() : "";
}

function didCommandTimeOut(error: unknown): boolean {
	return (
		error instanceof Error &&
		(error as NodeJS.ErrnoException).code === "ETIMEDOUT"
	);
}

function exitCodeForResult(status: number | null, timedOut: boolean): number {
	if (timedOut) {
		return EXIT_CODES.TIMEOUT;
	}
	if (typeof status === "number") {
		return status;
	}
	return EXIT_CODES.COMMAND_FAILED;
}

function commandPassed(
	exitCode: number,
	timedOut: boolean,
	treatTimeoutAsSuccess: boolean,
	error: unknown,
): boolean {
	if (timedOut) {
		return treatTimeoutAsSuccess;
	}
	if (error) {
		return false;
	}
	return exitCode === EXIT_CODES.SUCCESS;
}

function normalizeExitCode(
	exitCode: number,
	timedOut: boolean,
	treatTimeoutAsSuccess: boolean,
): number {
	return timedOut && treatTimeoutAsSuccess ? EXIT_CODES.SUCCESS : exitCode;
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

	const stdout = trimmedOutput(result.stdout);
	const stderr = trimmedOutput(result.stderr);
	const timedOut = didCommandTimeOut(result.error);
	const rawExitCode = exitCodeForResult(result.status, timedOut);
	const exitCode = normalizeExitCode(
		rawExitCode,
		timedOut,
		treatTimeoutAsSuccess,
	);
	const passed = commandPassed(
		exitCode,
		timedOut,
		treatTimeoutAsSuccess,
		result.error,
	);

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
