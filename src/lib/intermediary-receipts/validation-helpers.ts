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
	if (typeof value !== "string") return false;
	const match = RFC3339.exec(value);
	if (!match) return false;
	const [datePart, timeAndZone] = value.split("T");
	if (!datePart || !timeAndZone) return false;
	const [yearText, monthText, dayText] = datePart.split("-");
	const [timePart, zonePart] = timeAndZone.endsWith("Z")
		? [timeAndZone.slice(0, -1), "Z"]
		: [timeAndZone.slice(0, -6), timeAndZone.slice(timeAndZone.length - 6)];
	const [hourText, minuteText, secondTextWithFraction] = timePart.split(":");
	const secondText = secondTextWithFraction?.split(".")[0];
	const year = Number(yearText);
	const month = Number(monthText);
	const day = Number(dayText);
	const hour = Number(hourText);
	const minute = Number(minuteText);
	const second = Number(secondText);
	if (
		!Number.isInteger(year) ||
		!Number.isInteger(month) ||
		!Number.isInteger(day) ||
		!Number.isInteger(hour) ||
		!Number.isInteger(minute) ||
		!Number.isInteger(second)
	) {
		return false;
	}
	if (month < 1 || month > 12) return false;
	const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
	if (day < 1 || day > maxDay) return false;
	if (
		hour < 0 ||
		hour > 23 ||
		minute < 0 ||
		minute > 59 ||
		second < 0 ||
		second > 59
	) {
		return false;
	}
	if (zonePart !== "Z") {
		const zoneHour = Number(zonePart.slice(1, 3));
		const zoneMinute = Number(zonePart.slice(4, 6));
		if (
			!Number.isInteger(zoneHour) ||
			!Number.isInteger(zoneMinute) ||
			zoneHour > 23 ||
			zoneMinute > 59
		) {
			return false;
		}
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
