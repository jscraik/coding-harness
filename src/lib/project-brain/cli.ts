/**
 * harness brain — JSC-184, JSC-185
 *
 * Project Brain command suite for knowledge, rules, and quality management.
 */

import { cliBrainAdd } from "./add-cli.js";
import { EXIT_CODES } from "./cli-types.js";
import {
	BRAIN_SUBCOMMAND_SET,
	renderBrainSubcommandHelp,
	renderBrainTopLevelHelp,
} from "./help.js";
import { cliBrainLint } from "./lint-cli.js";
import { cliBrainPreflight } from "./preflight-cli.js";
import { cliBrainQuery } from "./query-cli.js";
import { cliBrainStale } from "./stale-cli.js";
import { cliBrainStatus } from "./status-cli.js";

export { runBrainAdd } from "./add-cli.js";
export {
	EXIT_CODES,
	type BrainAddResult,
	type BrainAddType,
	type BrainCliResult,
	type BrainPreflightContext,
	type BrainPreflightResult,
	type BrainQueryMatch,
	type BrainQueryResult,
	type BrainStaleResult,
	type BrainStatusResult,
} from "./cli-types.js";
export type { BrainLintResult } from "./lint-types.js";
export { runBrainLint } from "./lint-cli.js";
export { runBrainPreflight } from "./preflight-cli.js";
export { runBrainQuery } from "./query-cli.js";
export { runBrainStale } from "./stale-cli.js";
export { runBrainStatus } from "./status-cli.js";

/**
 * Entrypoint that parses arguments and dispatches the `harness brain` subcommands.
 *
 * @param args - Command-line arguments passed to the CLI.
 * @returns An integer exit code: 0 for success, 1 for warnings, 2 for errors, 3 for not found, 4 for invalid arguments.
 */
export function runBrainCLI(args: string[]): number {
	const subcommand = args[0];
	const shouldShowTopLevelHelp =
		args.length === 0 || subcommand === "--help" || subcommand === "-h";
	if (shouldShowTopLevelHelp) {
		process.stdout.write(renderBrainTopLevelHelp());
		return EXIT_CODES.SUCCESS;
	}

	const subArgs = args.slice(1);

	if (!BRAIN_SUBCOMMAND_SET.has(subcommand ?? "")) {
		process.stderr.write(
			`Error: Unknown brain subcommand "${subcommand}"\n  Available: ${[...BRAIN_SUBCOMMAND_SET].join(", ")}\n`,
		);
		return EXIT_CODES.INVALID_ARGS;
	}

	if (subArgs.includes("--help") || subArgs.includes("-h")) {
		const help = renderBrainSubcommandHelp(subcommand ?? "");
		if (help) {
			process.stdout.write(help);
			return EXIT_CODES.SUCCESS;
		}
	}

	switch (subcommand) {
		case "status": {
			const r = cliBrainStatus(subArgs);
			return r.exitCode;
		}
		case "query": {
			const r = cliBrainQuery(subArgs);
			return r.exitCode;
		}
		case "add": {
			const r = cliBrainAdd(subArgs);
			return r.exitCode;
		}
		case "preflight": {
			const r = cliBrainPreflight(subArgs);
			return r.exitCode;
		}
		case "stale": {
			const r = cliBrainStale(subArgs);
			return r.exitCode;
		}
		case "lint": {
			const r = cliBrainLint(subArgs);
			return r.exitCode;
		}
		default:
			return EXIT_CODES.INVALID_ARGS;
	}
}
