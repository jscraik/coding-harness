import type { ReviewContextLearning } from "./review-context.js";
import type { LearningPromotionStatus } from "./types.js";

/** Schema version for the advisory review/rework learning closeout projection. */
export const REVIEW_LEARNING_CLOSEOUT_SCHEMA_VERSION =
	"review-learning-closeout/v1";

/** One learning that has a concrete enforcement destination. */
export interface ReviewLearningPromotedGuardrail {
	/** Stable imported learning identifier. */
	id: string;
	/** Promotion state represented by this record. */
	promotionStatus: "enforced";
	/** Source and test paths that enforce the learning. */
	enforcedBy: string[];
	/** Changed files matched by the learning. */
	matchedFiles: string[];
	/** Decision rationale from the enforcement ledger, when recorded. */
	reason?: string;
}

/** One matched learning that was intentionally or not-yet promoted. */
export interface ReviewLearningSkippedPromotion {
	/** Stable imported learning identifier. */
	id: string;
	/** Usage count from the imported learning evidence. */
	usage: number;
	/** Current promotion lifecycle status. */
	promotionStatus: LearningPromotionStatus;
	/** Changed files matched by the learning. */
	matchedFiles: string[];
	/** Concrete reason this learning is not represented as an enforced guardrail. */
	reason: string;
}

/** Evidence status for the imported review-context source. */
export interface ReviewLearningEvidenceStatus {
	/** Whether the imported learning evidence was available for this closeout. */
	status: "available" | "n.a.";
	/** Source path or URI that was requested. */
	source: string;
	/** Fingerprint of the imported source when available. */
	sourceFingerprint?: string;
	/** Concrete reason when the evidence is not applicable or unavailable. */
	reason?: string;
}

/** Advisory artifact summarizing review learning and rework promotion decisions. */
export interface ReviewLearningCloseout {
	/** Artifact schema version. */
	schemaVersion: typeof REVIEW_LEARNING_CLOSEOUT_SCHEMA_VERSION;
	/** Whether learning evidence was available for this closeout. */
	status: "available" | "not_applicable";
	/** Imported learning source path or URI. */
	source: string;
	/** Fingerprint of the imported learning artifact when available. */
	sourceFingerprint?: string;
	/** Repository identified by the imported learning artifact. */
	repo: string;
	/** Changed files used for matching. */
	changedFiles: string[];
	/** Explicit availability of historical review-context evidence. */
	reviewContextEvidence: ReviewLearningEvidenceStatus;
	/** Historical learnings matched to the changed files. */
	matchingLearnings: ReviewContextLearning[];
	/** Matched learnings promoted to concrete enforced guardrails. */
	promotedGuardrails: ReviewLearningPromotedGuardrail[];
	/** Matched learnings that were skipped, deferred, or remain unenforced. */
	skippedPromotions: ReviewLearningSkippedPromotion[];
	/** Deterministic counts for the closeout summary. */
	summary: {
		matchingLearnings: number;
		promotedGuardrails: number;
		skippedPromotions: number;
		exactFileMatches: number;
		advisoryFuzzyMatches: number;
	};
	/** Boundary preventing advisory learning evidence from becoming readiness evidence. */
	claimBoundary: string;
}

/** Inputs for building an available review-learning closeout. */
export interface ReviewLearningCloseoutOptions {
	/** Imported learning source path or URI. */
	source: string;
	/** Fingerprint of the imported learning artifact. */
	sourceFingerprint?: string;
	/** Repository identified by the imported learning artifact. */
	repo: string;
	/** Changed files used for matching. */
	changedFiles: string[];
	/** Matched review-context learnings. */
	matchingLearnings: ReviewContextLearning[];
	/** Minimum usage count used for promotion triage. */
	minUsage?: number;
}

