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
			'  Run "harness --help --all-commands" to view the full legacy command list.',
		);
	}
	console.info("");
	console.info("Options:");
	console.info("  --version, -v          Print version");
	console.info("  --help, -h             Print this help");
	console.info(
		"  --all, --all-commands  Include legacy command list in help output",
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
 * @returns `true` if fuzzy dispatch occurred (function has already exited the process)
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
 * Dispatches a CLI command from the provided argv slice and exits with the command's exit code.
 *
 * Handles top-level flags (`--version`, `--help`), performs exact and fuzzy registry dispatch, prints usage
 * or an unknown-command report with suggestions, and emits correction notes to stderr when a fuzzy match is used.
 * This function performs process-level side effects (console output and calling `process.exit`) and routes
 * asynchronous failures to the global fatal error handler.
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
