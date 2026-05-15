import { describe, expect, it } from "vitest";
import {
	aggregateHePhaseExit,
	createAutofixGateResult,
	createHeCodeReviewGateResult,
	createHeFixBugsGateResult,
	createSimplifyGateResult,
	createTestingReviewerGateResult,
	type HeEvidenceRef,
	type HeGateResult,
	validateHeGateResult,
	validateHePhaseExit,
	validateHePhaseExitInput,
} from "./he-phase-exit.js";

function gateEvidence(id: string, kind = "artifact"): HeEvidenceRef[] {
	return [
		{
			id,
			kind,
			ref: `artifact:${id}`,
			gateLocal: true,
		},
	];
}

function expectValidGate(gate: HeGateResult): void {
	expect(validateHeGateResult(gate)).toEqual({ valid: true, errors: [] });
}

describe("HE phase-exit evidence adapters", () => {
	it("maps local skill and subagent artifacts into passing closeout gates", () => {
		const gates = [
			createSimplifyGateResult({
				scopeEvidence: ["git diff -- src/lib/decision"],
				evidenceRefs: gateEvidence("simplify-report", "skill"),
				reuseReviewed: true,
				qualityReviewed: true,
				efficiencyReviewed: true,
			}),
			createTestingReviewerGateResult({
				scopeEvidence: ["artifacts/reviews/testing-reviewer.md"],
				evidenceRefs: gateEvidence("testing-reviewer-report", "subagent"),
				testAdequacyReviewed: true,
			}),
			createHeFixBugsGateResult({
				status: "not_applicable",
				reason: "No failing validation evidence is present.",
				scopeEvidence: [
					"pnpm vitest run src/lib/decision/he-phase-exit.test.ts",
				],
				evidenceRefs: gateEvidence("validation-pass", "command"),
			}),
			createHeCodeReviewGateResult({
				scopeEvidence: ["artifacts/reviews/he-code-review.md"],
				evidenceRefs: gateEvidence("he-code-review-report", "review"),
				findingsFirst: true,
				traceabilityReviewed: true,
				blockerClassification: true,
				safeToContinueReviewed: true,
			}),
		];

		for (const gate of gates) expectValidGate(gate);

		const decision = aggregateHePhaseExit({
			phaseContext: {
				phase: "closeout",
				failingEvidencePresent: false,
				reviewFeedbackPresent: false,
			},
			requiredGates: [
				"simplify",
				"testing_reviewer",
				"he_fix_bugs",
				"he_code_review",
			],
			optionalGates: [],
			gates,
		});

		expect(validateHePhaseExit(decision)).toEqual({ valid: true, errors: [] });
		expect(decision).toMatchObject({
			recommendation: "continue",
			commitAllowed: true,
			exitAllowed: true,
			blockers: [],
		});
	});

	it("represents a blocked review artifact without violating gate structure", () => {
		const gate = createHeCodeReviewGateResult({
			status: "blocked",
			blockedReason: "he_code_review found an unresolved high-severity issue",
			scopeEvidence: ["artifacts/reviews/he-code-review.md"],
			evidenceRefs: gateEvidence("he-code-review-report", "review"),
			findingsFirst: true,
			traceabilityReviewed: true,
			blockerClassification: true,
			safeToContinueReviewed: false,
		});

		expectValidGate(gate);
		expect(gate.findings).toEqual([
			expect.objectContaining({
				id: "he_code_review-adapter-blocker",
				status: "open",
				evidenceRef: "he-code-review-report",
			}),
		]);

		const decision = aggregateHePhaseExit({
			phaseContext: {
				phase: "closeout",
				failingEvidencePresent: false,
				reviewFeedbackPresent: false,
			},
			requiredGates: ["he_code_review"],
			optionalGates: [],
			gates: [gate],
		});

		expect(decision).toMatchObject({
			recommendation: "commit_blocked",
			commitAllowed: false,
			exitAllowed: false,
			blockers: ["he_code_review found an unresolved high-severity issue"],
		});
	});

	it("fails closed when an adapter receives only non-gate evidence", () => {
		const gate = createSimplifyGateResult({
			scopeEvidence: ["route-decision/v1"],
			evidenceRefs: [
				{
					id: "route-context",
					kind: "route-decision",
					ref: "route-decision/v1:closeout",
					gateLocal: false,
				},
			],
			reuseReviewed: true,
			qualityReviewed: true,
			efficiencyReviewed: true,
		});

		expectValidGate(gate);
		expect(gate).toMatchObject({
			gateId: "simplify",
			status: "not_run",
			safeToContinue: false,
			blockedReason: "simplify gate has no gate-local evidence source",
		});
	});

	it("maps bug-fix repair evidence when failing evidence makes the gate required", () => {
		const gate = createHeFixBugsGateResult({
			scopeEvidence: ["pnpm vitest run src/lib/foo.test.ts"],
			evidenceRefs: gateEvidence("bugfix-validation", "command"),
			reproductionEvidence: ["pnpm vitest run src/lib/foo.test.ts --runInBand"],
			rootCause:
				"A stale phase-exit blocker was not normalized before aggregation.",
			regressionProtection: ["src/lib/decision/he-phase-exit-adapters.test.ts"],
			rollbackNote:
				"Revert the adapter change and preserve the failing fixture.",
		});

		expectValidGate(gate);
		expect(
			validateHePhaseExitInput({
				phaseContext: {
					phase: "closeout",
					failingEvidencePresent: true,
					reviewFeedbackPresent: false,
				},
				requiredGates: ["he_fix_bugs"],
				optionalGates: [],
				gates: [gate],
			}),
		).toEqual({ valid: true, errors: [] });
	});

	it("maps autofix inventory only when all review feedback is accounted for", () => {
		const gate = createAutofixGateResult({
			scopeEvidence: ["coderabbit unresolved review threads"],
			evidenceRefs: gateEvidence("autofix-report", "review"),
			feedbackInventory: ["CR-1", "CR-2"],
			accountedItems: 2,
		});

		expectValidGate(gate);
		expect(
			validateHePhaseExitInput({
				phaseContext: {
					phase: "closeout",
					failingEvidencePresent: false,
					reviewFeedbackPresent: true,
				},
				requiredGates: ["autofix"],
				optionalGates: [],
				gates: [gate],
			}),
		).toEqual({ valid: true, errors: [] });
	});
});
