/**
 * Workflow State Normalization (Slice 3)
 *
 * Translates tracker-specific state labels (Linear, GitHub, Jira, etc.)
 * to canonical workflow states, preventing hard dependencies on custom
 * tracker labels.
 *
 * Key concepts:
 * - **Canonical states**: The `S0 TODO`, `S1 IN_PROGRESS`, etc. states
 *   from the `S|E|G|A|N` transition table.
 * - **Tracker states**: Provider-specific labels ("Todo", "In Progress",
 *   "Done", "Canceled", "Duplicate").
 * - **Status aliases**: A bidirectional mapping between tracker labels
 *   and canonical state codes.
 *
 * Usage:
 *   const normalizer = createStateNormalizer(aliasMap);
 *   const canonical = normalizer.toCanonical("In Progress"); // "S1 IN_PROGRESS"
 *   const tracker = normalizer.toTracker("S3 DONE");         // "Done"
 */

// ─── Types ──────────────────────────────────────────────────────────────────────

/** Canonical workflow state (from the S|E|G|A|N table). */
export type CanonicalState =
	| "S0 TODO"
	| "S1 IN_PROGRESS"
	| "S2 IN_REVIEW"
	| "S3 DONE"
	| "S4 BLOCKED"
	| "FAIL";

/** Terminal canonical states. */
export const CANONICAL_TERMINAL_STATES: readonly CanonicalState[] = [
	"S3 DONE",
	"FAIL",
];

/** Non-terminal canonical states. */
export const CANONICAL_NON_TERMINAL_STATES: readonly CanonicalState[] = [
	"S0 TODO",
	"S1 IN_PROGRESS",
	"S2 IN_REVIEW",
	"S4 BLOCKED",
];

/** All canonical states. */
export const ALL_CANONICAL_STATES: readonly CanonicalState[] = [
	...CANONICAL_NON_TERMINAL_STATES,
	...CANONICAL_TERMINAL_STATES,
];

/** Supported tracker providers. */
export type TrackerProvider = "linear" | "github" | "jira" | "custom";

/**
 * A single status alias entry: maps one tracker label to a canonical state.
 */
export interface StatusAlias {
	/** The tracker-specific label (e.g. "In Progress", "Todo"). */
	tracker_label: string;
	/** The canonical state it maps to. */
	canonical_state: CanonicalState;
	/** Whether this is the primary/preferred label for the canonical state. */
	primary: boolean;
}

/**
 * Complete status aliases configuration for a workflow.
 */
export interface StatusAliasMap {
	/** Tracker provider this map is for. */
	provider: TrackerProvider;
	/** Human-readable description of this alias mapping. */
	description: string;
	/** The alias entries. */
	aliases: StatusAlias[];
}

/** Finding from alias validation. */
export interface AliasValidationFinding {
	code: string;
	severity: "error" | "warning";
	message: string;
}

/** Result of alias validation. */
export interface AliasValidationResult {
	pass: boolean;
	findings: AliasValidationFinding[];
	summary: { errors: number; warnings: number };
}

// ─── Default Alias Maps ─────────────────────────────────────────────────────────

/** Default status aliases for Linear tracker. */
export const LINEAR_STATUS_ALIASES: StatusAliasMap = {
	provider: "linear",
	description: "Linear issue status → canonical workflow state mapping",
	aliases: [
		{ tracker_label: "Todo", canonical_state: "S0 TODO", primary: true },
		{ tracker_label: "Backlog", canonical_state: "S0 TODO", primary: false },
		{ tracker_label: "Triage", canonical_state: "S0 TODO", primary: false },
		{
			tracker_label: "In Progress",
			canonical_state: "S1 IN_PROGRESS",
			primary: true,
		},
		{
			tracker_label: "In Review",
			canonical_state: "S2 IN_REVIEW",
			primary: true,
		},
		{
			tracker_label: "Review",
			canonical_state: "S2 IN_REVIEW",
			primary: false,
		},
		{ tracker_label: "Done", canonical_state: "S3 DONE", primary: true },
		{
			tracker_label: "Canceled",
			canonical_state: "S3 DONE",
			primary: false,
		},
		{
			tracker_label: "Cancelled",
			canonical_state: "S3 DONE",
			primary: false,
		},
		{
			tracker_label: "Duplicate",
			canonical_state: "S3 DONE",
			primary: false,
		},
		{
			tracker_label: "Blocked",
			canonical_state: "S4 BLOCKED",
			primary: true,
		},
	],
};

