import {
	SYNAIPSE_STATE_SCHEMA_VERSION,
	type SynaipseStateValidationResult,
} from "./state-contract.js";
import { isRecord } from "../decision/validators.js";

const VALID_STAGES = [
	"orient",
	"verify",
	"review",
	"repair",
	"handoff",
] as const;
const VALID_STATUSES = ["pass", "fail", "blocked", "action_required"] as const;

/** Add a validation error when a contract string is missing or blank. */
function requireString(
	value: unknown,
	path: string,
	errors: SynaipseStateValidationResult["errors"],
): void {
	if (typeof value !== "string" || value.trim().length === 0)
		errors.push({ path, message: "must be a non-empty string" });
}

/** Add a validation error when an object contains fields outside its contract. */
function rejectUnknownProperties(
	value: Record<string, unknown>,
	allowed: readonly string[],
	path: string,
	errors: SynaipseStateValidationResult["errors"],
): void {
	for (const key of Object.keys(value)) {
		if (!allowed.includes(key))
			errors.push({
				path: `${path}.${key}`,
				message: "must not contain unknown properties",
			});
	}
}

/** Return whether a string contains only decimal digits. */
function isDigits(value: string): boolean {
	return (
		value.length > 0 &&
		[...value].every((character) => character >= "0" && character <= "9")
	);
}

type DateParts = { month: number; day: number };

/** Return whether a string has the fixed-width numeric date shape. */
function isDateShape(value: string): boolean {
	return (
		value.length === 10 &&
		value[4] === "-" &&
		value[7] === "-" &&
		isDigits(value.slice(0, 4)) &&
		isDigits(value.slice(5, 7)) &&
		isDigits(value.slice(8, 10))
	);
}

/** Return whether month/day values fit the calendar bounds used by RFC3339. */
function isCalendarDate({ month, day }: DateParts): boolean {
	const maxDay = month === 2 ? 29 : [4, 6, 9, 11].includes(month) ? 30 : 31;
	return month >= 1 && month <= 12 && day >= 1 && day <= maxDay;
}

/** Return whether the date component has the fixed-width RFC3339 shape. */
function isDatePart(value: string): boolean {
	if (!isDateShape(value)) return false;
	return isCalendarDate({
		month: Number.parseInt(value.slice(5, 7), 10),
		day: Number.parseInt(value.slice(8, 10), 10),
	});
}

/** Split the clock component from its RFC3339 timezone suffix. */
function splitTimeAndZone(value: string): [string, string] | null {
	const zoneStart = value.endsWith("Z")
		? value.length - 1
		: Math.max(value.lastIndexOf("+"), value.lastIndexOf("-"));
	if (zoneStart < 0) return null;
	return [value.slice(0, zoneStart), value.slice(zoneStart)];
}

/** Return whether the clock component has valid numeric fields and fraction shape. */
function isSecondPart(value: string): boolean {
	const [second, fraction] = value.split(".");
	return (
		second !== undefined &&
		isDigits(second) &&
		(fraction === undefined || isDigits(fraction))
	);
}

type TimeParts = { hour: number; minute: number; second: number };

/** Parse the numeric clock fields after validating their fixed-width shape. */
function parseTimeParts(value: string): TimeParts | null {
	const [hour, minute, second] = value.split(":");
	if (
		hour === undefined ||
		minute === undefined ||
		second === undefined ||
		!isDigits(hour) ||
		!isDigits(minute) ||
		!isSecondPart(second)
	)
		return null;
	return {
		hour: Number.parseInt(hour, 10),
		minute: Number.parseInt(minute, 10),
		second: Number.parseInt(second.split(".")[0] ?? "0", 10),
	};
}

/** Return whether numeric clock fields fit the RFC3339 time bounds. */
function isClockRange({ hour, minute, second }: TimeParts): boolean {
	return (
		hour >= 0 &&
		hour <= 23 &&
		minute >= 0 &&
		minute <= 59 &&
		second >= 0 &&
		second <= 59
	);
}

