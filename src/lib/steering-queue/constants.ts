export const STEERING_QUEUE_SCHEMA_VERSION = "steering-queue/v1" as const;
export const STEERING_INSTRUCTION_CANONICALIZATION_VERSION =
	"steering-instruction-text-lf/v1" as const;

export const STEERING_QUEUE_STATES = [
	"pending",
	"applicable",
	"applied",
	"rejected",
	"expired",
	"superseded",
	"stale",
] as const;

export const STEERING_QUEUE_STALE_KINDS = [
	"stale_turn",
	"stale_thread",
	"stale_client_user_message",
	"stale_head",
	"instruction_hash_mismatch",
	"instruction_hash_unverifiable",
	"artifact_identity_mismatch",
	"superseded_artifact",
	"expired_queue",
	"missing_artifact",
	"rejected_steering",
	"already_applied",
	"terminal_conflict",
] as const;

export const STEERING_QUEUE_PROVENANCE_KINDS = [
	"harness_artifact",
	"runtime_card",
	"review_artifact",
	"goal_artifact",
	"external_snapshot_ref",
] as const;

export const STEERING_QUEUE_DELIVERY_MODES = [
	"next_turn",
	"same_thread_continuation",
	"pr_triage_followup",
	"manual_resume",
	"unknown",
] as const;

export const SAFE_POINTER_PATTERN = /^[A-Za-z0-9#][A-Za-z0-9._:/#@+-]{0,511}$/u;
export const HEAD_SHA_PATTERN = /^[a-f0-9]{7,64}$/u;
export const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;
export const ISO_TIMESTAMP_PATTERN =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;

export const DISALLOWED_RAW_KEYS = new Set([
	"rawPrompt",
	"promptText",
	"promptBody",
	"rawSteering",
	"steeringText",
	"instructionText",
	"transcript",
	"rawTranscript",
	"secret",
	"token",
	"apiKey",
	"password",
	"credential",
]);

export const PACKET_KEYS = new Set([
	"schemaVersion",
	"generatedAt",
	"producer",
	"runtimeStatus",
	"evidenceUse",
	"headSha",
	"threadId",
	"turnId",
	"clientUserMessageId",
	"evaluatedAt",
	"selectedItemId",
	"items",
	"summary",
	"blockedBy",
]);

export const ITEM_KEYS = new Set([
	"id",
	"scopeRef",
	"createdAt",
	"expiresAt",
	"sourceRef",
	"instructionRef",
	"instructionHash",
	"instructionHashAlgorithm",
	"instructionCanonicalizationVersion",
	"instructionProvenanceKind",
	"deliveryMode",
	"expectedThreadId",
	"expectedTurnId",
	"expectedClientUserMessageId",
	"expectedHeadSha",
	"priority",
	"requiredArtifacts",
	"supersedes",
	"supersededBy",
	"state",
	"stateReason",
	"appliedClientUserMessageId",
	"stateAt",
	"appliedAt",
	"rejectedAt",
	"supersededAt",
	"stalePreconditions",
]);

export const ARTIFACT_KEYS = new Set([
	"artifactRef",
	"headSha",
	"producedAt",
	"sha256",
	"receiptId",
]);

export const STALE_PRECONDITION_KEYS = new Set([
	"kind",
	"expected",
	"actual",
	"evidenceRef",
]);

export const SUMMARY_KEYS = new Set([
	"total",
	"pending",
	"applicable",
	"applied",
	"rejected",
	"expired",
	"superseded",
	"stale",
]);
