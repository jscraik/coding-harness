import {
	type UILoopCommandSpec,
	parseUILoopCommandSpec,
} from "../lib/contract/ui-loop-command.js";

/** Normalized UI loop command specification. */
export type CommandSpec = UILoopCommandSpec;

/**
 * Parse a UI loop command string into a structured command spec.
 *
 * @param command - The command string to parse
 * @returns A result containing the parsed CommandSpec or an error message
 */
export function parseCommandSpec(
	command: string,
): { ok: true; value: CommandSpec } | { ok: false; error: string } {
	return parseUILoopCommandSpec(command);
}

/**
 * Append forwarded arguments to a policy command spec, inserting -- separator
 * for npm run commands when needed.
 *
 * @param spec - The base command spec from policy
 * @param forwardedArgs - Arguments to append
 * @returns A new command spec with forwarded args merged
 */
export function appendForwardedArgsToPolicyCommand(
	spec: CommandSpec,
	forwardedArgs: string[],
): CommandSpec {
	if (forwardedArgs.length === 0) {
		return {
			command: spec.command,
			args: [...spec.args],
		};
	}
	const isNpmRunCommand = spec.command === "npm" && spec.args[0] === "run";
	if (!isNpmRunCommand) {
		return {
			command: spec.command,
			args: [...spec.args, ...forwardedArgs],
		};
	}
	const hasSeparator = spec.args.includes("--");
	return {
		command: spec.command,
		args: hasSeparator
			? [...spec.args, ...forwardedArgs]
			: [...spec.args, "--", ...forwardedArgs],
	};
}

/**
 * Format a single command argument for display, JSON-stringifying when necessary.
 *
 * @param arg - The argument to format
 * @returns The formatted argument string
 */
export function formatCommandArg(arg: string): string {
	return /^[A-Za-z0-9_./:@%+=,-]+$/.test(arg) ? arg : JSON.stringify(arg);
}

/**
 * Format a command spec into a human-readable display string.
 *
 * @param spec - The command spec to format
 * @returns A shell-like command string
 */
export function formatCommandDisplay(spec: CommandSpec): string {
	return [spec.command, ...spec.args.map(formatCommandArg)].join(" ");
}
