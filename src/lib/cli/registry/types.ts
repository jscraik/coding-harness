export interface CommandSpec {
	name: string;
	aliases?: string[];
	summary: string;
	errorLabel: string;
	/** Canonical example invocation shown in error suggestions (omit "harness " prefix). */
	example?: string;
	execute: (args: string[]) => number | Promise<number>;
}

export interface RegistryDispatchResult {
	spec: CommandSpec;
	result: number | Promise<number>;
}
