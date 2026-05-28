import {
	ITEM_KEYS,
	STEERING_INSTRUCTION_CANONICALIZATION_VERSION,
	STEERING_QUEUE_DELIVERY_MODES,
	STEERING_QUEUE_PROVENANCE_KINDS,
	STEERING_QUEUE_STATES,
} from "./constants.js";
import type {
	SteeringQueueItem,
	SteeringQueueValidationError,
} from "./types.js";
import {
	addError,
	isRecord,
	requireAllowedKeys,
	requireEnum,
	requireHeadSha,
	requireIso,
	requireLiteral,
	requireNullableIso,
	requireNullableSafePointer,
	requirePointerArray,
	requireSafePointer,
	requireSha256,
	validateArtifactArray,
	validateStalePreconditions,
} from "./validation-helpers.js";

/** Validate one evaluated steering queue item and its semantic invariants. */
export function validateItem(
	value: unknown,
	path: string,
	ids: Set<string>,
	errors: SteeringQueueValidationError[],
) {
	if (!isRecord(value)) {
		addError(errors, "invalid_item", path, "must be an object");
		return;
	}
	requireAllowedKeys(value, ITEM_KEYS, path, errors);
	validateItemIdentity(value, path, ids, errors);
	validateInstructionContract(value, path, errors);
	validateRuntimeContext(value, path, errors);
	validateItemStateFields(value, path, errors);
	validateItemSemantics(value as Partial<SteeringQueueItem>, path, errors);
}

function validateItemIdentity(
	value: Record<string, unknown>,
	path: string,
	ids: Set<string>,
	errors: SteeringQueueValidationError[],
) {
	requireSafePointer(value.id, `${path}.id`, errors);
	if (typeof value.id === "string") {
		if (ids.has(value.id)) {
			addError(errors, "duplicate_item_id", `${path}.id`, "must be unique");
		}
		ids.add(value.id);
	}
	requireSafePointer(value.scopeRef, `${path}.scopeRef`, errors);
	requireIso(value.createdAt, `${path}.createdAt`, errors);
	requireIso(value.expiresAt, `${path}.expiresAt`, errors);
	requireSafePointer(value.sourceRef, `${path}.sourceRef`, errors);
}

function validateInstructionContract(
	value: Record<string, unknown>,
	path: string,
	errors: SteeringQueueValidationError[],
) {
	requireSafePointer(value.instructionRef, `${path}.instructionRef`, errors);
	requireSha256(value.instructionHash, `${path}.instructionHash`, errors);
	requireLiteral(
		value.instructionHashAlgorithm,
		"sha256",
		`${path}.instructionHashAlgorithm`,
		errors,
	);
	requireLiteral(
		value.instructionCanonicalizationVersion,
		STEERING_INSTRUCTION_CANONICALIZATION_VERSION,
		`${path}.instructionCanonicalizationVersion`,
		errors,
	);
	requireEnum(
		value.instructionProvenanceKind,
		STEERING_QUEUE_PROVENANCE_KINDS,
		`${path}.instructionProvenanceKind`,
		errors,
	);
	requireEnum(
		value.deliveryMode,
		STEERING_QUEUE_DELIVERY_MODES,
		`${path}.deliveryMode`,
		errors,
	);
}

function validateRuntimeContext(
	value: Record<string, unknown>,
	path: string,
	errors: SteeringQueueValidationError[],
) {
	requireNullableSafePointer(
		value.expectedThreadId,
		`${path}.expectedThreadId`,
		errors,
	);
	requireNullableSafePointer(
		value.expectedTurnId,
		`${path}.expectedTurnId`,
		errors,
	);
	requireHeadSha(value.expectedHeadSha, `${path}.expectedHeadSha`, errors);
	if (!Number.isInteger(value.priority)) {
		addError(
			errors,
			"invalid_priority",
			`${path}.priority`,
			"must be an integer",
		);
	}
	validateArtifactArray(
		value.requiredArtifacts,
		`${path}.requiredArtifacts`,
		errors,
	);
	requirePointerArray(value.supersedes, `${path}.supersedes`, errors);
	requireNullableSafePointer(
		value.supersededBy,
		`${path}.supersededBy`,
		errors,
	);
}

function validateItemStateFields(
	value: Record<string, unknown>,
	path: string,
	errors: SteeringQueueValidationError[],
) {
	requireEnum(value.state, STEERING_QUEUE_STATES, `${path}.state`, errors);
	requireNullableSafePointer(value.stateReason, `${path}.stateReason`, errors);
	requireIso(value.stateAt, `${path}.stateAt`, errors);
	requireNullableIso(value.appliedAt, `${path}.appliedAt`, errors);
	requireNullableIso(value.rejectedAt, `${path}.rejectedAt`, errors);
	requireNullableIso(value.supersededAt, `${path}.supersededAt`, errors);
	validateStalePreconditions(
		value.stalePreconditions,
		`${path}.stalePreconditions`,
		errors,
	);
}

function validateItemSemantics(
	item: Partial<SteeringQueueItem>,
	path: string,
	errors: SteeringQueueValidationError[],
) {
	validateExpiry(item, path, errors);
	validateStateTimestamps(item, path, errors);
	validateTerminalState(item, path, errors);
}

function validateExpiry(
	item: Partial<SteeringQueueItem>,
	path: string,
	errors: SteeringQueueValidationError[],
) {
	if (
		typeof item.createdAt === "string" &&
		typeof item.expiresAt === "string" &&
		Date.parse(item.expiresAt) <= Date.parse(item.createdAt)
	) {
		addError(
			errors,
			"invalid_expiry",
			`${path}.expiresAt`,
			"must be later than createdAt",
		);
	}
}

function validateStateTimestamps(
	item: Partial<SteeringQueueItem>,
	path: string,
	errors: SteeringQueueValidationError[],
) {
	for (const timestampKey of [
		"appliedAt",
		"rejectedAt",
		"supersededAt",
	] as const) {
		const timestamp = item[timestampKey];
		if (
			typeof item.createdAt === "string" &&
			typeof timestamp === "string" &&
			Date.parse(timestamp) < Date.parse(item.createdAt)
		) {
			addError(
				errors,
				"invalid_state_timestamp",
				`${path}.${timestampKey}`,
				"must be after createdAt",
			);
		}
	}
}

function validateTerminalState(
	item: Partial<SteeringQueueItem>,
	path: string,
	errors: SteeringQueueValidationError[],
) {
	if (item.state === "applied" && item.appliedAt === null) {
		addError(
			errors,
			"missing_applied_at",
			`${path}.appliedAt`,
			"is required for applied items",
		);
	}
	if (item.state === "applied" && (item.stalePreconditions?.length ?? 0) > 0) {
		addError(
			errors,
			"applied_with_stale_preconditions",
			`${path}.stalePreconditions`,
			"must be empty for applied items",
		);
	}
	if (item.state === "rejected" && item.rejectedAt === null) {
		addError(
			errors,
			"missing_rejected_at",
			`${path}.rejectedAt`,
			"is required for rejected items",
		);
	}
	if (item.state === "rejected" && item.stateReason === null) {
		addError(
			errors,
			"missing_state_reason",
			`${path}.stateReason`,
			"is required for rejected items",
		);
	}
}
