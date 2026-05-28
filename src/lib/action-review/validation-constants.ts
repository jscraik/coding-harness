export const PACKET_KEYS = [
	"schemaVersion",
	"receiptId",
	"generatedAt",
	"producer",
	"runtimeStatus",
	"evidenceUse",
	"action",
	"requestedBy",
	"reviewer",
	"decision",
	"requiredEvidence",
	"freshness",
	"expiresAt",
	"blockers",
	"mismatches",
	"nextAction",
	"blockedBy",
] as const;

export const ENVELOPE_KEYS = [
	"actionId",
	"kind",
	"riskTier",
	"targetRef",
	"repository",
	"prNumber",
	"issueRef",
	"headSha",
	"commandRef",
	"requestedAt",
] as const;

export const ACTOR_KEYS = [
	"actorId",
	"identityRef",
	"role",
	"producer",
	"sourceRef",
] as const;
export const REVIEWER_KEYS = [
	...ACTOR_KEYS,
	"independence",
	"reviewedAt",
] as const;

export const EVIDENCE_KEYS = [
	"ref",
	"kind",
	"status",
	"freshness",
	"evidenceUse",
	"headSha",
	"verifiedAt",
] as const;
export const BLOCKER_KEYS = ["class", "reason", "nextAction"] as const;
export const MISMATCH_KEYS = ["class", "reason", "expected", "actual"] as const;

export const ACTION_KINDS = [
	"merge",
	"release",
	"destructive_cleanup",
	"external_tracker_mutation",
] as const;
export const DECISIONS = [
	"allow",
	"block",
	"mismatch",
	"unknown",
	"not_applicable",
] as const;
export const FRESHNESS = [
	"current",
	"stale",
	"missing",
	"unknown",
	"not_applicable",
] as const;
export const EVIDENCE_STATUS = [
	"pass",
	"fail",
	"blocked",
	"unknown",
	"not_applicable",
] as const;
export const EVIDENCE_USE = [
	"orientation",
	"audit_trail",
	"governance",
] as const;
export const SUPPORTING_EVIDENCE_USE = [
	"claim_support",
	"governance",
	"orientation",
	"audit_trail",
] as const;

export const REQUIRED_ALLOW_EVIDENCE_KINDS = {
	merge: ["delivery_truth", "review_state", "external_state"],
	release: ["delivery_truth", "external_state"],
	destructive_cleanup: ["policy_gate"],
	external_tracker_mutation: ["delivery_truth", "external_state"],
} as const;

export const EVIDENCE_REF_PREFIXES = {
	delivery_truth: "delivery-truth:",
	external_state: "external-state:",
	policy_gate: "policy-gate:",
	review_state: "review-state:",
	validation: "validation:",
} as const;

export const BLOCKER_CLASSES = [
	"requires_human_authority",
	"requires_external_state_refresh",
	"requires_review_approval",
	"requires_security_review",
	"requires_release_authority",
	"requires_tracker_authority",
	"requires_policy_gate",
	"requires_current_head",
	"mismatched_action_envelope",
] as const;

export const MISMATCH_CLASSES = [
	"action_kind",
	"target",
	"head_sha",
	"actor",
	"scope",
] as const;

export const SAFE_POINTER_PATTERN =
	/^[A-Za-z0-9][A-Za-z0-9:._/@#?=&+,-]{1,255}$/u;
export const HEAD_SHA_PATTERN = /^[0-9a-f]{40}$/u;
export const RAW_KEY_PATTERN =
	/(raw|secret|token|password|credential|transcript|prompt|commandOutput|rawOutput|reviewBody)/iu;
