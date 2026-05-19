import type { PolicyGateResult } from "../../commands/policy-gate.js";
import { buildGateResult, uniqueStrings } from "./normalise-core.js";
import type { GateFinding, GateResult } from "./types.js";

function buildPolicyViolationFindings(
	result: Extract<PolicyGateResult, { ok: true }>["output"],
	gate: string,
): GateFinding[] {
	const violatingFiles = result.violatingFiles;
	if (violatingFiles.length === 0) {
		return [
			{
				id: "policy-gate.result.error.unknown",
				severity: "error",
				gate,
				message: "Gate reported failure without file details",
				baseline: false,
				fix: { suppressible: false },
			},
		];
	}

	return violatingFiles.map(
		(file, index): GateFinding => ({
			id: `policy-gate.result.error.${index}`,
			severity: "error",
			gate,
			message: `File '${file}' exceeds policy tier (actual: ${result.tier}, max: ${result.maxAllowed ?? "unset"})`,
			...(file ? { path: file } : {}),
			baseline: false,
			fix: { suppressible: false },
		}),
	);
}

/**
 * Normalise a PolicyGateResult to the canonical GateResult interface.
 *
 * @param result - The raw policy-gate result to project into GateResult
 * @returns A canonical GateResult preserving policy tier and evidence details
 */
export function normalisePolicyGateResult(
	result: PolicyGateResult,
): GateResult {
	const gate = "policy-gate";
	const timestamp = new Date().toISOString();

	if (!result.ok) {
		const finding: GateFinding = {
			id: "policy-gate.result.internal",
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
				actionNow: ["Investigate policy-gate internal error and rerun."],
				evidenceRef: ["error:policy-gate.result.internal"],
			},
		});
	}

	if (result.output.passed) {
		return buildGateResult({
			gate,
			timestamp,
			status: "pass",
			findings: [],
			meta: {
				tier: result.output.tier,
				verdict: result.output.verdict,
				action: result.output.action,
			},
			decision: {
				reason: `Policy gate passed for tier '${result.output.tier}'.`,
				evidenceRef: [`tier:${result.output.tier}`],
			},
		});
	}

	const findings = buildPolicyViolationFindings(result.output, gate);

	return buildGateResult({
		gate,
		timestamp,
		status: "fail",
		findings,
		meta: {
			tier: result.output.tier,
			maxAllowed: result.output.maxAllowed,
			verdict: result.output.verdict,
			action: result.output.action,
		},
		decision: {
			reason: `Tier '${result.output.tier}' exceeds allowed '${result.output.maxAllowed ?? "unset"}'.`,
			evidenceRef: uniqueStrings(
				(result.output.violatingFiles ?? []).map((file) => `path:${file}`),
			),
		},
	});
}
