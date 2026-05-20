import { runMemoryGateCLI } from "./cli.js";
import type { MemoryGateOptions } from "./types.js";

function getOptionalFlagValue(
	args: string[],
	flag: string,
): string | undefined {
	const index = args.indexOf(flag);
	if (index === -1) {
		return undefined;
	}
	const value = args[index + 1];
	if (value === undefined || value.startsWith("--")) {
		return undefined;
	}
	return value;
}

/**
 * Convert raw memory-gate command arguments into the typed command contract.
 */
export function buildMemoryGateOptionsFromCliArgs(
	args: string[],
): MemoryGateOptions {
	const memoryPath = getOptionalFlagValue(args, "--memory");
	const forjamiePath = getOptionalFlagValue(args, "--forjamie");
	const metricsPath = getOptionalFlagValue(args, "--metrics");

	return {
		...(memoryPath ? { memoryPath } : {}),
		...(forjamiePath ? { forjamiePath } : {}),
		...(metricsPath ? { metricsPath } : {}),
		...(args.includes("--json") ? { json: true } : {}),
	};
}

/**
 * Run memory-gate from raw CLI arguments after local option projection.
 */
export function runMemoryGateFromCliArgs(args: string[]): number {
	return runMemoryGateCLI(buildMemoryGateOptionsFromCliArgs(args));
}
