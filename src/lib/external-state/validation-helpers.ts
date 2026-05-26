import { isSafeEvidenceReceiptPointer } from "../evidence/evidence-receipt.js";
import type { ExternalStateValidationError } from "./types.js";

export const EVIDENCE_USES = [
	"orientation",
	"claim_support",
	"audit_trail",
] as const;

export const RECEIPT_FRESHNESS = [
	"current",
	"stale",
	"missing",
	"unknown",
	"not_applicable",
] as const;

export const RECEIPT_STATUSES = [
	"pass",
	"fail",
	"blocked",
	"unknown",
	"not_applicable",
] as const;

/** Require an exact literal value for a packet field. */
export function requireLiteral(
	value: unknown,
	expected: string,
	path: string,
	errors: ExternalStateValidationError[],
): void {
	if (value !== expected) {
		addExternalStateError(errors, `${path} must be ${expected}`, path);
	}
}

/** Require a string value from a fixed enum list. */
export function requireEnum<T extends readonly string[]>(
	value: unknown,
	allowed: T,
	path: string,
	errors: ExternalStateValidationError[],
): void {
	if (typeof value !== "string" || !allowed.includes(value)) {
		addExternalStateError(
			errors,
			`${path} must be one of ${allowed.join(", ")}`,
			path,
		);
	}
}

/** Require a boolean value for a packet field. */
export function requireBoolean(
	value: unknown,
	path: string,
	errors: ExternalStateValidationError[],
): void {
	if (typeof value !== "boolean") {
		addExternalStateError(errors, `${path} must be a boolean`, path);
	}
}

/** Require a compact non-empty string safe for evidence pointers. */
export function requireSafeNonEmptyString(
	value: unknown,
	path: string,
	errors: ExternalStateValidationError[],
): void {
	if (typeof value !== "string" || value.trim() === "") {
		addExternalStateError(errors, `${path} must be a non-empty string`, path);
		return;
	}
	if (!isSafeEvidenceReceiptPointer(value)) {
		addExternalStateError(
			errors,
			`${path} must be a safe compact string`,
			path,
		);
	}
}

/** Require a strict ISO-8601 timestamp string. */
export function requireIsoTimestamp(
	value: unknown,
	path: string,
	errors: ExternalStateValidationError[],
): void {
	requireSafeNonEmptyString(value, path, errors);
	if (typeof value === "string" && !isStrictIsoTimestamp(value)) {
		addExternalStateError(
			errors,
			`${path} must be an ISO-8601 timestamp`,
			path,
		);
	}
}

/** Require a positive integer value. */
export function requirePositiveInteger(
	value: unknown,
	path: string,
	errors: ExternalStateValidationError[],
): void {
	if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
		addExternalStateError(errors, `${path} must be a positive integer`, path);
	}
}

/** Require null or a 40-character git head SHA. */
export function requireNullableHeadSha(
	value: unknown,
	path: string,
	errors: ExternalStateValidationError[],
): void {
	if (value === null) return;
	requireSafeNonEmptyString(value, path, errors);
	if (typeof value === "string" && !/^[a-f0-9]{40}$/u.test(value)) {
		addExternalStateError(
			errors,
			`${path} must be a 40-character git SHA`,
			path,
		);
	}
}

/** Validate an array of compact non-empty strings. */
export function validateStringArray(
	value: unknown,
	path: string,
	errors: ExternalStateValidationError[],
): void {
	if (!Array.isArray(value)) {
		addExternalStateError(errors, `${path} must be an array`, path);
		return;
	}
	for (const [index, item] of value.entries()) {
		requireSafeNonEmptyString(item, `${path}.${index}`, errors);
	}
}

/** Return whether a value is an empty array. */
export function isEmptyArray(value: unknown): boolean {
	return Array.isArray(value) && value.length === 0;
}

/** Return whether a value is a plain object record. */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Return whether fetchedAt plus ttlSeconds is expired by generatedAt. */
export function isExpiredAt(
	fetchedAt: unknown,
	ttlSeconds: unknown,
	generatedAt: unknown,
): boolean {
	if (
		typeof fetchedAt !== "string" ||
		typeof ttlSeconds !== "number" ||
		!Number.isInteger(ttlSeconds) ||
		ttlSeconds <= 0 ||
		typeof generatedAt !== "string"
	) {
		return false;
	}
	const fetchedAtMs = Date.parse(fetchedAt);
	const generatedAtMs = Date.parse(generatedAt);
	if (!Number.isFinite(fetchedAtMs) || !Number.isFinite(generatedAtMs)) {
		return false;
	}
	return fetchedAtMs + ttlSeconds * 1000 <= generatedAtMs;
}

/** Append a structured external-state validation error. */
export function addExternalStateError(
	errors: ExternalStateValidationError[],
	code: string,
	path: string,
): void {
	errors.push({ code, path, severity: "error" });
}

function isStrictIsoTimestamp(value: string): boolean {
	return /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/u.test(
		value,
	);
}
