import { isRecord } from "../decision/validators.js";
import { isRfc3339DateTime } from "./date-time.js";

/** Versioned improvement observation contract used by the feedback loop. */
export const SYNAIPSE_IMPROVEMENT_CASE_SCHEMA_VERSION =
	"synaipse-improvement-case/v1" as const;

/** Structured validation result for `synaipse-improvement-case/v1`. */
export interface SynaipseImprovementCaseValidationResult {
	valid: boolean;
	errors: Array<{ path: string; message: string }>;
}

const CLASSIFICATIONS = ["local", "systemic"] as const;
const DISPOSITIONS = [
	"retain",
	"change",
	"consolidate",
	"delete",
	"block",
] as const;

/** Candidate mechanism carried by a complete improvement case. */
export interface SynaipseImprovementCandidate {
	mechanism: string;
	disposition: "selected" | "rejected";
	rationale: string;
}

/** Complete canonical improvement observation. */
export interface SynaipseImprovementCase {
	schemaVersion: typeof SYNAIPSE_IMPROVEMENT_CASE_SCHEMA_VERSION;
	caseId: string;
	observedAt: string;
	observation: string;
	classification: (typeof CLASSIFICATIONS)[number];
	siblingInventory: string[];
	candidates: SynaipseImprovementCandidate[];
	selectedMechanism: string;
	canary: string;
	measurement: string;
	disposition: (typeof DISPOSITIONS)[number];
	owner: string;
	retirementCondition: string;
}

/** Builder input for one complete canonical improvement observation. */
export type BuildSynaipseImprovementCaseInput = Omit<
	SynaipseImprovementCase,
	"schemaVersion"
>;

/** Build a complete improvement record without sharing mutable caller arrays. */
export function buildSynaipseImprovementCase(
	input: BuildSynaipseImprovementCaseInput,
): SynaipseImprovementCase {
	return {
		...input,
		schemaVersion: SYNAIPSE_IMPROVEMENT_CASE_SCHEMA_VERSION,
		siblingInventory: [...input.siblingInventory],
		candidates: input.candidates.map((candidate) => ({ ...candidate })),
	};
}
const CANDIDATE_SELECTION = {
	NOT_SELECTED: "not_selected",
	SELECTED_MISMATCH: "selected_mismatch",
	SELECTED_MATCH: "selected_match",
} as const;
type CandidateSelection =
	(typeof CANDIDATE_SELECTION)[keyof typeof CANDIDATE_SELECTION];

/** Append one deterministic improvement-case validation error. */
function error(
	errors: SynaipseImprovementCaseValidationResult["errors"],
	path: string,
	message: string,
): void {
	errors.push({ path, message });
}

/** Add an error when an improvement-case field is not a non-empty string. */
function requireString(
	value: unknown,
	path: string,
	errors: SynaipseImprovementCaseValidationResult["errors"],
): void {
	if (typeof value !== "string" || value.trim() === "")
		error(errors, path, "must be a non-empty string");
}

/** Add an error when an improvement-case list is missing or contains blanks. */
function requireStringArray(
	value: unknown,
	path: string,
	errors: SynaipseImprovementCaseValidationResult["errors"],
): void {
	if (
		!Array.isArray(value) ||
		value.length === 0 ||
		!value.every((entry) => typeof entry === "string" && entry.trim() !== "")
	)
		error(errors, path, "must be a non-empty array of strings");
}

/** Add errors for fields outside a versioned improvement-case object boundary. */
function rejectUnknownProperties(
	value: Record<string, unknown>,
	allowed: readonly string[],
	path: string,
	errors: SynaipseImprovementCaseValidationResult["errors"],
): void {
	for (const key of Object.keys(value))
		if (!allowed.includes(key))
			error(errors, `${path}.${key}`, "must not contain unknown properties");
}

