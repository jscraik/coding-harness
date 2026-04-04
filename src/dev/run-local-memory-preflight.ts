#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runLocalMemoryPreflightCLI } from "../commands/local-memory-preflight.js";
import { EXIT_CODES } from "../commands/local-memory-preflight.js";
import { inspectFlagValue } from "../lib/cli/parse-utils.js";

export interface LocalMemoryPreflightRunnerParseResult {
	options?: Parameters<typeof runLocalMemoryPreflightCLI>[0];
	error?: string;
}

/**
 * Parse CLI flags for the source runner without silently consuming later flags
 * as option values.
 */
export function parseLocalMemoryPreflightRunnerArgs(
	args: string[],
): LocalMemoryPreflightRunnerParseResult {
	const configFlag = inspectFlagValue(args, "--config");
	if (configFlag.missingValue) {
		return { error: "--config requires a path" };
	}

	const daemonLogFlag = inspectFlagValue(args, "--daemon-log");
	if (daemonLogFlag.missingValue) {
		return { error: "--daemon-log requires a path" };
	}

	return {
		options: {
			...(configFlag.value ? { configPath: configFlag.value } : {}),
			...(daemonLogFlag.value ? { daemonLogPath: daemonLogFlag.value } : {}),
			json: args.includes("--json"),
		},
	};
}

export async function runLocalMemoryPreflightRunner(
	args: string[] = process.argv.slice(2),
): Promise<number> {
	const parsed = parseLocalMemoryPreflightRunnerArgs(args);
	if (parsed.error) {
		console.error(parsed.error);
		return EXIT_CODES.USAGE_ERROR;
	}

	return runLocalMemoryPreflightCLI(parsed.options ?? {});
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	runLocalMemoryPreflightRunner()
		.then((exitCode) => process.exit(exitCode))
		.catch((error) => {
			console.error(error instanceof Error ? error.message : String(error));
			process.exit(1);
		});
}
