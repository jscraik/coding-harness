import type { HeEvidenceRef, HeGateResult } from "./he-phase-exit-core.js";
import type { HeValidationError } from "./validators.js";

const EXECUTED_STATUSES = ["pass", "fail", "blocked"] as const;
const GATE_LOCAL_EVIDENCE_STATUSES = [
	"pass",
	"fail",
	"blocked",
	"not_applicable",
] as const;

function hasStatus(statuses: readonly string[], status: string): boolean {
	return statuses.includes(status);
}

function gateTrustError(
	message: string,
	path: string,
	gate: string,
): HeValidationError {
	return {
		code: message,
		path,
		severity: "error",
		gate,
	};
}

/**
 * Validate gate status, execution mode, finding, and evidence-reference trust rules.
 *
 * This is the trust seam for HeGateResult/v1: callers may summarize phase-exit
 * evidence, but this policy decides whether the summary is strong enough to
 * count as executable gate proof.
 *
 * @param result - Normalized gate result whose trust rules should be checked
 * @param evidenceRefs - Evidence references declared by the gate
 * @param errors - Mutable validation-error collector
 */
export function validateHeGateTrustPolicy(
	result: HeGateResult,
	evidenceRefs: readonly HeEvidenceRef[],
	errors: HeValidationError[],
): void {
	validateExecutedStatusMode(result, errors);
	validateGateLocalEvidence(result, evidenceRefs, errors);
	validateFindingEvidence(result, evidenceRefs, errors);
	validateSkippedStatusReasons(result, errors);
}

function validateExecutedStatusMode(
	result: HeGateResult,
	errors: HeValidationError[],
): void {
	if (
		hasStatus(EXECUTED_STATUSES, result.status) &&
		["not_applicable", "not_run"].includes(result.executionMode)
	) {
		errors.push(
			gateTrustError(
				"pass, fail, and blocked gates cannot have not_applicable or not_run executionMode",
				"executionMode",
				result.gateId,
			),
		);
	}
	if (
		hasStatus(EXECUTED_STATUSES, result.status) &&
		result.executionMode === "validation_only"
	) {
		errors.push(
			gateTrustError(
				"validation_only gates cannot satisfy pass, fail, or blocked skill-gate evidence",
				"executionMode",
				result.gateId,
			),
		);
	}
}

function validateGateLocalEvidence(
	result: HeGateResult,
	evidenceRefs: readonly HeEvidenceRef[],
	errors: HeValidationError[],
): void {
	if (
		hasStatus(GATE_LOCAL_EVIDENCE_STATUSES, result.status) &&
		!evidenceRefs.some((ref) => ref.gateLocal)
	) {
		errors.push(
			gateTrustError(
				result.status === "not_applicable"
					? "not_applicable gates require at least one gate-local evidence ref"
					: "pass, fail, and blocked gates require at least one gate-local evidence ref",
				"evidenceRefs",
				result.gateId,
			),
		);
	}
}

function validateFindingEvidence(
	result: HeGateResult,
	evidenceRefs: readonly HeEvidenceRef[],
	errors: HeValidationError[],
): void {
	if (
		["fail", "blocked"].includes(result.status) &&
		!result.findings.some((finding) => finding.status === "open")
	) {
		errors.push(
			gateTrustError(
				"failed or blocked gates require an open finding",
				"findings",
				result.gateId,
			),
		);
	}
	if (
		result.status === "blocked" &&
		(typeof result.blockedReason !== "string" ||
			result.blockedReason.trim().length === 0)
	) {
		errors.push(
			gateTrustError(
				"blocked gates require blockedReason",
				"blockedReason",
				result.gateId,
			),
		);
	}
	const evidenceRefIds = new Set(evidenceRefs.map((ref) => ref.id));
	for (const finding of result.findings) {
		if (
			finding.evidenceRef !== null &&
			!evidenceRefIds.has(finding.evidenceRef)
		) {
			errors.push(
				gateTrustError(
					`unknown evidenceRefs.id: ${finding.evidenceRef}`,
					"findings.evidenceRef",
					result.gateId,
				),
			);
		}
	}
}

function validateSkippedStatusReasons(
	result: HeGateResult,
	errors: HeValidationError[],
): void {
	if (
		result.status === "not_applicable" &&
		result.executionMode !== "not_applicable"
	) {
		errors.push(
			gateTrustError(
				"not_applicable gates require not_applicable executionMode",
				"executionMode",
				result.gateId,
			),
		);
	}
	if (
		result.status === "not_applicable" &&
		(typeof result.reason !== "string" || result.reason.trim().length === 0)
	) {
		errors.push(
			gateTrustError(
				"not_applicable gates require reason",
				"reason",
				result.gateId,
			),
		);
	}
	if (result.status === "not_run" && result.executionMode !== "not_run") {
		errors.push(
			gateTrustError(
				"not_run gates require not_run executionMode",
				"executionMode",
				result.gateId,
			),
		);
	}
	if (
		result.status === "not_run" &&
		(typeof result.reason !== "string" || result.reason.trim().length === 0)
	) {
		errors.push(
			gateTrustError("not_run gates require reason", "reason", result.gateId),
		);
	}
}
