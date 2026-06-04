import { STEERING_QUEUE_STATES } from "./constants.js";
import type {
	SteeringQueueStalePrecondition,
	SteeringQueueState,
	SteeringQueueValidationError,
	SteeringQueueValidationResult,
} from "./types.js";
import {
	addError,
	isRecord,
	requireAllowedKeys,
	requireEnum,
	requireHeadSha,
	requireIso,
	requireLiteral,
	requireNullableSafePointer,
	requireSafePointer,
	validateNoRawKeys,
	validateStalePreconditions,
} from "./validation-helpers.js";

export const STEERING_APPLICATION_RECEIPT_SCHEMA_VERSION =
	"steering-application-receipt/v1" as const;

/** Allowed non-authoritative uses for a steering application receipt. */
export type SteeringApplicationReceiptEvidenceUse =
	| "orientation"
	| "audit_trail"
	| "governance";

/** Decision recorded for an attempted steering queue item application. */
export type SteeringApplicationDecision = "applied" | "rejected" | "blocked";

/** Machine-readable blocker classes for rejected or blocked steering application. */
export type SteeringApplicationBlockerClass =
	| "stale_context"
	| "expired_steering"
	| "superseded_steering"
	| "missing_runtime_card_update"
	| "runtime_card_head_mismatch"
	| "stale_precondition"
	| "queue_item_not_applicable"
	| "producer_not_wired";

/** Runtime identity context used to compare expected and current steering application state. */
export interface SteeringApplicationContext {
	threadId: string | null;
	turnId: string | null;
	clientUserMessageId: string | null;
	headSha: string;
}

/** Pointer to the runtime-card update that records an applied steering item. */
export interface SteeringRuntimeCardUpdateRef {
	ref: string;
	headSha: string;
	producedAt: string;
	receiptId: string | null;
}

/** Decision metadata for an attempted steering application. */
export interface SteeringApplicationDecisionRecord {
	decision: SteeringApplicationDecision;
	decidedAt: string;
	reason: string;
	appliedClientUserMessageId: string | null;
}

/** Blocker evidence explaining why steering application was rejected or blocked. */
export interface SteeringApplicationBlocker {
	class: SteeringApplicationBlockerClass;
	reason: string;
	nextAction: string;
	evidenceRef: string;
}

/** Pointer-only receipt for attempted steering queue application. */
export interface SteeringApplicationReceipt {
	schemaVersion: typeof STEERING_APPLICATION_RECEIPT_SCHEMA_VERSION;
	receiptId: string;
	generatedAt: string;
	producer: string;
	runtimeStatus: "not_yet_emitted";
	evidenceUse: SteeringApplicationReceiptEvidenceUse;
	headSha: string;
	queuePacketRef: string;
	queueItemId: string;
	queueItemState: SteeringQueueState;
	expectedContext: SteeringApplicationContext;
	currentContext: SteeringApplicationContext;
	runtimeCardUpdateRef: SteeringRuntimeCardUpdateRef | null;
	application: SteeringApplicationDecisionRecord;
	stalePreconditions: SteeringQueueStalePrecondition[];
	blockers: SteeringApplicationBlocker[];
	nextAction: string;
	blockedBy: string;
}

const RECEIPT_KEYS = new Set([
	"schemaVersion",
	"receiptId",
	"generatedAt",
	"producer",
	"runtimeStatus",
	"evidenceUse",
	"headSha",
	"queuePacketRef",
	"queueItemId",
	"queueItemState",
	"expectedContext",
	"currentContext",
	"runtimeCardUpdateRef",
	"application",
	"stalePreconditions",
	"blockers",
	"nextAction",
	"blockedBy",
]);

const CONTEXT_KEYS = new Set([
	"threadId",
	"turnId",
	"clientUserMessageId",
	"headSha",
]);

const RUNTIME_CARD_UPDATE_KEYS = new Set([
	"ref",
	"headSha",
	"producedAt",
	"receiptId",
]);

