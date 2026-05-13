/**
 * Shared runtime validation helpers for decision-layer contracts.
 *
 * These utilities accumulate deterministic string errors so callers can report
 * every contract failure without trusting or executing payload content.
 */

/** Type guard for plain objects (excludes arrays and null). */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate that `value` is a non-empty string. */
export function validateString(
	value: unknown,
	field: string,
	errors: string[],
): void {
	if (typeof value !== "string" || value.trim().length === 0) {
		errors.push(`${field} must be a non-empty string`);
	}
}

/** Validate that `value` is a non-empty string or `null`. */
export function validateNullableString(
	value: unknown,
	field: string,
	errors: string[],
): void {
	if (
		value !== null &&
		(typeof value !== "string" || value.trim().length === 0)
	) {
		errors.push(`${field} must be a non-empty string or null`);
	}
}

/** Validate that `value` is a boolean. */
export function validateBoolean(
	value: unknown,
	field: string,
	errors: string[],
): void {
	if (typeof value !== "boolean") {
		errors.push(`${field} must be a boolean`);
	}
}

/** Validate that `value` is a non-negative integer. */
export function validateNumber(
	value: unknown,
	field: string,
	errors: string[],
): void {
	if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
		errors.push(`${field} must be a non-negative integer`);
	}
}

/** Validate that `value` is an array of non-empty strings. */
export function validateStringArray(
	value: unknown,
	field: string,
	errors: string[],
): void {
	if (!Array.isArray(value)) {
		errors.push(`${field} must be a string array`);
		return;
	}
	if (
		value.some(
			(entry) => typeof entry !== "string" || entry.trim().length === 0,
		)
	) {
		errors.push(`${field} entries must be non-empty strings`);
	}
}

/**
 * Validate that `value` is one of the allowed enum values.
 *
 * @returns `true` when the value is valid, `false` otherwise.
 */
export function validateEnum<T extends string>(
	value: unknown,
	field: string,
	validValues: readonly T[],
	errors: string[],
): value is T {
	if (!validValues.includes(value as T)) {
		errors.push(`${field} must be one of ${validValues.join(", ")}`);
		return false;
	}
	return true;
}
