export const EVIDENCE_RECEIPT_SCHEMA_VERSION = "evidence-receipt/v1" as const;

export const EVIDENCE_RECEIPT_KINDS = [
	"validation",
	"artifact",
	"review_artifact",
	"external_state",
	"runtime_card",
	"run_record",
] as const;

export const EVIDENCE_RECEIPT_STATUSES = [
	"pass",
	"fail",
	"blocked",
	"unknown",
	"not_applicable",
] as const;

export const EVIDENCE_RECEIPT_FRESHNESS = [
	"current",
	"stale",
	"missing",
	"unknown",
	"not_applicable",
] as const;

export const EVIDENCE_RECEIPT_USES = [
	"orientation",
	"claim_support",
	"audit_trail",
] as const;

/** Receipt categories that identify what kind of proof a receipt describes. */
export type EvidenceReceiptKind = (typeof EVIDENCE_RECEIPT_KINDS)[number];

/** Canonical pass/fail/blocking state for a single evidence receipt. */
export type EvidenceReceiptStatus = (typeof EVIDENCE_RECEIPT_STATUSES)[number];

/** Freshness classification used when deciding whether evidence can support a claim. */
export type EvidenceReceiptFreshness =
	(typeof EVIDENCE_RECEIPT_FRESHNESS)[number];

/** Declares whether evidence is suitable for orientation, claim support, or audit history. */
export type EvidenceReceiptUse = (typeof EVIDENCE_RECEIPT_USES)[number];

/** Shared evidence receipt contract for validation, artifacts, runtime cards, and run records. */
export interface EvidenceReceipt {
	schemaVersion: typeof EVIDENCE_RECEIPT_SCHEMA_VERSION;
	kind: EvidenceReceiptKind;
	ref: string;
	producer: string;
	status: EvidenceReceiptStatus;
	freshness: EvidenceReceiptFreshness;
	evidenceUse: EvidenceReceiptUse;
	blockerClass: string | null;
	producedAt?: string;
	verifiedAt?: string;
	headSha?: string | null;
	sizeBytes?: number | null;
	checksum?: string | null;
}

/** Structured validation error emitted when an evidence receipt violates the contract. */
export interface EvidenceReceiptValidationError {
	code: string;
	path: string;
	severity: "error";
}

/** Validation result for callers that need deterministic pass/fail receipt checks. */
export interface EvidenceReceiptValidationResult {
	valid: boolean;
	errors: EvidenceReceiptValidationError[];
}

