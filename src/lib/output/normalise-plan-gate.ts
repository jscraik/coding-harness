import type { PlanGateResult } from "../plan-gate/types.js";
import { buildGateResult } from "./normalise-core.js";
import type { GateFinding, GateResult } from "./types.js";

function buildPlanGateFindings(
	result: PlanGateResult,
	recoveryHints: Record<string, string | undefined>,
	gate: string,
): GateFinding[] {
	return result.errors.map((error) => {
		const hint = recoveryHints[error.code];
		return {
			id: `plan-gate.result.error.${error.code}`,
			severity: "error" as const,
			gate,
			message: error.message,
			...(error.path !== undefined ? { path: error.path } : {}),
			baseline: false,
			fix: {
				...(hint !== undefined ? { manual: hint } : {}),
				suppressible: false,
			},
		};
	});
}

/**
 * Normalise a PlanGateResult to the canonical GateResult interface.
 *
 * @param result - The raw plan-gate result to project into GateResult
 * @param recoveryHints - Optional map from plan-gate error code to recovery hint
 * @returns A canonical GateResult preserving plan validation failures
 */
export function normalisePlanGateResult(
	result: PlanGateResult,
	recoveryHints: Record<string, string | undefined> = {},
): GateResult {
	const gate = "plan-gate";
	const timestamp = new Date().toISOString();

	if (result.passed) {
		return buildGateResult({
			gate,
			timestamp,
			status: "pass",
			findings: [],
		});
	}

	return buildGateResult({
		gate,
		timestamp,
		status: "fail",
		findings: buildPlanGateFindings(result, recoveryHints, gate),
	});
}
