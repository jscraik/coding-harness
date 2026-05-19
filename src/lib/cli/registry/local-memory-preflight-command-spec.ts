import {
	EXIT_CODES,
	runLocalMemoryPreflightCLI,
} from "../../../commands/local-memory-preflight.js";
import { inspectFlagValue } from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

type LocalMemoryPreflightOptions = Parameters<
	typeof runLocalMemoryPreflightCLI
>[0];

/** Build the local-memory-preflight registry seam. */
export function createLocalMemoryPreflightCommandSpec(): CommandSpec {
	return {
		name: "local-memory-preflight",
		summary: "Run the structured Local Memory preflight smoke checks",
		errorLabel: "Local Memory Preflight Error",
		execute: runLocalMemoryPreflightCommand,
	};
}

function runLocalMemoryPreflightCommand(
	args: string[],
): number | Promise<number> {
	const configFlag = inspectFlagValue(args, "--config");
	const daemonLogFlag = inspectFlagValue(args, "--daemon-log");
	const usageError = validateLocalMemoryFlagValues(configFlag, daemonLogFlag);
	if (usageError !== undefined) return usageError;

	const options: LocalMemoryPreflightOptions = {};
	if (args.includes("--json")) options.json = true;
	if (configFlag.value !== undefined) options.configPath = configFlag.value;
	if (daemonLogFlag.value !== undefined) {
		options.daemonLogPath = daemonLogFlag.value;
	}

	return runLocalMemoryPreflightCLI(options);
}

function validateLocalMemoryFlagValues(
	configFlag: ReturnType<typeof inspectFlagValue>,
	daemonLogFlag: ReturnType<typeof inspectFlagValue>,
): number | undefined {
	if (configFlag.missingValue) {
		console.error("Error: --config requires a path");
		return EXIT_CODES.USAGE_ERROR;
	}
	if (daemonLogFlag.missingValue) {
		console.error("Error: --daemon-log requires a path");
		return EXIT_CODES.USAGE_ERROR;
	}
	return undefined;
}
