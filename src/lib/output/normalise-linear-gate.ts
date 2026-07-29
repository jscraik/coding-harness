import type { LinearGateResult } from "../../commands/linear-gate.js";
import type { GateFailureClass } from "../policy/required-checks.js";
import { buildGateResult } from "./normalise-core.js";
import type { GateFinding, GateResult } from "./types.js";

type LinearGateCheck = Extract<
	LinearGateResult,
	{ ok: true }
>["output"]["checks"][number];

/** Return the required-check failure class for a Linear gate error. */
export interface LinearGateFailureClassification {
	failureClass: GateFailureClass;
	nextAction: string;
}

const LINEAR_GATE_CONTRACT_POLICY_NEXT_ACTION =
	"Fix contract/policy mismatch, then rerun linear-gate.";
const LINEAR_GATE_TRANSIENT_INFRA_NEXT_ACTION =
	"Retry once after infrastructure recovers, then rerun linear-gate.";
const LINEAR_GATE_INTERNAL_UNKNOWN_NEXT_ACTION =
	"Inspect gate output, fix root cause, and rerun linear-gate.";

/**
 * Maps a linear-gate error code to a failure classification used for next-action guidance.
 *
 * @param errorCode - Error code reported by the linear gate
 * @returns `contract_policy` for policy/contract validation failures, `transient_infra` for retryable infra/network classes, `internal_unknown` otherwise
 */
function classifyLinearGateErrorCode(errorCode: string): GateFailureClass {
	const normalizedCode = errorCode.trim().toUpperCase();
	if (["CONTRACT_ERROR", "VALIDATION_ERROR"].includes(normalizedCode)) {
		return "contract_policy";
	}
	if (
		normalizedCode.includes("TIMEOUT") ||
		normalizedCode.includes("RATE_LIMIT") ||
		normalizedCode.includes("TRANSIENT") ||
		normalizedCode.includes("NETWORK") ||
		normalizedCode.includes("UNAVAILABLE") ||
		normalizedCode === "ECONNRESET" ||
		normalizedCode === "ETIMEDOUT" ||
		normalizedCode === "EAI_AGAIN"
	) {
		return "transient_infra";
	}
	return "internal_unknown";
}

/** Return a corrective action for a Linear gate failure class. */
function resolveLinearGateNextAction(failureClass: GateFailureClass): string {
	switch (failureClass) {
		case "contract_policy":
			return LINEAR_GATE_CONTRACT_POLICY_NEXT_ACTION;
		case "transient_infra":
			return LINEAR_GATE_TRANSIENT_INFRA_NEXT_ACTION;
		case "internal_unknown":
			return LINEAR_GATE_INTERNAL_UNKNOWN_NEXT_ACTION;
	}
}

/** Classify a Linear gate result for its failure guidance. */
export function classifyLinearGateFailure(
	result: LinearGateResult,
): LinearGateFailureClassification | null {
	if (result.ok) {
		if (result.output.passed) {
			return null;
		}
		return {
			failureClass: "contract_policy",
			nextAction: resolveLinearGateNextAction("contract_policy"),
		};
	}
	const failureClass = classifyLinearGateErrorCode(result.error.code);
	return {
		failureClass,
		nextAction: resolveLinearGateNextAction(failureClass),
	};
}

const LINEAR_GATE_ID = "linear-gate";
const LINEAR_GATE_INTERNAL_FINDING_ID = "linear-gate.result.internal";

/** Preserve a compact-contract exemption without presenting it as tracker evidence. */
function normaliseNotApplicableLinearGateResult(
	output: Extract<LinearGateResult, { ok: true }>["output"],
): GateResult {
	return buildGateResult({
		gate: LINEAR_GATE_ID,
		status: "skipped",
		findings: [],
		meta: {
			notApplicable: output.notApplicable,
			repoRoot: output.repoRoot,
		},
		decision: {
			reason:
				"Linear gate is not applicable for this compact minimal contract; no tracker evidence was evaluated.",
			actionLater: [
				"Add an issue-tracking policy before treating this lane as Linear evidence.",
			],
			evidenceRef: [`linear:not-applicable:${output.notApplicable}`],
		},
	});
}

