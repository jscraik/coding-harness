/**
 * Shared runtime validation helpers for decision-layer contracts.
 *
 * These utilities accumulate deterministic string errors so callers can report
 * every contract failure without trusting or executing payload content.
 */

/**
 * Determines whether a value is a plain object (not null and not an array).
 *
 * @returns `true` if `value` is an object, not `null`, and not an array; `false` otherwise.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates that the provided value is a non-empty string after trimming whitespace.
 *
 * If validation fails, appends `${field} must be a non-empty string` to `errors`.
 *
 * @param field - Field name used in the appended error message
 * @param errors - Array that will receive the validation error message when validation fails
 */
export function validateString(
	value: unknown,
	field: string,
	errors: string[],
): void {
	if (typeof value !== "string" || value.trim().length === 0) {
		errors.push(`${field} must be a non-empty string`);
	}
}

/**
 * Validate that a value is either `null` or a non-empty string.
 *
 * If the check fails, appends `"<field> must be a non-empty string or null"` to `errors`.
 *
 * @param field - The name of the field used in the appended error message
 * @param errors - Array to receive validation error messages
 */
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

/**
 * Validates that a value is a boolean and appends an error message when it is not.
 *
 * @param value - The value to validate
 * @param field - The field name to include in the error message
 * @param errors - The array that will receive an error string if validation fails
 */
export function validateBoolean(
	value: unknown,
	field: string,
	errors: string[],
): void {
	if (typeof value !== "boolean") {
		errors.push(`${field} must be a boolean`);
	}
}

/**
 * Checks whether a value is a non-negative integer and appends an error message to `errors` when it is not.
 *
 * @param value - The value to validate
 * @param field - The field name used in the generated error message
 * @param errors - The array to which the error string will be appended on validation failure
 */
export function validateNumber(
	value: unknown,
	field: string,
	errors: string[],
): void {
	if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
		errors.push(`${field} must be a non-negative integer`);
	}
}

/**
 * Validates that `value` is an array of non-empty trimmed strings and appends a descriptive error to `errors` on failure.
 *
 * @param value - The value to validate.
 * @param field - The field name used in generated error messages.
 * @param errors - Accumulator array; on failure this function pushes either
 *   - `${field} must be a string array` when `value` is not an array, or
 *   - `${field} entries must be non-empty strings` when any array entry is not a non-empty string
 */
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
 * Determines whether `value` is one of the allowed string values.
 *
 * Appends an error message to `errors` when `value` is not included in `validValues`.
 *
 * @param field - The name of the field used in the error message
 * @param validValues - The list of allowed string values
 * @param errors - Array to which validation error messages are appended
 * @returns `true` if `value` is one of `validValues`, `false` otherwise
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