/** Validate an arbitrary value against the evidence-receipt/v1 contract. */
export function validateEvidenceReceipt(
	value: unknown,
): EvidenceReceiptValidationResult {
	const errors: EvidenceReceiptValidationError[] = [];
	if (!isRecord(value)) {
		addReceiptError(errors, "receipt must be an object", "receipt");
		return { valid: false, errors };
	}

	requireLiteral(
		value.schemaVersion,
		EVIDENCE_RECEIPT_SCHEMA_VERSION,
		"schemaVersion",
		errors,
	);
	requireEnum(value.kind, EVIDENCE_RECEIPT_KINDS, "kind", errors);
	requireNonEmptyString(value.ref, "ref", errors);
	requireNonEmptyString(value.producer, "producer", errors);
	requireEnum(value.status, EVIDENCE_RECEIPT_STATUSES, "status", errors);
	requireEnum(value.freshness, EVIDENCE_RECEIPT_FRESHNESS, "freshness", errors);
	requireEnum(value.evidenceUse, EVIDENCE_RECEIPT_USES, "evidenceUse", errors);
	requireNullableNonEmptyString(value.blockerClass, "blockerClass", errors);

	if (
		typeof value.producedAt !== "string" &&
		typeof value.verifiedAt !== "string"
	) {
		addReceiptError(
			errors,
			"receipt requires producedAt or verifiedAt",
			"producedAt",
		);
	}
	if (value.producedAt !== undefined) {
		requireIsoTimestamp(value.producedAt, "producedAt", errors);
	}
	if (value.verifiedAt !== undefined) {
		requireIsoTimestamp(value.verifiedAt, "verifiedAt", errors);
	}
	if (
		typeof value.producedAt === "string" &&
		typeof value.verifiedAt === "string" &&
		isStrictIsoTimestamp(value.producedAt) &&
		isStrictIsoTimestamp(value.verifiedAt) &&
		Date.parse(value.verifiedAt) < Date.parse(value.producedAt)
	) {
		addReceiptError(
			errors,
			"verifiedAt must not be earlier than producedAt",
			"verifiedAt",
		);
	}
	if (value.headSha !== undefined) {
		requireNullableNonEmptyString(value.headSha, "headSha", errors);
	}
	if (value.checksum !== undefined) {
		requireNullableNonEmptyString(value.checksum, "checksum", errors);
	}
	if (value.sizeBytes !== undefined && value.sizeBytes !== null) {
		if (
			typeof value.sizeBytes !== "number" ||
			!Number.isInteger(value.sizeBytes) ||
			value.sizeBytes < 0
		) {
			addReceiptError(
				errors,
				"sizeBytes must be a non-negative integer when present",
				"sizeBytes",
			);
		}
	}

	return { valid: errors.length === 0, errors };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireLiteral(
	value: unknown,
	expected: string,
	path: string,
	errors: EvidenceReceiptValidationError[],
): void {
	if (value !== expected) {
		addReceiptError(errors, `${path} must be ${expected}`, path);
	}
}

function requireEnum<T extends readonly string[]>(
	value: unknown,
	allowed: T,
	path: string,
	errors: EvidenceReceiptValidationError[],
): void {
	if (typeof value !== "string" || !allowed.includes(value)) {
		addReceiptError(
			errors,
			`${path} must be one of ${allowed.join(", ")}`,
			path,
		);
	}
}

function requireNonEmptyString(
	value: unknown,
	path: string,
	errors: EvidenceReceiptValidationError[],
): void {
	if (typeof value !== "string" || value.trim() === "") {
		addReceiptError(errors, `${path} must be a non-empty string`, path);
	}
}

function requireNullableNonEmptyString(
	value: unknown,
	path: string,
	errors: EvidenceReceiptValidationError[],
): void {
	if (value === null) {
		return;
	}
	requireNonEmptyString(value, path, errors);
}

function requireIsoTimestamp(
	value: unknown,
	path: string,
	errors: EvidenceReceiptValidationError[],
): void {
	requireNonEmptyString(value, path, errors);
	if (typeof value !== "string" || value.trim() === "") {
		return;
	}

	if (!isStrictIsoTimestamp(value)) {
		addReceiptError(errors, `${path} must be an ISO-8601 timestamp`, path);
	}
}

function isStrictIsoTimestamp(value: string): boolean {
	const match =
		/^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/u.exec(
			value,
		);
	if (!match) {
		return false;
	}

	const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
		match;
	const year = Number(yearText);
	const month = Number(monthText);
	const day = Number(dayText);
	const hour = Number(hourText);
	const minute = Number(minuteText);
	const second = Number(secondText);
	const utcDate = new Date(
		Date.UTC(year, month - 1, day, hour, minute, second),
	);

	return (
		utcDate.getUTCFullYear() === year &&
		utcDate.getUTCMonth() === month - 1 &&
		utcDate.getUTCDate() === day &&
		utcDate.getUTCHours() === hour &&
		utcDate.getUTCMinutes() === minute &&
		utcDate.getUTCSeconds() === second &&
		!Number.isNaN(Date.parse(value))
	);
}

function addReceiptError(
	errors: EvidenceReceiptValidationError[],
	code: string,
	path: string,
): void {
	errors.push({ code, path, severity: "error" });
}
