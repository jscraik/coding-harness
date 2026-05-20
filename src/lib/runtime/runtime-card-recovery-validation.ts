import {
	type HeValidationError,
	isRecord,
	toValidationError,
	validateEnum,
	validateNullableString,
	validateString,
	validateStringArray,
} from "../decision/validators.js";
import type {
	RuntimeCardLifecycleState,
	RuntimeCardRecoveryOwner,
	RuntimeCardRetryDecision,
} from "./runtime-card.js";

const VALID_LIFECYCLES: readonly RuntimeCardLifecycleState[] = [
	"planned",
	"active",
	"implemented",
	"locally_validated",
	"review_pending",
	"ci_blocked",
	"merge_ready",
	"merged",
	"closeout_pending",
	"reconciled",
	"closed",
	"stale",
	"superseded",
	"blocked",
	"unknown",
];

const VALID_RECOVERY_OWNERS: readonly RuntimeCardRecoveryOwner[] = [
	"codex",
	"external_service",
	"operator",
];

const VALID_RETRY_DECISIONS: readonly RuntimeCardRetryDecision[] = [
	"none",
	"wait",
	"stop",
];

function validatePositiveInteger(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): void {
	if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
		errors.push(
			toValidationError(`${field} must be a positive integer`, field),
		);
	}
}

/** Validate runtime-card attempt ledger retry metadata. */
export function validateRuntimeCardAttemptLedger(
	value: unknown,
	errors: HeValidationError[],
): void {
	if (!isRecord(value)) {
		errors.push(
			toValidationError("attemptLedger must be an object", "attemptLedger"),
		);
		return;
	}
	if (value.schemaVersion !== "attempt-ledger/v1") {
		errors.push(
			toValidationError(
				"attemptLedger.schemaVersion must be attempt-ledger/v1",
				"attemptLedger.schemaVersion",
			),
		);
	}
	if (value.command !== "runtime-card") {
		errors.push(
			toValidationError(
				"attemptLedger.command must be runtime-card",
				"attemptLedger.command",
			),
		);
	}
	validatePositiveInteger(value.attempt, "attemptLedger.attempt", errors);
	validatePositiveInteger(
		value.maxAttempts,
		"attemptLedger.maxAttempts",
		errors,
	);
	if (value.firstFailure !== null) {
		if (!isRecord(value.firstFailure)) {
			errors.push(
				toValidationError(
					"attemptLedger.firstFailure must be an object or null",
					"attemptLedger.firstFailure",
				),
			);
		} else {
			validatePositiveInteger(
				value.firstFailure.attempt,
				"attemptLedger.firstFailure.attempt",
				errors,
			);
			validateEnum(
				value.firstFailure.lifecycle,
				"attemptLedger.firstFailure.lifecycle",
				VALID_LIFECYCLES,
				errors,
			);
			validateString(
				value.firstFailure.nextSafeAction,
				"attemptLedger.firstFailure.nextSafeAction",
				errors,
			);
		}
	}
	validateEnum(
		value.retryDecision,
		"attemptLedger.retryDecision",
		VALID_RETRY_DECISIONS,
		errors,
	);
	validateEnum(
		value.owner,
		"attemptLedger.owner",
		VALID_RECOVERY_OWNERS,
		errors,
	);
	validateNullableString(value.stopReason, "attemptLedger.stopReason", errors);
	validateString(value.nextAction, "attemptLedger.nextAction", errors);
	validateStringArray(value.evidenceRefs, "attemptLedger.evidenceRefs", errors);
}

/** Validate runtime-card recovery event metadata. */
export function validateRuntimeCardRecoveryEvent(
	value: unknown,
	errors: HeValidationError[],
): void {
	if (value === null) return;
	if (!isRecord(value)) {
		errors.push(
			toValidationError(
				"recoveryEvent must be an object or null",
				"recoveryEvent",
			),
		);
		return;
	}
	if (value.schemaVersion !== "recovery-event/v1") {
		errors.push(
			toValidationError(
				"recoveryEvent.schemaVersion must be recovery-event/v1",
				"recoveryEvent.schemaVersion",
			),
		);
	}
	if (value.command !== "runtime-card") {
		errors.push(
			toValidationError(
				"recoveryEvent.command must be runtime-card",
				"recoveryEvent.command",
			),
		);
	}
	validateString(value.eventId, "recoveryEvent.eventId", errors);
	validatePositiveInteger(value.attempt, "recoveryEvent.attempt", errors);
	validateEnum(
		value.owner,
		"recoveryEvent.owner",
		VALID_RECOVERY_OWNERS,
		errors,
	);
	validateString(value.failureClass, "recoveryEvent.failureClass", errors);
	validateString(value.stopReason, "recoveryEvent.stopReason", errors);
	validateString(value.nextAction, "recoveryEvent.nextAction", errors);
	validateEnum(
		value.retryDecision,
		"recoveryEvent.retryDecision",
		VALID_RETRY_DECISIONS,
		errors,
	);
	validateStringArray(value.evidenceRefs, "recoveryEvent.evidenceRefs", errors);
}
