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
	FitnessLaneStatus,
	FitnessReport,
	FitnessStatus,
} from "./types.js";
import {
	VALID_ENFORCEMENTS,
	VALID_PRINCIPLES,
	validateFinding,
	validateFindings,
} from "./finding-validation.js";
import { validateTrendSnapshot } from "./trend-validation.js";
import {
	validateLaneStatusInvariant,
	validateTopFindingInvariant,
} from "./validation-invariants.js";

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
const REQUIRED_LANE_IDS = [
	"architecture-fitness",
	"quality-structure",
	"type-safety",
	"static-lint",
	"behavior-proof",
	"feedback-learning",
] as const;

/** Validation result for a candidate harness-fitness/v1 report. */
export interface FitnessReportValidationResult {
	valid: boolean;
	errors: HeValidationError[];
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

/** Validate one fitness coverage contract entry. */
function validateCoverage(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): void {
	if (!isRecord(value)) {
		errors.push(toValidationError(`${field} must be an object`, field));
		return;
	}
	validateString(value.category, `${field}.category`, errors);
	validateString(value.concern, `${field}.concern`, errors);
	validateStringArray(value.laneIds, `${field}.laneIds`, errors);
	validateStringArray(value.commands, `${field}.commands`, errors);
	if (
		Array.isArray(value.laneIds) &&
		Array.isArray(value.commands) &&
		value.laneIds.length === 0 &&
		value.commands.length === 0
	) {
		errors.push(
			toValidationError(
				`${field} must define at least one laneId or command`,
				field,
			),
		);
	}
	validateString(value.coverage, `${field}.coverage`, errors);
	validateString(value.claimBoundary, `${field}.claimBoundary`, errors);
}

/** Validate the non-empty fitness coverage contract array. */
function validateCoverageArray(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): void {
	if (!Array.isArray(value)) {
		errors.push(toValidationError(`${field} must be an array`, field));
		return;
	}
	if (value.length === 0) {
		errors.push(toValidationError(`${field} must not be empty`, field));
	}
	value.forEach((coverage, index) => {
		validateCoverage(coverage, `${field}[${String(index)}]`, errors);
	});
}

/** Validate the fitness summary counters used by status invariants. */
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

function recordFindingsFromLanes(
	lanes: readonly unknown[],
): Record<string, unknown>[] {
	return lanes.filter(isRecord).flatMap((lane) => {
		const findings = lane.findings;
		return Array.isArray(findings) ? findings.filter(isRecord) : [];
	});
}

function severityOf(finding: Record<string, unknown>): unknown {
	return finding.severity;
}

function enforcementOf(finding: Record<string, unknown>): unknown {
	return finding.enforcement;
}

function validateGeneratedAt(
	value: Record<string, unknown>,
	errors: HeValidationError[],
): void {
	if (
		typeof value.generatedAt === "string" &&
		Number.isNaN(Date.parse(value.generatedAt))
	) {
		errors.push(
			toValidationError(
				"generatedAt must be an ISO-8601 datetime string",
				"generatedAt",
			),
		);
	}
}

function validateSummaryCounts(
	summary: Record<string, unknown>,
	lanes: readonly unknown[],
	findings: readonly Record<string, unknown>[],
	failures: number,
	warnings: number,
	lanesNeedingEvidence: number,
	errors: HeValidationError[],
): void {
	const expectedSummary: Array<[string, number]> = [
		["lanes", lanes.length],
		["findings", findings.length],
		["failures", failures],
		["warnings", warnings],
		["lanesNeedingEvidence", lanesNeedingEvidence],
	];
	for (const [field, expected] of expectedSummary) {
		if (summary[field] !== expected) {
			errors.push(
				toValidationError(
					`summary.${field} must match lane evidence`,
					`summary.${field}`,
				),
			);
		}
	}
}

function validateStatusInvariant(
	status: unknown,
	failures: number,
	warnings: number,
	lanesNeedingEvidence: number,
	failedLanes: number,
	warningLanes: number,
	errors: HeValidationError[],
): void {
	const expectedStatus =
		failures > 0 || failedLanes > 0
			? "fail"
			: lanesNeedingEvidence > 0
				? "needs_evidence"
				: warnings > 0 || warningLanes > 0
					? "warn"
					: "pass";
	if (status !== expectedStatus) {
		errors.push(
			toValidationError(
				`status must be ${expectedStatus} for derived lane/finding counts`,
				"status",
			),
		);
	}
}

function validateFitnessInvariants(
	value: Record<string, unknown>,
	errors: HeValidationError[],
): void {
	if (!isRecord(value.summary) || !Array.isArray(value.lanes)) return;
	const summary = value.summary;
	const lanes = value.lanes;
	const findings = recordFindingsFromLanes(lanes);
	const failures = findings.filter((finding) => {
		const severity = severityOf(finding);
		return severity === "critical" || severity === "error";
	}).length;
	const warnings = findings.filter(
		(finding) => severityOf(finding) === "warning",
	).length;
	const lanesNeedingEvidence = lanes.filter(
		(lane) => isRecord(lane) && lane.status === "not_run",
	).length;
	const failedLanes = lanes.filter(
		(lane) => isRecord(lane) && lane.status === "fail",
	).length;
	const warningLanes = lanes.filter(
		(lane) => isRecord(lane) && lane.status === "warn",
	).length;
	const deterministicFindings = findings.filter(
		(finding) => enforcementOf(finding) !== "advisory",
	);

	validateSummaryCounts(
		summary,
		lanes,
		findings,
		failures,
		warnings,
		lanesNeedingEvidence,
		errors,
	);
	validateStatusInvariant(
		value.status,
		failures,
		warnings,
		lanesNeedingEvidence,
		failedLanes,
		warningLanes,
		errors,
	);
	validateLaneStatusInvariant(lanes, errors);
	validateRequiredLaneIds(lanes, errors);
	validateTopFindingInvariant(value, deterministicFindings, errors);
}

function validateRequiredLaneIds(
	lanes: readonly unknown[],
	errors: HeValidationError[],
): void {
	const rawLaneIds = lanes.flatMap((lane) =>
		isRecord(lane) && typeof lane.id === "string" ? [lane.id] : [],
	);
	const laneIds = new Set(rawLaneIds);
	if (laneIds.size !== rawLaneIds.length) {
		errors.push(
			toValidationError("lanes must not contain duplicate lane ids", "lanes"),
		);
	}
	for (const laneId of REQUIRED_LANE_IDS) {
		if (!laneIds.has(laneId)) {
			errors.push(
				toValidationError(
					`lanes must include required lane ${laneId}`,
					"lanes",
				),
			);
		}
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
	validateGeneratedAt(value, errors);
	validateSummary(value.summary, errors);
	if (!Array.isArray(value.lanes)) {
		errors.push(toValidationError("lanes must be an array", "lanes"));
	} else {
		value.lanes.forEach((lane, index) => {
			validateLane(lane, `lanes[${String(index)}]`, errors);
		});
	}
	if (value.coverage !== undefined) {
		validateCoverageArray(value.coverage, "coverage", errors);
	}
	if (value.topDeterministicFinding !== null) {
		validateFinding(
			value.topDeterministicFinding,
			"topDeterministicFinding",
			errors,
		);
	}
	if (value.trendSnapshot !== undefined) {
		validateTrendSnapshot(value.trendSnapshot, errors);
	}
	validateStringArray(value.claimBoundaries, "claimBoundaries", errors);
	validateFitnessInvariants(value, errors);
	return { valid: errors.length === 0, errors };
}

/** Type guard for validated harness-fitness/v1 reports. */
export function isFitnessReport(value: unknown): value is FitnessReport {
	return validateFitnessReport(value).valid;
}
