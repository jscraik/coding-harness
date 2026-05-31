import type { IntermediaryReceiptCoverageValidationError } from "./types.js";

const HEAD_SHA = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const POINTER = /^[A-Za-z0-9][A-Za-z0-9:._/@#?=&+,-]{0,255}$/u;
const RFC3339 =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const RAW_OR_SECRET_KEY =
	/(raw|promptText|transcript|commandOutput|toolPayload|payload|screenshot|image|secret|token|password|credential|apiKey|privateKey)/iu;
const RAW_OR_SECRET_VALUE =
	/(sk-[A-Za-z0-9_-]{20,}|gh[opsru]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|Bearer\s+[A-Za-z0-9._~+/-]{20,}=*|BEGIN PRIVATE KEY|(?:token|secret|password|credential)=|raw prompt|full transcript|command output)/iu;

/** Adds a structured validation error to the packet validation result. */
export function addError(
	errors: IntermediaryReceiptCoverageValidationError[],
	code: string,
	path: string,
	message: string,
): void {
	errors.push({ code, path, message });
}

/** Returns true when a value is a plain object that can be contract-validated. */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Returns true when a value is a lowercase 40-character git head SHA. */
export function isHeadSha(value: unknown): value is string {
	return typeof value === "string" && HEAD_SHA.test(value);
}

/** Returns true when a value is a lowercase 64-character SHA-256 digest. */
export function isSha256(value: unknown): value is string {
	return typeof value === "string" && SHA256.test(value);
}

/** Returns true when a value is a bounded safe evidence pointer. */
export function isPointer(value: unknown): value is string {
	return typeof value === "string" && POINTER.test(value);
}

/** Returns true when a value is an RFC3339-style timestamp. */
export function isIso(value: unknown): value is string {
	if (typeof value !== "string" || !RFC3339.test(value)) {
		return false;
	}

	// Parse components with more specific capture groups
	const match = value.match(
		/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|([+-])(\d{2}):(\d{2}))$/u,
	);
	if (!match) return false;

	const [
		,
		year,
		month,
		day,
		hour,
		minute,
		second,
		,
		tzPart,
		,
		tzHour,
		tzMinute,
	] = match;
	const numYear = Number.parseInt(year ?? "0", 10);
	const numMonth = Number.parseInt(month ?? "0", 10);
	const numDay = Number.parseInt(day ?? "0", 10);
	const numHour = Number.parseInt(hour ?? "0", 10);
	const numMinute = Number.parseInt(minute ?? "0", 10);
	const numSecond = Number.parseInt(second ?? "0", 10);

	// Validate component ranges
	if (numMonth < 1 || numMonth > 12) return false;
	if (numHour > 23 || numMinute > 59 || numSecond > 59) return false;

	// Validate day range based on month and leap-year calendar semantics.
	const maxDay = new Date(Date.UTC(numYear, numMonth, 0)).getUTCDate();
	if (numDay < 1 || (maxDay !== undefined && numDay > maxDay)) return false;

	// Validate timezone offset
	if (tzPart !== "Z") {
		if (tzHour === undefined || tzMinute === undefined) return false;
		const numTzHour = Number.parseInt(tzHour, 10);
		const numTzMinute = Number.parseInt(tzMinute, 10);
		if (numTzHour > 23 || numTzMinute > 59) return false;
	}

	return true;
}

/** Rejects object keys that are not part of the declared packet contract. */
export function requireAllowedKeys(
	value: Record<string, unknown>,
	allowedKeys: readonly string[],
	path: string,
	errors: IntermediaryReceiptCoverageValidationError[],
): void {
	const allowed = new Set(allowedKeys);
	for (const key of Object.keys(value)) {
		if (!allowed.has(key)) {
			addError(
				errors,
				"unknown_field",
				`${path}.${key}`,
				"field is not part of the contract",
			);
		}
	}
}

/** Requires a value to be one of a closed string enum. */
export function requireEnum<T extends readonly string[]>(
	value: unknown,
	allowed: T,
	path: string,
	errors: IntermediaryReceiptCoverageValidationError[],
): void {
	if (typeof value !== "string" || !allowed.includes(value)) {
		addError(
			errors,
			"invalid_enum",
			path,
			`must be one of ${allowed.join(", ")}`,
		);
	}
}

