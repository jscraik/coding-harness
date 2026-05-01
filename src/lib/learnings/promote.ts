import { DEFAULT_CODERABBIT_LOCAL_ARTIFACT } from "./artifact-io.js";
import {
	DEFAULT_LEARNING_ENFORCEMENT_STATUS_LEDGER,
	applyLearningEnforcementStatus,
	loadLearningEnforcementStatusLedger,
} from "./enforcement-status.js";
import { loadLearningArtifact } from "./gate.js";
import type { LearningItem } from "./types.js";

/** Options for generating promotion candidates from imported learnings. */
export interface LearningsPromoteOptions {
	/** Imported learning artifact path. */
	source?: string;
	/** Minimum usage count required for promotion candidacy. */
	minUsage?: number;
	/** Repository root used for relative artifact resolution. */
	repoRoot?: string;
	/** Local enforcement-status ledger path. */
	enforcementStatusPath?: string;
	/** Include learnings that are already enforced. */
	includeEnforced?: boolean;
}

/** Promotion candidate emitted for high-signal imported learnings. */
export interface LearningPromotionCandidate {
	/** Stable learning identifier. */
	id: string;
	/** Original learning usage count from the provider export. */
	usage: number;
	/** Existing normalized classification. */
	classification: LearningItem["classification"];
	/** Recommended implementation target for the promoted rule. */
	recommendedTarget: string;
	/** Recommended enforcement severity after promotion. */
	recommendedSeverity: LearningItem["enforcement"];
	/** Suggested regression test path or test surface. */
	recommendedTest: string;
	/** Human-readable reason for the promotion recommendation. */
	reason: string;
	/** Matched file or target patterns that justify the destination. */
	targets: string[];
	/** Current promotion lifecycle status for this learning. */
	promotionStatus: LearningItem["promotionStatus"];
	/** Concrete files or tests enforcing this learning when status is enforced. */
	enforcedBy?: string[];
}

/** Result for `harness learnings promote`. */
export interface LearningsPromoteResult {
	schemaVersion: "learnings-promote-result/v1";
	status: "success" | "error";
	source: string;
	minUsage: number;
	promotionCandidates: LearningPromotionCandidate[];
	summary: {
		total: number;
		eligible: number;
		excluded: number;
		belowThreshold: number;
		enforcedExcluded: number;
		explicitlyDeferred: number;
		enforced: number;
	};
	error?: {
		code: string;
		message: string;
		fix?: string;
	};
}

const DEFAULT_MIN_USAGE = 25;

/**
 * Builds promotion candidates from a local learning artifact using usage thresholds and enforcement state.
 *
 * @param options - Controls the input artifact source and repoRoot, minimum usage threshold, enforcement ledger path, and whether already-enforced items are included
 * @returns A `LearningsPromoteResult` containing `promotionCandidates` and a `summary`. On failure the result will have `status: "error"` and include an `error` object with `code`, `message`, and optional `fix`.
 */
export function buildLearningPromotionCandidates(
	options: LearningsPromoteOptions = {},
): LearningsPromoteResult {
	const source = options.source ?? DEFAULT_CODERABBIT_LOCAL_ARTIFACT;
	const minUsage = options.minUsage ?? DEFAULT_MIN_USAGE;
	const loaded = loadLearningArtifact(source, options.repoRoot);

	if (!loaded.ok) {
		return {
			schemaVersion: "learnings-promote-result/v1",
			status: "error",
			source,
			minUsage,
			promotionCandidates: [],
			summary: {
				total: 0,
				eligible: 0,
				excluded: 0,
				belowThreshold: 0,
				enforcedExcluded: 0,
				explicitlyDeferred: 0,
				enforced: 0,
			},
			error: {
				code: loaded.code,
				message: loaded.message,
				...(loaded.fix ? { fix: loaded.fix } : {}),
			},
		};
	}
	const enforcementStatus = loadLearningEnforcementStatusLedger(
		options.enforcementStatusPath ?? DEFAULT_LEARNING_ENFORCEMENT_STATUS_LEDGER,
		options.repoRoot,
	);
	if (!enforcementStatus.ok) {
		return {
			schemaVersion: "learnings-promote-result/v1",
			status: "error",
			source,
			minUsage,
			promotionCandidates: [],
			summary: {
				total: loaded.artifact.items.length,
				eligible: 0,
				excluded: loaded.artifact.items.length,
				belowThreshold: 0,
				enforcedExcluded: 0,
				explicitlyDeferred: 0,
				enforced: 0,
			},
			error: {
				code: enforcementStatus.code,
				message: enforcementStatus.message,
				...(enforcementStatus.fix ? { fix: enforcementStatus.fix } : {}),
			},
		};
	}

	const items = applyLearningEnforcementStatus(
		loaded.artifact.items,
		enforcementStatus.ledger,
	);
	const enforcedCount = items.filter(
		(item) => item.promotionStatus === "enforced",
	).length;
	const belowThresholdCount = items.filter(
		(item) => item.usage < minUsage,
	).length;
	const enforcedExcludedCount = options.includeEnforced
		? 0
		: items.filter(
				(item) => item.usage >= minUsage && item.promotionStatus === "enforced",
			).length;
	const explicitlyDeferredCount = items.filter(
		(item) => item.promotionStatus === "deferred",
	).length;
	const promotionCandidates = items
		.filter((item) => item.usage >= minUsage)
		.filter(
			(item) =>
				item.promotionStatus !== "deferred" &&
				(options.includeEnforced || item.promotionStatus !== "enforced"),
		)
		.filter((item) => item.promotionStatus !== "deferred")
		.map(buildPromotionCandidate)
		.sort((a, b) => b.usage - a.usage || a.id.localeCompare(b.id));

	return {
		schemaVersion: "learnings-promote-result/v1",
		status: "success",
		source,
		minUsage,
		promotionCandidates,
		summary: {
			total: loaded.artifact.items.length,
			eligible: promotionCandidates.length,
			excluded: loaded.artifact.items.length - promotionCandidates.length,
			belowThreshold: belowThresholdCount,
			enforcedExcluded: enforcedExcludedCount,
			explicitlyDeferred: explicitlyDeferredCount,
			enforced: enforcedCount,
		},
	};
}

