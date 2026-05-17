import { describe, expect, it } from "vitest";
import {
	HE_GATE_RESULT_SCHEMA_VERSION,
	HE_PHASE_EXIT_SCHEMA_VERSION,
	aggregateHePhaseExit,
	type HeGateId,
	type HeGatePayload,
	type HeGateResult,
} from "../decision/he-phase-exit.js";
import { normaliseHePhaseExitResult } from "./normalise.js";

function payloadFor(gateId: HeGateId): HeGatePayload {
	switch (gateId) {
		case "simplify":
			return {
				scopeEvidence: ["git diff"],
				reuseReviewed: true,
				qualityReviewed: true,
				efficiencyReviewed: true,
			};
		case "improve_codebase_architecture":
			return {
				scopeEvidence: ["architecture review artifact"],
				complexitySymptomsNamed: true,
				patchVsInterfaceCompared: true,
				tracerProofRecorded: true,
				decisionSurfaceRecorded: true,
			};
		case "unslopify":
			return {
				scopeEvidence: ["unslopify review artifact"],
				cleanupLedgerRecorded: true,
				removalEvidenceRecorded: true,
				validationRecorded: true,
				rollbackAndResidualRiskRecorded: true,
			};
		case "testing_reviewer":
			return {
				scopeEvidence: ["review artifact"],
				testAdequacyReviewed: true,
				missingEdgeCases: [],
			};
		case "he_fix_bugs":
			return {
				scopeEvidence: ["no failing evidence"],
				reproductionEvidence: [],
				rootCause: null,
				regressionProtection: [],
				rollbackNote: null,
			};
		case "he_code_review":
			return {
				scopeEvidence: ["review artifact"],
				findingsFirst: true,
				traceabilityReviewed: true,
				blockerClassification: true,
				safeToContinueReviewed: true,
			};
		case "autofix":
			return {
				scopeEvidence: ["no review feedback"],
				feedbackInventory: [],
				accountedItems: 0,
			};
		case "ubiquitous_language":
			return {
				scopeEvidence: ["UBIQUITOUS_LANGUAGE.md"],
				glossaryReviewed: true,
				canonicalTermsApplied: true,
				promptTranslationsUpdated: true,
				instructionPointerChecked: true,
			};
	}
}

function passingGate(gateId: HeGateId, required = true): HeGateResult {
	return {
		schemaVersion: HE_GATE_RESULT_SCHEMA_VERSION,
		gateId,
		required,
		executionMode:
			gateId === "testing_reviewer" ? "subagent_proxy" : "direct_skill",
		status: "pass",
		payload: payloadFor(gateId),
		evidenceRefs: [
			{
				id: `${gateId}-artifact`,
				kind: gateId === "testing_reviewer" ? "subagent" : "skill",
				ref: `artifact:${gateId}`,
				gateLocal: true,
			},
		],
		findings: [],
		actions: [],
		validation: [
			{
				command: "pnpm vitest run src/lib/decision/he-phase-exit.test.ts",
				outcome: "pass",
				reason: null,
			},
		],
		requiresHuman: false,
		safeToContinue: true,
		reason: null,
		blockedReason: null,
	};
}

function notApplicableGate(gateId: HeGateId, required = true): HeGateResult {
	return {
		...passingGate(gateId, required),
		executionMode: "not_applicable",
		status: "not_applicable",
		validation: [],
		reason: `${gateId} was not applicable`,
	};
}

function phaseExit(
	overrides: Partial<Parameters<typeof aggregateHePhaseExit>[0]> = {},
) {
	return aggregateHePhaseExit({
		phaseContext: {
			phase: "closeout",
			failingEvidencePresent: false,
			reviewFeedbackPresent: false,
		},
		requiredGates: [
			"simplify",
			"improve_codebase_architecture",
			"unslopify",
			"testing_reviewer",
			"he_fix_bugs",
			"he_code_review",
		],
		optionalGates: ["autofix", "ubiquitous_language"],
		gates: [
			passingGate("simplify"),
			passingGate("improve_codebase_architecture"),
			passingGate("unslopify"),
			passingGate("testing_reviewer"),
			notApplicableGate("he_fix_bugs"),
			passingGate("he_code_review"),
			notApplicableGate("autofix", false),
			{ ...passingGate("ubiquitous_language", false), required: false },
		],
		...overrides,
	});
}

