import { validateSources } from "./source-validation.js";
import { EXTERNAL_STATE_SNAPSHOT_SCHEMA_VERSION } from "./types.js";
import type {
	ExternalStateValidationError,
	ExternalStateValidationResult,
} from "./types.js";
import {
	EVIDENCE_USES,
	addExternalStateError,
	isEmptyArray,
	isExpiredAt,
	isRecord,
	requireBoolean,
	requireEnum,
	requireIsoTimestamp,
	requireLiteral,
	requireNullableHeadSha,
	requirePositiveInteger,
	validateStringArray,
} from "./validation-helpers.js";

/** Validate an arbitrary value against the external-state-snapshot/v1 contract. */
export function validateExternalStateSnapshot(
	value: unknown,
): ExternalStateValidationResult {
	const errors: ExternalStateValidationError[] = [];
	if (!isRecord(value)) {
		addExternalStateError(errors, "snapshot must be an object", "snapshot");
		return { valid: false, errors };
	}

	requireLiteral(
		value.schemaVersion,
		EXTERNAL_STATE_SNAPSHOT_SCHEMA_VERSION,
		"schemaVersion",
		errors,
	);
	requireIsoTimestamp(value.generatedAt, "generatedAt", errors);
	requireIsoTimestamp(value.fetchedAt, "fetchedAt", errors);
	requirePositiveInteger(value.ttlSeconds, "ttlSeconds", errors);
	requireNullableHeadSha(value.headSha, "headSha", errors);
	requireEnum(value.evidenceUse, EVIDENCE_USES, "evidenceUse", errors);
	requireBoolean(value.stale, "stale", errors);
	validateStringArray(value.staleReasons, "staleReasons", errors);
	validateSources(value.sources, value.headSha, value.generatedAt, errors);
	validateSnapshotStaleness(value, errors);

	return { valid: errors.length === 0, errors };
}

function validateSnapshotStaleness(
	value: Record<string, unknown>,
	errors: ExternalStateValidationError[],
): void {
	const expired = isExpiredAt(
		value.fetchedAt,
		value.ttlSeconds,
		value.generatedAt,
	);
	if (value.stale === true && isEmptyArray(value.staleReasons)) {
		addExternalStateError(
			errors,
			"stale snapshots require at least one stale reason",
			"staleReasons",
		);
	}
	if (expired && value.stale !== true) {
		addExternalStateError(
			errors,
			"expired snapshots must be marked stale",
			"stale",
		);
	}
	if (expired && isEmptyArray(value.staleReasons)) {
		addExternalStateError(
			errors,
			"expired snapshots require a stale reason",
			"staleReasons",
		);
	}
}