/** Requires a value to match an exact string literal. */
export function requireLiteral(
	value: unknown,
	expected: string,
	path: string,
	errors: IntermediaryReceiptCoverageValidationError[],
): void {
	if (value !== expected) {
		addError(errors, "invalid_literal", path, `must be ${expected}`);
	}
}

/** Requires a value to be a bounded safe evidence pointer. */
export function requirePointer(
	value: unknown,
	path: string,
	errors: IntermediaryReceiptCoverageValidationError[],
): void {
	if (!isPointer(value)) {
		addError(errors, "invalid_pointer", path, "must be a compact safe pointer");
	}
}

/** Requires a value to be bounded single-line text. */
export function requireText(
	value: unknown,
	path: string,
	maxLength: number,
	errors: IntermediaryReceiptCoverageValidationError[],
): void {
	if (
		typeof value !== "string" ||
		value.trim() === "" ||
		value.length > maxLength ||
		/[\r\n]/u.test(value)
	) {
		addError(errors, "invalid_text", path, "must be bounded single-line text");
	}
}

/** Requires a value to be an RFC3339-style timestamp. */
export function requireIso(
	value: unknown,
	path: string,
	errors: IntermediaryReceiptCoverageValidationError[],
): void {
	if (!isIso(value)) {
		addError(errors, "invalid_timestamp", path, "must be an RFC3339 timestamp");
	}
}

/** Requires a value to be null or a lowercase 40-character git head SHA. */
export function requireNullableHeadSha(
	value: unknown,
	path: string,
	errors: IntermediaryReceiptCoverageValidationError[],
): void {
	if (value !== null && !isHeadSha(value)) {
		addError(
			errors,
			"invalid_head_sha",
			path,
			"must be a 40-character lowercase git SHA or null",
		);
	}
}

/** Requires a value to be null or a lowercase 64-character SHA-256 digest. */
export function requireNullableSha256(
	value: unknown,
	path: string,
	errors: IntermediaryReceiptCoverageValidationError[],
): void {
	if (value !== null && !isSha256(value)) {
		addError(
			errors,
			"invalid_sha256",
			path,
			"must be a 64-character lowercase sha256 or null",
		);
	}
}

/** Requires a value to be null or a bounded safe evidence pointer. */
export function requireNullablePointer(
	value: unknown,
	path: string,
	errors: IntermediaryReceiptCoverageValidationError[],
): void {
	if (value !== null && !isPointer(value)) {
		addError(
			errors,
			"invalid_pointer",
			path,
			"must be a compact safe pointer or null",
		);
	}
}

/** Requires a value to be boolean. */
export function requireBoolean(
	value: unknown,
	path: string,
	errors: IntermediaryReceiptCoverageValidationError[],
): void {
	if (typeof value !== "boolean") {
		addError(errors, "invalid_boolean", path, "must be boolean");
	}
}

/** Recursively rejects raw payload or secret-like object keys. */
export function validateNoRawKeys(
	value: unknown,
	path: string,
	errors: IntermediaryReceiptCoverageValidationError[],
): void {
	if (Array.isArray(value)) {
		value.forEach((item, index) => {
			validateNoRawKeys(item, `${path}[${index}]`, errors);
		});
		return;
	}
	if (!isRecord(value)) return;
	for (const [key, nested] of Object.entries(value)) {
		if (RAW_OR_SECRET_KEY.test(key)) {
			addError(
				errors,
				"raw_or_secret_content",
				`${path}.${key}`,
				"raw payload or sensitive key is not allowed in intermediary receipt coverage",
			);
		}
		validateNoRawKeys(nested, `${path}.${key}`, errors);
	}
}

/** Recursively rejects secret-like or raw payload scalar string values. */
export function validateScalarValues(
	value: unknown,
	path: string,
	errors: IntermediaryReceiptCoverageValidationError[],
): void {
	if (Array.isArray(value)) {
		value.forEach((item, index) => {
			validateScalarValues(item, `${path}[${index}]`, errors);
		});
		return;
	}
	if (isRecord(value)) {
		for (const [key, nested] of Object.entries(value)) {
			validateScalarValues(nested, `${path}.${key}`, errors);
		}
		return;
	}
	if (typeof value === "string" && RAW_OR_SECRET_VALUE.test(value)) {
		addError(
			errors,
			"secret_like_value",
			path,
			"secret-like or raw payload value is not allowed",
		);
	}
}
