import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import { sanitizeError } from "../lib/input/sanitize.js";
import type { PrCloseoutToolInput } from "../lib/pr-closeout.js";

/** Synchronous command runner used by PR closeout live evidence collection. */
export type CommandRunner = (
	command: string,
	args: readonly string[],
	options: { cwd: string; env?: NodeJS.ProcessEnv },
) => string;

const DEFAULT_ENV_FILE = resolve(homedir(), ".codex/.env");
const CLOSEOUT_ENV_KEYS = new Set([
	"GH_TOKEN",
	"GITHUB_TOKEN",
	"CIRCLECI_TOKEN",
	"CIRCLE_TOKEN",
	"CODERABBIT_API_KEY",
	"SNYK_TOKEN",
]);

/**
 * Create a PrCloseoutToolInput describing a Codex environment file at the given path.
 *
 * @param resolvedPath - The resolved filesystem path to the environment file; used in the tool `ref` as `env:<resolvedPath>`
 * @param status - The tool status to record (`"usable" | "missing" | "blocked"`)
 * @param failureClass - A failure classification string to record, or `null` when there is no failure
 * @returns A `PrCloseoutToolInput` with `name` set to `"codex_env"`, `available` set to `true`, `ref` set to `env:<resolvedPath>`, and the provided `status` and `failureClass`
 */
function codexEnvTool(
	resolvedPath: string,
	status: PrCloseoutToolInput["status"],
	failureClass: string | null,
): PrCloseoutToolInput {
	return {
		name: "codex_env",
		available: true,
		ref: `env:${resolvedPath}`,
		status,
		failureClass,
	};
}

/**
 * Execute an external command and return its trimmed standard output.
 *
 * @param command - The executable to run
 * @param args - Arguments passed to the executable
 * @param options - Execution options
 * @param options.cwd - Working directory for the child process
 * @param options.env - Optional environment variables for the child process
 * @returns The child process stdout with surrounding whitespace removed
 */
export function defaultRunner(
	command: string,
	args: readonly string[],
	options: { cwd: string; env?: NodeJS.ProcessEnv },
): string {
	return execFileSync(command, [...args], {
		cwd: options.cwd,
		env: options.env,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
		timeout: 15_000,
	}).trim();
}

/**
 * Load variables from a Codex-format environment file into a copy of `process.env` and produce metadata about the file.
 *
 * If `envFilePath` is omitted, the function resolves the standard Codex env file path and uses that. It applies valid `KEY=VALUE` pairs from the file onto a shallow copy of `process.env` and returns that environment together with a tool object describing the file's availability and any failure classification.
 *
 * @param envFilePath - Optional path to the env file; when omitted the default Codex env file path is used
 * @returns An object with:
 *  - `env`: a shallow copy of `process.env` with variables from the env file applied when present and valid
 *  - `tool`: a `PrCloseoutToolInput` referencing the resolved file path and indicating the file status (`"usable"`, `"missing"`, or `"blocked"`); when `"blocked"`, `failureClass` describes the reason
 */
export function loadEnvFile(envFilePath: string | undefined): {
	env: NodeJS.ProcessEnv;
	tool: PrCloseoutToolInput;
} {
	const resolvedPath = envFilePath ?? DEFAULT_ENV_FILE;
	const env = { ...process.env };
	try {
		if (!existsSync(resolvedPath)) {
			return {
				env,
				tool: codexEnvTool(resolvedPath, "missing", "env_file_missing"),
			};
		}
		const stat = lstatSync(resolvedPath);
		if (stat.isFIFO()) {
			return {
				env,
				tool: codexEnvTool(resolvedPath, "usable", null),
			};
		}
		if (!stat.isFile()) {
			return {
				env,
				tool: codexEnvTool(resolvedPath, "blocked", "env_file_not_regular"),
			};
		}
		for (const line of readFileSync(resolvedPath, "utf8").split(/\r?\n/u)) {
			const trimmed = line.trim();
			if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
			const eqIndex = trimmed.indexOf("=");
			if (eqIndex < 1) continue;
			const key = trimmed.slice(0, eqIndex).trim();
			const value = trimmed
				.slice(eqIndex + 1)
				.trim()
				.replace(/^["']|["']$/g, "");
			if (CLOSEOUT_ENV_KEYS.has(key) && value.length > 0) {
				env[key] = value;
			}
		}
		return {
			env,
			tool: codexEnvTool(resolvedPath, "usable", null),
		};
	} catch (error) {
		return {
			env,
			tool: codexEnvTool(
				resolvedPath,
				"blocked",
				`env_file_unreadable:${sanitizeError(error)}`,
			),
		};
	}
}
