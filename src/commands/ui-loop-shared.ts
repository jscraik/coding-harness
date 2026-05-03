/**
 * UI loop execution mode.
 */
export type UILoopMode = "execute" | "prepare";

/**
 * Shared options across UI loop subcommands.
 */
export interface UIBaseOptions {
	mode?: UILoopMode;
	dryRun?: boolean;
}

/**
 * Options for `ui:fast`.
 */
export interface UIFastOptions extends UIBaseOptions {
	port?: number;
	ci?: boolean;
	json?: boolean;
	contractPath?: string;
}

/**
 * Options for `ui:verify`.
 */
export interface UIVerifyOptions extends UIBaseOptions {
	outputDir?: string;
	json?: boolean;
	timeout?: number;
	shard?: string;
	contractPath?: string;
}

/**
 * Options for `ui:explore`.
 */
export interface UIExploreOptions extends UIBaseOptions {
	url?: string;
	outputDir?: string;
	json?: boolean;
	interactions?: boolean;
	contractPath?: string;
}

/**
 * Serialized UI loop evidence artifact metadata.
 */
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

/**
 * Internal normalized command execution outcome.
 */
export interface CommandExecutionResult {
	executed: boolean;
	passed: boolean;
	exitCode: number;
	durationMs: number;
	timedOut: boolean;
	stdout?: string;
	stderr?: string;
}

/**
 * True when UI execution kill-switch environment variable is enabled.
 */
export function isExecutionDisabled(envVarName: string): boolean {
	const raw = process.env[envVarName]?.trim().toLowerCase();
	if (!raw) {
		return false;
	}
	return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/**
 * Detect shell metacharacters that are unsafe in policy command strings.
 */
export function hasUnsafeShellChars(command: string): boolean {
	return /[;&|`$<>]/.test(command) || /[\n\r]/.test(command);
}

/**
 * Resolve effective UI loop mode.
 */
export function resolveMode(mode?: UILoopMode, dryRun?: boolean): UILoopMode {
	if (dryRun) {
		return "prepare";
	}
	return mode ?? "execute";
}

/**
 * Build command execution result for prepare mode.
 */
export function buildPrepareResult(
	successExitCode: number,
): CommandExecutionResult {
	return {
		executed: false,
		passed: true,
		exitCode: successExitCode,
		durationMs: 0,
		timedOut: false,
	};
}

/**
 * Build command execution result for execution-disabled mode.
 */
export function buildExecutionDisabledResult(
	executionDisabledExitCode: number,
	disabledMessage: string,
): CommandExecutionResult {
	return {
		executed: false,
		passed: false,
		exitCode: executionDisabledExitCode,
		durationMs: 0,
		timedOut: false,
		stderr: disabledMessage,
	};
}
