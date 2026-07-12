import { isRecord } from "../decision/validators.js";
import { isRfc3339DateTime } from "./state-validation.js";
import type {
	SynaipseValidationError,
	SynaipseValidationResult,
} from "./lifecycle.js";

/** Versioned improvement-case contract identifier. */
export const SYNAIPSE_IMPROVEMENT_CASE_SCHEMA_VERSION =
	"synaipse-improvement-case/v1" as const;

const CLASSIFICATIONS = ["local", "systemic"] as const;
const MECHANISMS = ["change", "retain", "delete", "defer"] as const;
const RUNTIME_STATUS = "not_yet_emitted" as const;
type ErrorList = SynaipseValidationError[];

function add(errors: ErrorList, path: string, message: string): void {
	errors.push({ path, message });
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function isEnum<T extends string>(
	value: unknown,
	values: readonly T[],
): value is T {
	return typeof value === "string" && values.includes(value as T);
}

function requireString(value: unknown, path: string, errors: ErrorList): void {
	if (!isNonEmptyString(value)) add(errors, path, "must be a non-empty string");
}

function requireEnum<T extends string>(
	value: unknown,
	path: string,
	values: readonly T[],
	errors: ErrorList,
): void {
	if (!isEnum(value, values))
		add(errors, path, `must be one of ${values.join(", ")}`);
}

function rejectUnknownProperties(
	value: Record<string, unknown>,
	allowed: readonly string[],
	path: string,
	errors: ErrorList,
): void {
	for (const key of Object.keys(value))
		if (!allowed.includes(key))
			add(errors, `${path}.${key}`, "must not contain unknown properties");
}

function isSha(value: unknown): value is string {
	const isHex = (character: string): boolean =>
		(character >= "0" && character <= "9") ||
		(character >= "a" && character <= "f") ||
		(character >= "A" && character <= "F");
	return (
		typeof value === "string" && value.length === 40 && [...value].every(isHex)
	);
}

function validateRepository(value: unknown, errors: ErrorList): void {
	if (!isRecord(value)) {
		add(errors, "repository", "must be an object");
		return;
	}
	rejectUnknownProperties(value, ["name", "sha"], "repository", errors);
	requireString(value.name, "repository.name", errors);
	if (!isSha(value.sha))
		add(errors, "repository.sha", "must be a 40-character SHA");
}

function validateSiblingInventory(value: unknown, errors: ErrorList): void {
	if (!isRecord(value)) {
		add(errors, "siblingInventory", "must be an object");
		return;
	}
	rejectUnknownProperties(
		value,
		["searched", "changed", "left", "deferred"],
		"siblingInventory",
		errors,
	);
	for (const field of ["searched", "changed", "left", "deferred"] as const) {
		if (
			!Array.isArray(value[field]) ||
			(field === "searched" && value[field].length === 0) ||
			!value[field].every(isNonEmptyString)
		)
			add(
				errors,
				`siblingInventory.${field}`,
				"must be a non-empty array of strings",
			);
	}
}

function validateCandidates(value: unknown, errors: ErrorList): void {
	if (!Array.isArray(value) || value.length === 0) {
		add(errors, "candidates", "must be a non-empty array");
		return;
	}
	for (const [index, candidate] of value.entries()) {
		const path = `candidates[${index}]`;
		if (!isRecord(candidate)) {
			add(errors, path, "must be an object");
			continue;
		}
		rejectUnknownProperties(
			candidate,
			["disposition", "rationale", "rollback"],
			path,
			errors,
		);
		requireEnum(
			candidate.disposition,
			`${path}.disposition`,
			MECHANISMS,
			errors,
		);
		requireString(candidate.rationale, `${path}.rationale`, errors);
		requireString(candidate.rollback, `${path}.rollback`, errors);
	}
}

function validateObjectFields(
	value: Record<string, unknown>,
	field: "selectedMechanism" | "canary" | "measurement",
	errors: ErrorList,
): void {
	const shapes = {
		selectedMechanism: ["disposition", "rationale"],
		canary: ["command", "expected"],
		measurement: ["metric", "target"],
	} as const;
	const object = value[field];
	if (!isRecord(object)) {
		add(errors, field, "must be an object");
		return;
	}
	rejectUnknownProperties(object, shapes[field], field, errors);
	if (field === "selectedMechanism")
		requireEnum(
			object.disposition,
			"selectedMechanism.disposition",
			MECHANISMS,
			errors,
		);
	for (const key of shapes[field])
		requireString(object[key], `${field}.${key}`, errors);
}

function validateShape(
	value: Record<string, unknown>,
	errors: ErrorList,
): void {
	rejectUnknownProperties(
		value,
		[
			"schemaVersion",
			"runtimeStatus",
			"repository",
			"observedAt",
			"observation",
			"classification",
			"siblingInventory",
			"candidates",
			"selectedMechanism",
			"canary",
			"measurement",
			"disposition",
			"owner",
			"retirementCondition",
		],
		"improvementCase",
		errors,
	);
	if (value.schemaVersion !== SYNAIPSE_IMPROVEMENT_CASE_SCHEMA_VERSION)
		add(
			errors,
			"schemaVersion",
			`must be ${SYNAIPSE_IMPROVEMENT_CASE_SCHEMA_VERSION}`,
		);
	if (value.runtimeStatus !== RUNTIME_STATUS)
		add(errors, "runtimeStatus", `must be ${RUNTIME_STATUS}`);
	validateRepository(value.repository, errors);
	if (!isRfc3339DateTime(value.observedAt))
		add(errors, "observedAt", "must be an RFC3339 date-time string");
	requireString(value.observation, "observation", errors);
	requireEnum(value.classification, "classification", CLASSIFICATIONS, errors);
	validateSiblingInventory(value.siblingInventory, errors);
	validateCandidates(value.candidates, errors);
	validateObjectFields(value, "selectedMechanism", errors);
	validateObjectFields(value, "canary", errors);
	validateObjectFields(value, "measurement", errors);
	requireEnum(value.disposition, "disposition", MECHANISMS, errors);
	requireString(value.owner, "owner", errors);
	requireString(value.retirementCondition, "retirementCondition", errors);
}

/** Validate one improvement case, including sibling search and rollback proof. */
export function validateSynaipseImprovementCase(
	value: unknown,
	currentSha: string,
): SynaipseValidationResult {
	if (!isRecord(value))
		return {
			valid: false,
			errors: [{ path: "improvementCase", message: "must be an object" }],
		};
	const errors: ErrorList = [];
	validateShape(value, errors);
	if (isRecord(value.repository) && value.repository.sha !== currentSha)
		add(errors, "repository.sha", "must match the current repository SHA");
	if (isRecord(value.selectedMechanism) && Array.isArray(value.candidates)) {
		const selected = value.selectedMechanism.disposition;
		if (
			!value.candidates.some(
				(candidate) =>
					isRecord(candidate) && candidate.disposition === selected,
			)
		)
			add(
				errors,
				"selectedMechanism.disposition",
				"must be represented in candidates",
			);
	}
	if (
		isEnum(value.disposition, MECHANISMS) &&
		isRecord(value.selectedMechanism)
	)
		if (value.disposition !== value.selectedMechanism.disposition)
			add(errors, "disposition", "must match selectedMechanism.disposition");
	return { valid: errors.length === 0, errors };
}
