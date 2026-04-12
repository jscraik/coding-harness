import {
	COMMAND_CATALOG_SCHEMA_VERSION,
	buildCommandCapabilityCatalogDocument,
	toCommandCapability,
} from "./registry/command-capabilities.js";
import type {
	CommandCapability,
	CommandCategory,
	CommandMutability,
	CommandRetryability,
} from "./registry/command-capabilities.js";
import { COMMAND_SPECS as EXTRACTED_COMMAND_SPECS } from "./registry/command-specs.js";
import {
	fuzzyFindCommand as fuzzyFindCommandInternal,
	normalizeCommandName,
	suggestCommands as suggestCommandsInternal,
} from "./registry/fuzzy-resolution.js";
import type {
	FuzzyCommandMatch,
	FuzzyMatchConfidence,
} from "./registry/fuzzy-resolution.js";
import type { CommandSpec, RegistryDispatchResult } from "./registry/types.js";

export { COMMAND_CATALOG_SCHEMA_VERSION, normalizeCommandName };
export type {
	CommandCapability,
	CommandCategory,
	CommandMutability,
	CommandRetryability,
	CommandSpec,
	FuzzyCommandMatch,
	FuzzyMatchConfidence,
	RegistryDispatchResult,
};

const COMMAND_SPECS: CommandSpec[] = [
	{
		name: "commands",
		summary:
			"List machine-readable command capability metadata for humans and agents",
		example: "commands --json",
		errorLabel: "Commands Catalog Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const capabilities = getRegistryCommandCapabilities();
			if (jsonFlag) {
				const payload = buildCommandCapabilityCatalogDocument(capabilities);
				console.info(JSON.stringify(payload));
				return 0;
			}

			console.info("Command capability catalog:");
			for (const capability of capabilities) {
				const category = capability.category.padEnd(22, " ");
				console.info(
					`  ${capability.name.padEnd(24, " ")} ${category} ${capability.mutability}`,
				);
			}
			console.info("");
			console.info(
				'Run "harness commands --json" for stable machine-readable metadata.',
			);
			return 0;
		},
	},
	...EXTRACTED_COMMAND_SPECS,
];

const COMMAND_INDEX = new Map<string, CommandSpec>();
for (const spec of COMMAND_SPECS) {
	COMMAND_INDEX.set(spec.name, spec);
	for (const alias of spec.aliases ?? []) {
		COMMAND_INDEX.set(alias, spec);
	}
}

export const MIGRATED_COMMAND_NAMES = COMMAND_SPECS.map((spec) => spec.name);
export const MIGRATED_COMMAND_AND_ALIAS_NAMES = COMMAND_SPECS.flatMap(
	(spec) => [spec.name, ...(spec.aliases ?? [])],
);

export function getRegistryCommandCapabilities(): CommandCapability[] {
	return COMMAND_SPECS.map((spec) => toCommandCapability(spec));
}

export function getRegistryCommandHelpRows(options?: {
	includeLegacy?: boolean;
}): Array<{
	name: string;
	summary: string;
	category: CommandCategory;
}> {
	const capabilities = getRegistryCommandCapabilities();
	const canonicalRows = capabilities.map((capability) => ({
		name: capability.name,
		summary: capability.summary,
		category: capability.category,
	}));
	if (!options?.includeLegacy) {
		return canonicalRows;
	}

	const aliasRows = capabilities.flatMap((capability) =>
		(capability.aliases ?? []).map((alias) => ({
			name: alias,
			summary: capability.summary,
			category: capability.category,
		})),
	);

	return [...canonicalRows, ...aliasRows];
}

export function dispatchRegistryCommand(
	command: string | undefined,
	args: string[],
): RegistryDispatchResult | undefined {
	if (!command) {
		return undefined;
	}
	const spec = COMMAND_INDEX.get(command);
	if (!spec) {
		return undefined;
	}
	return {
		spec,
		result: spec.execute(args.slice(1)),
	};
}

export function fuzzyFindCommand(name: string): FuzzyCommandMatch | undefined {
	return fuzzyFindCommandInternal(name, COMMAND_SPECS, COMMAND_INDEX);
}

export function suggestCommands(
	name: string,
	limit = 3,
): Array<{ spec: CommandSpec; distance: number }> {
	return suggestCommandsInternal(name, COMMAND_SPECS, limit);
}

export function suggestCommandCapabilities(
	name: string,
	limit = 3,
): Array<{
	spec: CommandSpec;
	distance: number;
	capability: CommandCapability;
}> {
	return suggestCommands(name, limit).map((suggestion) => ({
		...suggestion,
		capability: toCommandCapability(suggestion.spec),
	}));
}
