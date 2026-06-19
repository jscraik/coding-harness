import {
	type HeValidationError,
	isRecord,
	toValidationError,
	validateEnum,
	validateNumber,
	validateString,
	validateStringArray,
} from "../decision/validators.js";
import type {
	FitnessEnforcement,
	FitnessLaneStatus,
	FitnessPrinciple,
	FitnessReport,
	FitnessSeverity,
	FitnessStatus,
} from "./types.js";

const VALID_REPORT_STATUSES: readonly FitnessStatus[] = [
	"pass",
	"warn",
	"fail",
	"needs_evidence",
];
const VALID_LANE_STATUSES: readonly FitnessLaneStatus[] = [
	"pass",
	"warn",
	"fail",
	"not_run",
];
const VALID_SEVERITIES: readonly FitnessSeverity[] = [
	"critical",
	"error",
	"warning",
	"info",
];
const VALID_ENFORCEMENTS: readonly FitnessEnforcement[] = [
	"hard_blocker",
	"architecture_fitness",
	"quality_budget",
	"advisory",
];
const VALID_PRINCIPLES: readonly FitnessPrinciple[] = [
	"protect_deep_module_boundaries",
	"reduce_cognitive_load",
	"prove_behavior_outcomes",
	"compound_feedback_to_harness",
];

/** Validation result for a candidate harness-fitness/v1 report. */
export interface FitnessReportValidationResult {
	valid: boolean;
	errors: HeValidationError[];
}

function validateEvidence(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): void {
	if (!isRecord(value)) {
		errors.push(toValidationError(`${field} must be an object`, field));
		return;
	}
	if (value.file !== undefined)
		validateString(value.file, `${field}.file`, errors);
	if (value.line !== undefined)
		validateNumber(value.line, `${field}.line`, errors);
	validateString(value.message, `${field}.message`, errors);
}

function validateFinding(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): void {
	if (!isRecord(value)) {
		errors.push(toValidationError(`${field} must be an object`, field));
		return;
	}
	validateString(value.id, `${field}.id`, errors);
	validateString(value.title, `${field}.title`, errors);
	validateEnum(value.severity, `${field}.severity`, VALID_SEVERITIES, errors);
	validateString(value.lane, `${field}.lane`, errors);
	validateEnum(value.principle, `${field}.principle`, VALID_PRINCIPLES, errors);
	validateEnum(
		value.enforcement,
		`${field}.enforcement`,
		VALID_ENFORCEMENTS,
		errors,
	);
	validateEvidence(value.evidence, `${field}.evidence`, errors);
	validateString(value.risk, `${field}.risk`, errors);
	validateString(
		value.recommendedCommand,
		`${field}.recommendedCommand`,
		errors,
	);
	validateString(value.claimBoundary, `${field}.claimBoundary`, errors);
}

function validateFindings(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): void {
	if (!Array.isArray(value)) {
		errors.push(toValidationError(`${field} must be an array`, field));
		return;
	}
	value.forEach((finding, index) => {
		validateFinding(finding, `${field}[${String(index)}]`, errors);
	});
}

function validateLane(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): void {
	if (!isRecord(value)) {
		errors.push(toValidationError(`${field} must be an object`, field));
		return;
	}
	validateString(value.id, `${field}.id`, errors);
	validateString(value.label, `${field}.label`, errors);
	validateString(value.command, `${field}.command`, errors);
	validateEnum(value.principle, `${field}.principle`, VALID_PRINCIPLES, errors);
	validateEnum(
		value.enforcement,
		`${field}.enforcement`,
		VALID_ENFORCEMENTS,
		errors,
	);
	validateEnum(value.status, `${field}.status`, VALID_LANE_STATUSES, errors);
	validateString(value.evidenceSource, `${field}.evidenceSource`, errors);
	validateFindings(value.findings, `${field}.findings`, errors);
}

function validateSummary(value: unknown, errors: HeValidationError[]): void {
	if (!isRecord(value)) {
		errors.push(toValidationError("summary must be an object", "summary"));
		return;
	}
	for (const field of [
		"lanes",
		"findings",
		"failures",
		"warnings",
		"lanesNeedingEvidence",
	]) {
		validateNumber(value[field], `summary.${field}`, errors);
	}
}

/** Validate the runtime shape of a harness-fitness/v1 report. */
export function validateFitnessReport(
	value: unknown,
): FitnessReportValidationResult {
	const errors: HeValidationError[] = [];
	if (!isRecord(value)) {
		return {
			valid: false,
			errors: [toValidationError("fitness report must be an object")],
		};
	}
	if (value.schemaVersion !== "harness-fitness/v1") {
		errors.push(
			toValidationError(
				"schemaVersion must be harness-fitness/v1",
				"schemaVersion",
			),
		);
	}
	validateEnum(value.status, "status", VALID_REPORT_STATUSES, errors);
	validateString(value.generatedAt, "generatedAt", errors);
	validateSummary(value.summary, errors);
	if (!Array.isArray(value.lanes)) {
		errors.push(toValidationError("lanes must be an array", "lanes"));
	} else {
		value.lanes.forEach((lane, index) => {
			validateLane(lane, `lanes[${String(index)}]`, errors);
		});
	}
	if (value.topDeterministicFinding !== null) {
		validateFinding(
			value.topDeterministicFinding,
			"topDeterministicFinding",
			errors,
		);
	}
	validateStringArray(value.claimBoundaries, "claimBoundaries", errors);
	return { valid: errors.length === 0, errors };
}

/** Type guard for validated harness-fitness/v1 reports. */
export function isFitnessReport(value: unknown): value is FitnessReport {
	return validateFitnessReport(value).valid;
}
