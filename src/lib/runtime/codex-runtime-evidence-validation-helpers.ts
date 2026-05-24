/** Callback used by runtime evidence validators to append a finding. */
export type AddFinding = (path: string, code: string, message: string) => void;

/** Require a value to match one of the supplied string literals. */
export function requireEnum<T extends readonly string[]>(
	value: unknown,
	allowed: T,
	path: string,
	add: AddFinding,
): void {
	if (typeof value !== "string" || !allowed.includes(value)) {
		add(path, "enum_invalid", `${path} must be one of ${allowed.join(", ")}.`);
	}
}

/** Require a value to be an array of non-empty strings. */
export function requireStringArray(
	value: unknown,
	path: string,
	add: AddFinding,
): void {
	if (!Array.isArray(value)) {
		add(path, "string_array_invalid", `${path} must be a string array.`);
		return;
	}
	if (
		value.some(
			(entry) => typeof entry !== "string" || entry.trim().length === 0,
		)
	) {
		add(
			path,
			"string_array_entry_invalid",
			`${path} entries must be non-empty strings.`,
		);
	}
}

/** Require a value to be a non-empty string. */
export function requireNonEmptyString(
	value: unknown,
	path: string,
	add: AddFinding,
): void {
	if (typeof value !== "string" || value.trim().length === 0) {
		add(path, "string_missing", `${path} must be a non-empty string.`);
	}
}

/** Require a value to be either null or a non-empty string. */
export function requireNullableNonEmptyString(
	value: unknown,
	path: string,
	add: AddFinding,
): void {
	if (
		value !== null &&
		(typeof value !== "string" || value.trim().length === 0)
	) {
		add(
			path,
			"nullable_string_invalid",
			`${path} must be a non-empty string or null.`,
		);
	}
}

/** Require a value to be a strict UTC ISO-8601 timestamp. */
export function requireIsoTimestamp(
	value: unknown,
	path: string,
	add: AddFinding,
): void {
	if (typeof value !== "string" || !isStrictIsoTimestamp(value)) {
		add(
			path,
			"timestamp_invalid",
			`${path} must be a valid ISO-8601 UTC timestamp.`,
		);
	}
}

function isStrictIsoTimestamp(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
		return false;
	}
	const time = Date.parse(value);
	if (Number.isNaN(time)) return false;
	const normalized = new Date(time).toISOString();
	return normalized === value || normalized.replace(".000Z", "Z") === value;
}

/** Return whether a value is a non-array record. */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Return a string value as text, otherwise null. */
export function asText(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

/** Return whether optional text is null or blank. */
export function isBlank(value: string | null): boolean {
	return value === null || value.trim().length === 0;
}
