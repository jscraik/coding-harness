import type { CommandSpec } from "./types.js";

export const COMMAND_CATALOG_SCHEMA_VERSION = "harness-command-catalog/v3";

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

/** Discovery layer where a command should appear by default. */
export type CommandVisibility =
	| "default"
	| "agent"
	| "advanced"
	| "plumbing"
	| "hidden"
	| "legacy";

/** Machine-readable capability metadata for one registry command. */
export interface CommandCapability {
	name: string;
	aliases: string[];
	summary: string;
	example?: string;
	category: CommandCategory;
	mutability: CommandMutability;
	requiredFlags: string[];
	expectedArtifacts: string[];
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

const COMMAND_CATEGORY_BY_NAME: Partial<Record<string, CommandCategory>> = {
	commands: "discovery",
	init: "bootstrap-governance",
	"fleet-plan": "bootstrap-governance",
	eject: "bootstrap-governance",
	check: "bootstrap-governance",
	next: "bootstrap-governance",
	"runtime-card": "bootstrap-governance",
	doctor: "bootstrap-governance",
	audit: "bootstrap-governance",
	brain: "bootstrap-governance",
	health: "bootstrap-governance",
	contract: "bootstrap-governance",
	upgrade: "bootstrap-governance",
	"ci-migrate": "bootstrap-governance",
	"branch-protect": "bootstrap-governance",
	"verify-work": "bootstrap-governance",
	"verify-coderabbit": "bootstrap-governance",
	preset: "bootstrap-governance",
	"symphony-check": "bootstrap-governance",

	"policy-gate": "review-policy",
	"preflight-gate": "review-policy",
	"review-gate": "review-policy",
	"docs-gate": "review-policy",
	"plan-gate": "review-policy",
	"brainstorm-gate": "review-policy",
	"prompt-gate": "review-policy",
	"pr-template-gate": "review-policy",
	"rule-lifecycle-gate": "review-policy",
	"license-gate": "review-policy",
	"check-authz": "review-policy",
	"check-environment": "review-policy",
	"local-memory-preflight": "review-policy",
	"artifact-gate": "review-policy",
	"ci-ownership-gate": "review-policy",
	"blast-radius": "review-policy",
	"risk-tier": "review-policy",
	"diff-budget": "review-policy",
	"observability-gate": "review-policy",
	"silent-error": "review-policy",
	"memory-gate": "review-policy",

	linear: "workflow-linear",
	"linear-gate": "workflow-linear",
	"workflow:generate": "workflow-linear",

	"pilot-evaluate": "pilot-remediation",
	"pilot-rollback": "pilot-remediation",
	simulate: "pilot-remediation",
	"automation-run": "pilot-remediation",
	"gap-case": "pilot-remediation",
	remediate: "pilot-remediation",
	replay: "pilot-remediation",

	"drift-gate": "drift-search-evidence",
	"org-audit": "drift-search-evidence",
	"tooling-audit": "drift-search-evidence",
	gardener: "drift-search-evidence",
	"context-health": "drift-search-evidence",
	learnings: "drift-search-evidence",
	"north-star-feedback": "drift-search-evidence",
	"review-context": "drift-search-evidence",
	"validation-plan": "drift-search-evidence",
	search: "drift-search-evidence",
	context: "drift-search-evidence",
	"source-outline": "drift-search-evidence",
	"index-context": "drift-search-evidence",
	"evidence-verify": "drift-search-evidence",
	"ui:fast": "drift-search-evidence",
	"ui:verify": "drift-search-evidence",
	"ui:explore": "drift-search-evidence",
};

const WRITE_COMMANDS = new Set<string>([
	"init",
	"eject",
	"upgrade",
	"ci-migrate",
	"branch-protect",
	"linear",
	"linear-gate",
	"automation-run",
	"gap-case",
	"remediate",
	"pilot-rollback",
	"learnings",
]);

const REQUIRED_FLAGS_BY_NAME: Partial<Record<string, string[]>> = {
	"blast-radius": ["--files"],
	"artifact-gate": ["--files"],
	"review-gate": ["--token", "--owner", "--repo", "--pr", "--sha"],
	"workflow:generate": ["--source"],
	"linear-gate": ["--branch", "--pr-title", "--pr-body"],
	"review-context": ["--files"],
	"validation-plan": ["--files"],
};

const EXPECTED_ARTIFACTS_BY_NAME: Partial<Record<string, string[]>> = {
	"check-environment": ["artifacts/policy/environment-attestation.json"],
	"context-health": ["artifacts/context-integrity/index-source-inventory.json"],
	"ci-migrate": [".harness/ci-provider-transition-status.json"],
	"fleet-plan": ["artifacts/harness-upgrade-matrix-dev.json"],
	"artifact-gate": [".harness/artifact-provenance.json"],
	"ci-ownership-gate": ["harness.contract.json"],
	"review-context": ["artifacts/review-context/pr-context.json"],
};

const RETRYABILITY_BY_NAME: Partial<Record<string, CommandRetryability>> = {
	commands: "safe",
	check: "safe",
	next: "safe",
	"runtime-card": "safe",
	"fleet-plan": "safe",
	doctor: "safe",
	health: "safe",
	audit: "safe",
	brain: "safe",
	contract: "safe",
	"check-environment": "safe",
	"check-authz": "safe",
	"local-memory-preflight": "safe",
	search: "safe",
	context: "safe",
	"source-outline": "safe",
	"index-context": "conditional",
	"automation-run": "manual",
	"pilot-rollback": "manual",
	"branch-protect": "manual",
};

const SAFE_FIRST_ALTERNATIVES_BY_NAME: Partial<Record<string, string[]>> = {
	init: ["init --dry-run", "check --json"],
	upgrade: ["upgrade --dry-run", "contract validate --json"],
	"ci-migrate": ["ci-migrate prepare --dry-run --json"],
	remediate: ["remediate run --json"],
	linear: ["linear prepare --issue <KEY>", "linear triage --dry-run --json"],
	"linear-gate": ["linear prepare --issue <KEY>"],
	"branch-protect": ["check-authz --json"],
	"pilot-rollback": ["pilot-evaluate --artifacts <PATH> --json"],
	"automation-run": ["check --json"],
};

const COMMAND_TIER_BY_NAME: Partial<Record<string, CommandTier>> = {
	check: "cockpit",
	next: "cockpit",
	"runtime-card": "domain",
	"fleet-plan": "domain",

	init: "domain",
	contract: "domain",
	"review-gate": "domain",
	"docs-gate": "domain",
	"ci-migrate": "domain",
	linear: "domain",
	"validation-plan": "domain",
	"review-context": "domain",

	"drift-gate": "plumbing",
	"artifact-gate": "plumbing",
	"source-outline": "plumbing",
	"index-context": "plumbing",
	replay: "plumbing",
	simulate: "plumbing",
	"policy-gate": "plumbing",
	"preflight-gate": "plumbing",
	"plan-gate": "plumbing",
	"brainstorm-gate": "plumbing",
	"prompt-gate": "plumbing",
	"pr-template-gate": "plumbing",
	"rule-lifecycle-gate": "plumbing",
	"license-gate": "plumbing",
	"check-authz": "plumbing",
	"check-environment": "plumbing",
	"local-memory-preflight": "plumbing",
	"ci-ownership-gate": "plumbing",
	"blast-radius": "plumbing",
	"risk-tier": "plumbing",
	"diff-budget": "plumbing",
	"observability-gate": "plumbing",
	"silent-error": "plumbing",
	"memory-gate": "plumbing",
};

const PRIMARY_AUDIENCE_BY_NAME: Partial<
	Record<string, CommandPrimaryAudience>
> = {
	commands: "agent",
	check: "both",
	next: "agent",
	"runtime-card": "agent",
	"fleet-plan": "agent",
	doctor: "both",
	health: "both",
	"review-gate": "agent",
	"docs-gate": "agent",
	"validation-plan": "agent",
	"review-context": "agent",
	"source-outline": "agent",
	"index-context": "agent",
	search: "both",
	context: "both",
	linear: "human",
};

const ORCHESTRATED_BY_BY_NAME: Partial<Record<string, CommandOrchestrator[]>> =
	{
		next: [],
		"runtime-card": ["next"],
		"fleet-plan": ["next"],
		check: ["next"],
		doctor: ["next"],
		health: ["next"],
		"review-gate": ["next", "pr-ready"],
		"docs-gate": ["next", "pr-ready"],
		"validation-plan": ["next", "pr-ready"],
		"review-context": ["next", "pr-ready"],
		"linear-gate": ["pr-ready"],
		"north-star-feedback": ["learn"],
		learnings: ["learn"],
	};

const AGENT_MODE_BY_NAME: Partial<Record<string, CommandAgentMode>> = {
	commands: "orient",
	check: "verify",
	next: "orient",
	"runtime-card": "orient",
	init: "orient",
	"fleet-plan": "plan",
	doctor: "orient",
	health: "orient",
	contract: "verify",
	"verify-work": "verify",
	"verify-coderabbit": "review",
	"review-gate": "review",
	"docs-gate": "verify",
	"validation-plan": "verify",
	"review-context": "review",
	"linear-gate": "handoff",
	linear: "handoff",
	remediate: "repair",
	learnings: "learn",
	"north-star-feedback": "learn",
};

const COMMAND_VISIBILITY_BY_NAME: Partial<Record<string, CommandVisibility>> = {
	next: "default",
	commands: "advanced",
	check: "advanced",
	init: "advanced",
	"runtime-card": "advanced",
	doctor: "advanced",
	health: "advanced",
	"fleet-plan": "advanced",
	"validation-plan": "advanced",
	"review-context": "advanced",
	contract: "advanced",
	linear: "advanced",
	"review-gate": "plumbing",
	"docs-gate": "plumbing",
};

const FIRST_CONTACT_COMMAND_NAMES = new Set<string>(["next"]);

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

function getCommandMutability(name: string): CommandMutability {
	return WRITE_COMMANDS.has(name) ? "write" : "read";
}

function getCommandRetryability(
	name: string,
	mutability: CommandMutability,
): CommandRetryability {
	const explicit = RETRYABILITY_BY_NAME[name];
	if (explicit) return explicit;
	return mutability === "read" ? "safe" : "conditional";
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

/** Convert a command registry spec into agent-consumable capability metadata. */
export function toCommandCapability(spec: CommandSpec): CommandCapability {
	const mutability = getCommandMutability(spec.name);
	const category = getCommandCategory(spec.name);
	const tier = getCommandTier(spec.name, category);
	const primaryAudience = getCommandPrimaryAudience(spec.name);
	const orchestratedBy = [...(ORCHESTRATED_BY_BY_NAME[spec.name] ?? [])];
	return {
		name: spec.name,
		aliases: [...(spec.aliases ?? [])],
		summary: spec.summary,
		...(spec.example ? { example: spec.example } : {}),
		category,
		mutability,
		requiredFlags: [...(REQUIRED_FLAGS_BY_NAME[spec.name] ?? [])],
		expectedArtifacts: [...(EXPECTED_ARTIFACTS_BY_NAME[spec.name] ?? [])],
		retryability: getCommandRetryability(spec.name, mutability),
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
): CommandCapability[] {
	return commands
		.filter((command) => isFirstContactCommandName(command.name))
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
): CommandCapabilityCatalogDocument {
	return buildCommandCapabilityCatalogDocument(
		filterAgentCommandCapabilities(getCommandCapabilities(specs)),
	);
}
