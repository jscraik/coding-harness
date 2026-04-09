#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
	dispatchRegistryCommand,
	fuzzyFindCommand,
	getRegistryCommandHelpRows,
	suggestCommands,
} from "./lib/cli/command-registry.js";
import { renderCommandHelpRows } from "./lib/cli/help-renderer.js";
import { parseCsvList, parseIntegerArg } from "./lib/cli/parse-utils.js";
import { sanitizeError } from "./lib/input/sanitize.js";
import { getVersion } from "./lib/version.js";

// Consolidated error handler
function handleFatalError(type: string, error: unknown): never {
	console.error(`${type}:`, sanitizeError(error));
	if (process.env.DEBUG === "1") {
		console.error("Full error (DEBUG mode):", error);
	}
	process.exit(1);
}

process.on("unhandledRejection", (reason) => {
	handleFatalError("Unhandled Rejection", reason);
});

process.on("uncaughtException", (error) => {
	handleFatalError("Uncaught Exception", error);
});

/**
 * Print the CLI usage, examples, and command list to stdout.
 *
 * When `options.includeLegacyCommands` is true the full command list (including legacy
 * commands) is shown; otherwise a focused command list is displayed and a hint is printed
 * instructing how to view legacy commands.
 *
 * This function writes help text and options to stdout/stderr and does not return a value.
 *
 * @param options - Optional settings for rendering the help output.
 * @param options.includeLegacyCommands - If true, include legacy commands in the displayed command list.
 */
function printUsage(options: { includeLegacyCommands?: boolean } = {}): void {
	const includeLegacyCommands = options.includeLegacyCommands ?? false;

	console.info("Usage: harness <command> [options]");
	console.info("");
	console.info("Start here (standard path):");
	console.info("  1. pnpm add -g @brainwav/coding-harness");
	console.info("  2. harness init --dry-run");
	console.info("  3. harness init --track");
	console.info("  4. harness contract validate");
	console.info("  5. harness health --json");
	console.info("");
	console.info("Lite mode (solo-dev / small team, under 10 minutes):");
	console.info("  1. harness init --minimal --track");
	console.info("  2. harness contract init --preset lite --force");
	console.info("  3. harness contract validate");
	console.info("  4. harness check --json");
	console.info(
		"  5. Upgrade later: harness contract init --preset standard --force",
	);
	console.info("");
	console.info("Hero workflows:");
	console.info(
		"  Bootstrap repo:    harness init --dry-run && harness init --track",
	);
	console.info("  Start on issue:    harness linear prepare --issue <KEY>");
	console.info(
		"  Submit for review: harness docs-gate --json && harness review-gate ...",
	);
	console.info("");
	console.info(
		includeLegacyCommands ? "Commands (full):" : "Commands (focused):",
	);
	for (const line of renderCommandHelpRows(
		getRegistryCommandHelpRows({ includeLegacy: includeLegacyCommands }),
	)) {
		console.info(line);
	}
	if (!includeLegacyCommands) {
		console.info("");
		console.info(
			'  Run "harness --help --all-commands" to view the full legacy command list.',
		);
	}
	console.info("");
	console.info("Options:");
	console.info("  --version, -v          Print version");
	console.info("  --help, -h             Print this help");
	console.info("  --all, --all-commands  Include legacy command list in help output");
	console.info("");
	console.info("Agent / Robot Mode:");
	console.info("  Add --json to any command for structured JSON output.");
	console.info(
		"  Exit codes: 0 = pass/success, 1 = fail/unknown command, 2 = usage error.",
	);
	console.info(
		"  Typos and camelCase/snake_case variants are auto-corrected with a note on stderr.",
	);
	console.info(
		"  On unknown commands, harness prints suggestions with examples to stdout.",
	);
}
export { parseIntegerArg, parseCsvList };

/**
 * Entrypoint that parses CLI arguments, dispatches the selected subcommand, and exits with the command's exit code.
 *
 * Parses top-level flags (--version, --help), attempts registry-based dispatch, and otherwise routes known commands
 * to their respective handlers; prints usage or an unknown-command message when appropriate. This function performs
 * process-level side effects (console output and calling process.exit) and will call the global fatal error handler
 * on unhandled asynchronous failures.
 *
 * @param args - Command-line arguments excluding the node and executable path (e.g., process.argv.slice(2)).
 */
