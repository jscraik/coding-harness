import type { LinearGateResult } from "../../commands/linear-gate.js";
import type { GateFailureClass } from "../policy/required-checks.js";
import { buildGateResult } from "./normalise-core.js";
import type { GateFinding, GateResult } from "./types.js";

type LinearGateCheck = Extract<
	LinearGateResult,
	{ ok: true }
>["output"]["checks"][number];

/** Failure class and next action derived from a linear-gate error code. */
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
	if (errorCode === "CONTRACT_ERROR" || errorCode === "VALIDATION_ERROR") {
		return "contract_policy";
	}
	const normalizedCode = errorCode.trim().toUpperCase();
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

/**
 * Selects the user-facing next-action string for a linear gate failure class.
 *
 * @param failureClass - The classified failure type for a linear gate; determines the recommended next action.
 * @returns The next-action string corresponding to `failureClass`: the contract-policy guidance when `failureClass` is `"contract_policy"`, otherwise the internal-unknown guidance.
 */
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

/**
 * Classify a linear-gate result into a failure category and a user-facing next action.
 *
 * @param result - The linear gate result to evaluate; used to determine whether the run passed or failed and, if failed, which error code to classify.
 * @returns A `LinearGateFailureClassification` describing the failure class and recommended next action when the result represents a failure, or `null` when the result indicates success.
 */
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

function failureManualFix(
	failure: LinearGateFailureClassification | null,
): GateFinding["fix"] {
	return {
		...(failure ? { manual: failure.nextAction } : {}),
		suppressible: false,
	};
}

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

function failureActionNow(
	failure: LinearGateFailureClassification | null,
	fallback: string,
): string[] {
	return failure ? [failure.nextAction] : [fallback];
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
			actionNow: failureActionNow(
				failure,
				"Inspect linear-gate internal error and rerun.",
			),
			evidenceRef: [`error:${LINEAR_GATE_INTERNAL_FINDING_ID}`],
		},
	});
}

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
			actionNow: failureActionNow(
				failure,
				"Inspect linear-gate payload contract and rerun.",
			),
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

/**
 * Convert a raw LinearGateResult into the canonical GateResult with standardized findings, summary counts, status, and optional meta information.
 *
 * When the gate call failed (result.ok === false) the returned GateResult contains a single internal error finding and `meta.errorCode`. When the gate call succeeded, the returned GateResult contains one error finding for each failing check. If a failure classification is available, its `nextAction` is attached to each finding's `fix.manual` and `meta.failureClass` / `meta.nextAction` are included.
 *
 * @param result - The raw linear-gate response to normalize.
 * @returns A canonical GateResult with normalized `findings`, `summary` (errors/warnings/info/total), `status` ("pass" or "fail"), and optional `meta` fields (`failureClass`, `nextAction`, `errorCode`).
 */
export function normaliseLinearGateResult(
	result: LinearGateResult,
): GateResult {
	const timestamp = new Date().toISOString();
	const failure = classifyLinearGateFailure(result);

	if (!result.ok) {
		return normaliseLinearGateInternalError(result, timestamp, failure);
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
