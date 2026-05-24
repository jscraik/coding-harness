import {
	isRecord,
	toValidationError,
	type HeValidationError,
} from "../decision/validators.js";

/** Structured result returned by lifecycle intent validators. */
export interface LifecycleIntentValidationResult {
	/** Whether the checked artifact satisfies the lifecycle intent contract. */
	valid: boolean;
	/** Deterministic validation errors, empty when valid. */
	errors: HeValidationError[];
}

/** Evidence-use modes accepted for reviewed intent proof. */
export const LIFECYCLE_INTENT_ALLOWED_EVIDENCE_USES = [
	"claim_support",
	"audit_trail",
] as const;

/** Status required for a review receipt to authorize implementation start. */
export const LIFECYCLE_INTENT_PASS_STATUS = "pass";

/** Mechanically checkable acceptance IDs for the runtime verifier lifecycle. */
export const CODEX_RUNTIME_EVIDENCE_ACCEPTANCE_IDS = [
	"SA-001",
	"SA-002",
	"SA-003",
	"SA-004",
	"SA-005",
	"SA-006",
	"SA-007",
	"SA-008",
	"SA-009",
	"SA-010",
	"SA-011",
	"SA-012",
	"SA-013",
	"SA-014",
	"SA-015",
	"SA-016",
	"SA-017",
	"SA-018",
] as const;

/** Proof kinds accepted by acceptance coverage validation. */
export const LIFECYCLE_INTENT_ACCEPTANCE_PROOF_KINDS = [
	"validator",
	"test",
	"fixture",
	"command",
	"schema_assertion",
] as const;

/** Lifecycle units frozen by the PU-000 baseline. */
export const CODEX_RUNTIME_EVIDENCE_LIFECYCLE_UNITS = [
	"PU-000",
	"PU-001",
	"PU-002",
	"PU-003",
	"PU-004",
	"PU-005",
	"PU-006",
	"PU-007",
	"PU-008",
	"PU-009",
	"PU-010",
	"PU-011",
	"PU-012",
	"PU-013",
	"PU-014",
	"PU-015",
	"PU-016",
] as const;

/** Unknown-path policy required before runtime implementation begins. */
export const LIFECYCLE_INTENT_UNKNOWN_RUNTIME_PATH_POLICY =
	"fail_closed_until_reviewed_intent_updates_guardedPathGlobs";

/** Adds a structured validation error to the accumulator. */
export function addLifecycleIntentError(
	errors: HeValidationError[],
	code: string,
	path?: string,
): void {
	errors.push(toValidationError(code, path));
}

/** Returns true when all entries are non-empty strings. */
export function isNonEmptyStringArray(value: unknown): value is string[] {
	return (
		Array.isArray(value) &&
		value.length > 0 &&
		value.every((entry) => typeof entry === "string" && entry.trim() !== "")
	);
}

/** Validates that a value is a non-empty string array. */
export function requireNonEmptyStringArray(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): void {
	if (!isNonEmptyStringArray(value)) {
		addLifecycleIntentError(
			errors,
			`${field} must be a non-empty string array`,
			field,
		);
	}
}

/** Validates that a value is a non-empty string. */
export function requireString(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): void {
	if (typeof value !== "string" || value.trim() === "") {
		addLifecycleIntentError(
			errors,
			`${field} must be a non-empty string`,
			field,
		);
	}
}

/** Validates that a value is a plain object. */
export function requireRecord(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): value is Record<string, unknown> {
	if (!isRecord(value)) {
		addLifecycleIntentError(errors, `${field} must be an object`, field);
		return false;
	}
	return true;
}

/** Validates that a value is a non-empty object array. */
export function requireRecordArray(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): value is Record<string, unknown>[] {
	if (!Array.isArray(value) || value.length === 0 || !value.every(isRecord)) {
		addLifecycleIntentError(
			errors,
			`${field} must be a non-empty object array`,
			field,
		);
		return false;
	}
	return true;
}

/** Compares two string arrays as exact ordered contracts. */
export function sameStringArray(left: string[], right: string[]): boolean {
	return (
		left.length === right.length &&
		left.every((entry, index) => entry === right[index])
	);
}

/** Extracts a string array after recording shape errors. */
export function readStringArray(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): string[] {
	if (!Array.isArray(value)) {
		addLifecycleIntentError(errors, `${field} must be a string array`, field);
		return [];
	}
	const strings = value.filter(
		(entry): entry is string =>
			typeof entry === "string" && entry.trim() !== "",
	);
	if (strings.length !== value.length) {
		addLifecycleIntentError(
			errors,
			`${field} entries must be non-empty strings`,
			field,
		);
	}
	return strings;
}
