import type { CommandSpec } from "./types.js";

/** Metadata needed to define a simple command registry adapter. */
export interface DefineCommandSpecOptions {
	/** Canonical command name. */
	name: CommandSpec["name"];
	/** Optional alias names that dispatch to the same command. */
	aliases?: CommandSpec["aliases"];
	/** Human and machine-readable command summary. */
	summary: CommandSpec["summary"];
	/** Error label rendered for command failures. */
	errorLabel: CommandSpec["errorLabel"];
	/** Canonical example invocation shown in suggestions. */
	example?: CommandSpec["example"];
	/** Command runner that receives args after the command name is stripped. */
	runner: CommandSpec["execute"];
}

/** Define a command spec whose registry adapter only forwards to a runner. */
export function defineCommandSpec(
	options: DefineCommandSpecOptions,
): CommandSpec {
	return {
		name: options.name,
		...(options.aliases ? { aliases: options.aliases } : {}),
		summary: options.summary,
		...(options.example ? { example: options.example } : {}),
		errorLabel: options.errorLabel,
		execute: options.runner,
	};
}
