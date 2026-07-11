import type { CommandSpec } from "./types.js";
import {
	AGENT_CATALOG_COMMAND_NAMES,
	FIRST_CONTACT_COMMAND_NAMES,
} from "./command-agent-catalog-rules.js";
import {
	type CommandInvocationEffect,
	getCommandEffectCharacterization,
	getCommandInvocationEffects,
	getInvocationMutability,
} from "./command-invocation-effects.js";
import {
	AGENT_MODE_BY_NAME,
	COMMAND_CATEGORY_BY_NAME,
	COMMAND_TIER_BY_NAME,
	COMMAND_VISIBILITY_BY_NAME,
	EXPECTED_ARTIFACTS_BY_NAME,
	ORCHESTRATED_BY_BY_NAME,
	PRIMARY_AUDIENCE_BY_NAME,
	REQUIRED_FLAGS_BY_NAME,
	RETRYABILITY_BY_NAME,
	SAFE_FIRST_ALTERNATIVES_BY_NAME,
	WRITE_COMMANDS,
} from "./command-capability-rules.js";
export const COMMAND_CATALOG_SCHEMA_VERSION = "harness-command-catalog/v4";
/** High-level grouping used by command help and machine-readable catalogs. */
export type CommandCategory =
	| "discovery"
	| "bootstrap-governance"
	| "review-policy"
	| "workflow-linear"
	| "pilot-remediation"
	| "drift-search-evidence"
	| "uncategorized";
export const COMMAND_CATEGORY_ORDER = [
	"discovery",
	"bootstrap-governance",
	"review-policy",
	"workflow-linear",
	"pilot-remediation",
	"drift-search-evidence",
	"uncategorized",
] as const satisfies readonly CommandCategory[];
export const COMMAND_CATEGORY_LABELS: Readonly<
	Record<CommandCategory, string>
> = {
	discovery: "Discovery",
	"bootstrap-governance": "Bootstrap & Governance",
	"review-policy": "Review & Policy",
	"workflow-linear": "Linear & Workflow",
	"pilot-remediation": "Pilot & Remediation",
	"drift-search-evidence": "Drift, Search & Evidence",
	uncategorized: "Other",
};
/** Whether a command is expected to mutate the repository or external state. */
export type CommandMutability = "read" | "write";

/** How safely an agent can retry a command after failure or interruption. */
export type CommandRetryability = "safe" | "conditional" | "manual";

/** Default discovery tier for human help and agent routing. */
export type CommandTier = "cockpit" | "domain" | "plumbing" | "legacy";

/** Primary consumer for a command capability. */
export type CommandPrimaryAudience = "agent" | "human" | "both";

/** Cockpit commands that may orchestrate or recommend expert commands. */
export type CommandOrchestrator = "next" | "pr-ready" | "fix-review" | "learn";

/** Agent moment served by a command in the public command surface. */
export type CommandAgentMode =
	| "orient"
	| "plan"
	| "verify"
	| "review"
	| "repair"
	| "handoff"
	| "learn"
	| "admin";

/** Bounded catalog modes exposed by `harness commands --json --for-agent --mode`. */
export type CommandAgentCatalogMode =
	| "orient"
	| "verify"
	| "review"
	| "handoff";

/** Discovery layer where a command should appear by default. */
export type CommandVisibility =
	| "default"
	| "agent"
	| "advanced"
	| "plumbing"
	| "hidden"
	| "legacy";

/** Machine-readable command discovery metadata, including invocation effects. */
export interface CommandCapability {
	name: string;
	aliases: string[];
	summary: string;
	example?: string;
	category: CommandCategory;
	mutability: CommandMutability;
	requiredFlags: string[];
	expectedArtifacts: string[];
	effectCharacterization: "characterized" | "legacy_uncharacterized";
	invocationEffects: CommandInvocationEffect[];
	retryability: CommandRetryability;
	safeFirstAlternatives: string[];
	tier: CommandTier;
	primaryAudience: CommandPrimaryAudience;
	orchestratedBy: CommandOrchestrator[];
	agentMode: CommandAgentMode;
	visibility: CommandVisibility;
}

/** Versioned command capability catalog emitted by `harness commands --json`. */
export interface CommandCapabilityCatalogDocument {
	schemaVersion: typeof COMMAND_CATALOG_SCHEMA_VERSION;
	generatedAt: string;
	commandCount: number;
	commands: CommandCapability[];
}