/**
 * Create a promotion candidate object from a single learning artifact item.
 *
 * @param item - The learning artifact item to convert into a promotion candidate
 * @returns A `LearningPromotionCandidate` containing identification, usage and classification, recommended target/test and severity, human-readable reason, matched target references, current promotion status, and `enforcedBy` when present
 */
function buildPromotionCandidate(
	item: LearningItem,
): LearningPromotionCandidate {
	const destination = destinationFor(item);
	return {
		id: item.id,
		usage: item.usage,
		classification: item.classification,
		recommendedTarget: destination.target,
		recommendedSeverity: recommendedSeverityFor(item),
		recommendedTest: destination.test,
		reason: reasonFor(item),
		targets: targetRefsFor(item),
		promotionStatus: item.promotionStatus,
		...(item.enforcedBy ? { enforcedBy: item.enforcedBy } : {}),
	};
}

/**
 * Selects the promotion gate (`target`) and corresponding test file (`test`) for a learning item based on its file path, target patterns, and classification.
 *
 * @param item - The learning artifact entry whose `file`, `targetPatterns`, and `classification` determine the destination.
 * @returns An object with `target` set to the chosen promotion gate and `test` set to the corresponding test file path. Selection rules (first match wins):
 * - If `file` starts with `"docs/"` or any `targetPatterns` entry starts with `"docs/"`: `target` = `"docs-gate"`, `test` = `"src/commands/docs-gate.test.ts"`.
 * - If `classification` = `"validation_contract"`: `target` = `"validation-plan"`, `test` = `"src/lib/learnings/promote.test.ts"`.
 * - If `classification` = `"generated_artifact"`: `target` = `"artifact-provenance-gate"`, `test` = `"src/lib/learnings/promote.test.ts"`.
 * - If `classification` = `"scaffold_default"`: `target` = `"scaffold-contracts"`, `test` = `"src/lib/init/scaffold-contract-template.test.ts"`.
 * - Fallback: `target` = `"learnings-gate"`, `test` = `"src/lib/learnings/promote.test.ts"`.
 */
function destinationFor(item: LearningItem): {
	target: string;
	test: string;
} {
	if (item.file?.startsWith("docs/") || hasTargetPrefix(item, "docs/")) {
		return {
			target: "docs-gate",
			test: "src/commands/docs-gate.test.ts",
		};
	}
	if (item.classification === "validation_contract") {
		return {
			target: "validation-plan",
			test: "src/lib/learnings/promote.test.ts",
		};
	}
	if (item.classification === "generated_artifact") {
		return {
			target: "artifact-provenance-gate",
			test: "src/lib/learnings/promote.test.ts",
		};
	}
	if (item.classification === "scaffold_default") {
		return {
			target: "scaffold-contracts",
			test: "src/lib/init/scaffold-contract-template.test.ts",
		};
	}
	return {
		target: "learnings-gate",
		test: "src/lib/learnings/promote.test.ts",
	};
}

/**
 * Recommend an enforcement severity for a learning item.
 *
 * @param item - The learning item to evaluate
 * @returns The item's existing enforcement if not `none`; otherwise `error` when `usage` is 100 or greater, `warning` otherwise.
 */
function recommendedSeverityFor(
	item: LearningItem,
): LearningItem["enforcement"] {
	if (item.enforcement !== "none") return item.enforcement;
	return item.usage >= 100 ? "error" : "warning";
}

/**
 * Produces a concise human-readable explanation for promoting a learning item.
 *
 * @param item - The learning entry to evaluate; its `usage` determines which message is returned
 * @returns A short explanation string: the high-usage enforcement recommendation if `item.usage >= 100`, otherwise a standard review-for-enforcement message
 */
function reasonFor(item: LearningItem): string {
	if (item.usage >= 100) {
		return "High-usage repeated learning should become an enforced guardrail, validator, scaffold rule, or explicit exception.";
	}
	return "Repeated learning meets the promotion threshold and should be reviewed for permanent enforcement.";
}

/**
 * Collects normalized file and target references for a learning item.
 *
 * @param item - The learning item to extract file and target references from
 * @returns A sorted array of unique, non-empty file paths and target patterns associated with `item`
 */
function targetRefsFor(item: LearningItem): string[] {
	const refs = [item.file, ...(item.targetPatterns ?? [])].filter(
		(ref): ref is string => Boolean(ref),
	);
	return [...new Set(refs)].sort();
}

/**
 * Determines whether the learning item has any target pattern that begins with the given prefix.
 *
 * @param item - The learning item to inspect; missing or empty `targetPatterns` are treated as none.
 * @param prefix - The prefix to match at the start of each target pattern.
 * @returns `true` if any entry in `item.targetPatterns` starts with `prefix`, `false` otherwise.
 */
function hasTargetPrefix(item: LearningItem, prefix: string): boolean {
	return (item.targetPatterns ?? []).some((pattern) =>
		pattern.startsWith(prefix),
	);
}