/** Default status aliases for GitHub Issues. */
export const GITHUB_STATUS_ALIASES: StatusAliasMap = {
	provider: "github",
	description: "GitHub issue/PR status → canonical workflow state mapping",
	aliases: [
		{ tracker_label: "open", canonical_state: "S0 TODO", primary: true },
		{
			tracker_label: "in_progress",
			canonical_state: "S1 IN_PROGRESS",
			primary: true,
		},
		{
			tracker_label: "review_requested",
			canonical_state: "S2 IN_REVIEW",
			primary: true,
		},
		{ tracker_label: "closed", canonical_state: "S3 DONE", primary: true },
		{ tracker_label: "merged", canonical_state: "S3 DONE", primary: false },
	],
};

// ─── State Normalizer ───────────────────────────────────────────────────────────

/** A bidirectional state normalizer. */
export interface StateNormalizer {
	/** The provider this normalizer is configured for. */
	provider: TrackerProvider;

	/** Convert a tracker-specific label to a canonical state. */
	toCanonical(trackerLabel: string): CanonicalState | null;

	/** Convert a canonical state to the primary tracker label. */
	toTracker(canonicalState: CanonicalState): string | null;

	/** Check if a tracker label is known. */
	isKnownLabel(trackerLabel: string): boolean;

	/** Check if a canonical state is terminal. */
	isTerminal(canonicalState: CanonicalState): boolean;

	/** Get all tracker labels that map to a canonical state. */
	getLabelsForState(canonicalState: CanonicalState): string[];

	/** Get all known tracker labels. */
	getAllLabels(): string[];
}

/**
 * Create a state normalizer from a status alias map.
 *
 * The normalizer provides bidirectional translation between tracker
 * labels and canonical workflow states. Label matching is
 * case-insensitive.
 */
export function createStateNormalizer(
	aliasMap: StatusAliasMap,
): StateNormalizer {
	// Build lookup maps (case-insensitive keys for tracker labels)
	const toCanonicalMap = new Map<string, CanonicalState>();
	const toPrimaryTrackerMap = new Map<CanonicalState, string>();
	const stateToLabelsMap = new Map<CanonicalState, string[]>();

	for (const alias of aliasMap.aliases) {
		const lowerLabel = alias.tracker_label.toLowerCase();
		toCanonicalMap.set(lowerLabel, alias.canonical_state);

		// Primary tracker label for reverse lookups
		if (alias.primary) {
			toPrimaryTrackerMap.set(alias.canonical_state, alias.tracker_label);
		}

		// All labels for a state
		const labels = stateToLabelsMap.get(alias.canonical_state) ?? [];
		labels.push(alias.tracker_label);
		stateToLabelsMap.set(alias.canonical_state, labels);
	}

	return {
		provider: aliasMap.provider,

		toCanonical(trackerLabel: string): CanonicalState | null {
			return toCanonicalMap.get(trackerLabel.toLowerCase()) ?? null;
		},

		toTracker(canonicalState: CanonicalState): string | null {
			return toPrimaryTrackerMap.get(canonicalState) ?? null;
		},

		isKnownLabel(trackerLabel: string): boolean {
			return toCanonicalMap.has(trackerLabel.toLowerCase());
		},

		isTerminal(canonicalState: CanonicalState): boolean {
			return CANONICAL_TERMINAL_STATES.includes(canonicalState);
		},

		getLabelsForState(canonicalState: CanonicalState): string[] {
			return stateToLabelsMap.get(canonicalState) ?? [];
		},

		getAllLabels(): string[] {
			return aliasMap.aliases.map((a) => a.tracker_label);
		},
	};
}

// ─── Alias Validation ───────────────────────────────────────────────────────────

/**
 * Validate a status alias map for completeness and correctness.
 *
 * Checks:
 * 1. Every canonical state has at least one alias
 * 2. Every canonical state has exactly one primary alias
 * 3. No duplicate tracker labels
 * 4. All canonical states in aliases are valid
 * 5. Provider is valid
 */
