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
 * When `options.includeExpertCommands` is true the displayed list includes expert commands;
 * otherwise a focused command list is shown and a hint for viewing expert commands is printed.
 *
 * @param options - Optional settings for rendering the help output.
 * @param options.includeExpertCommands - If true, include expert commands in the displayed command list.
 */
function printUsage(options: { includeExpertCommands?: boolean } = {}): void {
	const includeExpertCommands = options.includeExpertCommands ?? false;

	console.info("Usage: harness <command> [options]");
	console.info("");
	console.info("Start here: harness next --json");
	console.info("");
	console.info("Agent memory rule:");
	console.info(
		"  Run harness next --json first for compact route and orientation.",
	);
	console.info("  Use harness orient --json only for legacy compatibility.");
	console.info("");
	const helpRows = getRegistryCommandHelpRows({
		includeExpert: includeExpertCommands,
	});
	console.info(
		includeExpertCommands
			? "Commands (full, with aliases):"
			: "Commands (focused):",
	);
	for (const line of includeExpertCommands
		? renderCommandHelpRows(helpRows)
		: renderGroupedCommandHelpRows(helpRows)) {
		console.info(line);
	}
	if (!includeExpertCommands) {
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

function stripOptionalBinaryPrefix(args: string[]): string[] {
	return args[0] === "harness" ? args.slice(1) : args;
}

type RegistryDispatch = NonNullable<ReturnType<typeof dispatchRegistryCommand>>;

interface RunState {
	dispatchArgs: string[];
	version: string;
	command: string | undefined;
	jsonFlag: boolean;
	allowFuzzy: boolean;
	includeExpertCommandsInHelp: boolean;
	hasCommandToken: boolean;
	noCommandHelpRequested: boolean;
	commandHelpFlagIndex: number;
	firstArg: string | undefined;
}

/** Parse top-level CLI flags and command identity once for dispatch. */
function parseRunState(args: string[]): RunState {
	const allowFuzzyFlag = args.includes("--allow-fuzzy");
	const disableFuzzyFlag = args.includes("--no-fuzzy");
	const allowFuzzyFromEnv = process.env.HARNESS_ALLOW_FUZZY_COMMANDS === "1";
	const dispatchArgs = stripOptionalBinaryPrefix(args).filter(
		(arg) => arg !== "--allow-fuzzy" && arg !== "--no-fuzzy",
	);
	const firstArg = dispatchArgs[0];
	const hasCommandToken =
		typeof firstArg === "string" &&
		firstArg.length > 0 &&
		!firstArg.startsWith("-");
	return {
		dispatchArgs,
		version: getVersion(),
		command: firstArg,
		jsonFlag: dispatchArgs.includes("--json"),
		allowFuzzy: !disableFuzzyFlag && (allowFuzzyFlag || allowFuzzyFromEnv),
		includeExpertCommandsInHelp:
			dispatchArgs.includes("--all-commands") || dispatchArgs.includes("--all"),
		hasCommandToken,
		noCommandHelpRequested:
			!hasCommandToken &&
			dispatchArgs.some((arg) => arg === "--help" || arg === "-h"),
		commandHelpFlagIndex: hasCommandToken
			? dispatchArgs.findIndex(
					(arg, index) => index > 0 && (arg === "--help" || arg === "-h"),
				)
			: -1,
		firstArg,
	};
}

/** Schedule process termination for a registry command result. */
function exitFromRegistryDispatch(dispatch: RegistryDispatch): void {
	if (dispatch.result instanceof Promise) {
		dispatch.result
			.then((exitCode) => process.exit(exitCode))
			.catch((error) => handleFatalError(dispatch.spec.errorLabel, error));
		return;
	}
	process.exit(dispatch.result);
}

/** Handle top-level version/help flags before command dispatch. */
function printTopLevelMetaIfRequested(state: RunState): boolean {
	if (
		!state.hasCommandToken &&
		(state.firstArg === "--version" || state.firstArg === "-v")
	) {
		console.info(`harness v${state.version}`);
		return true;
	}
	if (
		state.noCommandHelpRequested ||
		(state.hasCommandToken && state.commandHelpFlagIndex === 1)
	) {
		console.info(`harness v${state.version}`);
		printUsage({
			includeExpertCommands: state.includeExpertCommandsInHelp,
		});
		return true;
	}
	return false;
}

/** Dispatch an exact registry command when present. */
function dispatchExactCommand(
	command: string | undefined,
	args: string[],
): boolean {
	const registryDispatch = dispatchRegistryCommand(command, args);
	if (!registryDispatch) return false;
	exitFromRegistryDispatch(registryDispatch);
	return true;
}

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
		exitFromRegistryDispatch(correctedDispatch);
		return true;
	}
	return false;
}

/** Render the rich unknown-command response and exit with the unknown-command code. */
function exitUnknownCommand(command: string, jsonFlag: boolean): void {
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
}

/**
 * Parse top-level flags, dispatch the requested CLI command (exact or fuzzy), and terminate the process with the command's exit code.
 *
 * Handles top-level `--version` and `--help` behavior, emits fuzzy-correction notices when applicable, prints usage or rich unknown-command suggestions (plain or JSON), and routes asynchronous command failures to the global fatal error handler.
 *
 * @param args - Command-line arguments excluding the node and executable path (e.g., `process.argv.slice(2)`)
 */
export function run(args: string[]): void {
	const state = parseRunState(args);
	if (printTopLevelMetaIfRequested(state)) {
		return;
	}

	if (dispatchExactCommand(state.command, state.dispatchArgs)) {
		return;
	}

	const fuzzyDispatch = tryFuzzyDispatch(
		state.command,
		state.dispatchArgs,
		state.allowFuzzy,
		state.jsonFlag,
	);
	if (fuzzyDispatch) {
		return;
	}
	if (state.command) {
		exitUnknownCommand(state.command, state.jsonFlag);
		return;
	}

	// No command at all — show help
	console.info(`harness v${state.version}`);
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
