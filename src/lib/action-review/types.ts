/** ActionReviewReceipt/v1 packet schema version. */
export const ACTION_REVIEW_RECEIPT_SCHEMA_VERSION =
	"action-review-receipt/v1" as const;

/** Action families that require explicit human or guardian-style review. */
export type ActionReviewKind =
	| "merge"
	| "release"
	| "destructive_cleanup"
	| "external_tracker_mutation";

/** Review decision for a requested action envelope. */
export type ActionReviewDecision =
	| "allow"
	| "block"
	| "mismatch"
	| "unknown"
	| "not_applicable";

/** Freshness classification for evidence used by an action review. */
export type ActionReviewFreshness =
	| "current"
	| "stale"
	| "missing"
	| "unknown"
	| "not_applicable";

/** Status classification for supporting evidence. */
export type ActionReviewEvidenceStatus =
	| "pass"
	| "fail"
	| "blocked"
	| "unknown"
	| "not_applicable";

/** Bounded use of ActionReviewReceipt/v1. */
export type ActionReviewEvidenceUse =
	| "orientation"
	| "audit_trail"
	| "governance";

/** Evidence-use values accepted for inputs that support an allow decision. */
export type ActionReviewSupportingEvidenceUse = "claim_support" | "governance";

/** Independent-review classification for the action reviewer. */
export type ActionReviewIndependence = "independent" | "self" | "unknown";

/** Machine-readable blocker class for blocked or unknown action reviews. */
export type ActionReviewBlockerClass =
	| "requires_human_authority"
	| "requires_external_state_refresh"
	| "requires_review_approval"
	| "requires_security_review"
	| "requires_release_authority"
	| "requires_tracker_authority"
	| "requires_policy_gate"
	| "requires_current_head"
	| "mismatched_action_envelope";

/** Action envelope being reviewed; all fields are pointer or identity values. */
export interface ActionReviewEnvelope {
	actionId: string;
	kind: ActionReviewKind;
	riskTier: "high" | "critical";
	targetRef: string;
	repository: string | null;
	prNumber: number | null;
	issueRef: string | null;
	headSha: string | null;
	commandRef: string | null;
	requestedAt: string;
}

/** Actor that requested or reviews the action envelope. */
export interface ActionReviewActor {
	actorId: string;
	identityRef: string;
	role: string;
	producer: string;
	sourceRef: string;
}

/** Reviewer identity and independence metadata. */
export interface ActionReviewReviewer extends ActionReviewActor {
	independence: ActionReviewIndependence;
	reviewedAt: string;
}

/** Supporting evidence referenced by an action review. */
export interface ActionReviewEvidenceRef {
	ref: string;
	kind: string;
	status: ActionReviewEvidenceStatus;
	freshness: ActionReviewFreshness;
	evidenceUse:
		| ActionReviewSupportingEvidenceUse
		| "orientation"
		| "audit_trail";
	headSha: string | null;
	verifiedAt: string;
}

/** Blocker that prevents an action review from allowing the action. */
export interface ActionReviewBlocker {
	class: ActionReviewBlockerClass;
	reason: string;
	nextAction: string;
}

/** Difference between the reviewed action envelope and the observed action. */
export interface ActionReviewMismatch {
	class: "action_kind" | "target" | "head_sha" | "actor" | "scope";
	reason: string;
	expected: ActionReviewEnvelope;
	actual: ActionReviewEnvelope;
}

/** Guardian-style review receipt for risky external or destructive actions. */
export interface ActionReviewReceipt {
	schemaVersion: typeof ACTION_REVIEW_RECEIPT_SCHEMA_VERSION;
	receiptId: string;
	generatedAt: string;
	producer: string;
	runtimeStatus: "not_yet_emitted";
	evidenceUse: ActionReviewEvidenceUse;
	action: ActionReviewEnvelope;
	requestedBy: ActionReviewActor;
	reviewer: ActionReviewReviewer;
	decision: ActionReviewDecision;
	requiredEvidence: ActionReviewEvidenceRef[];
	freshness: ActionReviewFreshness;
	expiresAt: string | null;
	blockers: ActionReviewBlocker[];
	mismatches: ActionReviewMismatch[];
	nextAction: string;
	blockedBy: string;
}

/** Semantic validator error for ActionReviewReceipt/v1. */
export interface ActionReviewReceiptValidationError {
	code: string;
	path: string;
	message: string;
	severity: "error";
}

/** Semantic validation result for ActionReviewReceipt/v1. */
export interface ActionReviewReceiptValidationResult {
	valid: boolean;
	errors: ActionReviewReceiptValidationError[];
}
