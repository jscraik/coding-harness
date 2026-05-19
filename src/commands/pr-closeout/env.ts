import { existsSync, lstatSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { sanitizeError } from "../../lib/input/sanitize.js";
import type { PrCloseoutToolInput } from "../../lib/pr-closeout.js";

const DEFAULT_ENV_FILE = resolve(homedir(), ".codex/.env");

/** Environment variables and evidence emitted by the PR closeout env seam. */
export interface PrCloseoutEnvLoadResult {
	env: NodeJS.ProcessEnv;
	tool: PrCloseoutToolInput;
}

function buildEnvTool(
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

function applyEnvLine(env: NodeJS.ProcessEnv, line: string): void {
	const trimmed = line.trim();
	if (trimmed.length === 0 || trimmed.startsWith("#")) return;
	const eqIndex = trimmed.indexOf("=");
	if (eqIndex < 1) return;
	const key = trimmed.slice(0, eqIndex).trim();
	const value = trimmed
		.slice(eqIndex + 1)
		.trim()
		.replace(/^["']|["']$/g, "");
	if (/^[A-Z_][A-Z0-9_]*$/u.test(key) && value.length > 0) {
		env[key] = value;
	}
}

/** Loads PR closeout credentials from the Codex env file and records evidence. */
export function loadPrCloseoutEnvFile(
	envFilePath: string | undefined,
): PrCloseoutEnvLoadResult {
	const resolvedPath = envFilePath ?? DEFAULT_ENV_FILE;
	const env = { ...process.env };
	try {
		if (!existsSync(resolvedPath)) {
			return {
				env,
				tool: buildEnvTool(resolvedPath, "missing", "env_file_missing"),
			};
		}
		const stat = lstatSync(resolvedPath);
		if (stat.isFIFO()) {
			return {
				env,
				tool: buildEnvTool(resolvedPath, "usable", null),
			};
		}
		if (!stat.isFile()) {
			return {
				env,
				tool: buildEnvTool(resolvedPath, "blocked", "env_file_not_regular"),
			};
		}
		for (const line of readFileSync(resolvedPath, "utf8").split(/\r?\n/u)) {
			applyEnvLine(env, line);
		}
		return {
			env,
			tool: buildEnvTool(resolvedPath, "usable", null),
		};
	} catch (error) {
		return {
			env,
			tool: buildEnvTool(
				resolvedPath,
				"blocked",
				`env_file_unreadable:${sanitizeError(error)}`,
			),
		};
	}
}
