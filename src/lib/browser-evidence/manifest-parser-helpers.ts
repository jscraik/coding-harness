import type { BrowserEvidenceValidationError } from "./types.js";

const RFC3339_DATE_TIME =
	/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/u;

function isLeapYear(year: number): boolean {
	return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
	if (month === 2) return isLeapYear(year) ? 29 : 28;
	return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Build a browser-evidence validation error with a canonical code. */
export function browserError(
	code: BrowserEvidenceValidationError["code"],
	message: string,
): BrowserEvidenceValidationError {
	return { code, message };
}

/** Return true when a value is a plain JSON object. */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Return true when a value is a string with non-whitespace content. */
export function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

/** Return true when a value is an RFC3339 date-time string with timezone. */
export function isRfc3339DateTime(value: unknown): value is string {
	if (!isNonEmptyString(value)) return false;
	const match = RFC3339_DATE_TIME.exec(value.trim());
	if (!match) return false;
	const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
		match;
	const [, , , , , , , zoneHourText, zoneMinuteText] = match;
	const year = Number(yearText);
	const month = Number(monthText);
	const day = Number(dayText);
	const hour = Number(hourText);
	const minute = Number(minuteText);
	const second = Number(secondText);
	const zoneHour = zoneHourText === undefined ? 0 : Number(zoneHourText);
	const zoneMinute = zoneMinuteText === undefined ? 0 : Number(zoneMinuteText);
	return (
		month >= 1 &&
		month <= 12 &&
		day >= 1 &&
		day <= daysInMonth(year, month) &&
		hour <= 23 &&
		minute <= 59 &&
		second <= 59 &&
		zoneHour <= 23 &&
		zoneMinute <= 59 &&
		!Number.isNaN(Date.parse(value.trim()))
	);
}

/** Parse a JSON value as an array of trimmed non-empty strings. */
export function readStringArray(value: unknown): string[] | null {
	if (!Array.isArray(value)) return null;
	const values = value.filter(isNonEmptyString).map((item) => item.trim());
	return values.length === value.length ? values : null;
}

/** Read an optional manifest string field and report schema drift. */
export function readOptionalStringProperty(
	value: Record<string, unknown>,
	key: string,
	scope: string,
	errors: BrowserEvidenceValidationError[],
): string | undefined {
	if (!Object.hasOwn(value, key)) return undefined;
	const candidate = value[key];
	if (typeof candidate === "string") return candidate;
	errors.push(
		browserError(
			"BROWSER_MANIFEST_SCHEMA_INVALID",
			`Browser evidence manifest ${scope}.${key} must be a string when present.`,
		),
	);
	return undefined;
}

/** Report unsupported keys for a manifest object scope. */
export function unexpectedPropertyErrors(
	value: Record<string, unknown>,
	allowedKeys: ReadonlySet<string>,
	scope: string,
): BrowserEvidenceValidationError[] {
	return Object.keys(value)
		.filter((key) => !allowedKeys.has(key))
		.map((key) =>
			browserError(
				"BROWSER_MANIFEST_SCHEMA_INVALID",
				`Browser evidence manifest ${scope} contains unsupported property: ${key}.`,
			),
		);
}
