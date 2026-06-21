import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
	COMMAND_CATALOG_SCHEMA_VERSION,
	type CommandAgentCatalogMode,
	type CommandAgentMode,
	type CommandCapability,
	type CommandCapabilityCatalogDocument,
	type CommandCategory,
	type CommandMutability,
	type CommandOrchestrator,
	type CommandPrimaryAudience,
	type CommandRetryability,
	type CommandTier,
	type CommandVisibility,
	getCommandCapabilities,
	getAgentCommandCapabilityCatalogDocument,
	getCommandCapabilityCatalogDocument,
	isFirstContactCommandName,
	parseAgentCatalogMode,
} from "./registry/command-capabilities.js";
import { suggestCommandCapabilities as suggestCatalogCapabilities } from "./registry/command-fuzzy.js";
import { COMMAND_SPECS as EXTRACTED_COMMAND_SPECS } from "./registry/command-specs.js";
import {
	type FuzzyCommandMatch,
	type FuzzyMatchConfidence,
	fuzzyFindCommand as fuzzyFindRegistryCommand,
	normalizeCommandName,
	suggestCommands as suggestRegistryCommands,
} from "./registry/fuzzy-resolution.js";
import { SOURCE_OUTLINE_COMMAND_SPEC } from "./registry/source-outline-spec.js";
import type { CommandSpec, RegistryDispatchResult } from "./registry/types.js";

export type {
	CommandCapability,
	CommandCapabilityCatalogDocument,
	CommandAgentCatalogMode,
	CommandAgentMode,
	CommandCategory,
	CommandMutability,
	CommandOrchestrator,
	CommandPrimaryAudience,
	CommandRetryability,
	CommandTier,
	CommandVisibility,
	CommandSpec,
	FuzzyCommandMatch,
	FuzzyMatchConfidence,
	RegistryDispatchResult,
};

export { COMMAND_CATALOG_SCHEMA_VERSION, normalizeCommandName };

const COMMAND_SPECS: CommandSpec[] = [
	{
		name: "prompt-context-drift:write",
		summary: "Write the prompt-context drift report for the current repo",
		example: "prompt-context-drift:write",
		errorLabel: "Prompt Context Drift Write Error",
		execute: (args) =>
			runPackagedPromptContextScript(
				"write-prompt-context-drift-report.cjs",
				args.length > 0 ? args : ["--repo-root", "."],
			),
	},
	{
		name: "prompt-context-drift:validate",
		summary: "Validate a prompt-context drift report for the current repo",
		example: "prompt-context-drift:validate",
		errorLabel: "Prompt Context Drift Validate Error",
		execute: (args) =>
			runPackagedPromptContextScript(
				"validate-prompt-context-drift.cjs",
				args.length > 0
					? args
					: [
							"artifacts/context-integrity/prompt-context-drift-report.json",
							"--repo-root",
							".",
						],
			),
	},
	{
		name: "commands",
		summary:
			"List machine-readable command capability metadata for humans and agents",
		example: "commands --json",
		errorLabel: "Commands Catalog Error",
		execute: runCommandsCatalog,
	},
	SOURCE_OUTLINE_COMMAND_SPEC,
	...EXTRACTED_COMMAND_SPECS,
];

function runCommandsCatalog(args: readonly string[]): number {
	const jsonFlag = args.includes("--json");
	const forAgentFlag = args.includes("--for-agent");
	const fullCatalogFlag = args.includes("--all") || args.includes("--plumbing");
	const agentMode = parseAgentCatalogMode(args);
	if (forAgentFlag && !fullCatalogFlag && agentMode === "invalid") {
		console.error(
			"Error: --mode must be orient, verify, review, or handoff when used with commands --for-agent",
		);
		return 2;
	}
	const catalog = commandCatalogForFlags(
		forAgentFlag,
		fullCatalogFlag,
		agentMode,
	);
	if (jsonFlag) {
		console.info(JSON.stringify(catalog));
		return 0;
	}
	printCommandCatalog(catalog, forAgentFlag && !fullCatalogFlag);
	return 0;
}

function commandCatalogForFlags(
	forAgentFlag: boolean,
	fullCatalogFlag: boolean,
	agentMode: CommandAgentCatalogMode | undefined | "invalid",
): CommandCapabilityCatalogDocument {
	return forAgentFlag && !fullCatalogFlag
		? getRegistryAgentCommandCatalogDocument(
				agentMode !== "invalid" ? agentMode : undefined,
			)
		: getRegistryCommandCatalogDocument();
}

