import { describe, expect, it } from "vitest";
import {
	HE_GATE_RESULT_SCHEMA_VERSION,
	HE_PHASE_EXIT_SCHEMA_VERSION,
	aggregateHePhaseExit,
	createMissingGateResult,
	type HeGateId,
	type HeGatePayload,
	type HeGateResult,
	type HePhaseContext,
	type HePhaseExitInput,
	validateHeGateResult,
	validateHePhaseExit,
	validateHePhaseExitInput,
} from "./he-phase-exit.js";

const closeoutContext: HePhaseContext = {
	phase: "closeout",
	failingEvidencePresent: false,
	reviewFeedbackPresent: false,
};

function evidence(gateId: HeGateId) {
	return [
		{
			id: `${gateId}-evidence`,
			kind: "skill",
			ref: `evidence:${gateId}`,
			gateLocal: true,
		},
	];
}

function payloadFor(gateId: HeGateId): HeGatePayload {
	switch (gateId) {
		case "simplify":
			return {
				scopeEvidence: ["git diff"],
				reuseReviewed: true,
				qualityReviewed: true,
				efficiencyReviewed: true,
			};
		case "testing_reviewer":
			return {
				scopeEvidence: ["test file"],
				testAdequacyReviewed: true,
				missingEdgeCases: [],
			};
		case "he_fix_bugs":
			return {
				scopeEvidence: ["validation passed"],
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
		evidenceRefs: evidence(gateId),
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
		evidenceRefs: [],
		validation: [],
		reason: `${gateId} not applicable to this phase`,
	};
}

function blockedGate(gateId: HeGateId, required = true): HeGateResult {
	return {
		...passingGate(gateId, required),
		status: "blocked",
		findings: [
			{
				id: `${gateId}-blocked`,
				severity: "high",
				status: "open",
				summary: `${gateId} is blocked`,
				evidenceRef: `${gateId}-evidence`,
			},
		],
		safeToContinue: false,
		blockedReason: `${gateId} blocker`,
	};
}

function gateWithExecutionMode(
	gateId: HeGateId,
	executionMode: HeGateResult["executionMode"],
	required = true,
): HeGateResult {
	return {
		...passingGate(gateId, required),
		executionMode,
	};
}

function input(overrides: Partial<HePhaseExitInput> = {}): HePhaseExitInput {
	return {
		phaseContext: closeoutContext,
		requiredGates: [
			"simplify",
			"testing_reviewer",
			"he_fix_bugs",
			"he_code_review",
		],
		optionalGates: ["autofix"],
		gates: [
			passingGate("simplify"),
			passingGate("testing_reviewer"),
			notApplicableGate("he_fix_bugs"),
			passingGate("he_code_review"),
			notApplicableGate("autofix", false),
		],
		...overrides,
	};
}

describe("validateHeGateResult", () => {
	it("accepts a complete simplify gate", () => {
		expect(validateHeGateResult(passingGate("simplify"))).toEqual({
			valid: true,
			errors: [],
		});
	});

	it("rejects route-decision metadata as gate proof", () => {
		const result = validateHeGateResult({
			...passingGate("simplify"),
			evidenceRefs: [
				{
					id: "route",
					kind: "route-decision",
					ref: "route-decision/v1:review",
					gateLocal: false,
				},
			],
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContain(
			"route-decision refs are context, not gate evidence",
		);
		expect(result.errors).toContain(
			"pass, fail, and blocked gates require at least one gate-local evidence ref",
		);
	});

	it("rejects incomplete simplify accounting", () => {
		const gate = passingGate("simplify");
		expect(
			validateHeGateResult({
				...gate,
				payload: { ...gate.payload, efficiencyReviewed: false },
			}).errors,
		).toContain("simplify must account for reuse, quality, and efficiency");
	});

	it("rejects incomplete he_code_review accounting", () => {
		const gate = passingGate("he_code_review");
		expect(
			validateHeGateResult({
				...gate,
				payload: { ...gate.payload, safeToContinueReviewed: false },
			}).errors,
		).toContain(
			"he_code_review must prove findings-first traceable blocker and safe-to-continue review",
		);
	});

	it("rejects failed or blocked gates without gate-local evidence", () => {
		for (const status of ["fail", "blocked"] as const) {
			const result = validateHeGateResult({
				...blockedGate("he_code_review"),
				status,
				evidenceRefs: [],
			});

			expect(result.valid).toBe(false);
			expect(result.errors).toContain(
				"pass, fail, and blocked gates require at least one gate-local evidence ref",
			);
		}
	});

	it("returns deterministic errors for failed or blocked gates with malformed findings", () => {
		for (const findings of [undefined, 1, null]) {
			const result = validateHeGateResult({
				...blockedGate("he_code_review"),
				findings,
			});

			expect(result.valid).toBe(false);
			expect(result.errors).toContain("findings must be an array");
			expect(result.errors).toContain(
				"failed or blocked gates require an open finding",
			);
		}
	});

	it("rejects blocked gates without an open finding or reason", () => {
		const result = validateHeGateResult({
			...passingGate("he_code_review"),
			status: "blocked",
			safeToContinue: false,
			findings: [],
			blockedReason: null,
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContain(
			"failed or blocked gates require an open finding",
		);
		expect(result.errors).toContain("blocked gates require blockedReason");
	});

	it("rejects not_applicable gates without a reason", () => {
		const result = validateHeGateResult({
			...notApplicableGate("he_fix_bugs"),
			reason: null,
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContain("not_applicable gates require reason");
	});

	it("rejects not_run gates without a reason", () => {
		const result = validateHeGateResult({
			...createMissingGateResult("he_code_review"),
			reason: null,
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContain("not_run gates require reason");
	});

	it("accepts manual review and validation-only execution modes with complete evidence", () => {
		for (const executionMode of ["manual_review", "validation_only"] as const) {
			expect(
				validateHeGateResult(
					gateWithExecutionMode("he_code_review", executionMode),
				),
			).toEqual({ valid: true, errors: [] });
		}
	});

	it("rejects executed statuses with non-executed execution modes", () => {
		const invalidGates: HeGateResult[] = [
			gateWithExecutionMode("simplify", "not_applicable"),
			{
				...blockedGate("he_code_review"),
				executionMode: "not_run",
			},
		];

		for (const gate of invalidGates) {
			const result = validateHeGateResult(gate);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain(
				"pass, fail, and blocked gates cannot have not_applicable or not_run executionMode",
			);
		}
	});
});

describe("validateHePhaseExitInput", () => {
	it("accepts complete configured gate evidence", () => {
		expect(validateHePhaseExitInput(input())).toEqual({
			valid: true,
			errors: [],
		});
	});

	it("returns deterministic errors for malformed gate configuration arrays", () => {
		const result = validateHePhaseExitInput({
			phaseContext: closeoutContext,
			requiredGates: 1,
			optionalGates: null,
			gates: [passingGate("simplify")],
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContain("requiredGates must be an array");
		expect(result.errors).toContain("optionalGates must be an array");
		expect(result.errors).toContain("gates[0].gateId must be configured");
	});

	it("rejects duplicate configured gates", () => {
		const result = validateHePhaseExitInput(
			input({
				requiredGates: ["simplify"],
				optionalGates: [],
				gates: [passingGate("simplify"), passingGate("simplify")],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContain("gates[1].gateId must be unique");
	});

	it("rejects gate required flags that disagree with configuration", () => {
		const result = validateHePhaseExitInput(
			input({
				requiredGates: ["simplify"],
				optionalGates: ["autofix"],
				gates: [passingGate("simplify", false), notApplicableGate("autofix")],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContain(
			"gates[0].required must match requiredGates",
		);
		expect(result.errors).toContain(
			"gates[1].required must match optionalGates",
		);
	});

	it("blocks he_fix_bugs not_applicable when failing evidence exists", () => {
		const result = validateHePhaseExitInput(
			input({
				phaseContext: {
					phase: "closeout",
					failingEvidencePresent: true,
					reviewFeedbackPresent: false,
				},
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContain(
			"he_fix_bugs cannot be not_applicable with failing evidence",
		);
	});

	it("requires he_fix_bugs in required gates when failing evidence exists", () => {
		const result = validateHePhaseExitInput(
			input({
				phaseContext: {
					phase: "closeout",
					failingEvidencePresent: true,
					reviewFeedbackPresent: false,
				},
				requiredGates: ["simplify", "testing_reviewer", "he_code_review"],
				optionalGates: ["he_fix_bugs", "autofix"],
				gates: [],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContain(
			"phaseContext.failingEvidencePresent requires he_fix_bugs in requiredGates",
		);
	});

	it("blocks he_fix_bugs execution when no failing evidence exists", () => {
		const result = validateHePhaseExitInput(
			input({
				gates: [
					passingGate("simplify"),
					passingGate("testing_reviewer"),
					passingGate("he_fix_bugs"),
					passingGate("he_code_review"),
				],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContain(
			"he_fix_bugs must not run without failing evidence",
		);
	});

	it("requires he_fix_bugs proof when failing evidence exists", () => {
		const result = validateHePhaseExitInput(
			input({
				phaseContext: {
					phase: "closeout",
					failingEvidencePresent: true,
					reviewFeedbackPresent: false,
				},
				gates: [
					passingGate("simplify"),
					passingGate("testing_reviewer"),
					passingGate("he_fix_bugs"),
					passingGate("he_code_review"),
				],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContain(
			"he_fix_bugs pass requires reproduction, root cause, regression protection, and rollback note",
		);
	});

	it("blocks autofix execution when no review feedback exists", () => {
		const result = validateHePhaseExitInput(
			input({
				gates: [
					passingGate("simplify"),
					passingGate("testing_reviewer"),
					notApplicableGate("he_fix_bugs"),
					passingGate("he_code_review"),
					passingGate("autofix", false),
				],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContain(
			"autofix must not run without review feedback",
		);
	});

	it("requires autofix inventory when review feedback exists", () => {
		const result = validateHePhaseExitInput(
			input({
				phaseContext: {
					phase: "closeout",
					failingEvidencePresent: false,
					reviewFeedbackPresent: true,
				},
				gates: [
					passingGate("simplify"),
					passingGate("testing_reviewer"),
					notApplicableGate("he_fix_bugs"),
					passingGate("he_code_review"),
					notApplicableGate("autofix", false),
				],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContain(
			"autofix cannot be not_applicable with review feedback",
		);
	});

	it("requires autofix in required gates when review feedback exists", () => {
		const result = validateHePhaseExitInput(
			input({
				phaseContext: {
					phase: "closeout",
					failingEvidencePresent: false,
					reviewFeedbackPresent: true,
				},
				requiredGates: [
					"simplify",
					"testing_reviewer",
					"he_fix_bugs",
					"he_code_review",
				],
				optionalGates: ["autofix"],
				gates: [],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContain(
			"phaseContext.reviewFeedbackPresent requires autofix in requiredGates",
		);
	});

	it("rejects unknown evidenceRefs.id", () => {
		const gateWithInvalidRef = passingGate("simplify");
		gateWithInvalidRef.findings = [
			{
				id: "finding-1",
				severity: "medium",
				status: "open",
				summary: "Test finding",
				evidenceRef: "missing-id",
			},
		];

		const result = validateHePhaseExitInput(
			input({
				gates: [gateWithInvalidRef],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContain("unknown evidenceRefs.id: missing-id");
	});

	it("rejects gate in both requiredGates and optionalGates", () => {
		const result = validateHePhaseExitInput(
			input({
				requiredGates: ["simplify"],
				optionalGates: ["simplify"],
				gates: [passingGate("simplify")],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContain(
			"gate cannot be both required and optional",
		);
	});

	it("accepts manual_review executionMode with gate-local evidence", () => {
		const gate = passingGate("he_code_review");
		const result = validateHePhaseExitInput(
			input({
				gates: [
					passingGate("simplify"),
					passingGate("testing_reviewer"),
					notApplicableGate("he_fix_bugs"),
					{ ...gate, executionMode: "manual_review" },
				],
			}),
		);

		expect(result.valid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it("rejects manual_review gates without gate-local evidence", () => {
		const gate = passingGate("he_code_review");
		const result = validateHePhaseExitInput(
			input({
				gates: [
					passingGate("simplify"),
					passingGate("testing_reviewer"),
					notApplicableGate("he_fix_bugs"),
					{
						...gate,
						executionMode: "manual_review",
						evidenceRefs: [],
					},
				],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContain(
			"pass, fail, and blocked gates require at least one gate-local evidence ref",
		);
	});

	it("accepts validation_only executionMode with gate-local evidence", () => {
		const gate = passingGate("simplify");
		const result = validateHePhaseExitInput(
			input({
				gates: [
					{ ...gate, executionMode: "validation_only" },
					passingGate("testing_reviewer"),
					notApplicableGate("he_fix_bugs"),
					passingGate("he_code_review"),
				],
			}),
		);

		expect(result.valid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it("rejects validation_only gates without gate-local evidence", () => {
		const gate = passingGate("simplify");
		const result = validateHePhaseExitInput(
			input({
				gates: [
					{
						...gate,
						executionMode: "validation_only",
						evidenceRefs: [],
					},
					passingGate("testing_reviewer"),
					notApplicableGate("he_fix_bugs"),
					passingGate("he_code_review"),
				],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContain(
			"pass, fail, and blocked gates require at least one gate-local evidence ref",
		);
	});
});

describe("aggregateHePhaseExit", () => {
	it("allows closeout commit when all required gates pass or are not applicable", () => {
		const result = aggregateHePhaseExit(input());

		expect(result).toMatchObject({
			schemaVersion: HE_PHASE_EXIT_SCHEMA_VERSION,
			recommendation: "continue",
			commitAllowed: true,
			exitAllowed: true,
			blockers: [],
			warnings: [],
		});
		expect(validateHePhaseExit(result)).toEqual({ valid: true, errors: [] });
	});

	it("synthesizes missing required gates and blocks commit", () => {
		const result = aggregateHePhaseExit(
			input({ gates: [passingGate("simplify")] }),
		);

		expect(result.recommendation).toBe("commit_blocked");
		expect(result.commitAllowed).toBe(false);
		expect(result.blockers).toContain("testing_reviewer gate has not run");
		expect(result.gates).toContainEqual(
			createMissingGateResult("he_code_review"),
		);
	});

	it("stops earlier lifecycle phases instead of returning commit_blocked", () => {
		const result = aggregateHePhaseExit(
			input({
				phaseContext: {
					phase: "route",
					failingEvidencePresent: false,
					reviewFeedbackPresent: false,
				},
				gates: [blockedGate("simplify")],
			}),
		);

		expect(result.recommendation).toBe("stop");
		expect(result.commitAllowed).toBe(false);
	});

	it("requires human review when a human-required gate is blocking", () => {
		const gate = { ...blockedGate("he_code_review"), requiresHuman: true };

		expect(
			aggregateHePhaseExit(
				input({
					gates: [
						passingGate("simplify"),
						passingGate("testing_reviewer"),
						notApplicableGate("he_fix_bugs"),
						gate,
					],
				}),
			).recommendation,
		).toBe("human_review_required");
	});

	it("does not let a forged optional required flag bypass configured required gates", () => {
		const result = aggregateHePhaseExit(
			input({
				requiredGates: ["simplify", "he_code_review"],
				optionalGates: ["autofix"],
				gates: [
					passingGate("simplify"),
					{ ...blockedGate("he_code_review"), required: false },
					notApplicableGate("autofix", false),
				],
			}),
		);

		expect(result.recommendation).toBe("commit_blocked");
		expect(result.blockers).toContain(
			"gates[1].required must match requiredGates",
		);
	});

	it("records optional gate failures as warnings only", () => {
		const result = aggregateHePhaseExit(
			input({
				requiredGates: ["simplify", "testing_reviewer", "he_fix_bugs"],
				optionalGates: ["he_code_review", "autofix"],
				gates: [
					passingGate("simplify"),
					passingGate("testing_reviewer"),
					notApplicableGate("he_fix_bugs"),
					blockedGate("he_code_review", false),
					notApplicableGate("autofix", false),
				],
			}),
		);

		expect(result.recommendation).toBe("continue");
		expect(result.commitAllowed).toBe(true);
		expect(result.warnings).toContain("he_code_review blocker");
	});

	it("records optional safe-to-continue failures as warnings only", () => {
		const result = aggregateHePhaseExit(
			input({
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
			}),
		);

		expect(result.recommendation).toBe("continue");
		expect(result.commitAllowed).toBe(true);
		expect(result.warnings).toContain("he_code_review is not safe to continue");
	});

	it("fails closed without throwing when aggregate input is malformed", () => {
		const result = aggregateHePhaseExit({
			phaseContext: null,
			gates: null,
		} as unknown as HePhaseExitInput);

		expect(result.recommendation).toBe("commit_blocked");
		expect(result.commitAllowed).toBe(false);
		expect(result.exitAllowed).toBe(false);
		expect(Array.isArray(result.blockers)).toBe(true);
	});

	it("allows commit when all required gates pass with manual_review executionMode", () => {
		const gate = passingGate("he_code_review");
		const result = aggregateHePhaseExit(
			input({
				gates: [
					passingGate("simplify"),
					passingGate("testing_reviewer"),
					notApplicableGate("he_fix_bugs"),
					{ ...gate, executionMode: "manual_review" },
				],
			}),
		);

		expect(result.recommendation).toBe("continue");
		expect(result.commitAllowed).toBe(true);
		expect(result.exitAllowed).toBe(true);
		expect(result.blockers).toEqual([]);
	});

	it("allows commit when all required gates pass with validation_only executionMode", () => {
		const gate = passingGate("simplify");
		const result = aggregateHePhaseExit(
			input({
				gates: [
					{ ...gate, executionMode: "validation_only" },
					passingGate("testing_reviewer"),
					notApplicableGate("he_fix_bugs"),
					passingGate("he_code_review"),
				],
			}),
		);

		expect(result.recommendation).toBe("continue");
		expect(result.commitAllowed).toBe(true);
		expect(result.exitAllowed).toBe(true);
		expect(result.blockers).toEqual([]);
	});
});
