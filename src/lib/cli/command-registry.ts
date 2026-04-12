import { COMMAND_SPECS as EXTRACTED_COMMAND_SPECS } from "./registry/command-specs.js";
import type { CommandSpec, RegistryDispatchResult } from "./registry/types.js";

export type { CommandSpec, RegistryDispatchResult };

export const COMMAND_CATALOG_SCHEMA_VERSION = "harness-command-catalog/v1";

export type CommandCategory =
	| "discovery"
	| "bootstrap-governance"
	| "review-policy"
	| "workflow-linear"
	| "pilot-remediation"
	| "drift-search-evidence"
	| "uncategorized";

export type CommandMutability = "read" | "write";
export type CommandRetryability = "safe" | "conditional" | "manual";

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

interface CommandCapabilityCatalogDocument {
	schemaVersion: typeof COMMAND_CATALOG_SCHEMA_VERSION;
	generatedAt: string;
	commandCount: number;
	commands: CommandCapability[];
}

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

const COMMAND_CATEGORY_BY_NAME: Partial<Record<string, CommandCategory>> = {
	commands: "discovery",
	init: "bootstrap-governance",
	eject: "bootstrap-governance",
	check: "bootstrap-governance",
	doctor: "bootstrap-governance",
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
	search: "drift-search-evidence",
	context: "drift-search-evidence",
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
]);

const REQUIRED_FLAGS_BY_NAME: Partial<Record<string, string[]>> = {
	"policy-gate": ["--files"],
	"preflight-gate": ["--files"],
	"risk-tier": ["--files"],
	"blast-radius": ["--files"],
	"review-gate": ["--token", "--owner", "--repo", "--pr", "--sha"],
	"workflow:generate": ["--source"],
	"linear-gate": ["--branch", "--pr-title", "--pr-body"],
};

const EXPECTED_ARTIFACTS_BY_NAME: Partial<Record<string, string[]>> = {
	"check-environment": ["artifacts/policy/environment-attestation.json"],
	"context-health": ["artifacts/context-integrity/index-source-inventory.json"],
	"ci-migrate": [".harness/ci-provider-transition-status.json"],
};

