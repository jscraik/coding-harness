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

/** Run a short-lived child process and return trimmed stdout. */
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

/** Load a Codex environment file into a process environment and record tool evidence. */
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
			if (/^[A-Z_][A-Z0-9_]*$/u.test(key) && value.length > 0) {
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