function getAgentCatalogCommandNames(
	mode: CommandAgentCatalogMode | undefined,
): ReadonlySet<string> {
	return new Set(AGENT_CATALOG_COMMAND_NAMES[mode ?? "default"]);
}

/** Parse the optional agent catalog phase mode from command arguments. */
export function parseAgentCatalogMode(
	args: readonly string[],
): CommandAgentCatalogMode | undefined | "invalid" {
	const modeIndex = args.indexOf("--mode");
	if (modeIndex === -1) return undefined;
	const mode = args[modeIndex + 1];
	if (
		mode === "orient" ||
		mode === "verify" ||
		mode === "review" ||
		mode === "handoff"
	) {
		return mode;
	}
	return "invalid";
}

/**
 * Determine if a command belongs on first-contact agent surfaces.
 *
 * @param name - Command name to test
 * @returns `true` if the command is considered a first-contact command, `false` otherwise.
 */
export function isFirstContactCommandName(name: string): boolean {
	return FIRST_CONTACT_COMMAND_NAMES.has(name);
}

const AGENT_MODE_ORDER: Readonly<Record<CommandAgentMode, number>> = {
	orient: 0,
	plan: 1,
	verify: 2,
	review: 3,
	repair: 4,
	handoff: 5,
	learn: 6,
	admin: 7,
};

const AGENT_CATALOG_VISIBILITY_ORDER: Readonly<
	Record<CommandVisibility, number>
> = {
	default: 0,
	agent: 1,
	advanced: 2,
	plumbing: 3,
	hidden: 4,
	legacy: 5,
};

/** Resolves a command category and rejects uncategorized development entries. */
function getCommandCategory(name: string): CommandCategory {
	const category = COMMAND_CATEGORY_BY_NAME[name];
	if (!category) {
		if (process.env.NODE_ENV !== "production") {
			throw new Error(
				`Command "${name}" is not categorized in COMMAND_CATEGORY_BY_NAME. Add an entry to prevent silent mislabeling.`,
			);
		}
		return "uncategorized";
	}
	return category;
}

/** Resolves the explicit retry rule or derives the conservative default. */
function getCommandRetryability(
	name: string,
	mutability: CommandMutability,
): CommandRetryability {
	const explicit = RETRYABILITY_BY_NAME[name];
	if (explicit) return explicit;
	return mutability === "read" ? "safe" : "conditional";
}

/** Derives the safest retry classification from every characterized invocation. */
function getInvocationRetryability(
	effects: readonly CommandInvocationEffect[],
): CommandRetryability {
	if (effects.some((effect) => effect.retryPolicy === "manual")) return "manual";
	if (effects.some((effect) => effect.retryPolicy === "conditional")) {
		return "conditional";
	}
	return "safe";
}

function getCommandTier(name: string, category: CommandCategory): CommandTier {
	const explicit = COMMAND_TIER_BY_NAME[name];
	if (explicit) return explicit;
	if (category === "bootstrap-governance" || category === "workflow-linear") {
		return "domain";
	}
	return "plumbing";
}

function getCommandPrimaryAudience(name: string): CommandPrimaryAudience {
	return PRIMARY_AUDIENCE_BY_NAME[name] ?? "both";
}

function getCommandAgentMode(
	name: string,
	category: CommandCategory,
	mutability: CommandMutability,
	orchestratedBy: CommandOrchestrator[],
): CommandAgentMode {
	const explicit = AGENT_MODE_BY_NAME[name];
	if (explicit) return explicit;
	if (orchestratedBy.includes("learn")) return "learn";
	if (category === "workflow-linear") return "handoff";
	if (category === "pilot-remediation")
		return mutability === "write" ? "repair" : "verify";
	if (category === "review-policy") {
		return name.includes("review") || name.includes("pr-template")
			? "review"
			: "verify";
	}
	if (category === "drift-search-evidence") return "orient";
	if (mutability === "write") return "admin";
	return "orient";
}

/** Resolves the default discovery layer for a command capability. */
function getCommandVisibility(
	name: string,
	tier: CommandTier,
	primaryAudience: CommandPrimaryAudience,
): CommandVisibility {
	const explicit = COMMAND_VISIBILITY_BY_NAME[name];
	if (explicit) return explicit;
	if (tier === "cockpit") return "default";
	if (tier === "legacy") return "legacy";
	if (tier === "plumbing") return "plumbing";
	if (primaryAudience === "agent") return "agent";
	return "advanced";
}

