import type { CommandSpec } from "./types.js";

/** Public metadata and runner for a simple command registry adapter. */
export interface DefineCommandSpecOptions {
	name: string;
	aliases?: string[];
	summary: string;
	example?: string;
	errorLabel: string;
	execute?: CommandSpec["execute"];
	runner?: CommandSpec["execute"];
}

/** Define a simple command registry adapter that forwards args to one runner. */
export function defineCommandSpec(
	options: DefineCommandSpecOptions,
): CommandSpec {
	const execute = options.execute ?? options.runner;
	if (!execute)
		throw new Error(`command spec ${options.name} is missing a runner`);
	const spec: CommandSpec = {
		name: options.name,
		summary: options.summary,
		errorLabel: options.errorLabel,
		execute,
	};
	if (options.aliases) spec.aliases = options.aliases;
	if (options.example) spec.example = options.example;
	return spec;
}
