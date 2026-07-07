/**
 * JSC-123: Contract configuration presets for `harness contract init`.
 *
 * Three tiers of contract complexity:
 *
 * - `minimal`  — 7 sections (~2.5 KB). Solo-dev or first-time setup.
 *                Includes canonical north-star governance surfaces.
 *
 * - `standard` — 11 sections (~4 KB). Small team or CI-integrated project.
 *                Adds diff budget, docs-drift rules, and evidence policy.
 *                This is the recommended default.
 *
 * - `full`     — All 15+ sections (~10 KB). Enterprise / advanced use.
 *                Includes tooling policy, loop stage contracts, and
 *                all governance surfaces. Equivalent to what `harness init`
 *                produces today.
 */

import { SCHEMA_VERSION } from "./json-schema.js";
import {
	DEFAULT_CONTRACT,
	DEFAULT_NORTH_STAR_CONTRACT,
	DEFAULT_OVERRIDE_REVIEWER_REGISTRY,
	DEFAULT_PRODUCT_SURFACE_REGISTRY,
	DEFAULT_TOOLING_POLICY,
} from "./types.js";

// ─── Preset type ─────────────────────────────────────────────────────────────

/**
 * Supported contract preset identifiers for generated governance contracts.
 */
export type ContractPreset = "minimal" | "standard" | "full";

/**
 * Accepted user-facing preset inputs, including compatibility aliases.
 */
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

/**
 * Map a user-supplied preset identifier (including aliases) to a canonical contract preset.
 *
 * @param preset - Input preset name or alias (for example `"lite"`, `"minimal"`, `"standard"`, `"full"`).
 * @returns The canonical `ContractPreset` for recognized inputs, or `undefined` if the input is not a supported preset.
 */
export function normalizeContractPreset(
	preset: string,
): ContractPreset | undefined {
	if (!Object.hasOwn(PRESET_NORMALIZATION_MAP, preset)) {
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

/** Build canonical north-star surfaces with cloned arrays for preset output. */
function buildCanonicalNorthStarSurfaces(): Record<string, unknown> {
	return {
		northStar: {
			...DEFAULT_NORTH_STAR_CONTRACT,
			mantra: [...DEFAULT_NORTH_STAR_CONTRACT.mantra],
			personalStandards: [...DEFAULT_NORTH_STAR_CONTRACT.personalStandards],
			safetyFloor: [...DEFAULT_NORTH_STAR_CONTRACT.safetyFloor],
			nonGoals: [...DEFAULT_NORTH_STAR_CONTRACT.nonGoals],
			decisionQuestions: DEFAULT_NORTH_STAR_CONTRACT.decisionQuestions.map(
				(question) => ({ ...question }),
			),
		},
		productSurface: {
			surfaces: DEFAULT_PRODUCT_SURFACE_REGISTRY.surfaces.map((surface) => ({
				...surface,
				ownedPaths: [...surface.ownedPaths],
			})),
		},
		overrideReviewerRegistry: {
			trustedReviewers: DEFAULT_OVERRIDE_REVIEWER_REGISTRY.trustedReviewers.map(
				(reviewer) => ({
					...reviewer,
				}),
			),
		},
	};
}

// ─── Preset builders ──────────────────────────────────────────────────────────

/**
 * `minimal` preset — canonical core sections.
 *
 * Enough for gates to dispatch correctly and preserve canonical north-star
 * contract surfaces. Suitable for first-time setup or solo-dev repos that
 * don't yet need broader governance overhead.
 */
function buildMinimalPreset(): Record<string, unknown> {
	return {
		version: SCHEMA_VERSION,
		...buildCanonicalNorthStarSurfaces(),
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
		...buildCanonicalNorthStarSurfaces(),
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
		docsGatePolicy: DEFAULT_CONTRACT.docsGatePolicy,
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
		...buildCanonicalNorthStarSurfaces(),
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
		"7 sections (~2.5 KB). Solo-dev / first-time setup with canonical north-star surfaces.",
	standard:
		"11 sections (~4 KB). Recommended default. Adds diff budget, docs-drift, evidence, and docs-gate policy.",
	full: "All governance sections (~10 KB). Enterprise / advanced. Equivalent to `harness init` output.",
};
