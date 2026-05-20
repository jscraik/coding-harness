import type { PrTemplateGateResult } from "../../commands/pr-template-gate.js";
import { buildGateResult } from "./normalise-core.js";
import type { GateFinding, GateResult } from "./types.js";

function buildPrTemplateFindings(
	result: Extract<PrTemplateGateResult, { ok: true }>["output"],
	gate: string,
): GateFinding[] {
	if (result.errors.length === 0) {
		return [
			{
				id: "pr-template-gate.result.error.unknown",
				severity: "error",
				gate,
				message: "Gate reported failure without error details",
				baseline: false,
				fix: { suppressible: false },
			},
		];
	}

	return result.errors.map(
		(message, index): GateFinding => ({
			id: `pr-template-gate.result.error.${index}`,
			severity: "error",
			gate,
			message,
			baseline: false,
			fix: { suppressible: false },
		}),
	);
}

/**
 * Normalise a PrTemplateGateResult to the canonical GateResult interface.
 *
 * @param result - The raw PR template gate result to project into GateResult
 * @returns A canonical GateResult preserving PR template validation failures
 */
export function normalisePrTemplateGateResult(
	result: PrTemplateGateResult,
): GateResult {
	const gate = "pr-template-gate";
	const timestamp = new Date().toISOString();

	if (!result.ok) {
		const finding: GateFinding = {
			id: "pr-template-gate.result.internal",
			severity: "error",
			gate,
			message: result.error.message,
			baseline: false,
			fix: { suppressible: false },
		};
		return buildGateResult({
			gate,
			timestamp,
			status: "fail",
			findings: [finding],
			decision: {
				reason: result.error.message,
				actionNow: ["Fix the internal pr-template-gate error and rerun."],
				evidenceRef: ["error:pr-template-gate.result.internal"],
			},
		});
	}

	if (result.output.passed) {
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
		findings: buildPrTemplateFindings(result.output, gate),
	});
}
