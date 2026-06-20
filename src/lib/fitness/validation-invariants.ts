import {
	type HeValidationError,
	isRecord,
	toValidationError,
} from "../decision/validators.js";

function severityOf(finding: Record<string, unknown>): unknown {
	return finding.severity;
}

function laneStatusError(
	status: unknown,
	hasFailure: boolean,
	hasWarning: boolean,
	field: string,
): HeValidationError | null {
	if (status === "fail" && !hasFailure) {
		return toValidationError(
			`${field} fail requires failure finding evidence`,
			field,
		);
	}
	if (status === "warn" && hasFailure) {
		return toValidationError(
			`${field} warn cannot contain failure finding evidence`,
			field,
		);
	}
	if (status === "warn" && !hasWarning) {
		return toValidationError(
			`${field} warn requires warning finding evidence`,
			field,
		);
	}
	if (status === "pass" && (hasFailure || hasWarning)) {
		return toValidationError(
			`${field} pass cannot contain blocking finding evidence`,
			field,
		);
	}
	return null;
}

/** Validate that deterministic finding evidence includes top-finding metadata. */
export function validateTopFindingInvariant(
	value: Record<string, unknown>,
	deterministicFindings: readonly Record<string, unknown>[],
	errors: HeValidationError[],
): void {
	if (
		deterministicFindings.length > 0 &&
		value.topDeterministicFinding == null
	) {
		errors.push(
			toValidationError(
				"topDeterministicFinding must be present when deterministic findings exist",
				"topDeterministicFinding",
			),
		);
	}
}

/** Validate that each lane status is backed by matching finding evidence. */
export function validateLaneStatusInvariant(
	lanes: readonly unknown[],
	errors: HeValidationError[],
): void {
	for (const [index, lane] of lanes.entries()) {
		if (!isRecord(lane) || !Array.isArray(lane.findings)) continue;
		const findings = lane.findings.filter(isRecord);
		const hasFailure = findings.some((finding) => {
			const severity = severityOf(finding);
			return severity === "critical" || severity === "error";
		});
		const hasWarning = findings.some(
			(finding) => severityOf(finding) === "warning",
		);
		const field = `lanes[${String(index)}].status`;
		const error = laneStatusError(lane.status, hasFailure, hasWarning, field);
		if (error) errors.push(error);
	}
}