/** Translates a spec into catalog metadata and derives mutability from effects. */
export function toCommandCapability(spec: CommandSpec): CommandCapability {
	const legacyMutability: CommandMutability = WRITE_COMMANDS.has(spec.name)
		? "write"
		: "read";
	const category = getCommandCategory(spec.name);
	const primaryAudience = getCommandPrimaryAudience(spec.name);
	const orchestratedBy = [...(ORCHESTRATED_BY_BY_NAME[spec.name] ?? [])];
	const legacyRetryability = getCommandRetryability(spec.name, legacyMutability);
	const invocationEffects = getCommandInvocationEffects(
		spec.name,
		legacyMutability,
		legacyRetryability,
	);
	const mutability = getInvocationMutability(invocationEffects);
	const retryability = getInvocationRetryability(invocationEffects);
	const tier = getCommandTier(spec.name, category);
	return {
		name: spec.name,
		aliases: [...(spec.aliases ?? [])],
		summary: spec.summary,
		...(spec.example ? { example: spec.example } : {}),
		category,
		mutability,
		requiredFlags: [...(REQUIRED_FLAGS_BY_NAME[spec.name] ?? [])],
		expectedArtifacts: [...(EXPECTED_ARTIFACTS_BY_NAME[spec.name] ?? [])],
		effectCharacterization: getCommandEffectCharacterization(spec.name),
		invocationEffects,
		retryability,
		safeFirstAlternatives: [
			...(SAFE_FIRST_ALTERNATIVES_BY_NAME[spec.name] ?? []),
		],
		tier,
		primaryAudience,
		orchestratedBy,
		agentMode: getCommandAgentMode(
			spec.name,
			category,
			mutability,
			orchestratedBy,
		),
		visibility: getCommandVisibility(spec.name, tier, primaryAudience),
	};
}

/**
 * Produce the agent-facing subset of command capabilities limited to first-contact commands and sorted deterministically.
 *
 * @param commands - Array of command capability objects to filter and sort
 * @returns The input commands filtered to only first-contact command names and sorted by visibility order, then agent-mode order, then name
 */
export function filterAgentCommandCapabilities(
	commands: readonly CommandCapability[],
	mode?: CommandAgentCatalogMode,
): CommandCapability[] {
	const commandNames = getAgentCatalogCommandNames(mode);
	return commands
		.filter((command) => commandNames.has(command.name))
		.toSorted((left, right) => {
			const visibilityDelta =
				AGENT_CATALOG_VISIBILITY_ORDER[left.visibility] -
				AGENT_CATALOG_VISIBILITY_ORDER[right.visibility];
			if (visibilityDelta !== 0) return visibilityDelta;
			const modeDelta =
				AGENT_MODE_ORDER[left.agentMode] - AGENT_MODE_ORDER[right.agentMode];
			if (modeDelta !== 0) return modeDelta;
			return left.name.localeCompare(right.name);
		});
}

/** Build the JSON document used by the command capability catalog. */
export function buildCommandCapabilityCatalogDocument(
	commands: CommandCapability[],
): CommandCapabilityCatalogDocument {
	return {
		schemaVersion: COMMAND_CATALOG_SCHEMA_VERSION,
		generatedAt: new Date().toISOString(),
		commandCount: commands.length,
		commands,
	};
}

/** Return capability metadata for every registered command spec. */
export function getCommandCapabilities(
	specs: CommandSpec[],
): CommandCapability[] {
	return specs.map((spec) => toCommandCapability(spec));
}

/** Build the full capability catalog document from command specs. */
export function getCommandCapabilityCatalogDocument(
	specs: CommandSpec[],
): CommandCapabilityCatalogDocument {
	return buildCommandCapabilityCatalogDocument(getCommandCapabilities(specs));
}

/** Build the agent-facing capability catalog document from command specs. */
export function getAgentCommandCapabilityCatalogDocument(
	specs: CommandSpec[],
	mode?: CommandAgentCatalogMode,
): CommandCapabilityCatalogDocument {
	return buildCommandCapabilityCatalogDocument(
		filterAgentCommandCapabilities(getCommandCapabilities(specs), mode),
	);
}