/** Validate the candidate mechanisms and the selected-candidate binding. */
function validateCandidate(
	candidate: unknown,
	path: string,
	selectedMechanism: unknown,
	errors: SynaipseImprovementCaseValidationResult["errors"],
): CandidateSelection {
	if (!isRecord(candidate)) {
		error(errors, path, "must be an object");
		return CANDIDATE_SELECTION.NOT_SELECTED;
	}
	rejectUnknownProperties(
		candidate,
		["mechanism", "disposition", "rationale"],
		path,
		errors,
	);
	requireString(candidate.mechanism, `${path}.mechanism`, errors);
	requireString(candidate.rationale, `${path}.rationale`, errors);
	if (
		candidate.disposition !== "selected" &&
		candidate.disposition !== "rejected"
	)
		error(errors, `${path}.disposition`, "must be selected or rejected");
	if (candidate.disposition !== "selected")
		return CANDIDATE_SELECTION.NOT_SELECTED;
	return candidate.mechanism === selectedMechanism
		? CANDIDATE_SELECTION.SELECTED_MATCH
		: CANDIDATE_SELECTION.SELECTED_MISMATCH;
}

/** Validate the candidate mechanisms and the selected-candidate binding. */
function validateCandidates(
	value: unknown,
	selectedMechanism: unknown,
	errors: SynaipseImprovementCaseValidationResult["errors"],
): void {
	if (!Array.isArray(value) || value.length === 0) {
		error(errors, "candidates", "must be a non-empty array");
		return;
	}
	let selectedCandidateCount = 0;
	let selectedMechanismCount = 0;
	for (const [index, candidate] of value.entries()) {
		const selected = validateCandidate(
			candidate,
			`candidates[${index}]`,
			selectedMechanism,
			errors,
		);
		if (
			selected === CANDIDATE_SELECTION.SELECTED_MATCH ||
			selected === CANDIDATE_SELECTION.SELECTED_MISMATCH
		)
			selectedCandidateCount += 1;
		if (selected === CANDIDATE_SELECTION.SELECTED_MATCH)
			selectedMechanismCount += 1;
	}
	if (selectedCandidateCount !== 1 || selectedMechanismCount !== 1)
		error(errors, "selectedMechanism", "must match one selected candidate");
}

/** Validate the required strings and finite vocabularies on an improvement case. */
function validateCoreFields(
	value: Record<string, unknown>,
	errors: SynaipseImprovementCaseValidationResult["errors"],
): void {
	if (value.schemaVersion !== SYNAIPSE_IMPROVEMENT_CASE_SCHEMA_VERSION)
		error(errors, "schemaVersion", "must be synaipse-improvement-case/v1");
	for (const field of [
		"caseId",
		"observation",
		"canary",
		"measurement",
		"selectedMechanism",
		"owner",
		"retirementCondition",
	] as const)
		requireString(value[field], field, errors);
	if (!isRfc3339DateTime(value.observedAt))
		error(errors, "observedAt", "must be a valid date-time");
	if (
		!CLASSIFICATIONS.includes(
			value.classification as (typeof CLASSIFICATIONS)[number],
		)
	)
		error(errors, "classification", "must be local or systemic");
	if (
		!DISPOSITIONS.includes(value.disposition as (typeof DISPOSITIONS)[number])
	)
		error(
			errors,
			"disposition",
			"must be retain, change, consolidate, delete, or block",
		);
}

/** Validate one retained/change/delete improvement observation. */
export function validateSynaipseImprovementCase(
	value: unknown,
): SynaipseImprovementCaseValidationResult {
	const errors: SynaipseImprovementCaseValidationResult["errors"] = [];
	if (!isRecord(value))
		return {
			valid: false,
			errors: [{ path: "case", message: "must be an object" }],
		};
	rejectUnknownProperties(
		value,
		[
			"schemaVersion",
			"caseId",
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
		"case",
		errors,
	);
	validateCoreFields(value, errors);
	requireStringArray(value.siblingInventory, "siblingInventory", errors);
	validateCandidates(value.candidates, value.selectedMechanism, errors);
	return { valid: errors.length === 0, errors };
}
