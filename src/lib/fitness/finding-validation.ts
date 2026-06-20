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
	FitnessPrinciple,
	FitnessSeverity,
} from "./types.js";

const VALID_SEVERITIES: readonly FitnessSeverity[] = [
	"critical",
	"error",
	"warning",
	"info",
];
export const VALID_ENFORCEMENTS: readonly FitnessEnforcement[] = [
	"hard_blocker",
	"architecture_fitness",
	"quality_budget",
	"quality_structure",
	"type_safety",
	"static_analysis",
	"advisory",
];
export const VALID_PRINCIPLES: readonly FitnessPrinciple[] = [
	"protect_deep_module_boundaries",
	"reduce_cognitive_load",
	"prove_type_safety",
	"preserve_static_contracts",
	"prove_behavior_outcomes",
	"compound_feedback_to_harness",
];

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

function validateMetrics(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): void {
	if (!isRecord(value)) {
		errors.push(toValidationError(`${field} must be an object`, field));
		return;
	}
	for (const key of Object.keys(value)) {
		validateNumber(value[key], `${field}.${key}`, errors);
	}
}

function validateRequiredFix(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): void {
	if (!isRecord(value)) {
		errors.push(toValidationError(`${field} must be an object`, field));
		return;
	}
	validateString(value.objective, `${field}.objective`, errors);
	validateStringArray(value.constraints, `${field}.constraints`, errors);
}

/** Validate a harness-fitness finding contract. */
export function validateFinding(
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
	if (value.metrics !== undefined) {
		validateMetrics(value.metrics, `${field}.metrics`, errors);
	}
	validateString(value.risk, `${field}.risk`, errors);
	if (value.requiredFix !== undefined) {
		validateRequiredFix(value.requiredFix, `${field}.requiredFix`, errors);
	}
	if (value.acceptanceCriteria !== undefined) {
		validateStringArray(
			value.acceptanceCriteria,
			`${field}.acceptanceCriteria`,
			errors,
		);
	}
	validateString(
		value.recommendedCommand,
		`${field}.recommendedCommand`,
		errors,
	);
	validateString(value.claimBoundary, `${field}.claimBoundary`, errors);
}

/** Validate all finding entries for a fitness lane. */
export function validateFindings(
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
