import type { EvidenceReceipt } from "../evidence/evidence-receipt.js";

/** IntermediaryReceiptCoverage/v1 packet schema version. */
export const INTERMEDIARY_RECEIPT_COVERAGE_SCHEMA_VERSION =
	"intermediary-receipt-coverage/v1" as const;

/** Runtime status for this first contract slice. */
export type IntermediaryReceiptRuntimeStatus = "not_yet_emitted";

/** How an intermediary runtime source may be used by downstream logic. */
export type IntermediaryEvidenceUse =
	| "orientation"
	| "audit_trail"
	| "claim_support";

/** Deterministic source taxonomy for realtime and intermediary runtime truth. */
export type IntermediarySourceKind =
	| "browser_state"
	| "streamed_status"
	| "mailbox_status"
	| "compaction_summary"
	| "screenshot_or_visual_state"
	| "realtime_event_snippet"
	| "external_check_snapshot"
	| "operator_steering_echo"
	| "subagent_status_text";

/** Claim families that intermediary evidence may orient, but rarely prove. */
export type IntermediaryClaimFamily =
	| "orientation"
	| "closeout_ready"
	| "merge_readiness"
	| "review_addressed"
	| "linear_alignment"
	| "judge_pm_readiness"
	| "delivery_truth"
	| "external_state"
	| "review_state"
	| "goal_completion"
	| "root_surface_tidy";

/** Freshness classification shared by sources and summaries. */
export type IntermediaryFreshness =
	| "current"
	| "stale"
	| "missing"
	| "unknown"
	| "not_applicable";

/** Source and aggregate status for intermediary coverage. */
export type IntermediaryCoverageStatus = "pass" | "warn" | "fail" | "blocked";

/** Supported canonical packet routes for protected claim families. */
export type IntermediaryCanonicalPacketSchema =
	| "delivery-truth/v1"
	| "external-state-snapshot/v1"
	| "goal-completion-audit-receipt/v1"
	| "review-state/v1";

/** Machine-readable reason a source or claim cannot support downstream truth. */
export type IntermediaryBlockerClass =
	| "missing_receipt"
	| "stale_receipt"
	| "receipt_not_claim_support"
	| "receipt_status_not_pass"
	| "missing_source_hash"
	| "head_sha_mismatch"
	| "policy_matrix_denied"
	| "canonical_packet_required"
	| "raw_or_secret_content"
	| "unsafe_reference"
	| "freshness_not_current"
	| "unbound_orientation_only";

/** Closed repair lane for each blocker class. */
export type IntermediaryNextActionClass =
	| "none"
	| "refresh_receipt"
	| "capture_hash"
	| "rebind_head"
	| "route_to_canonical_packet"
	| "request_policy_exception"
	| "redact_source"
	| "use_orientation_only";

/** One validated blocker with an enforced next-action class. */
export interface IntermediaryBlocker {
	blockerClass: IntermediaryBlockerClass;
	reason: string;
	nextActionClass: IntermediaryNextActionClass;
}

/** Complete source-kind/claim-family policy matrix entry. */
export interface IntermediaryClaimPolicy {
	sourceKind: IntermediarySourceKind;
	claimFamily: IntermediaryClaimFamily;
	allowed: boolean;
	requiredCanonicalPacketSchemas: IntermediaryCanonicalPacketSchema[];
}

/** Bounded realtime or intermediary source pointer. Raw payloads are excluded. */
export interface IntermediarySource {
	sourceId: string;
	sourceKind: IntermediarySourceKind;
	evidenceUse: IntermediaryEvidenceUse;
	status: IntermediaryCoverageStatus;
	freshness: IntermediaryFreshness;
	observedAt: string;
	observedHeadSha: string | null;
	currentHeadSha: string | null;
	ref: string;
	sourceHashSha256: string | null;
	receiptRef: string | null;
	canonicalPacketRef: string | null;
	claimFamilies: IntermediaryClaimFamily[];
	blockers: IntermediaryBlocker[];
}

/** Aggregate claim-family verdict for a set of intermediary sources. */
export interface IntermediaryClaimFamilySummary {
	claimFamily: IntermediaryClaimFamily;
	status: IntermediaryCoverageStatus;
	evidenceUse: IntermediaryEvidenceUse;
	claimSupportEligible: boolean;
	sourceIds: string[];
	blockers: IntermediaryBlocker[];
}

/** Packet proving how intermediary sources may and may not support claims. */
export interface IntermediaryReceiptCoverage {
	schemaVersion: typeof INTERMEDIARY_RECEIPT_COVERAGE_SCHEMA_VERSION;
	generatedAt: string;
	producer: string;
	repoRootRef: string;
	runtimeStatus: IntermediaryReceiptRuntimeStatus;
	currentHeadSha: string | null;
	defaultPolicy: "deny";
	sources: IntermediarySource[];
	receipts: EvidenceReceipt[];
	claimPolicies: IntermediaryClaimPolicy[];
	claimFamilySummaries: IntermediaryClaimFamilySummary[];
	overallStatus: IntermediaryCoverageStatus;
	blockers: IntermediaryBlocker[];
	nextAction: string;
}

/** Validation failure for an IntermediaryReceiptCoverage packet. */
export interface IntermediaryReceiptCoverageValidationError {
	code: string;
	path: string;
	message: string;
}

/** Aggregate validation result for IntermediaryReceiptCoverage validators. */
export interface IntermediaryReceiptCoverageValidationResult {
	valid: boolean;
	errors: IntermediaryReceiptCoverageValidationError[];
}