export function validateAliasMap(
	aliasMap: StatusAliasMap,
): AliasValidationResult {
	const findings: AliasValidationFinding[] = [];

	// Provider validation
	const validProviders: readonly TrackerProvider[] = [
		"linear",
		"github",
		"jira",
		"custom",
	];
	if (!validProviders.includes(aliasMap.provider)) {
		findings.push({
			code: "ALIAS_INVALID_PROVIDER",
			severity: "error",
			message: `Invalid provider '${aliasMap.provider}'. Expected one of: ${validProviders.join(", ")}`,
		});
	}

	// Empty aliases check
	if (aliasMap.aliases.length === 0) {
		findings.push({
			code: "ALIAS_EMPTY",
			severity: "error",
			message: "Alias map has no entries",
		});
		return buildResult(findings);
	}

	// Validate canonical states referenced in aliases
	for (const alias of aliasMap.aliases) {
		if (!ALL_CANONICAL_STATES.includes(alias.canonical_state)) {
			findings.push({
				code: "ALIAS_INVALID_CANONICAL_STATE",
				severity: "error",
				message: `Alias '${alias.tracker_label}' references invalid canonical state '${alias.canonical_state}'`,
			});
		}
	}

	// Check for duplicate tracker labels (case-insensitive)
	const seenLabels = new Map<string, string>();
	for (const alias of aliasMap.aliases) {
		const lower = alias.tracker_label.toLowerCase();
		const existing = seenLabels.get(lower);
		if (existing) {
			findings.push({
				code: "ALIAS_DUPLICATE_LABEL",
				severity: "error",
				message: `Duplicate tracker label '${alias.tracker_label}' (conflicts with '${existing}')`,
			});
		} else {
			seenLabels.set(lower, alias.tracker_label);
		}
	}

	// Check that every canonical state has at least one alias
	for (const state of ALL_CANONICAL_STATES) {
		const aliases = aliasMap.aliases.filter(
			(a) => a.canonical_state === state,
		);
		if (aliases.length === 0) {
			findings.push({
				code: "ALIAS_MISSING_STATE",
				severity: "warning",
				message: `No alias defined for canonical state '${state}'`,
			});
		}
	}

	// Check that each mapped canonical state has exactly one primary
	const stateGroups = new Map<CanonicalState, StatusAlias[]>();
	for (const alias of aliasMap.aliases) {
		if (!ALL_CANONICAL_STATES.includes(alias.canonical_state)) continue;
		const group = stateGroups.get(alias.canonical_state) ?? [];
		group.push(alias);
		stateGroups.set(alias.canonical_state, group);
	}

	for (const [state, group] of stateGroups) {
		const primaries = group.filter((a) => a.primary);
		if (primaries.length === 0) {
			findings.push({
				code: "ALIAS_NO_PRIMARY",
				severity: "error",
				message: `Canonical state '${state}' has aliases but no primary entry`,
			});
		} else if (primaries.length > 1) {
			findings.push({
				code: "ALIAS_MULTIPLE_PRIMARY",
				severity: "error",
				message: `Canonical state '${state}' has ${primaries.length} primary aliases (expected 1)`,
			});
		}
	}

	return buildResult(findings);
}

/**
 * Validate that a set of transition table states reference only canonical states.
 *
 * This ensures the review gate and other consumers don't accidentally
 * depend on tracker-specific labels.
 */
export function validateTransitionsUseCanonical(
	transitions: Array<{ S: string; N: string }>,
): AliasValidationFinding[] {
	const findings: AliasValidationFinding[] = [];
	const canonicalSet = new Set(ALL_CANONICAL_STATES as readonly string[]);
	// Also accept short-form terminal states from the checker
	canonicalSet.add("DONE");
	canonicalSet.add("FAIL");
	canonicalSet.add("BLOCKED");

	for (const row of transitions) {
		if (!canonicalSet.has(row.S)) {
			findings.push({
				code: "TRANSITION_NON_CANONICAL_STATE",
				severity: "warning",
				message: `Transition source state '${row.S}' is not a canonical state. Use one of: ${ALL_CANONICAL_STATES.join(", ")}`,
			});
		}
		if (!canonicalSet.has(row.N)) {
			findings.push({
				code: "TRANSITION_NON_CANONICAL_STATE",
				severity: "warning",
				message: `Transition target state '${row.N}' is not a canonical state. Use one of: ${ALL_CANONICAL_STATES.join(", ")}`,
			});
		}
	}

	return findings;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function buildResult(
	findings: AliasValidationFinding[],
): AliasValidationResult {
	const errors = findings.filter((f) => f.severity === "error").length;
	const warnings = findings.filter((f) => f.severity === "warning").length;
	return {
		pass: errors === 0,
		findings,
		summary: { errors, warnings },
	};
}