const APPLICATION_KEYS = new Set([
	"decision",
	"decidedAt",
	"reason",
	"appliedClientUserMessageId",
]);

const BLOCKER_KEYS = new Set(["class", "reason", "nextAction", "evidenceRef"]);

const EVIDENCE_USES = ["orientation", "audit_trail", "governance"] as const;
const APPLICATION_DECISIONS = ["applied", "rejected", "blocked"] as const;
const BLOCKER_CLASSES = [
	"stale_context",
	"expired_steering",
	"superseded_steering",
	"missing_runtime_card_update",
	"runtime_card_head_mismatch",
	"stale_precondition",
	"queue_item_not_applicable",
	"producer_not_wired",
] as const;

/** Validate a SteeringApplicationReceipt/v1 packet and its semantic invariants. */
export function validateSteeringApplicationReceipt(
	value: unknown,
): SteeringQueueValidationResult {
	const errors: SteeringQueueValidationError[] = [];
	validateNoRawKeys(value, "packet", errors);
	if (!isRecord(value)) {
		addError(errors, "invalid_packet", "packet", "must be an object");
		return { valid: false, errors };
	}

	validateReceiptEnvelope(value, errors);
	validateContext(value.expectedContext, "expectedContext", errors);
	validateContext(value.currentContext, "currentContext", errors);
	validateRuntimeCardUpdateRef(
		value.runtimeCardUpdateRef,
		"runtimeCardUpdateRef",
		errors,
	);
	validateApplication(value.application, "application", errors);
	validateStalePreconditions(
		value.stalePreconditions,
		"stalePreconditions",
		errors,
	);
	validateBlockers(value.blockers, "blockers", errors);
	validateReceiptSemantics(value, errors);

	return { valid: errors.length === 0, errors };
}

function validateReceiptEnvelope(
	value: Record<string, unknown>,
	errors: SteeringQueueValidationError[],
) {
	requireAllowedKeys(value, RECEIPT_KEYS, "packet", errors);
	requireLiteral(
		value.schemaVersion,
		STEERING_APPLICATION_RECEIPT_SCHEMA_VERSION,
		"schemaVersion",
		errors,
	);
	requireSafePointer(value.receiptId, "receiptId", errors);
	requireIso(value.generatedAt, "generatedAt", errors);
	requireSafePointer(value.producer, "producer", errors);
	requireLiteral(
		value.runtimeStatus,
		"not_yet_emitted",
		"runtimeStatus",
		errors,
	);
	requireEnum(value.evidenceUse, EVIDENCE_USES, "evidenceUse", errors);
	requireHeadSha(value.headSha, "headSha", errors);
	requireSafePointer(value.queuePacketRef, "queuePacketRef", errors);
	requireSafePointer(value.queueItemId, "queueItemId", errors);
	requireEnum(
		value.queueItemState,
		STEERING_QUEUE_STATES,
		"queueItemState",
		errors,
	);
	requireSafePointer(value.nextAction, "nextAction", errors);
	requireSafePointer(value.blockedBy, "blockedBy", errors);
}

function validateContext(
	value: unknown,
	path: string,
	errors: SteeringQueueValidationError[],
) {
	if (!isRecord(value)) {
		addError(errors, "invalid_context", path, "must be an object");
		return;
	}
	requireAllowedKeys(value, CONTEXT_KEYS, path, errors);
	requireNullableSafePointer(value.threadId, `${path}.threadId`, errors);
	requireNullableSafePointer(value.turnId, `${path}.turnId`, errors);
	requireNullableSafePointer(
		value.clientUserMessageId,
		`${path}.clientUserMessageId`,
		errors,
	);
	requireHeadSha(value.headSha, `${path}.headSha`, errors);
}