export function run(args: string[]): void {
	const version = getVersion();
	const includeLegacyCommandsInHelp =
		args.includes("--all-commands") || args.includes("--all");

	// Handle top-level --version and --help before parsing command
	// These work even without a command
	if (args.includes("--version") || args.includes("-v")) {
		console.info(`harness v${version}`);
		return;
	}

	// Handle --help/-h before dispatching any command.
	// Short-circuit here prevents mutating commands (init, eject, ci-migrate)
	// from executing side effects when the user just wants usage text.
	if (args.includes("--help") || args.includes("-h")) {
		console.info(`harness v${version}`);
		printUsage({ includeLegacyCommands: includeLegacyCommandsInHelp });
		return;
	}

	// Parse command
	const command = args[0];
	const jsonFlag = args.includes("--json");

	// Exact registry dispatch
	const registryDispatch = dispatchRegistryCommand(command, args);
	if (registryDispatch) {
		if (registryDispatch.result instanceof Promise) {
			registryDispatch.result
				.then((exitCode) => process.exit(exitCode))
				.catch((error) =>
					handleFatalError(registryDispatch.spec.errorLabel, error),
				);
			return;
		}
		process.exit(registryDispatch.result);
		return;
	}

	// No exact match — try fuzzy resolution
	if (command) {
		const fuzzy = fuzzyFindCommand(command);
		if (fuzzy) {
			// Emit a correction note on stderr (keeps stdout JSON pristine for agents)
			const note = `harness: "${command}" interpreted as "${fuzzy.spec.name}" — use the canonical name in future calls.`;
			if (jsonFlag) {
				process.stderr.write(
					`${JSON.stringify({
						_agent_correction: true,
						received: command,
						interpreted_as: fuzzy.spec.name,
						note: `Use "${fuzzy.spec.name}" in future calls.`,
					})}\n`,
				);
			} else {
				process.stderr.write(`${note}\n`);
			}
			// Re-dispatch with the canonical name
			const correctedArgs = [fuzzy.spec.name, ...args.slice(1)];
			const correctedDispatch = dispatchRegistryCommand(
				fuzzy.spec.name,
				correctedArgs,
			);
			if (correctedDispatch) {
				if (correctedDispatch.result instanceof Promise) {
					correctedDispatch.result
						.then((exitCode) => process.exit(exitCode))
						.catch((error) =>
							handleFatalError(correctedDispatch.spec.errorLabel, error),
						);
					return;
				}
				process.exit(correctedDispatch.result);
				return;
			}
		}

		// No match at all — rich error message with suggestions
		const suggestions = suggestCommands(command);
		if (jsonFlag) {
			console.info(
				JSON.stringify({
					status: "error",
					error: "unknown_command",
					received: command,
					suggestions: suggestions.map(({ spec }) => ({
						name: spec.name,
						summary: spec.summary,
						...(spec.example ? { example: `harness ${spec.example}` } : {}),
					})),
					hint: 'Run "harness --help" for the full command list.',
				}),
			);
		} else {
			console.info(`Unknown command: "${command}"`);
			console.info("");
			console.info("Did you mean one of these?");
			for (const { spec } of suggestions) {
				console.info(`  ${spec.name.padEnd(24)} ${spec.summary}`);
				if (spec.example) {
					console.info(`  ${"".padEnd(24)} Example: harness ${spec.example}`);
				}
			}
			console.info("");
			console.info('Run "harness --help" for the full command list.');
		}
		process.exit(1);
		return;
	}

	// No command at all — show help
	console.info(`harness v${version}`);
	printUsage();
}

function canonicalizeExecutablePath(filePath: string): string {
	const resolvedPath = resolve(filePath);
	try {
		return realpathSync(resolvedPath);
	} catch {
		return resolvedPath;
	}
}

export function isDirectExecution(
	entrypoint = process.argv[1],
	moduleUrl = import.meta.url,
): boolean {
	if (!entrypoint) {
		return false;
	}

	const entrypointHref = pathToFileURL(
		canonicalizeExecutablePath(entrypoint),
	).href;
	const moduleHref = pathToFileURL(
		canonicalizeExecutablePath(fileURLToPath(moduleUrl)),
	).href;

	return moduleHref === entrypointHref;
}

if (isDirectExecution()) {
	run(process.argv.slice(2));
}