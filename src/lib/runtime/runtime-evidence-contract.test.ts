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

	it("rejects unknown declared intent scopes", () => {
		const contract = validContract();
		contract.declaredIntent.requestedScope = "observe" as never;

		const result = validateRuntimeEvidenceContract(contract);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "requested_scope_invalid",
				path: "declaredIntent.requestedScope",
			}),
		);
	});

	it("rejects malformed declared intent source refs", () => {
		const contract = validContract();
		contract.declaredIntent.sourceRefs = [123] as never;

		const result = validateRuntimeEvidenceContract(contract);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "source_ref_invalid",
				path: "declaredIntent.sourceRefs",
			}),
		);
	});

	it("rejects malformed resolved state fields", () => {
		const contract = validContract();
		contract.resolvedState.goalStatus = 42 as never;
		contract.resolvedState.serviceTier = false as never;
		contract.resolvedState.pluginAttribution = [
			"harness-engineering",
			null,
		] as never;
		contract.resolvedState.runtimeProbe = "available" as never;

		const result = validateRuntimeEvidenceContract(contract);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "goal_status_invalid",
				path: "resolvedState.goalStatus",
			}),
		);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "service_tier_invalid",
				path: "resolvedState.serviceTier",
			}),
		);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "plugin_attribution_invalid",
				path: "resolvedState.pluginAttribution",
			}),
		);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "runtime_probe_invalid",
				path: "resolvedState.runtimeProbe",
			}),
		);
	});

	it("rejects unknown runtime probe spawn outcomes", () => {
		const contract = validContract();
		if (contract.resolvedState.runtimeProbe !== null) {
			contract.resolvedState.runtimeProbe.spawnOutcome = "maybe" as never;
			contract.resolvedState.runtimeProbe.blockerClass = "runtime_drift";
		}

		const result = validateRuntimeEvidenceContract(contract);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "runtime_probe_spawn_outcome_invalid",
				path: "resolvedState.runtimeProbe.spawnOutcome",
			}),
		);
	});

	it("rejects unknown evaluation statuses", () => {
		const contract = validContract();
		contract.evaluation.status = "banana" as never;

		const result = validateRuntimeEvidenceContract(contract);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "evaluation_status_invalid",
				path: "evaluation.status",
			}),
		);
	});

	it("rejects malformed evaluation portable flags", () => {
		const contract = validContract();
		contract.evaluation.portable = "yes" as never;
		contract.evaluation.command = null as never;

		const result = validateRuntimeEvidenceContract(contract);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "evaluation_portable_invalid",
				path: "evaluation.portable",
			}),
		);
	});

	it("rejects unknown claim trace consistency values", () => {
		const contract = validContract();
		contract.claimTraceConsistency = "maybe" as never;

		const result = validateRuntimeEvidenceContract(contract);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "claim_trace_consistency_invalid",
				path: "claimTraceConsistency",
			}),
		);
	});

	it("rejects unknown verifier result owners", () => {
		const contract = validContract();
		contract.verifierResult.owner = "bot" as never;

		const result = validateRuntimeEvidenceContract(contract);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "verifier_owner_invalid",
				path: "verifierResult.owner",
			}),
		);
	});

	it("rejects malformed pass verifier reasons", () => {
		const contract = validContract();
		contract.verifierResult.status = "pass";
		contract.verifierResult.reason = 123 as never;

		const result = validateRuntimeEvidenceContract(contract);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "verifier_reason_invalid",
				path: "verifierResult.reason",
			}),
		);
	});

	it("rejects malformed runtime probe session ids", () => {
		const contract = validContract();
		if (contract.resolvedState.runtimeProbe !== null) {
			contract.resolvedState.runtimeProbe.sessionId = 42 as never;
		}

		const result = validateRuntimeEvidenceContract(contract);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "runtime_probe_session_id_invalid",
				path: "resolvedState.runtimeProbe.sessionId",
			}),
		);
	});

	it("rejects malformed available runtime probe blocker classes", () => {
		const contract = validContract();
		if (contract.resolvedState.runtimeProbe !== null) {
			contract.resolvedState.runtimeProbe.spawnOutcome = "available";
			contract.resolvedState.runtimeProbe.blockerClass = 123 as never;
		}

		const result = validateRuntimeEvidenceContract(contract);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "runtime_probe_blocker_invalid",
				path: "resolvedState.runtimeProbe.blockerClass",
			}),
		);
	});

	it("rejects malformed runtime evidence timestamps", () => {
		const contract = validContract();
		contract.verifierResult.verifiedAt = "2026-05-22T10:01:00junk";
		if (contract.resolvedState.runtimeProbe !== null) {
			contract.resolvedState.runtimeProbe.checkedAt =
				"2026-02-30T10:00:00.000Z";
		}

		const result = validateRuntimeEvidenceContract(contract);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "verified_at_invalid",
				path: "verifierResult.verifiedAt",
			}),
		);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "runtime_probe_checked_at_invalid",
				path: "resolvedState.runtimeProbe.checkedAt",
			}),
		);
	});

	it("rejects malformed verifier evidence refs", () => {
		const contract = validContract();
		contract.verifierResult.evidenceRefs = [123] as never;

		const result = validateRuntimeEvidenceContract(contract);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "verifier_evidence_ref_invalid",
				path: "verifierResult.evidenceRefs",
			}),
		);
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