const RETRYABILITY_BY_NAME: Partial<Record<string, CommandRetryability>> = {
	commands: "safe",
	check: "safe",
	doctor: "safe",
	health: "safe",
	contract: "safe",
	"check-environment": "safe",
	"check-authz": "safe",
	"local-memory-preflight": "safe",
	search: "safe",
	context: "safe",
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

/**
 * Determine the command category for a given command name or alias, falling back to a default when the name is not recognized.
 *
 * @param name - The canonical command name or alias to classify
 * @returns The command's category; returns `"uncategorized"` when the name is not present in the category mapping
 */
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

/**
 * Determine whether a command name is considered mutating or read-only.
 *
 * @param name - The command name or alias to classify
 * @returns `write` if the command performs mutating actions, `read` otherwise
 */
function getCommandMutability(name: string): CommandMutability {
	return WRITE_COMMANDS.has(name) ? "write" : "read";
}

/**
 * Determines the retryability policy for a command.
 *
 * Looks up an explicit per-command override and, if none exists, returns `"safe"` for read commands and `"conditional"` for write commands.
 *
 * @param name - The canonical command name
 * @param mutability - The command's mutability (`"read"` or `"write"`)
 * @returns `"safe"`, `"conditional"`, or `"manual"` indicating how the command should be retried; explicit per-command overrides take precedence
 */
function getCommandRetryability(
	name: string,
	mutability: CommandMutability,
): CommandRetryability {
	const explicit = RETRYABILITY_BY_NAME[name];
	if (explicit) return explicit;
	return mutability === "read" ? "safe" : "conditional";
}

/**
 * Produce a machine-readable CommandCapability from a CommandSpec by attaching
 * registry-derived metadata (category, mutability, retryability and metadata lists).
 *
 * @param spec - The command specification to convert; the command `name` is used to derive category, mutability, retryability, and any per-command metadata configured in the registry.
 * @returns A CommandCapability object containing the command's name, aliases, summary, optional example, category, mutability, required flags, expected artifacts, retryability, and any "safe first" alternative commands.
 */
function toCommandCapability(spec: CommandSpec): CommandCapability {
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

/**
 * Builds a machine-readable catalog document describing the provided command capabilities.
 *
 * @param commands - Array of command capability objects to include in the catalog
 * @returns A catalog document containing the schema version, an ISO 8601 `generatedAt` timestamp, the total `commandCount`, and the supplied `commands` list
 */
function buildCommandCapabilityCatalogDocument(
	commands: CommandCapability[],
): CommandCapabilityCatalogDocument {
	return {
		schemaVersion: COMMAND_CATALOG_SCHEMA_VERSION,
		generatedAt: new Date().toISOString(),
		commandCount: commands.length,
		commands,
	};
}

/**
 * Produces the machine-readable capability metadata for every command in the registry.
 *
 * @returns An array of `CommandCapability` objects describing each registered command, including category, mutability, retryability, required flags, expected artifacts, and other command metadata.
 */
export function getRegistryCommandCapabilities(): CommandCapability[] {
	return COMMAND_SPECS.map((spec) => toCommandCapability(spec));
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

/**
 * Produce a list of registry command help rows containing each command's name and summary.
 *
 * @returns An array of objects each with `name` and `summary` for every registered command.
 */
export function getRegistryCommandHelpRows(options?: {
	includeLegacy?: boolean;
}): Array<{
	name: string;
	summary: string;
}> {
	const capabilities = getRegistryCommandCapabilities();
	const canonicalRows = capabilities.map((capability) => ({
		name: capability.name,
		summary: capability.summary,
	}));
	if (!options?.includeLegacy) {
		return canonicalRows;
	}

	const aliasRows = capabilities.flatMap((capability) =>
		(capability.aliases ?? []).map((alias) => ({
			name: alias,
			summary: capability.summary,
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

// ---------------------------------------------------------------------------
// Fuzzy command resolution — for agent-friendly error recovery
// ---------------------------------------------------------------------------

/**
 * Compute the Levenshtein edit distance between two strings.
 * Uses a single-row DP approach for O(n) space.
 */
function levenshtein(a: string, b: string): number {
	const m = a.length;
	const n = b.length;
	// row[j] = edit distance between a[0..i] and b[0..j] for current i
	const row: number[] = Array.from({ length: n + 1 }, (_, i) => i);
	for (let i = 1; i <= m; i++) {
		let prev = i;
		for (let j = 1; j <= n; j++) {
			const val =
				a[i - 1] === b[j - 1]
					? (row[j - 1] ?? 0)
					: 1 + Math.min(prev, row[j] ?? 0, row[j - 1] ?? 0);
			row[j - 1] = prev;
			prev = val;
		}
		row[n] = prev;
	}
	return row[n] ?? 0;
}

/**
 * Normalize a command name to kebab-case.
 * Handles camelCase (blastRadius → blast-radius) and snake_case (blast_radius → blast-radius).
 */
export function normalizeCommandName(name: string): string {
	return name
		.replace(/([a-z])([A-Z])/g, "$1-$2")
		.toLowerCase()
		.replace(/_/g, "-");
}

function fuzzyThreshold(len: number): number {
	if (len <= 5) return 1;
	return 2;
}

export type FuzzyMatchConfidence = "normalized" | "near";

export interface FuzzyCommandMatch {
	spec: CommandSpec;
	confidence: FuzzyMatchConfidence;
	/** Edit distance (0 for normalized matches). */
	distance: number;
}

/**
 * Resolve a possibly malformed command name to a registered command.
 *
 * Attempts a deterministic normalization (camelCase/snake_case → kebab-case) first; if that fails, performs a Levenshtein near-match against command names and aliases. Returns a match only when normalization succeeds or the edit distance is within the fuzzy threshold.
 *
 * @param name - The input command name to resolve (may be malformed or use different casing/formatting)
 * @returns A `FuzzyCommandMatch` describing the matched spec, confidence (`"normalized"` or `"near"`), and edit distance; `undefined` if no confident match is found.
 */
export function fuzzyFindCommand(name: string): FuzzyCommandMatch | undefined {
	// 1. Normalization pass
	const normalized = normalizeCommandName(name);
	if (normalized !== name) {
		const spec = COMMAND_INDEX.get(normalized);
		if (spec) {
			return { spec, confidence: "normalized", distance: 0 };
		}
	}

	// 2. Levenshtein near-match (compare normalized input against all entries)
	const threshold = fuzzyThreshold(Math.max(name.length, normalized.length));
	let best: FuzzyCommandMatch | undefined;

	for (const spec of COMMAND_SPECS) {
		const candidates = [spec.name, ...(spec.aliases ?? [])];
		for (const candidate of candidates) {
			const d = levenshtein(normalized, candidate);
			if (d > 0 && d <= threshold && (!best || d < best.distance)) {
				best = { spec, confidence: "near", distance: d };
			}
		}
	}

	return best;
}

/**
 * Get the closest registry commands to a provided command name using edit-distance ranking.
 *
 * Normalizes the input command name before scoring and returns up to `limit` candidate commands
 * ordered by ascending edit distance (lower is closer).
 *
 * @param name - The raw command name to match (may be camelCase, snake_case, etc.)
 * @param limit - Maximum number of suggestions to return
 * @returns An array of suggestion objects containing the command `spec` and its numeric `distance` (edit distance from the normalized input)
 */
export function suggestCommands(
	name: string,
	limit = 3,
): Array<{ spec: CommandSpec; distance: number }> {
	const normalized = normalizeCommandName(name);
	const scored = COMMAND_SPECS.map((spec) => {
		const candidates = [spec.name, ...(spec.aliases ?? [])];
		const distance = Math.min(
			...candidates.map((c) => levenshtein(normalized, c)),
		);
		return { spec, distance };
	});
	scored.sort((a, b) => a.distance - b.distance);
	return scored.slice(0, limit);
}

/**
 * Suggest the closest commands and attach capability metadata for guardrail-aware routing.
 *
 * @param name - The raw command name to match (may include typos or alternate casing)
 * @param limit - Maximum number of suggestions to return
 * @returns Closest command suggestions with the same edit-distance ranking as `suggestCommands`, plus each command capability payload.
 */
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
