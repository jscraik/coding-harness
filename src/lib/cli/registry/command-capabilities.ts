import type { CommandSpec } from "./types.js";

export const COMMAND_CATALOG_SCHEMA_VERSION = "harness-command-catalog/v1";

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
	eject: "bootstrap-governance",
	check: "bootstrap-governance",
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
	"artifact-gate": [".harness/artifact-provenance.json"],
	"ci-ownership-gate": ["harness.contract.json"],
	"review-context": ["artifacts/review-context/pr-context.json"],
};

const RETRYABILITY_BY_NAME: Partial<Record<string, CommandRetryability>> = {
	commands: "safe",
	check: "safe",
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

/** Convert a command registry spec into agent-consumable capability metadata. */
export function toCommandCapability(spec: CommandSpec): CommandCapability {
	const mutability = getCommandMutability(spec.name);
	return {
		name: spec.name,
		aliases: [...(spec.aliases ?? [])],
		summary: spec.summary,
		...(spec.example ? { example: spec.example } : {}),
		category: getCommandCategory(spec.name),
		mutability,
		requiredFlags: [...(REQUIRED_FLAGS_BY_NAME[spec.name] ?? [])],
		expectedArtifacts: [...(EXPECTED_ARTIFACTS_BY_NAME[spec.name] ?? [])],
		retryability: getCommandRetryability(spec.name, mutability),
		safeFirstAlternatives: [
			...(SAFE_FIRST_ALTERNATIVES_BY_NAME[spec.name] ?? []),
		],
	};
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
