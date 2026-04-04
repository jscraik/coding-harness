#!/usr/bin/env node

import { runLocalMemoryPreflightCLI } from "../commands/local-memory-preflight.js";

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
