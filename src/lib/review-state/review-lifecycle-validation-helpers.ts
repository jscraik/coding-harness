import type { ReviewLifecycleValidationError } from "./review-lifecycle-contract.js";

const RAW_OR_SECRET_KEY_PATTERN =
	/(raw|body|prompt|transcript|secret|token|credential|password|apiKey|api_key)/iu;

/** @internal Append a ReviewLifecycle/v1 validation error. */
export function addError(
	errors: ReviewLifecycleValidationError[],
	code: string,
	path: string,
): void {
	errors.push({ code, path, severity: "error" });
}

/** @internal True when a value is a plain record. */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** @internal Reject fields not owned by a schema-closed object. */
export function requireAllowedKeys(
	value: Record<string, unknown>,
	allowed: readonly string[],
	path: string,
	errors: ReviewLifecycleValidationError[],
): void {
	const allowedKeys = new Set(allowed);
	for (const key of Object.keys(value)) {
		if (!allowedKeys.has(key)) {
			addError(errors, "field is not allowed", `${path}.${key}`);
		}
	}
}

/** @internal Reject nested keys that could carry raw prompts or secrets. */
export function rejectRawOrSensitiveKeys(
	value: unknown,
	path: string,
	errors: ReviewLifecycleValidationError[],
): void {
	if (Array.isArray(value)) {
		for (const [index, entry] of value.entries()) {
			rejectRawOrSensitiveKeys(entry, `${path}.${index}`, errors);
		}
		return;
	}
	if (!isRecord(value)) return;
	for (const [key, entry] of Object.entries(value)) {
		if (RAW_OR_SECRET_KEY_PATTERN.test(key)) {
			addError(
				errors,
				"raw or sensitive fields are not allowed",
				`${path}.${key}`,
			);
		}
		rejectRawOrSensitiveKeys(entry, `${path}.${key}`, errors);
	}
}

/** @internal Require an exact string literal. */
export function requireLiteral(
	value: unknown,
	expected: string,
	path: string,
	errors: ReviewLifecycleValidationError[],
): void {
	if (value !== expected) {
		addError(errors, `${path} must be ${expected}`, path);
	}
}

/** @internal Require one value from an allowed string set. */
export function requireEnum<T extends readonly string[]>(
	value: unknown,
	allowed: T,
	path: string,
	errors: ReviewLifecycleValidationError[],
): void {
	if (typeof value !== "string" || !allowed.includes(value)) {
		addError(errors, `${path} must be one of ${allowed.join(", ")}`, path);
	}
}

/** @internal Require bounded single-line text. */
export function requireSafeText(
	value: unknown,
	path: string,
	errors: ReviewLifecycleValidationError[],
): void {
	if (
		typeof value !== "string" ||
		value.trim() === "" ||
		/[\r\n]/u.test(value) ||
		value.length > 512
	) {
		addError(errors, `${path} must be bounded single-line text`, path);
	}
}

/** @internal Require null or bounded single-line text. */
export function requireNullableSafeText(
	value: unknown,
	path: string,
	errors: ReviewLifecycleValidationError[],
): void {
	if (value === null) return;
	requireSafeText(value, path, errors);
}

/** @internal Require an ISO UTC timestamp. */
export function requireIsoTimestamp(
	value: unknown,
	path: string,
	errors: ReviewLifecycleValidationError[],
): void {
	if (
		typeof value !== "string" ||
		!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:[.][0-9]{1,3})?Z$/u.test(
			value,
		) ||
		Number.isNaN(Date.parse(value))
	) {
		addError(errors, `${path} must be an ISO UTC timestamp`, path);
	}
}

/** @internal Require null or an ISO UTC timestamp. */
export function requireNullableIso(
	value: unknown,
	path: string,
	errors: ReviewLifecycleValidationError[],
): void {
	if (value === null) return;
	requireIsoTimestamp(value, path, errors);
}

/** @internal Require a lowercase 40-character git SHA. */
export function requireHeadSha(
	value: unknown,
	path: string,
	errors: ReviewLifecycleValidationError[],
): void {
	if (typeof value !== "string" || !/^[a-f0-9]{40}$/u.test(value)) {
		addError(errors, `${path} must be a 40-character git head SHA`, path);
	}
}

/** @internal Require a positive integer. */
export function requirePositiveInteger(
	value: unknown,
	path: string,
	errors: ReviewLifecycleValidationError[],
): void {
	if (!Number.isInteger(value) || (value as number) < 1) {
		addError(errors, `${path} must be a positive integer`, path);
	}
}

/** @internal Require a non-negative integer. */
export function requireNonNegativeInteger(
	value: unknown,
	path: string,
	errors: ReviewLifecycleValidationError[],
): void {
	if (!Number.isInteger(value) || (value as number) < 0) {
		addError(errors, `${path} must be a non-negative integer`, path);
	}
}