/** Return whether the clock component has valid numeric fields and fraction shape. */
function isTimePart(value: string): boolean {
	const parts = parseTimeParts(value);
	return parts !== null && isClockRange(parts);
}

/** Return whether a timezone component has RFC3339 UTC or numeric-offset shape. */
function isZonePart(value: string): boolean {
	const validZone =
		value === "Z" ||
		(value.length === 6 &&
			(value[0] === "+" || value[0] === "-") &&
			value[3] === ":" &&
			isDigits(value.slice(1, 3)) &&
			isDigits(value.slice(4, 6)));
	return validZone;
}

/** Return whether a string has an RFC3339 date-time shape and valid calendar value. */
function isRfc3339DateTime(value: unknown): value is string {
	if (typeof value !== "string") return false;
	const separator = value.indexOf("T");
	if (separator !== 10 || value.indexOf("T", separator + 1) !== -1)
		return false;
	const timeAndZone = splitTimeAndZone(value.slice(separator + 1));
	return (
		isDatePart(value.slice(0, separator)) &&
		timeAndZone !== null &&
		isTimePart(timeAndZone[0]) &&
		isZonePart(timeAndZone[1]) &&
		!Number.isNaN(Date.parse(value))
	);
}

/** Add a validation error when a value is not an RFC3339 date-time string. */
function requireDateTime(
	value: unknown,
	path: string,
	errors: SynaipseStateValidationResult["errors"],
): void {
	if (!isRfc3339DateTime(value))
		errors.push({ path, message: "must be an RFC3339 date-time string" });
}

/** Add a validation error when a value is outside a finite contract vocabulary. */
function requireEnum(
	value: unknown,
	path: string,
	allowed: readonly string[],
	errors: SynaipseStateValidationResult["errors"],
): void {
	if (typeof value !== "string" || !allowed.includes(value))
		errors.push({ path, message: `must be one of ${allowed.join(", ")}` });
}

/** Validate the nullable repository identity and worktree fields. */
function validateRepository(
	value: unknown,
	errors: SynaipseStateValidationResult["errors"],
): void {
	if (!isRecord(value)) {
		errors.push({ path: "repository", message: "must be an object" });
		return;
	}
	rejectUnknownProperties(
		value,
		["name", "branch", "baseRef", "headSha", "baseSha", "clean"],
		"repository",
		errors,
	);
	for (const field of [
		"name",
		"branch",
		"baseRef",
		"headSha",
		"baseSha",
	] as const) {
		const fieldValue = value[field];
		if (fieldValue !== null)
			requireString(fieldValue, `repository.${field}`, errors);
	}
	if (typeof value.clean !== "boolean" && value.clean !== null)
		errors.push({
			path: "repository.clean",
			message: "must be boolean or null",
		});
}

/** Validate a task or authority object without accepting missing required fields. */
function validateTaskAndAuthority(
	value: Record<string, unknown>,
	errors: SynaipseStateValidationResult["errors"],
): void {
	if (!isRecord(value.task))
		errors.push({ path: "task", message: "must be an object" });
	else {
		rejectUnknownProperties(
			value.task,
			["status", "objective"],
			"task",
			errors,
		);
		requireEnum(value.task.status, "task.status", VALID_STATUSES, errors);
		requireString(value.task.objective, "task.objective", errors);
	}
	if (!isRecord(value.authority))
		errors.push({ path: "authority", message: "must be an object" });
	else {
		rejectUnknownProperties(
			value.authority,
			["owner", "humanRequired"],
			"authority",
			errors,
		);
		requireEnum(
			value.authority.owner,
			"authority.owner",
			["codex", "operator"],
			errors,
		);
		if (typeof value.authority.humanRequired !== "boolean")
			errors.push({
				path: "authority.humanRequired",
				message: "must be boolean",
			});
	}
}

