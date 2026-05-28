import type {
	STEERING_INSTRUCTION_CANONICALIZATION_VERSION,
	STEERING_QUEUE_DELIVERY_MODES,
	STEERING_QUEUE_PROVENANCE_KINDS,
	STEERING_QUEUE_SCHEMA_VERSION,
	STEERING_QUEUE_STALE_KINDS,
	STEERING_QUEUE_STATES,
} from "./constants.js";

/** Lifecycle state for one deferred steering item. */
export type SteeringQueueState = (typeof STEERING_QUEUE_STATES)[number];
/** Reason a steering item can no longer be trusted for the current runtime context. */
export type SteeringQueueStaleKind =
	(typeof STEERING_QUEUE_STALE_KINDS)[number];
/** Source category for the artifact that carries the hashed steering instruction. */
export type SteeringInstructionProvenanceKind =
	(typeof STEERING_QUEUE_PROVENANCE_KINDS)[number];
/** Intended delivery path for a deferred steering item. */
export type SteeringQueueDeliveryMode =
	(typeof STEERING_QUEUE_DELIVERY_MODES)[number];

/** Immutable identity fields for an artifact required by a steering item. */
export interface SteeringArtifactIdentity {
	artifactRef: string;
	headSha: string;
	producedAt: string;
	sha256: string | null;
	receiptId: string | null;
}

/** Current-context mismatch that prevents a steering item from applying. */
export interface SteeringQueueStalePrecondition {
	kind: SteeringQueueStaleKind;
	expected: string;
	actual: string;
	evidenceRef: string;
}

/** One deferred operator-steering instruction represented only by refs and hashes. */
export interface SteeringQueueItem {
	id: string;
	scopeRef: string;
	createdAt: string;
	expiresAt: string;
	sourceRef: string;
	instructionRef: string;
	instructionHash: string;
	instructionHashAlgorithm: "sha256";
	instructionCanonicalizationVersion: typeof STEERING_INSTRUCTION_CANONICALIZATION_VERSION;
	instructionProvenanceKind: SteeringInstructionProvenanceKind;
	deliveryMode: SteeringQueueDeliveryMode;
	expectedThreadId: string | null;
	expectedTurnId: string | null;
	expectedHeadSha: string;
	priority: number;
	requiredArtifacts: SteeringArtifactIdentity[];
	supersedes: string[];
	supersededBy: string | null;
	state: SteeringQueueState;
	stateReason: string | null;
	stateAt: string;
	appliedAt: string | null;
	rejectedAt: string | null;
	supersededAt: string | null;
	stalePreconditions: SteeringQueueStalePrecondition[];
}

/** Count of steering queue items by lifecycle state. */
export interface SteeringQueueSummary {
	total: number;
	pending: number;
	applicable: number;
	applied: number;
	rejected: number;
	expired: number;
	superseded: number;
	stale: number;
}

/** SteeringQueue/v1 packet emitted as orientation or audit-trail evidence. */
export interface SteeringQueuePacket {
	schemaVersion: typeof STEERING_QUEUE_SCHEMA_VERSION;
	generatedAt: string;
	producer: string;
	runtimeStatus: "not_yet_emitted";
	evidenceUse: "orientation" | "audit_trail";
	headSha: string;
	threadId: string | null;
	turnId: string | null;
	evaluatedAt: string;
	selectedItemId: string | null;
	items: SteeringQueueItem[];
	summary: SteeringQueueSummary;
	blockedBy: string;
}

/** Optional raw instruction source used only to verify the stored instruction hash. */
export interface SteeringInstructionSource {
	instructionRef: string;
	instructionText: string | null;
}

/** Builder input for a steering item before current-context evaluation. */
export interface SteeringQueueItemInput
	extends Omit<SteeringQueueItem, "state" | "stateAt" | "stalePreconditions"> {
	state: SteeringQueueState;
	stateAt?: string | null;
	stalePreconditions?: readonly SteeringQueueStalePrecondition[];
}

/** Inputs needed to evaluate queued steering against the current runtime context. */
export interface SteeringQueueEvaluationInput {
	generatedAt: string;
	producer: string;
	evidenceUse: "orientation" | "audit_trail";
	headSha: string;
	threadId: string | null;
	turnId: string | null;
	nowIso: string;
	items: readonly SteeringQueueItemInput[];
	currentArtifacts: readonly SteeringArtifactIdentity[];
	instructionSources?: readonly SteeringInstructionSource[];
	blockedBy?: string;
}

/** Semantic validator error for a SteeringQueue/v1 packet. */
export interface SteeringQueueValidationError {
	code: string;
	path: string;
	severity: "error";
}

/** Semantic validation result for a SteeringQueue/v1 packet. */
export interface SteeringQueueValidationResult {
	valid: boolean;
	errors: SteeringQueueValidationError[];
}