function validateRuntimeCardUpdateRef(
	value: unknown,
	path: string,
	errors: SteeringQueueValidationError[],
) {
	if (value === null) return;
	if (!isRecord(value)) {
		addError(
			errors,
			"invalid_runtime_card_update",
			path,
			"must be null or an object",
		);
		return;
	}
	requireAllowedKeys(value, RUNTIME_CARD_UPDATE_KEYS, path, errors);
	requireSafePointer(value.ref, `${path}.ref`, errors);
	requireHeadSha(value.headSha, `${path}.headSha`, errors);
	requireIso(value.producedAt, `${path}.producedAt`, errors);
	requireNullableSafePointer(value.receiptId, `${path}.receiptId`, errors);
}

function validateApplication(
	value: unknown,
	path: string,
	errors: SteeringQueueValidationError[],
) {
	if (!isRecord(value)) {
		addError(errors, "invalid_application", path, "must be an object");
		return;
	}
	requireAllowedKeys(value, APPLICATION_KEYS, path, errors);
	requireEnum(
		value.decision,
		APPLICATION_DECISIONS,
		`${path}.decision`,
		errors,
	);
	requireIso(value.decidedAt, `${path}.decidedAt`, errors);
	requireSafePointer(value.reason, `${path}.reason`, errors);
	requireNullableSafePointer(
		value.appliedClientUserMessageId,
		`${path}.appliedClientUserMessageId`,
		errors,
	);
}

function validateBlockers(
	value: unknown,
	path: string,
	errors: SteeringQueueValidationError[],
) {
	if (!Array.isArray(value)) {
		addError(errors, "invalid_blockers", path, "must be an array");
		return;
	}
	for (const [index, blocker] of value.entries()) {
		const itemPath = `${path}[${index}]`;
		if (!isRecord(blocker)) {
			addError(errors, "invalid_blocker", itemPath, "must be an object");
			continue;
		}
		requireAllowedKeys(blocker, BLOCKER_KEYS, itemPath, errors);
		requireEnum(blocker.class, BLOCKER_CLASSES, `${itemPath}.class`, errors);
		requireSafePointer(blocker.reason, `${itemPath}.reason`, errors);
		requireSafePointer(blocker.nextAction, `${itemPath}.nextAction`, errors);
		requireSafePointer(blocker.evidenceRef, `${itemPath}.evidenceRef`, errors);
	}
}

function validateReceiptSemantics(
	packet: Record<string, unknown>,
	errors: SteeringQueueValidationError[],
) {
	if (!isRecord(packet.expectedContext) || !isRecord(packet.currentContext)) {
		return;
	}
	if (!isRecord(packet.application)) return;

	validateContextFreshness(packet, errors);
	validateStateDecisionCompatibility(packet, errors);
	validateRuntimeCardSemantics(packet, errors);
	validateBlockedOrRejectedSemantics(packet, errors);
}

function validateContextFreshness(
	packet: Record<string, unknown>,
	errors: SteeringQueueValidationError[],
) {
	const expected = packet.expectedContext as Record<string, unknown>;
	const current = packet.currentContext as Record<string, unknown>;
	if (packet.headSha !== current.headSha) {
		addError(
			errors,
			"current_head_mismatch",
			"currentContext.headSha",
			"must match receipt headSha",
		);
	}
	for (const key of ["threadId", "turnId", "clientUserMessageId", "headSha"]) {
		const expectedValue = expected[key];
		if (expectedValue !== null && expectedValue !== current[key]) {
			addError(
				errors,
				"expected_current_mismatch",
				`currentContext.${key}`,
				"must match non-null expectedContext value",
			);
		}
	}
	if (packet.application && isRecord(packet.application)) {
		const decision = packet.application.decision;
		if (
			decision === "applied" &&
			current.turnId === null &&
			current.clientUserMessageId === null
		) {
			addError(
				errors,
				"missing_current_runtime_identity",
				"currentContext",
				"applied receipts require a current turnId or clientUserMessageId",
			);
		}
	}
}