/** Validate the state arrays used for capabilities, blockers, and evidence refs. */
function validateStateArrays(
	value: Record<string, unknown>,
	errors: SynaipseStateValidationResult["errors"],
): void {
	for (const field of [
		"truthLaneBlockers",
		"admittedCapabilities",
		"evidenceRefs",
	] as const) {
		if (
			!Array.isArray(value[field]) ||
			!value[field].every(
				(entry) => typeof entry === "string" && entry.trim().length > 0,
			) ||
			(field !== "truthLaneBlockers" && value[field].length === 0)
		)
			errors.push({ path: field, message: "must be an array of strings" });
	}
}

/** Enforce the pure-read effect declaration for the current cockpit producer. */
function validateInvocationEffects(
	value: unknown,
	errors: SynaipseStateValidationResult["errors"],
): void {
	if (!isRecord(value)) {
		errors.push({ path: "invocationEffects", message: "must be an object" });
		return;
	}
	rejectUnknownProperties(
		value,
		[
			"effectClasses",
			"targets",
			"writesFiles",
			"mutatesGit",
			"mutatesExternal",
		],
		"invocationEffects",
		errors,
	);
	if (
		!Array.isArray(value.effectClasses) ||
		value.effectClasses.length !== 1 ||
		value.effectClasses[0] !== "pure_read"
	)
		errors.push({
			path: "invocationEffects.effectClasses",
			message: "must contain only pure_read",
		});
	if (
		!Array.isArray(value.targets) ||
		value.targets.length === 0 ||
		!value.targets.every((entry) => typeof entry === "string" && entry.trim())
	)
		errors.push({
			path: "invocationEffects.targets",
			message: "must be a non-empty array of strings",
		});
	for (const field of ["writesFiles", "mutatesGit", "mutatesExternal"] as const)
		if (value[field] !== false)
			errors.push({
				path: `invocationEffects.${field}`,
				message: "must be false",
			});
}

/** Validate freshness evidence while keeping source-specific age policy outside this packet. */
function validateFreshness(
	value: unknown,
	errors: SynaipseStateValidationResult["errors"],
): void {
	if (!isRecord(value))
		errors.push({ path: "freshness", message: "must be an object" });
	else {
		rejectUnknownProperties(
			value,
			["status", "observedAt"],
			"freshness",
			errors,
		);
		requireEnum(
			value.status,
			"freshness.status",
			["current", "unknown"],
			errors,
		);
		requireDateTime(value.observedAt, "freshness.observedAt", errors);
	}
}

/** Validate the emitted compact state without coupling it to provider state. */
export function validateSynaipseState(
	value: unknown,
): SynaipseStateValidationResult {
	const errors: SynaipseStateValidationResult["errors"] = [];
	if (!isRecord(value))
		return {
			valid: false,
			errors: [{ path: "state", message: "must be an object" }],
		};
	rejectUnknownProperties(
		value,
		[
			"schemaVersion",
			"generatedAt",
			"repository",
			"stage",
			"task",
			"authority",
			"truthLaneBlockers",
			"admittedCapabilities",
			"evidenceRefs",
			"nextAction",
			"invocationEffects",
			"freshness",
			"claimBoundary",
		],
		"state",
		errors,
	);
	if (value.schemaVersion !== SYNAIPSE_STATE_SCHEMA_VERSION)
		errors.push({
			path: "schemaVersion",
			message: `must be ${SYNAIPSE_STATE_SCHEMA_VERSION}`,
		});
	requireDateTime(value.generatedAt, "generatedAt", errors);
	validateRepository(value.repository, errors);
	requireEnum(value.stage, "stage", VALID_STAGES, errors);
	validateTaskAndAuthority(value, errors);
	validateStateArrays(value, errors);
	requireString(value.nextAction, "nextAction", errors);
	validateInvocationEffects(value.invocationEffects, errors);
	validateFreshness(value.freshness, errors);
	requireString(value.claimBoundary, "claimBoundary", errors);
	return { valid: errors.length === 0, errors };
}
