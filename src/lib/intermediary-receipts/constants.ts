import type {
	IntermediaryBlockerClass,
	IntermediaryCanonicalPacketSchema,
	IntermediaryClaimFamily,
	IntermediaryCoverageStatus,
	IntermediaryEvidenceUse,
	IntermediaryFreshness,
	IntermediaryNextActionClass,
	IntermediarySourceKind,
} from "./types.js";

export const INTERMEDIARY_SOURCE_KINDS = [
	"browser_state",
	"streamed_status",
	"mailbox_status",
	"compaction_summary",
	"screenshot_or_visual_state",
	"realtime_event_snippet",
	"external_check_snapshot",
	"operator_steering_echo",
	"subagent_status_text",
] as const satisfies readonly IntermediarySourceKind[];

export const INTERMEDIARY_CLAIM_FAMILIES = [
	"orientation",
	"closeout_ready",
	"merge_readiness",
	"review_addressed",
	"linear_alignment",
	"judge_pm_readiness",
	"delivery_truth",
	"external_state",
	"review_state",
	"goal_completion",
	"root_surface_tidy",
] as const satisfies readonly IntermediaryClaimFamily[];

export const INTERMEDIARY_EVIDENCE_USES = [
	"orientation",
	"audit_trail",
	"claim_support",
] as const satisfies readonly IntermediaryEvidenceUse[];

export const INTERMEDIARY_FRESHNESS = [
	"current",
	"stale",
	"missing",
	"unknown",
	"not_applicable",
] as const satisfies readonly IntermediaryFreshness[];

export const INTERMEDIARY_STATUSES = [
	"pass",
	"warn",
	"fail",
	"blocked",
] as const satisfies readonly IntermediaryCoverageStatus[];

export const INTERMEDIARY_CANONICAL_PACKET_SCHEMAS = [
	"delivery-truth/v1",
	"external-state-snapshot/v1",
	"goal-completion-audit-receipt/v1",
	"review-state/v1",
] as const satisfies readonly IntermediaryCanonicalPacketSchema[];

export const INTERMEDIARY_BLOCKER_CLASSES = [
	"missing_receipt",
	"stale_receipt",
	"receipt_not_claim_support",
	"receipt_status_not_pass",
	"missing_source_hash",
	"head_sha_mismatch",
	"policy_matrix_denied",
	"canonical_packet_required",
	"raw_or_secret_content",
	"unsafe_reference",
	"freshness_not_current",
	"unbound_orientation_only",
] as const satisfies readonly IntermediaryBlockerClass[];

export const INTERMEDIARY_NEXT_ACTION_CLASSES = [
	"none",
	"refresh_receipt",
	"capture_hash",
	"rebind_head",
	"route_to_canonical_packet",
	"request_policy_exception",
	"redact_source",
	"use_orientation_only",
] as const satisfies readonly IntermediaryNextActionClass[];

export const INTERMEDIARY_BLOCKER_ACTIONS = {
	missing_receipt: "refresh_receipt",
	stale_receipt: "refresh_receipt",
	receipt_not_claim_support: "refresh_receipt",
	receipt_status_not_pass: "refresh_receipt",
	missing_source_hash: "capture_hash",
	head_sha_mismatch: "rebind_head",
	policy_matrix_denied: "request_policy_exception",
	canonical_packet_required: "route_to_canonical_packet",
	raw_or_secret_content: "redact_source",
	unsafe_reference: "redact_source",
	freshness_not_current: "use_orientation_only",
	unbound_orientation_only: "use_orientation_only",
} as const satisfies Record<
	IntermediaryBlockerClass,
	IntermediaryNextActionClass
>;

export const PROTECTED_CLAIM_FAMILY_CANONICAL_SCHEMAS = {
	merge_readiness: ["delivery-truth/v1"],
	review_addressed: ["review-state/v1"],
	linear_alignment: ["external-state-snapshot/v1"],
	judge_pm_readiness: ["goal-completion-audit-receipt/v1"],
	delivery_truth: ["delivery-truth/v1"],
	external_state: ["external-state-snapshot/v1"],
	review_state: ["review-state/v1"],
} as const satisfies Partial<
	Record<IntermediaryClaimFamily, readonly IntermediaryCanonicalPacketSchema[]>
>;

export const PACKET_KEYS = [
	"schemaVersion",
	"generatedAt",
	"producer",
	"repoRootRef",
	"runtimeStatus",
	"currentHeadSha",
	"defaultPolicy",
	"sources",
	"receipts",
	"claimPolicies",
	"claimFamilySummaries",
	"overallStatus",
	"blockers",
	"nextAction",
] as const;

export const SOURCE_KEYS = [
	"sourceId",
	"sourceKind",
	"evidenceUse",
	"status",
	"freshness",
	"observedAt",
	"observedHeadSha",
	"currentHeadSha",
	"ref",
	"sourceHashSha256",
	"receiptRef",
	"canonicalPacketRef",
	"claimFamilies",
	"blockers",
] as const;

export const POLICY_KEYS = [
	"sourceKind",
	"claimFamily",
	"allowed",
	"requiredCanonicalPacketSchemas",
] as const;

export const SUMMARY_KEYS = [
	"claimFamily",
	"status",
	"evidenceUse",
	"claimSupportEligible",
	"sourceIds",
	"blockers",
] as const;

export const BLOCKER_KEYS = [
	"blockerClass",
	"reason",
	"nextActionClass",
] as const;
