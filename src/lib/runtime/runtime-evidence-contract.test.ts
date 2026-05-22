import { describe, expect, it } from "vitest";

import {
	RUNTIME_EVIDENCE_CONTRACT_SCHEMA_VERSION,
	mapRuntimeVerifierToRunExit,
	validateRuntimeEvidenceContract,
	type RuntimeEvidenceContract,
} from "./runtime-evidence-contract.js";

describe("runtime-evidence-contract", () => {
	it("validates a verifier-backed runtime claim with a live runtime probe", () => {
		const contract = validContract();

		const result = validateRuntimeEvidenceContract(contract);

		expect(result).toEqual({ valid: true, findings: [] });
	});

	it("blocks pass claims when runtime probe evidence is missing", () => {
		const contract = validContract();
		contract.resolvedState.runtimeProbe = null;

		const result = validateRuntimeEvidenceContract(contract);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "runtime_probe_missing",
				path: "resolvedState.runtimeProbe",
			}),
		);
	});

	it("requires outcome mapping to match verifier status", () => {
		const contract = validContract();
		contract.verifierResult.status = "blocked";
		contract.outcomeMapping = { outcome: "success", exitClassification: "ok" };

		const result = validateRuntimeEvidenceContract(contract);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({ code: "outcome_mapping_mismatch" }),
		);
		expect(mapRuntimeVerifierToRunExit("blocked")).toEqual({
			outcome: "blocked",
			exitClassification: "manual_intervention_required",
		});
	});
});

function validContract(): RuntimeEvidenceContract {
	return {
		schemaVersion: RUNTIME_EVIDENCE_CONTRACT_SCHEMA_VERSION,
		declaredIntent: {
			objective: "Implement runtime evidence contract",
			requestedScope: "implementation",
			sourceRefs: ["user:full-feature-request"],
		},
		resolvedState: {
			permissionProfile: "workspace_write",
			goalStatus: null,
			serviceTier: "priority",
			pluginAttribution: ["harness-engineering"],
			runtimeProbe: {
				roleName: "harness-product-code-reviewer",
				spawnOutcome: "available",
				checkedAt: "2026-05-22T10:00:00.000Z",
				sessionId: "session-123",
				checkout: "/Users/jamiecraik/dev/coding-harness",
				blockerClass: null,
			},
		},
		verifierResult: {
			status: "pass",
			owner: "validator",
			evidenceRefs: [
				"pnpm vitest run src/lib/runtime/runtime-evidence-contract.test.ts",
			],
			verifiedAt: "2026-05-22T10:01:00.000Z",
			reason: null,
		},
		claimTraceConsistency: "consistent",
		evaluation: {
			portable: true,
			command:
				"pnpm vitest run src/lib/runtime/runtime-evidence-contract.test.ts",
			status: "pass",
		},
		outcomeMapping: { outcome: "success", exitClassification: "ok" },
	};
}
