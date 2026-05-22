import { getFlagValue } from "../cli/parse-utils.js";
import type { UpgradeCliOptions } from "./types.js";

export type { UpgradeCliOptions } from "./types.js";

/** Parsed upgrade CLI arguments. */
export interface ParsedUpgradeCliArgs {
	targetDir: string | undefined;
	options: UpgradeCliOptions;
}

const VALUE_FLAGS = new Set(["--provider"]);

/** Build upgrade execution inputs from raw command-line arguments. */
export function buildUpgradeOptionsFromCliArgs(
	args: string[],
): ParsedUpgradeCliArgs {
	return {
		targetDir: collectPositionalArgs(args)[0],
		options: {
			dryRun: args.includes("--dry-run"),
			force: args.includes("--force"),
			json: args.includes("--json"),
			provider: getFlagValue(args, args.indexOf("--provider")),
			skipContractMigration: args.includes("--skip-contract-migration"),
		},
	};
}

function collectPositionalArgs(args: string[]): string[] {
	const positionalArgs: string[] = [];
	for (let index = 0; index < args.length; index++) {
		const token = args[index];
		if (!token) continue;
		if (token.startsWith("--")) {
			if (VALUE_FLAGS.has(token)) {
				const nextToken = args[index + 1];
				if (nextToken && !nextToken.startsWith("-")) index += 1;
			}
			continue;
		}
		if (token.startsWith("-")) continue;
		positionalArgs.push(token);
	}
	return positionalArgs;
}
