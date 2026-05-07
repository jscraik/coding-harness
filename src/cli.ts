#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
	dispatchRegistryCommand,
	fuzzyFindCommand,
	getRegistryCommandHelpRows,
	suggestCommandCapabilities,
	suggestCommands,
} from "./lib/cli/command-registry.js";
import {
	renderCommandHelpRows,
	renderGroupedCommandHelpRows,
} from "./lib/cli/help-renderer.js";
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
 * Print CLI usage, examples, and the command list to stdout.
 *
 * When `options.includeLegacyCommands` is true the displayed list includes expert commands;
 * otherwise a focused command list is shown and a hint for viewing expert commands is printed.
 *
 * @param options - Optional settings for rendering the help output.
 * @param options.includeLegacyCommands - If true, include expert commands in the displayed command list.
 */
function printUsage(options: { includeLegacyCommands?: boolean } = {}): void {
	const includeLegacyCommands = options.includeLegacyCommands ?? false;

	console.info("Usage: harness <command> [options]");
	console.info("");
	console.info("Start here: harness next --json");
	console.info("");
	console.info("Agent memory rule:");
	console.info("  Run harness next --json first.");
	console.info(
		"  Let that decision packet choose setup, checks, review, or repair.",
	);
	console.info("");
	const helpRows = getRegistryCommandHelpRows({
		includeLegacy: includeLegacyCommands,
	});
	console.info(
		includeLegacyCommands
			? "Commands (full, with aliases):"
			: "Commands (focused):",
	);
	for (const line of includeLegacyCommands
		? renderCommandHelpRows(helpRows)
		: renderGroupedCommandHelpRows(helpRows)) {
		console.info(line);
	}
	if (!includeLegacyCommands) {
		console.info("");
		console.info(
			'  Run "harness --help --all-commands" to view the full expert command list.',
		);
		console.info(
			'  Run "harness commands --json" for explicit machine/expert discovery.',
		);
	}
	console.info("");
	console.info("Options:");
	console.info("  --version, -v          Print version");
	console.info("  --help, -h             Print this help");
	console.info(
		"  --all, --all-commands  Include expert command list in help output",
	);
	console.info(
		"  --allow-fuzzy          Opt in to typo/case auto-correction for command names",
	);
	console.info("  --no-fuzzy             Disable fuzzy command correction");
	console.info("");
	console.info("Agent / Robot Mode:");
	console.info(
		"  Add --json to commands that support machine-readable output.",
	);
	console.info(
		"  Exit codes: default contract is 0 = pass/success, 1 = fail/unknown command, 2 = usage error.",
	);
	console.info(
		"  Some command families preserve richer process exit semantics (for example wrapper pass-through commands).",
	);
	console.info(
		"  On unknown commands, harness prints suggestions with examples to stdout.",
	);
	console.info(
		"  Fuzzy correction is opt-in via --allow-fuzzy or HARNESS_ALLOW_FUZZY_COMMANDS=1.",
	);
}
export { parseIntegerArg, parseCsvList };

/**
 * Attempt fuzzy command resolution and dispatch if a match is found.
 *
 * @returns `true` if fuzzy dispatch occurred and process termination has been scheduled
 */
function tryFuzzyDispatch(
	command: string | undefined,
	dispatchArgs: string[],
	allowFuzzy: boolean,
	jsonFlag: boolean,
): boolean {
	if (!command || !allowFuzzy) {
		return false;
	}
	const fuzzy = fuzzyFindCommand(command);
	if (!fuzzy) {
		return false;
	}
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
	const correctedArgs = [fuzzy.spec.name, ...dispatchArgs.slice(1)];
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
			return true;
		}
		process.exit(correctedDispatch.result);
		return true;
	}
	return false;
}

/**
 * Parse top-level flags, dispatch the requested CLI command (exact or fuzzy), and terminate the process with the command's exit code.
 *
 * Handles top-level `--version` and `--help` behavior, emits fuzzy-correction notices when applicable, prints usage or rich unknown-command suggestions (plain or JSON), and routes asynchronous command failures to the global fatal error handler.
 *
 * @param args - Command-line arguments excluding the node and executable path (e.g., `process.argv.slice(2)`)
 */
export function run(args: string[]): void {
	const allowFuzzyFlag = args.includes("--allow-fuzzy");
	const disableFuzzyFlag = args.includes("--no-fuzzy");
	const allowFuzzyFromEnv = process.env.HARNESS_ALLOW_FUZZY_COMMANDS === "1";
	const allowFuzzy = !disableFuzzyFlag && (allowFuzzyFlag || allowFuzzyFromEnv);
	const dispatchArgs = args.filter(
		(arg) => arg !== "--allow-fuzzy" && arg !== "--no-fuzzy",
	);
	const version = getVersion();
	const firstArg = dispatchArgs[0];
	const hasCommandToken =
		typeof firstArg === "string" &&
		firstArg.length > 0 &&
		!firstArg.startsWith("-");
	const includeLegacyCommandsInHelp =
		dispatchArgs.includes("--all-commands") || dispatchArgs.includes("--all");
	const noCommandHelpRequested =
		!hasCommandToken &&
		dispatchArgs.some((arg) => arg === "--help" || arg === "-h");
	const commandHelpFlagIndex = hasCommandToken
		? dispatchArgs.findIndex(
				(arg, index) => index > 0 && (arg === "--help" || arg === "-h"),
			)
		: -1;

	// Handle top-level --version before parsing command.
	// This only applies in no-command mode.
	if (!hasCommandToken && (firstArg === "--version" || firstArg === "-v")) {
		console.info(`harness v${version}`);
		return;
	}

	// Handle top-level --help/-h in no-command mode.
	// In command mode, only short-circuit when help is the first command option
	// (`harness <command> --help`) so malformed invocations like
	// `harness policy-gate --files --help` still return usage errors.
	if (
		noCommandHelpRequested ||
		(hasCommandToken && commandHelpFlagIndex === 1)
	) {
		console.info(`harness v${version}`);
		printUsage({ includeLegacyCommands: includeLegacyCommandsInHelp });
		return;
	}

	// Parse command
	const command = dispatchArgs[0];
	const jsonFlag = dispatchArgs.includes("--json");

	// Exact registry dispatch
	const registryDispatch = dispatchRegistryCommand(command, dispatchArgs);
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

	const fuzzyDispatch = tryFuzzyDispatch(
		command,
		dispatchArgs,
		allowFuzzy,
		jsonFlag,
	);
	if (fuzzyDispatch) {
		return;
	}
	if (command) {
		// No match at all — rich error message with suggestions
		const expertHelpHint =
			'Run "harness --help --all-commands" for the full expert command list.';
		const suggestions = suggestCommands(command);
		if (jsonFlag) {
			const capabilitySuggestions = suggestCommandCapabilities(command);
			console.info(
				JSON.stringify({
					status: "error",
					error: "unknown_command",
					received: command,
					suggestions: capabilitySuggestions.map(({ capability }) => ({
						name: capability.name,
						summary: capability.summary,
						mutability: capability.mutability,
						retryability: capability.retryability,
						requiredFlags: capability.requiredFlags,
						safeFirstAlternatives: capability.safeFirstAlternatives,
						...(capability.example
							? { example: `harness ${capability.example}` }
							: {}),
					})),
					hint: expertHelpHint,
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
			console.info(expertHelpHint);
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

/**
 * Detects whether this module is being executed directly as the CLI entrypoint.
 *
 * @param entrypoint - Process entrypoint path
 * @param moduleUrl - Current module URL
 * @returns True when running as the direct executable module
 */
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
