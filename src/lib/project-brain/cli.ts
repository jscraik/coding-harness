/**
 * harness brain — JSC-184, JSC-185
 *
 * Project Brain command suite for knowledge, rules, and quality management.
 */

import { cliBrainAdd } from "./add-cli.js";
import { EXIT_CODES } from "./cli-types.js";
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
	if (args.includes("--help") || args.includes("-h") || args.length === 0) {
		process.stdout.write(`Usage: harness brain <subcommand> [options]

Subcommands:
  status              Health summary of Project Brain artifacts
  query               Search across knowledge, rules, and quality criteria
  add                 Capture a learning, decision, rule, or hypothesis
  preflight           Load relevant context for a set of changed files
  stale               Report staleness of Project Brain artifacts

Options:
  --json              Output in JSON format
  --dir <path>        Target directory (default: current directory)
  --help, -h          Show this help

Examples:
  harness brain status --json
  harness brain query --query "vitest" --json
  harness brain add --type rule --domain api --content "All commands must have --help"
  harness brain add --type learning --content "Biome requires tabs for JSON"
`);
		return EXIT_CODES.SUCCESS;
	}

	const subcommand = args[0];
	const subArgs = args.slice(1);

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
		default:
			process.stderr.write(
				`Error: Unknown brain subcommand "${subcommand}"\n  Available: status, query, add, preflight, stale\n`,
			);
			return EXIT_CODES.INVALID_ARGS;
	}
}