/** Build an advisory closeout from matched historical learning evidence. */
export function buildReviewLearningCloseout(
	options: ReviewLearningCloseoutOptions,
): ReviewLearningCloseout {
	const minUsage = options.minUsage ?? 25;
	const promotedGuardrails = options.matchingLearnings
		.filter(
			(learning) =>
				learning.promotionStatus === "enforced" &&
				(learning.enforcedBy?.length ?? 0) > 0,
		)
		.map((learning) => ({
			id: learning.id,
			promotionStatus: "enforced" as const,
			enforcedBy: [...(learning.enforcedBy ?? [])],
			matchedFiles: [...learning.matchedFiles],
			...(learning.promotionReason ? { reason: learning.promotionReason } : {}),
		}));
	const skippedPromotions = options.matchingLearnings
		.filter(
			(learning) =>
				learning.promotionStatus !== "enforced" ||
				(learning.enforcedBy?.length ?? 0) === 0,
		)
		.map((learning) => ({
			id: learning.id,
			usage: learning.usage,
			promotionStatus: learning.promotionStatus,
			matchedFiles: [...learning.matchedFiles],
			reason: promotionSkipReason(learning, minUsage),
		}));
	const exactFileMatches = options.matchingLearnings.filter(
		(learning) => learning.match.kind === "exact_file",
	).length;
	const advisoryFuzzyMatches = options.matchingLearnings.reduce(
		(count, learning) =>
			count +
			(learning.matches ?? [learning.match]).filter(
				(match) => match.advisoryOnly,
			).length,
		0,
	);

	return {
		schemaVersion: REVIEW_LEARNING_CLOSEOUT_SCHEMA_VERSION,
		status: "available",
		source: options.source,
		...(options.sourceFingerprint
			? { sourceFingerprint: options.sourceFingerprint }
			: {}),
		repo: options.repo,
		changedFiles: [...options.changedFiles],
		reviewContextEvidence: {
			status: "available",
			source: options.source,
			...(options.sourceFingerprint
				? { sourceFingerprint: options.sourceFingerprint }
				: {}),
		},
		matchingLearnings: options.matchingLearnings,
		promotedGuardrails,
		skippedPromotions,
		summary: {
			matchingLearnings: options.matchingLearnings.length,
			promotedGuardrails: promotedGuardrails.length,
			skippedPromotions: skippedPromotions.length,
			exactFileMatches,
			advisoryFuzzyMatches,
		},
		claimBoundary:
			"Advisory historical-learning evidence only; it does not prove validation, review approval, CI, acceptance, release, or merge readiness.",
	};
}

/** Build a concrete n.a. closeout when imported learning evidence is unavailable. */
export function buildUnavailableReviewLearningCloseout(options: {
	source: string;
	repo: string;
	changedFiles: string[];
	reason: string;
}): ReviewLearningCloseout {
	const evidence: ReviewLearningEvidenceStatus = {
		status: "n.a.",
		source: options.source,
		reason: options.reason,
	};
	return {
		schemaVersion: REVIEW_LEARNING_CLOSEOUT_SCHEMA_VERSION,
		status: "not_applicable",
		source: options.source,
		repo: options.repo,
		changedFiles: [...options.changedFiles],
		reviewContextEvidence: evidence,
		matchingLearnings: [],
		promotedGuardrails: [],
		skippedPromotions: [],
		summary: {
			matchingLearnings: 0,
			promotedGuardrails: 0,
			skippedPromotions: 0,
			exactFileMatches: 0,
			advisoryFuzzyMatches: 0,
		},
		claimBoundary:
			"n.a.: imported historical-learning evidence was unavailable, so no learning, promotion, review, validation, acceptance, release, or merge-readiness claim is made.",
	};
}

/**
 * Explain why a matched learning is not represented as an enforced guardrail.
 *
 * @param learning - Matched historical learning with current promotion state
 * @param minUsage - Usage threshold used for promotion triage
 * @returns A concrete, stable reason suitable for an advisory closeout artifact
 */
function promotionSkipReason(
	learning: ReviewContextLearning,
	minUsage: number,
): string {
	if (learning.promotionStatus === "deferred") {
		return `deferred: ${learning.promotionReason ?? "no deferral reason was recorded in the enforcement ledger."}`;
	}
	if (learning.promotionStatus === "rejected") {
		return `rejected: ${learning.promotionReason ?? "no rejection reason was recorded in the enforcement ledger."}`;
	}
	if (learning.promotionStatus === "non_goal") {
		return `non_goal: ${learning.promotionReason ?? "the enforcement ledger records this learning as outside the promotion goal."}`;
	}
	if (learning.usage < minUsage) {
		return `below_usage_threshold: ${learning.usage} uses is below the ${minUsage}-use promotion threshold.`;
	}
	if (learning.promotionStatus === "unreviewed") {
		return "unreviewed: no promotion decision has been recorded in the enforcement ledger.";
	}
	if (learning.promotionStatus === "candidate") {
		return `candidate_not_enforced: ${learning.promotionReason ?? "usage qualifies for promotion review, but no concrete enforced guardrail is recorded."}`;
	}
	if (learning.promotionStatus === "accepted") {
		return `accepted_not_enforced: ${learning.promotionReason ?? "the learning is accepted for promotion, but no concrete enforced guardrail is recorded."}`;
	}
	return `not_enforced: promotion status ${learning.promotionStatus} has no concrete enforced guardrail.`;
}
