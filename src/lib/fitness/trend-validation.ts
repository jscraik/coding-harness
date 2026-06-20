import {
	type HeValidationError,
	isRecord,
	toValidationError,
	validateEnum,
	validateNumber,
	validateString,
} from "../decision/validators.js";
import type {
	FitnessStatus,
	FitnessTrendBaselineStatus,
	FitnessTrendDirection,
} from "./types.js";

const VALID_REPORT_STATUSES: readonly FitnessStatus[] = [
	"pass",
	"warn",
	"fail",
	"needs_evidence",
];
const VALID_TREND_DIRECTIONS: readonly FitnessTrendDirection[] = [
	"improved",
	"regressed",
	"unchanged",
	"baseline_unavailable",
];
const VALID_TREND_BASELINE_STATUSES: readonly FitnessTrendBaselineStatus[] = [
	"loaded",
	"unavailable",
];

function validateSignedInteger(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): void {
	if (typeof value !== "number" || !Number.isInteger(value)) {
		errors.push(toValidationError(`${field} must be an integer`, field));
	}
}

function validateTrendPoint(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): void {
	if (!isRecord(value)) {
		errors.push(toValidationError(`${field} must be an object`, field));
		return;
	}
	validateEnum(value.status, `${field}.status`, VALID_REPORT_STATUSES, errors);
	for (const metric of [
		"findings",
		"failures",
		"warnings",
		"lanesNeedingEvidence",
		"deterministicFindings",
		"advisoryFindings",
	]) {
		validateNumber(value[metric], `${field}.${metric}`, errors);
	}
}

function validateTrendDelta(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): void {
	if (!isRecord(value)) {
		errors.push(toValidationError(`${field} must be an object`, field));
		return;
	}
	for (const metric of [
		"findings",
		"failures",
		"warnings",
		"lanesNeedingEvidence",
		"deterministicFindings",
		"advisoryFindings",
	]) {
		validateSignedInteger(value[metric], `${field}.${metric}`, errors);
	}
}

/** Validate optional advisory trend snapshot metadata on a fitness report. */
export function validateTrendSnapshot(
	value: unknown,
	errors: HeValidationError[],
): void {
	if (!isRecord(value)) {
		errors.push(
			toValidationError("trendSnapshot must be an object", "trendSnapshot"),
		);
		return;
	}
	if (value.schemaVersion !== "harness-fitness-trend-snapshot/v1") {
		errors.push(
			toValidationError(
				"trendSnapshot.schemaVersion must be harness-fitness-trend-snapshot/v1",
				"trendSnapshot.schemaVersion",
			),
		);
	}
	if (value.baselineRef !== null)
		validateString(value.baselineRef, "trendSnapshot.baselineRef", errors);
	validateEnum(
		value.baselineStatus,
		"trendSnapshot.baselineStatus",
		VALID_TREND_BASELINE_STATUSES,
		errors,
	);
	validateTrendPoint(value.current, "trendSnapshot.current", errors);
	if (value.previous !== null)
		validateTrendPoint(value.previous, "trendSnapshot.previous", errors);
	if (value.delta !== null)
		validateTrendDelta(value.delta, "trendSnapshot.delta", errors);
	validateEnum(
		value.direction,
		"trendSnapshot.direction",
		VALID_TREND_DIRECTIONS,
		errors,
	);
	validateString(value.claimBoundary, "trendSnapshot.claimBoundary", errors);
}