function printCommandCatalog(
	catalog: CommandCapabilityCatalogDocument,
	forAgent: boolean,
): void {
	console.info("Command capability catalog:");
	for (const capability of catalog.commands) {
		const category = capability.category.padEnd(22, " ");
		console.info(
			`  ${capability.name.padEnd(24, " ")} ${category} ${capability.mutability}`,
		);
	}
	console.info("");
	console.info(
		forAgent
			? 'Run "harness commands --json --all" for the full capability catalog.'
			: 'Run "harness commands --json --for-agent" for the public agent rail set.',
	);
}

function runPackagedPromptContextScript(
	scriptName: string,
	args: readonly string[],
): number {
	const scriptPath = fileURLToPath(
		new URL(`../../../scripts/${scriptName}`, import.meta.url),
	);
	const result = spawnSync(process.execPath, [scriptPath, ...args], {
		stdio: "inherit",
	});
	if (result.error) {
		console.error(
			"Error: packaged prompt-context drift script failed to start.",
		);
		return 1;
	}
	return result.status ?? 1;
}

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

/** Return command capability metadata for every registered CLI command. */
export function getRegistryCommandCapabilities(): CommandCapability[] {
	return getCommandCapabilities(COMMAND_SPECS);
}

/** Build the versioned command capability catalog for `harness commands --json`. */
export function getRegistryCommandCatalogDocument(): CommandCapabilityCatalogDocument {
	return getCommandCapabilityCatalogDocument(COMMAND_SPECS);
}

/** Build the public agent rail catalog for `harness commands --json --for-agent`. */
export function getRegistryAgentCommandCatalogDocument(
	mode?: CommandAgentCatalogMode,
): CommandCapabilityCatalogDocument {
	return getAgentCommandCapabilityCatalogDocument(COMMAND_SPECS, mode);
}

/**
 * Build display-ready help rows for registered commands.
 *
 * When `options.includeExpert` is not set, only canonical commands intended for
 * first-contact are included; when set to `true`, expert command and alias rows
 * are appended.
 *
 * @param options - Optional settings
 * @param options.includeExpert - If `true`, include expert rows and aliases alongside canonical rows
 * @returns An array of help rows, each containing `name`, `summary`, and optional `category` and `tier`
 */
export function getRegistryCommandHelpRows(options?: {
	includeExpert?: boolean;
}): Array<{
	name: string;
	summary: string;
	category?: CommandCategory;
	tier?: CommandTier;
}> {
	const capabilities = getRegistryCommandCapabilities();
	const displayCapabilities = options?.includeExpert
		? capabilities
		: capabilities.filter((capability) =>
				isFirstContactCommandName(capability.name),
			);
	const canonicalRows = displayCapabilities.map((capability) => ({
		name: capability.name,
		summary: capability.summary,
		category: capability.category,
		tier: capability.tier,
	}));
	if (!options?.includeExpert) {
		return canonicalRows;
	}

	const aliasRows = displayCapabilities.flatMap((capability) =>
		(capability.aliases ?? []).map((alias) => ({
			name: alias,
			summary: capability.summary,
			category: capability.category,
			tier: capability.tier,
		})),
	);

	return [...canonicalRows, ...aliasRows];
}

/** Dispatch one CLI command name plus the original CLI argument vector. */
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

/** Fuzzy-find a registered command by name or alias. */
export function fuzzyFindCommand(name: string): FuzzyCommandMatch | undefined {
	return fuzzyFindRegistryCommand(name, COMMAND_SPECS, COMMAND_INDEX);
}

/** Suggest likely registered commands for an unknown command name. */
export function suggestCommands(
	name: string,
	limit = 3,
): Array<{ spec: CommandSpec; distance: number }> {
	return suggestRegistryCommands(name, COMMAND_SPECS, limit);
}

/** Suggest likely command capabilities for an unknown command name. */
export function suggestCommandCapabilities(
	name: string,
	limit = 3,
): Array<{ capability: CommandCapability; distance: number }> {
	return suggestCatalogCapabilities(
		name,
		getRegistryCommandCapabilities(),
		limit,
	);
}
