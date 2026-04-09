/**
 * JSC-123: Contract configuration presets for `harness contract init`.
 *
 * Three tiers of contract complexity:
 *
 * - `minimal`  — 4 sections (~1.4 KB). Solo-dev or first-time setup.
 *                Only the fields required for gate dispatch to work.
 *
 * - `standard` — 7 sections (~3 KB). Small team or CI-integrated project.
 *                Adds diff budget, docs-drift rules, and evidence policy.
 *                This is the recommended default.
 *
 * - `full`     — All 15+ sections (~10 KB). Enterprise / advanced use.
 *                Includes tooling policy, loop stage contracts, and
 *                all governance surfaces. Equivalent to what `harness init`
 *                produces today.
 */

import { SCHEMA_VERSION } from "./json-schema.js";
import { DEFAULT_CONTRACT, DEFAULT_TOOLING_POLICY } from "./types.js";

// ─── Preset type ─────────────────────────────────────────────────────────────

export type ContractPreset = "minimal" | "standard" | "full";
export type ContractPresetInput = ContractPreset | "lite";

export const CONTRACT_PRESETS: ContractPreset[] = [
	"minimal",
	"standard",
	"full",
];

export const CONTRACT_PRESET_INPUTS: ContractPresetInput[] = [
	...CONTRACT_PRESETS,
	"lite",
];

const PRESET_NORMALIZATION_MAP = {
	lite: "minimal",
	minimal: "minimal",
	standard: "standard",
	full: "full",
} as const satisfies Record<ContractPresetInput, ContractPreset>;

export function normalizeContractPreset(
	preset: string,
): ContractPreset | undefined {
	if (!(preset in PRESET_NORMALIZATION_MAP)) {
		return undefined;
	}
	return PRESET_NORMALIZATION_MAP[preset as ContractPresetInput];
}

// ─── Shared building blocks ───────────────────────────────────────────────────

const MINIMAL_BRANCH_PROTECTION = {
	requiredChecks: [] as string[],
	restrictDeletions: true,
	blockForcePushes: true,
	requireLinearHistory: true,
	requirePullRequest: true,
	requiredApprovingReviewCount: 0,
	dismissStaleReviewsOnPush: true,
	requireConversationResolution: true,
	requireCodeOwnerReview: false,
	requireLastPushApproval: false,
	requireBranchesUpToDate: true,
	allowedMergeMethods: {
		mergeCommit: false,
		squash: true,
		rebase: true,
	},
};

const STANDARD_RISK_TIER_RULES = {
	"src/auth/**": "high",
	"src/api/**": "high",
	"src/lib/**": "medium",
	"**/*.test.ts": "low",
};

// ─── Preset builders ──────────────────────────────────────────────────────────

/**
 * `minimal` preset — 4 sections.
 *
 * Enough for gates to dispatch correctly. Suitable for first-time setup
 * or solo-dev repos that don't yet need governance overhead.
 */
function buildMinimalPreset(): Record<string, unknown> {
	return {
		version: SCHEMA_VERSION,
		riskTierRules: { ...STANDARD_RISK_TIER_RULES },
		mergePolicy: {
			high: ["review-gate"],
			medium: [],
			low: [],
		},
		branchProtection: { ...MINIMAL_BRANCH_PROTECTION },
	};
}

/**
 * `standard` preset — 7 sections (~3 KB).
 *
 * Adds diff budget, docs-drift rules, and evidence policy on top of `minimal`.
 * Recommended starting point for most projects.
 */
function buildStandardPreset(): Record<string, unknown> {
	return {
		version: SCHEMA_VERSION,
		riskTierRules: { ...STANDARD_RISK_TIER_RULES },
		mergePolicy: {
			high: ["review-gate", "evidence-verify"],
			medium: ["review-gate"],
			low: [],
		},
		branchProtection: {
			...MINIMAL_BRANCH_PROTECTION,
			requiredApprovingReviewCount: 1,
			codeQuality: { required: true, severity: "all" },
		},
		docsDriftRules: {},
		diffBudget: {
			maxFiles: 20,
			maxNetLOC: 500,
			overrideLabel: "diff-budget-override",
		},
		evidencePolicy: {
			requiredFor: [],
			allowedTypes: ["png", "jpeg"],
			maxFileSizeBytes: 1048576,
		},
	};
}

/**
 * `full` preset — all governance sections.
 *
 * Equivalent to what `harness init` produces. Intended for enterprise repos
 * or teams adopting the complete harness governance model.
 */
function buildFullPreset(): Record<string, unknown> {
	return {
		version: SCHEMA_VERSION,
		riskTierRules: { ...STANDARD_RISK_TIER_RULES },
		mergePolicy: {
			high: ["review-gate", "evidence-verify"],
			medium: ["review-gate"],
			low: [],
		},
		branchProtection: DEFAULT_CONTRACT.branchProtection,
		docsDriftRules: {},
		diffBudget: {
			maxFiles: 20,
			maxNetLOC: 500,
			overrideLabel: "diff-budget-override",
		},
		evidencePolicy: {
			requiredFor: [],
			allowedTypes: ["png", "jpeg"],
			maxFileSizeBytes: 1048576,
		},
		toolingPolicy: DEFAULT_TOOLING_POLICY,
		reviewPolicy: DEFAULT_CONTRACT.reviewPolicy,
		remediationPolicy: DEFAULT_CONTRACT.remediationPolicy,
		contextCompact: DEFAULT_CONTRACT.contextCompact,
		contextIntegrityPolicy: DEFAULT_CONTRACT.contextIntegrityPolicy,
		controlPlanePolicy: DEFAULT_CONTRACT.controlPlanePolicy,
		loopStageContracts: DEFAULT_CONTRACT.loopStageContracts,
		docsGatePolicy: DEFAULT_CONTRACT.docsGatePolicy,
	};
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a contract object for the given preset tier.
 *
 * The returned value is a plain object ready to be serialised with
 * `JSON.stringify`. It is NOT validated — callers should pass the result
 * through `validateContract` if they want to verify it.
 */
export function buildContractPreset(
	preset: ContractPreset,
): Record<string, unknown> {
	switch (preset) {
		case "minimal":
			return buildMinimalPreset();
		case "standard":
			return buildStandardPreset();
		case "full":
			return buildFullPreset();
		default:
			throw new Error(`Unknown contract preset: ${preset as string}`);
	}
}

/**
 * Human-readable description for each preset. Used in CLI help output.
 */
export const PRESET_DESCRIPTIONS: Record<ContractPreset, string> = {
	minimal:
		"4 sections (~1.4 KB). Solo-dev / first-time setup. Just enough for gates to dispatch.",
	standard:
		"7 sections (~3 KB). Recommended default. Adds diff budget, docs-drift, and evidence policy.",
	full: "All governance sections (~10 KB). Enterprise / advanced. Equivalent to `harness init` output.",
};