/** Build the optional manual remediation attached to a normalized failure finding. */
function failureManualFix(
	failure: LinearGateFailureClassification | null,
): GateFinding["fix"] {
	return {
		...(failure ? { manual: failure.nextAction } : {}),
		suppressible: false,
	};
}

/** Build the normalized finding for an internal Linear gate failure. */
function linearInternalFinding(
	message: string,
	failure: LinearGateFailureClassification | null,
): GateFinding {
	return {
		id: LINEAR_GATE_INTERNAL_FINDING_ID,
		severity: "error",
		gate: LINEAR_GATE_ID,
		message,
		baseline: false,
		fix: failureManualFix(failure),
	};
}

function failureMeta(
	failure: LinearGateFailureClassification | null,
): Record<string, string> | undefined {
	return failure
		? { failureClass: failure.failureClass, nextAction: failure.nextAction }
		: undefined;
}

function normaliseLinearGateInternalError(
	result: Extract<LinearGateResult, { ok: false }>,
	timestamp: string,
	failure: LinearGateFailureClassification | null,
): GateResult {
	const meta = failureMeta(failure);
	return buildGateResult({
		gate: LINEAR_GATE_ID,
		timestamp,
		status: "fail",
		findings: [linearInternalFinding(result.error.message, failure)],
		meta: { ...meta, errorCode: result.error.code },
		decision: {
			reason: result.error.message,
			actionNow: [
				failure?.nextAction ?? "Inspect linear-gate internal error and rerun.",
			],
			evidenceRef: [`error:${LINEAR_GATE_INTERNAL_FINDING_ID}`],
		},
	});
}

/** Fail closed when a failed Linear gate result omits its failing checks. */
function normaliseLinearGateContractViolation(
	timestamp: string,
	failure: LinearGateFailureClassification | null,
): GateResult {
	const message =
		"Linear gate reported passed=false but provided no failing checks; treating payload as a contract violation.";
	const meta = failureMeta(failure);
	return buildGateResult({
		gate: LINEAR_GATE_ID,
		timestamp,
		status: "fail",
		findings: [linearInternalFinding(message, failure)],
		...(meta ? { meta } : {}),
		decision: {
			reason: "linear-gate returned passed=false with no failing checks.",
			actionNow: [
				failure?.nextAction ??
					"Inspect linear-gate payload contract and rerun.",
			],
			evidenceRef: [`error:${LINEAR_GATE_INTERNAL_FINDING_ID}`],
		},
	});
}

function linearCheckFinding(
	check: LinearGateCheck,
	failure: LinearGateFailureClassification | null,
): GateFinding {
	return {
		id: `linear-gate.check.${check.code}`,
		severity: "error" as const,
		gate: LINEAR_GATE_ID,
		message: check.message,
		baseline: false,
		fix: failureManualFix(failure),
	};
}

/** Convert a Linear gate result into canonical evidence. */
export function normaliseLinearGateResult(
	result: LinearGateResult,
): GateResult {
	const timestamp = new Date().toISOString();
	const failure = classifyLinearGateFailure(result);

	if (!result.ok) {
		return normaliseLinearGateInternalError(result, timestamp, failure);
	}
	if (result.output.notApplicable) {
		return normaliseNotApplicableLinearGateResult(result.output);
	}

	const failingChecks = result.output.checks.filter((c) => !c.passed);
	if (!result.output.passed && failingChecks.length === 0) {
		return normaliseLinearGateContractViolation(timestamp, failure);
	}

	const findings = failingChecks.map((check) =>
		linearCheckFinding(check, failure),
	);

	const status = findings.length > 0 ? "fail" : "pass";
	const meta = failureMeta(failure);
	return buildGateResult({
		gate: LINEAR_GATE_ID,
		timestamp,
		status,
		findings,
		...(meta ? { meta } : {}),
	});
}
