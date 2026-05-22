import { getFlagValue } from "../cli/parse-utils.js";
import type { ReplayOptions } from "./options.js";

/**
 * Convert raw replay command arguments into the typed replay command contract.
 */
export function buildReplayOptionsFromCliArgs(args: string[]): ReplayOptions {
	const options: ReplayOptions = {
		json: args.includes("--json"),
		dryRun: args.includes("--dry-run"),
		list: args.includes("--list"),
	};

	const traceIdValue = getFlagValue(args, args.indexOf("--trace-id"));
	if (traceIdValue) options.traceId = traceIdValue;

	const traceDirValue = getFlagValue(args, args.indexOf("--trace-dir"));
	if (traceDirValue) options.traceDir = traceDirValue;

	if (!options.traceId && args[0] && !args[0].startsWith("-")) {
		options.traceId = args[0];
	}

	return options;
}
