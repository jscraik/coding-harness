import type { EvidenceReceipt } from "../evidence/evidence-receipt.js";

export const REVIEW_LIFECYCLE_SCHEMA_VERSION = "review-lifecycle/v1" as const;

export const REVIEW_LIFECYCLE_MODE_KINDS = [
	"author_review",
	"code_review",
	"pr_review",
	"judge_review",
	"pm_review",
] as const;

export const REVIEW_LIFECYCLE_MODE_STATUSES = [
	"current",
	"stale",
	"missing",
	"unknown",
] as const;

export const REVIEW_LIFECYCLE_VERDICTS = [
	"pass",
	"blocked",
	"fail",
	"unknown",
] as const;

export const REVIEW_LIFECYCLE_TOOL_CLASSES = [
	"shell",
	"filesystem",
	"network",
	"mcp",
	"browser",
	"agent",
	"plugin",
	"app",
	"github",
	"linear",
	"review",
	"unknown",
] as const;

/** Review workflow lane represented by a ReviewLifecycle packet. */
export type ReviewLifecycleModeKind =
	(typeof REVIEW_LIFECYCLE_MODE_KINDS)[number];

/** Freshness state for the represented review workflow lane. */
export type ReviewLifecycleModeStatus =
	(typeof REVIEW_LIFECYCLE_MODE_STATUSES)[number];

/** Machine-readable result for the review lifecycle verdict. */
export type ReviewLifecycleVerdictStatus =
	(typeof REVIEW_LIFECYCLE_VERDICTS)[number];

/** Capability family observed while the reviewer produced the artifact. */
export type ReviewLifecycleToolClass =
	(typeof REVIEW_LIFECYCLE_TOOL_CLASSES)[number];

/** PR and source-review-state identity bound to the lifecycle packet. */
export interface ReviewLifecycleTarget {
	repository: string;
	prNumber: number;
	url: string;
	baseRef: string;
	headRef: string;
	headSha: string;
	reviewStateHeadSha: string;
}

/** Review lane timing and freshness summary. */
export interface ReviewLifecycleMode {
	kind: ReviewLifecycleModeKind;
	status: ReviewLifecycleModeStatus;
	startedAt: string | null;
	completedAt: string | null;
}

/** Reviewer identity and optional runtime manifest reference. */
export interface ReviewLifecycleReviewer {
	role: string;
	producer: string;
	runManifestRef: string | null;
}

/** Counts for visible, deferred, hidden, unavailable, and blocked tools. */
export interface ReviewLifecycleToolExposureCounts {
	visible: number;
	deferred: number;
	hidden: number;
	unavailable: number;
	policyBlocked: number;
}

/** Tool exposure summary for one capability family. */
export interface ReviewLifecycleToolExposureClass {
	className: ReviewLifecycleToolClass;
	statusCounts: ReviewLifecycleToolExposureCounts;
	failureClass: string | null;
}

/** Reviewer's capability exposure projection for agent-native auditing. */
export interface ReviewLifecycleToolExposure {
	sourceRef: string | null;
	classes: ReviewLifecycleToolExposureClass[];
}

/** Compact source ReviewState/v1 summary used for head-SHA binding. */
export interface ReviewLifecycleSourceReviewState {
	schemaVersion: "review-state/v1";
	ref: string;
	generatedAt: string;
	headSha: string;
	fetchReceiptRef: string;
	reviewerArtifactRefs: string[];
	unresolvedThreadTotal: number;
}

/** Receipt-backed reviewer artifact lineage entry. */
export interface ReviewLifecycleArtifactLineage {
	role: string;
	path: string;
	producer: string;
	runManifestRef: string;
	receipt: EvidenceReceipt;
}

/** Finding counts observed in the reviewed lifecycle. */
export interface ReviewLifecycleFindings {
	total: number;
	blocking: number;
	advisory: number;
	resolved: number;
}

/** Selectable comment counts for review-addressing workflows. */
export interface ReviewLifecycleSelectableComments {
	total: number;
	selected: number;
	unselected: number;
}

/** Unresolved thread counts split by human and autofix ownership. */
export interface ReviewLifecycleUnresolvedThreads {
	total: number;
	needsHuman: number;
	autofixable: number;
}

/** Required, covered, and missing reviewer-role coverage. */
export interface ReviewLifecycleCoverage {
	requiredRoles: string[];
	coveredRoles: string[];
	missingRoles: string[];
}

/** Orientation-only verdict for the review lifecycle packet. */
export interface ReviewLifecycleVerdict {
	status: ReviewLifecycleVerdictStatus;
	blockerClass: string | null;
	reason: string;
	readyForReviewClaim: boolean;
}

/** ReviewLifecycle/v1 packet for reviewer mode, lineage, and coverage. */
export interface ReviewLifecyclePacket {
	schemaVersion: typeof REVIEW_LIFECYCLE_SCHEMA_VERSION;
	generatedAt: string;
	producer: string;
	runtimeStatus: "not_yet_emitted";
	evidenceUse: "orientation" | "audit_trail";
	sourceReviewStateRef: string;
	sourceReviewState: ReviewLifecycleSourceReviewState;
	target: ReviewLifecycleTarget;
	mode: ReviewLifecycleMode;
	reviewer: ReviewLifecycleReviewer;
	toolExposure: ReviewLifecycleToolExposure;
	artifactLineage: ReviewLifecycleArtifactLineage[];
	findings: ReviewLifecycleFindings;
	selectableComments: ReviewLifecycleSelectableComments;
	unresolvedThreads: ReviewLifecycleUnresolvedThreads;
	coverage: ReviewLifecycleCoverage;
	verdict: ReviewLifecycleVerdict;
}

/** Validation error emitted by ReviewLifecycle/v1 validation. */
export interface ReviewLifecycleValidationError {
	code: string;
	path: string;
	severity: "error";
}

/** Validation result emitted by ReviewLifecycle/v1 validation. */
export interface ReviewLifecycleValidationResult {
	valid: boolean;
	errors: ReviewLifecycleValidationError[];
}
