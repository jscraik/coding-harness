import type { CommandSpec } from "./types.js";

/** Public metadata and runner for a simple command registry adapter. */
export interface DefineCommandSpecOptions {
	name: string;
	aliases?: string[];
	summary: string;
	example?: string;
	errorLabel: string;
	execute: CommandSpec["execute"];
}

/** Define a simple command registry adapter that forwards args to one runner. */
export function defineCommandSpec(
	options: DefineCommandSpecOptions,
): CommandSpec {
	return { ...options };
}
