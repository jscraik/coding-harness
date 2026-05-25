import type {
	EvidenceReceipt,
	EvidenceReceiptStatus,
} from "../evidence/evidence-receipt.js";

/** Schema version for PR review-state packets. */
export const REVIEW_STATE_SCHEMA_VERSION = "review-state/v1" as const;

/** Review-state ownership classes for gate failures and reviewer artifacts. */
export const REVIEW_STATE_OWNERSHIP_CLASSIFICATIONS = [
	"introduced_by_current_patch",
	"pre_existing",
	"unrelated_dirty_worktree",
	"environment_or_tooling_failure",
] as const;

/** GitHub review decision values normalized into review-state/v1. */
export const REVIEW_STATE_GITHUB_DECISIONS = [
	"approved",
	"changes_requested",
	"review_required",
	"unknown",
	"not_applicable",
] as const;

/** CodeRabbit review status values normalized into review-state/v1. */
export const REVIEW_STATE_CODERABBIT_STATUSES = [
	"completed",
	"skipped_draft",
	"unavailable",
	"failed",
	"unknown",
	"not_applicable",
] as const;

/** Validation ownership classification for review-state evidence. */
export type ReviewStateOwnershipClassification =
	(typeof REVIEW_STATE_OWNERSHIP_CLASSIFICATIONS)[number];

/** GitHub review decision represented in a review-state packet. */
export type ReviewStateGithubDecision =
	(typeof REVIEW_STATE_GITHUB_DECISIONS)[number];

/** CodeRabbit review status represented in a review-state packet. */
export type ReviewStateCodeRabbitStatus =
	(typeof REVIEW_STATE_CODERABBIT_STATUSES)[number];

/** Pull request identity fields that anchor review-state to one head SHA. */
export interface ReviewStatePullRequest {
	number: number;
	url: string;
	baseRef: string;
	headRef: string;
	headSha: string;
}

/** Counts for unresolved review threads separated from CI and tracker state. */
export interface ReviewStateUnresolvedThreads {
	total: number;
	needsHuman: number;
	autofixable: number;
}

/** Reviewer artifact proof carried by review-state/v1. */
export interface ReviewStateReviewerArtifact {
	role: string;
	path: string;
	expectedProducer: string;
	ownershipClassification: ReviewStateOwnershipClassification;
	receipt: EvidenceReceipt;
}

/** Normalized GitHub review-state summary. */
export interface ReviewStateGithubReviews {
	decision: ReviewStateGithubDecision;
	status: EvidenceReceiptStatus;
	reviewCount: number;
}

/** Normalized CodeRabbit review-state summary. */
export interface ReviewStateCodeRabbitReview {
	status: ReviewStateCodeRabbitStatus;
	evidenceStatus: EvidenceReceiptStatus;
	commentCount: number;
}

/** Production packet for PR review truth, separate from checks and tracker state. */
export interface ReviewStatePacket {
	schemaVersion: typeof REVIEW_STATE_SCHEMA_VERSION;
	generatedAt: string;
	pr: ReviewStatePullRequest;
	githubReviews: ReviewStateGithubReviews;
	codeRabbit: ReviewStateCodeRabbitReview;
	unresolvedThreads: ReviewStateUnresolvedThreads;
	reviewerArtifacts: ReviewStateReviewerArtifact[];
}

/** Structured validation error emitted for review-state/v1 packets. */
export interface ReviewStateValidationError {
	code: string;
	path: string;
	severity: "error";
}

/** Validation result for review-state/v1 packets. */
export interface ReviewStateValidationResult {
	valid: boolean;
	errors: ReviewStateValidationError[];
}