function validateStateDecisionCompatibility(
	packet: Record<string, unknown>,
	errors: SteeringQueueValidationError[],
) {
	const application = packet.application as Record<string, unknown>;
	if (application.decision !== "applied") return;
	if (packet.queueItemState !== "applicable") {
		addError(
			errors,
			"applied_requires_applicable_item",
			"queueItemState",
			"applied receipts require an applicable queue item",
		);
	}
	if (
		Array.isArray(packet.stalePreconditions) &&
		packet.stalePreconditions.length > 0
	) {
		addError(
			errors,
			"applied_with_stale_preconditions",
			"stalePreconditions",
			"applied receipts must not include stale preconditions",
		);
	}
	if (Array.isArray(packet.blockers) && packet.blockers.length > 0) {
		addError(
			errors,
			"applied_with_blockers",
			"blockers",
			"applied receipts must not include blockers",
		);
	}
	const appliedClientUserMessageId = application.appliedClientUserMessageId;
	const currentContext = packet.currentContext as Record<string, unknown>;
	if (appliedClientUserMessageId === null) {
		addError(
			errors,
			"missing_applied_client_user_message_id",
			"application.appliedClientUserMessageId",
			"applied receipts require explicit applied client user-message evidence",
		);
	} else if (
		appliedClientUserMessageId !== currentContext.clientUserMessageId
	) {
		addError(
			errors,
			"applied_client_user_message_mismatch",
			"application.appliedClientUserMessageId",
			"must match currentContext.clientUserMessageId",
		);
	}
}

function validateRuntimeCardSemantics(
	packet: Record<string, unknown>,
	errors: SteeringQueueValidationError[],
) {
	const application = packet.application as Record<string, unknown>;
	const runtimeCardUpdateRef = packet.runtimeCardUpdateRef;
	if (application.decision === "applied" && runtimeCardUpdateRef === null) {
		addError(
			errors,
			"missing_runtime_card_update_ref",
			"runtimeCardUpdateRef",
			"applied receipts require a runtime-card update ref",
		);
		return;
	}
	if (!isRecord(runtimeCardUpdateRef)) return;
	const currentContext = packet.currentContext as Record<string, unknown>;
	if (runtimeCardUpdateRef.headSha !== packet.headSha) {
		addError(
			errors,
			"runtime_card_receipt_head_mismatch",
			"runtimeCardUpdateRef.headSha",
			"must match receipt headSha",
		);
	}
	if (runtimeCardUpdateRef.headSha !== currentContext.headSha) {
		addError(
			errors,
			"runtime_card_current_head_mismatch",
			"runtimeCardUpdateRef.headSha",
			"must match currentContext.headSha",
		);
	}
}

function validateBlockedOrRejectedSemantics(
	packet: Record<string, unknown>,
	errors: SteeringQueueValidationError[],
) {
	const application = packet.application as Record<string, unknown>;
	if (application.decision === "applied") return;
	if (!Array.isArray(packet.blockers) || packet.blockers.length === 0) {
		addError(
			errors,
			"blocked_receipt_requires_blocker",
			"blockers",
			"blocked or rejected receipts require at least one blocker",
		);
	}
	if (!Array.isArray(packet.stalePreconditions)) return;
	const staleKinds = new Set(
		packet.stalePreconditions
			.filter(isRecord)
			.map((entry) => entry.kind)
			.filter((kind): kind is string => typeof kind === "string"),
	);
	if (packet.queueItemState === "expired" && !staleKinds.has("expired_queue")) {
		addError(
			errors,
			"expired_receipt_requires_stale_precondition",
			"stalePreconditions",
			"expired queue items require an expired_queue precondition",
		);
	}
	if (
		packet.queueItemState === "superseded" &&
		!staleKinds.has("superseded_artifact")
	) {
		addError(
			errors,
			"superseded_receipt_requires_stale_precondition",
			"stalePreconditions",
			"superseded queue items require a superseded_artifact precondition",
		);
	}
}
