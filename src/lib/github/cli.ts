import { spawnSync } from "node:child_process";
import { sanitizeError } from "../input/sanitize.js";

/** Environment source used to select the GitHub CLI executable. */
export type GitHubCliSource = "HARNESS_GH_BIN" | "GH_BIN" | "PATH";

/** Selected GitHub CLI executable and the source that provided it. */
export interface GitHubCliResolution {
	/** Executable used for GitHub CLI invocations. */
	command: string;
	/** Environment source that selected the executable. */
	source: GitHubCliSource;
}

interface GitHubCliFailureOptions {
	resolvedPath?: string | null;
}

const GITHUB_CLI_OVERRIDE_KEYS = ["HARNESS_GH_BIN", "GH_BIN"] as const;

function firstLine(value: string | null | undefined): string | null {
	const line = value?.trim().split("\n")[0]?.trim();
	return line && line.length > 0 ? line : null;
}

function errorText(value: unknown): string | null {
	if (typeof value === "string") return firstLine(value);
	if (value instanceof Buffer) return firstLine(value.toString("utf8"));
	return null;
}

function commandContainsPathSeparator(command: string): boolean {
	return command.includes("/") || command.includes("\\");
}

function isMisePath(path: string | null): boolean {
	if (!path) return false;
	return /(?:^|[/.])mise(?:[/.]|$)/u.test(path);
}

function quoteShellToken(value: string): string {
	if (/^[A-Za-z0-9_@%+=:,./-]+$/u.test(value)) return value;
	return `'${value.replace(/'/gu, "'\\''")}'`;
}

function isSilentFailure(error: unknown): boolean {
	if (!error || typeof error !== "object") return false;
	const record = error as {
		status?: unknown;
		stdout?: unknown;
		stderr?: unknown;
	};
	const hasOutput = Boolean(
		errorText(record.stdout) ?? errorText(record.stderr),
	);
	return record.status === -1 && !hasOutput;
}

function failureSummary(error: unknown): string {
	if (error && typeof error === "object") {
		const record = error as {
			error?: unknown;
			status?: unknown;
			signal?: unknown;
			stdout?: unknown;
			stderr?: unknown;
		};
		if (record.error) return sanitizeError(record.error);
		const stderr = errorText(record.stderr);
		if (stderr) return stderr;
		const stdout = errorText(record.stdout);
		if (stdout) return stdout;
		if (record.status !== undefined)
			return `exit_status=${String(record.status)}`;
		if (record.signal !== undefined) return `signal=${String(record.signal)}`;
	}
	return sanitizeError(error);
}

/** Resolve the GitHub CLI executable without changing PATH default behavior. */
export function resolveGitHubCli(
	env: NodeJS.ProcessEnv = process.env,
): GitHubCliResolution {
	for (const key of GITHUB_CLI_OVERRIDE_KEYS) {
		const value = env[key]?.trim();
		if (value) return { command: value, source: key };
	}
	return { command: "gh", source: "PATH" };
}

/** Resolve a GitHub CLI command to a filesystem path when possible. */
export function resolveGitHubCliPath(
	resolution: GitHubCliResolution,
): string | null {
	if (commandContainsPathSeparator(resolution.command))
		return resolution.command;
	const lookupCommand = process.platform === "win32" ? "where" : "which";
	const result = spawnSync(lookupCommand, [resolution.command], {
		stdio: "pipe",
		encoding: "utf-8",
		timeout: 3000,
	});
	if (result.status !== 0) return null;
	return firstLine(result.stdout);
}

/** Format the canonical command reference for GitHub CLI evidence. */
export function formatGitHubCliRef(args: readonly string[]): string {
	return `command:gh ${args.join(" ")}`;
}

/** Build a verification command for the selected GitHub CLI executable. */
export function formatGitHubCliVerificationCommand(
	resolution: GitHubCliResolution,
): string {
	return `${quoteShellToken(resolution.command)} --version`;
}

/** Format an actionable diagnostic for failed GitHub CLI invocations. */
export function formatGitHubCliFailure(
	error: unknown,
	args: readonly string[],
	resolution: GitHubCliResolution,
	options: GitHubCliFailureOptions = {},
): string {
	const resolvedPath =
		options.resolvedPath === undefined
			? resolveGitHubCliPath(resolution)
			: options.resolvedPath;
	const prefix = isSilentFailure(error)
		? "github_cli_failed_silently"
		: "github_cli_failed";
	const details = [
		`error=${failureSummary(error)}`,
		`command=${resolution.command}`,
		`source=${resolution.source}`,
		`args=${args.join(" ")}`,
		`resolved_path=${resolvedPath ?? "unknown"}`,
		`mise_path=${String(isMisePath(resolvedPath))}`,
		`verify=${formatGitHubCliVerificationCommand(resolution)}`,
		"override=set HARNESS_GH_BIN or GH_BIN to a working gh binary",
	];
	return `${prefix}:${details.join("; ")}`;
}