describe("normaliseHePhaseExitResult", () => {
	it("exposes passing phase-exit decisions as operator-visible gate results", () => {
		const result = normaliseHePhaseExitResult(phaseExit());

		expect(result).toMatchObject({
			gate: "he-phase-exit",
			status: "pass",
			reason: "HE phase exit passed with all required gate evidence satisfied.",
			findings: [],
			summary: { errors: 0, warnings: 0, info: 0, total: 0 },
			meta: {
				schemaVersion: HE_PHASE_EXIT_SCHEMA_VERSION,
				phase: "closeout",
				recommendation: "continue",
				commitAllowed: true,
				exitAllowed: true,
			},
		});
		expect(result.evidence_ref).toContain("gate:simplify:pass");
		expect(result.evidence_ref).toContain(
			"gate-evidence:he_code_review:he_code_review-artifact",
		);
	});

	it("surfaces optional gate failures as warnings without hiding commit readiness", () => {
		const decision = phaseExit({
			requiredGates: ["simplify", "testing_reviewer", "he_fix_bugs"],
			optionalGates: ["he_code_review", "autofix"],
			gates: [
				passingGate("simplify"),
				passingGate("testing_reviewer"),
				notApplicableGate("he_fix_bugs"),
				{
					...passingGate("he_code_review", false),
					safeToContinue: false,
				},
				notApplicableGate("autofix", false),
			],
		});
		const result = normaliseHePhaseExitResult(decision);

		expect(decision.commitAllowed).toBe(true);
		expect(result.status).toBe("warn");
		expect(result.findings).toEqual([
			expect.objectContaining({
				id: "he-phase-exit.warning.0",
				severity: "warning",
				message: "he_code_review is not safe to continue",
			}),
		]);
		expect(result.action_now).toEqual([
			"Review optional HE phase-exit warnings before handoff.",
		]);
	});

	it("surfaces blocking required gates as fail-closed operator findings", () => {
		const decision = phaseExit({
			gates: [passingGate("simplify")],
		});
		const result = normaliseHePhaseExitResult(decision);

		expect(result.status).toBe("fail");
		expect(result.findings).toEqual([
			expect.objectContaining({
				id: "he-phase-exit.blocker.0",
				severity: "error",
				message: "improve_codebase_architecture gate has not run",
			}),
			expect.objectContaining({
				id: "he-phase-exit.blocker.1",
				severity: "error",
				message: "unslopify gate has not run",
			}),
			expect.objectContaining({
				id: "he-phase-exit.blocker.2",
				severity: "error",
				message: "testing_reviewer gate has not run",
			}),
			expect.objectContaining({
				id: "he-phase-exit.blocker.3",
				severity: "error",
				message: "he_fix_bugs gate has not run",
			}),
			expect.objectContaining({
				id: "he-phase-exit.blocker.4",
				severity: "error",
				message: "he_code_review gate has not run",
			}),
		]);
		expect(result.action_now).toEqual([
			"Resolve required HE phase-exit blockers before commit readiness.",
		]);
	});

	it("maps human-review recommendations to explicit review guidance", () => {
		const decision = phaseExit({
			gates: [
				passingGate("simplify"),
				passingGate("improve_codebase_architecture"),
				passingGate("unslopify"),
				passingGate("testing_reviewer"),
				notApplicableGate("he_fix_bugs"),
				{
					...passingGate("he_code_review"),
					status: "blocked",
					safeToContinue: false,
					requiresHuman: true,
					blockedReason: "he_code_review requires human review",
					findings: [
						{
							id: "he-code-review-human",
							severity: "high",
							status: "open",
							summary: "Human review required",
							evidenceRef: "he_code_review-artifact",
						},
					],
				},
			],
		});
		const result = normaliseHePhaseExitResult(decision);

		expect(decision.recommendation).toBe("human_review_required");
		expect(result.status).toBe("fail");
		expect(result.action_now).toEqual([
			"Run the required human review gate, record artifact-backed evidence, then rerun phase-exit aggregation.",
		]);
		expect(result.reason).toBe(
			"HE phase exit is blocked: he_code_review requires human review",
		);
	});

	it("maps stopped non-closeout phases to stop guidance", () => {
		const decision = phaseExit({
			phaseContext: {
				phase: "route",
				failingEvidencePresent: false,
				reviewFeedbackPresent: false,
			},
			gates: [passingGate("simplify")],
		});
		const result = normaliseHePhaseExitResult(decision);

		expect(decision.recommendation).toBe("stop");
		expect(result.status).toBe("fail");
		expect(result.action_now).toEqual([
			"Stop the current HE phase and repair the blocking gate evidence before continuing.",
		]);
		expect(result.reason).toContain("HE phase exit is blocked:");
	});

	it("fails closed for non-continue recommendations even without blockers", () => {
		const result = normaliseHePhaseExitResult({
			schemaVersion: HE_PHASE_EXIT_SCHEMA_VERSION,
			phaseContext: {
				phase: "closeout",
				failingEvidencePresent: false,
				reviewFeedbackPresent: false,
			},
			recommendation: "human_review_required",
			commitAllowed: false,
			exitAllowed: false,
			blockers: [],
			warnings: [],
			gates: [],
		});

		expect(result.status).toBe("fail");
		expect(result.reason).toBe(
			"HE phase exit is blocked by recommendation: human_review_required",
		);
		expect(result.findings).toEqual([
			expect.objectContaining({
				id: "he-phase-exit.blocker.0",
				severity: "error",
				message: "HE phase exit recommendation is human_review_required.",
			}),
		]);
		expect(result.action_now).toEqual([
			"Run the required human review gate, record artifact-backed evidence, then rerun phase-exit aggregation.",
		]);
	});
});
