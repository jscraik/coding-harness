#!/usr/bin/env node

import { runLocalMemoryPreflightCLI } from "../commands/local-memory-preflight.js";

/**
 * Retrieve the value immediately following a specific command-line flag in an argument list.
 *
 * @param args - The argv-style array to search (e.g., process.argv.slice(2)).
 * @param flag - The exact flag to locate (matched by equality).
 * @returns The string that follows `flag` in `args`, or `undefined` if `flag` is not present or has no following element.
 */
function getFlagValue(args: string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	if (index === -1) {
		return undefined;
	}
	return args[index + 1];
}

const args = process.argv.slice(2);
const configPath = getFlagValue(args, "--config");
const daemonLogPath = getFlagValue(args, "--daemon-log");

runLocalMemoryPreflightCLI({
	...(configPath ? { configPath } : {}),
	...(daemonLogPath ? { daemonLogPath } : {}),
	json: args.includes("--json"),
})
	.then((exitCode) => process.exit(exitCode))
	.catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	});
