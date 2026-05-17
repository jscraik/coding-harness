import { describe, expect, it } from "vitest";
import {
	HE_GATE_RESULT_SCHEMA_VERSION,
	HE_PHASE_EXIT_SCHEMA_VERSION,
	type HeGateId,
	type HeGatePayload,
	type HeGateResult,
	type HePhaseExit,
} from "./decision/he-phase-exit.js";
import { buildPrCloseoutReport, type PrCloseoutInput } from "./pr-closeout.js";

function gatePayload(gateId: HeGateId): HeGatePayload {
	switch (gateId) {
		case "simplify":
			return {
				scopeEvidence: ["artifacts/reviews/simplify.md"],
				reuseReviewed: true,
				qualityReviewed: true,
				efficiencyReviewed: true,
			};
		case "improve_codebase_architecture":
			return {
				scopeEvidence: ["artifacts/reviews/architecture.md"],
				complexitySymptomsNamed: true,
				patchVsInterfaceCompared: true,
				tracerProofRecorded: true,
				decisionSurfaceRecorded: true,
			};
		case "unslopify":
			return {
				scopeEvidence: ["artifacts/reviews/unslopify.md"],
				cleanupLedgerRecorded: true,
				removalEvidenceRecorded: true,
				validationRecorded: true,
				rollbackAndResidualRiskRecorded: true,
			};
		case "ubiquitous_language":
			return {
				scopeEvidence: ["UBIQUITOUS_LANGUAGE.md"],
				glossaryReviewed: true,
				canonicalTermsApplied: true,
				promptTranslationsUpdated: true,
				instructionPointerChecked: true,
			};
		case "testing_reviewer":
			return {
				scopeEvidence: ["artifacts/reviews/testing-reviewer.md"],
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
				scopeEvidence: ["artifacts/reviews/he-code-review.md"],
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
			gateId === "testing_reviewer"
				? "subagent_proxy"
				: gateId === "he_fix_bugs" || gateId === "autofix"
					? "not_applicable"
					: "direct_skill",
		status:
			gateId === "he_fix_bugs" || gateId === "autofix"
				? "not_applicable"
				: "pass",
		payload: gatePayload(gateId),
		evidenceRefs: [
			{
				id: `${gateId}-evidence`,
				kind: "artifact",
				ref: `artifact:${gateId}`,
				gateLocal: true,
			},
		],
		findings: [],
		actions: [],
		validation: [],
		requiresHuman: false,
		safeToContinue: true,
		reason:
			gateId === "he_fix_bugs" || gateId === "autofix"
				? `${gateId} not applicable to this closeout.`
				: null,
		blockedReason: null,
	};
}

function passingPhaseExit(): HePhaseExit {
	return {
		schemaVersion: HE_PHASE_EXIT_SCHEMA_VERSION,
		phaseContext: {
			phase: "closeout",
			failingEvidencePresent: false,
			reviewFeedbackPresent: false,
		},
		recommendation: "continue",
		commitAllowed: true,
		exitAllowed: true,
		blockers: [],
		warnings: [],
		gates: [
			passingGate("simplify"),
			passingGate("improve_codebase_architecture"),
			passingGate("unslopify"),
			passingGate("testing_reviewer"),
			passingGate("he_fix_bugs"),
			passingGate("he_code_review"),
			passingGate("autofix", false),
			passingGate("ubiquitous_language", false),
		],
	};
}

function baseInput(overrides: Partial<PrCloseoutInput> = {}): PrCloseoutInput {
	return {
		pullRequest: {
			number: 258,
			state: "OPEN",
			isDraft: false,
			mergeStateStatus: "CLEAN",
			url: "https://github.com/jscraik/coding-harness/pull/258",
			reviewDecision: "APPROVED",
			body: "Refs JSC-327\n",
		},
		branch: {
			clean: true,
			pushed: true,
			behindBase: false,
			hasConflicts: false,
		},
		checks: [
			{
				name: "pr-pipeline",
				state: "SUCCESS",
				source: "github",
			},
		],
		reviewThreads: {
			unresolved: 0,
			needsHuman: 0,
			autofixable: 0,
		},
		traceability: {
			sessionIds: ["codex-session:2026-05-16"],
			traceIds: ["circleci:workflow-123"],
			aiSessionTraceability:
				"JSC-327 -> PR #258 -> Codex session -> commit -> validation",
		},
		phaseExit: passingPhaseExit(),
		tools: [
			{
				name: "github_cli",
				available: true,
				ref: "command:gh --version",
				status: "usable",
				failureClass: null,
			},
		],
		...overrides,
	};
}

describe("buildPrCloseoutReport", () => {
	it("marks a fully evidenced PR ready to merge", () => {
		const report = buildPrCloseoutReport(baseInput(), {
			now: new Date("2026-05-16T12:00:00.000Z"),
		});

		expect(report).toMatchObject({
			schemaVersion: "pr-closeout/v1",
			generatedAt: "2026-05-16T12:00:00.000Z",
			pr: 258,
			status: "ready",
			mergeable: true,
			nextAction: "ready_to_merge",
			checks: {
				total: 1,
				failed: 0,
				pending: 0,
				passed: 1,
				unknown: 0,
			},
			traceability: {
				complete: true,
			},
		});
		expect(report.blockers).toEqual([]);
	});

	it("classifies failed checks and missing traceability as Codex-fixable", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				checks: [{ name: "linear-gate", state: "FAILURE", source: "github" }],
				traceability: {
					sessionIds: [],
					traceIds: [],
					aiSessionTraceability: null,
				},
			}),
		);

		expect(report.status).toBe("fixable");
		expect(report.nextAction).toBe("codex_can_fix_now");
		expect(report.mergeable).toBe(false);
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "checks",
					reason: "Check failed: linear-gate.",
					fixableByCodex: true,
				}),
				expect.objectContaining({
					surface: "traceability",
					fixableByCodex: true,
				}),
			]),
		);
	});

	it("blocks closeout when coding-harness gate evidence is missing", () => {
		const input = baseInput();
		delete input.phaseExit;
		const report = buildPrCloseoutReport(input);

		expect(report.status).toBe("fixable");
		expect(report.nextAction).toBe("codex_can_fix_now");
		expect(report.harnessGates).toMatchObject({
			phaseExitPresent: false,
			recommendation: "missing",
			commitAllowed: false,
			exitAllowed: false,
		});
		expect(report.harnessGates.gates).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					gateId: "autofix",
					required: false,
					status: "missing",
				}),
				expect.objectContaining({
					gateId: "unslopify",
					required: true,
					status: "missing",
				}),
			]),
		);
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "harness_gates",
					reason:
						"Coding-harness closeout gates are missing HePhaseExit/v1 evidence.",
					fixableByCodex: true,
				}),
			]),
		);
	});

	it("blocks closeout when required coding-harness gates are not run", () => {
		const phaseExit = passingPhaseExit();
		phaseExit.commitAllowed = false;
		phaseExit.exitAllowed = false;
		phaseExit.recommendation = "commit_blocked";
		phaseExit.blockers = ["unslopify gate has no gate-local evidence source"];
		phaseExit.gates = phaseExit.gates.map((gate) =>
			gate.gateId === "unslopify"
				? {
						...gate,
						status: "not_run",
						executionMode: "not_run",
						safeToContinue: false,
						reason: "unslopify gate has no gate-local evidence source",
					}
				: gate,
		);

		const report = buildPrCloseoutReport(baseInput({ phaseExit }));

		expect(report.status).toBe("fixable");
		expect(report.harnessGates.gates).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					gateId: "unslopify",
					status: "not_run",
				}),
			]),
		);
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "harness_gates",
					reason: "unslopify gate has no gate-local evidence source",
				}),
			]),
		);
	});

	it("blocks omitted default coding-harness gates", () => {
		const phaseExit = passingPhaseExit();
		phaseExit.gates = [passingGate("simplify")];

		const report = buildPrCloseoutReport(baseInput({ phaseExit }));

		expect(report.status).toBe("fixable");
		expect(report.nextAction).toBe("codex_can_fix_now");
		expect(report.harnessGates.gates).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					gateId: "unslopify",
					status: "missing",
					required: true,
				}),
			]),
		);
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "harness_gates",
					reason: "unslopify gate is missing from HePhaseExit/v1 evidence.",
					fixableByCodex: true,
				}),
			]),
		);
	});

	it("derives default gate requiredness from the canonical contract", () => {
		const phaseExit = passingPhaseExit();
		phaseExit.commitAllowed = false;
		phaseExit.exitAllowed = false;
		phaseExit.recommendation = "commit_blocked";
		phaseExit.gates = phaseExit.gates.map((gate) =>
			gate.gateId === "unslopify"
				? {
						...gate,
						required: false,
						status: "not_run",
						executionMode: "not_run",
						safeToContinue: false,
						reason: "unslopify gate was malformed as optional",
					}
				: gate,
		);

		const report = buildPrCloseoutReport(baseInput({ phaseExit }));

		expect(report.status).toBe("fixable");
		expect(report.nextAction).toBe("codex_can_fix_now");
		expect(report.harnessGates.gates).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					gateId: "unslopify",
					required: true,
					status: "not_run",
				}),
			]),
		);
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "harness_gates",
					reason: "unslopify gate was malformed as optional",
					fixableByCodex: true,
				}),
			]),
		);
	});

	it("keeps omitted conditional coding-harness gates non-blocking", () => {
		const phaseExit = passingPhaseExit();
		phaseExit.gates = phaseExit.gates.filter(
			(gate) =>
				gate.gateId !== "autofix" && gate.gateId !== "ubiquitous_language",
		);

		const report = buildPrCloseoutReport(baseInput({ phaseExit }));

		expect(report.status).toBe("ready");
		expect(report.nextAction).toBe("ready_to_merge");
		expect(report.harnessGates.gates).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					gateId: "ubiquitous_language",
					status: "missing",
					required: false,
					blocker: null,
				}),
			]),
		);
		expect(report.blockers).toEqual([]);
	});

	it("honors required conditional gates from phase-exit evidence", () => {
		const phaseExit = passingPhaseExit();
		phaseExit.commitAllowed = false;
		phaseExit.exitAllowed = false;
		phaseExit.recommendation = "commit_blocked";
		phaseExit.phaseContext.reviewFeedbackPresent = true;
		phaseExit.gates = phaseExit.gates.map((gate) =>
			gate.gateId === "autofix"
				? {
						...gate,
						required: true,
						status: "not_run",
						executionMode: "not_run",
						safeToContinue: false,
						reason: "autofix required by unresolved review feedback",
					}
				: gate,
		);

		const report = buildPrCloseoutReport(baseInput({ phaseExit }));

		expect(report.status).toBe("fixable");
		expect(report.nextAction).toBe("codex_can_fix_now");
		expect(report.harnessGates.gates).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					gateId: "autofix",
					required: true,
					status: "not_run",
				}),
			]),
		);
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "harness_gates",
					reason: "autofix required by unresolved review feedback",
					fixableByCodex: true,
				}),
			]),
		);
	});

	it("does not route blocked harness gates to Codex by default", () => {
		const phaseExit = passingPhaseExit();
		phaseExit.commitAllowed = false;
		phaseExit.exitAllowed = false;
		phaseExit.recommendation = "commit_blocked";
		phaseExit.gates = phaseExit.gates.map((gate) =>
			gate.gateId === "he_code_review"
				? {
						...gate,
						status: "blocked",
						safeToContinue: false,
						blockedReason: "review dependency unavailable",
					}
				: gate,
		);

		const report = buildPrCloseoutReport(baseInput({ phaseExit }));

		expect(report.status).toBe("blocked");
		expect(report.nextAction).toBe("needs_jamie_decision");
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "harness_gates",
					classification: "unknown",
					reason: "review dependency unavailable",
					fixableByCodex: false,
				}),
			]),
		);
	});

	it("routes failed harness gates to Codex when they are safe to continue", () => {
		const phaseExit = passingPhaseExit();
		phaseExit.commitAllowed = false;
		phaseExit.exitAllowed = false;
		phaseExit.recommendation = "commit_blocked";
		phaseExit.gates = phaseExit.gates.map((gate) =>
			gate.gateId === "he_code_review"
				? {
						...gate,
						status: "fail",
						safeToContinue: true,
						reason: "review findings need a targeted fix",
					}
				: gate,
		);

		const report = buildPrCloseoutReport(baseInput({ phaseExit }));

		expect(report.status).toBe("fixable");
		expect(report.nextAction).toBe("codex_can_fix_now");
		expect(report.harnessGates.gates).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					gateId: "he_code_review",
					status: "fail",
				}),
			]),
		);
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "harness_gates",
					classification: "introduced",
					reason: "review findings need a targeted fix",
					fixableByCodex: true,
				}),
			]),
		);
	});

	it("blocks top-level phase-exit denial even when all gate rows pass", () => {
		const phaseExit = passingPhaseExit();
		phaseExit.commitAllowed = false;
		phaseExit.exitAllowed = false;
		phaseExit.recommendation = "commit_blocked";
		phaseExit.blockers = ["phase exit denied by policy"];

		const report = buildPrCloseoutReport(baseInput({ phaseExit }));

		expect(report.status).toBe("blocked");
		expect(report.nextAction).toBe("needs_jamie_decision");
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "harness_gates",
					classification: "unknown",
					reason:
						"HePhaseExit/v1 denies closeout (recommendation=commit_blocked, commitAllowed=false, exitAllowed=false).",
					fixableByCodex: false,
				}),
			]),
		);
	});

	it("routes human-required harness gate blockers to Jamie", () => {
		const phaseExit = passingPhaseExit();
		phaseExit.commitAllowed = false;
		phaseExit.exitAllowed = false;
		phaseExit.recommendation = "human_review_required";
		phaseExit.gates = phaseExit.gates.map((gate) =>
			gate.gateId === "he_code_review"
				? {
						...gate,
						status: "blocked",
						requiresHuman: true,
						safeToContinue: false,
						blockedReason: "human review required before closeout",
					}
				: gate,
		);

		const report = buildPrCloseoutReport(baseInput({ phaseExit }));

		expect(report.status).toBe("needs_jamie");
		expect(report.nextAction).toBe("needs_jamie_decision");
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "harness_gates",
					classification: "needs_jamie_decision",
					reason: "human review required before closeout",
					fixableByCodex: false,
				}),
			]),
		);
	});

	it("prioritizes unrelated local noise as cleanup before closeout", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				dirtyPaths: [
					{
						path: "tmp/reference.md",
						classification: "unrelated_local_noise",
					},
				],
			}),
		);

		expect(report.status).toBe("cleanup_required");
		expect(report.nextAction).toBe("cleanup_before_continue");
		expect(report.blockers[0]).toMatchObject({
			surface: "worktree",
			classification: "unrelated_dirty_worktree",
			fixableByCodex: false,
		});
	});

	it("waits when checks are still pending", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				checks: [{ name: "pr-pipeline", state: "PENDING", source: "circleci" }],
			}),
		);

		expect(report.status).toBe("waiting");
		expect(report.nextAction).toBe("wait_for_external_check");
		expect(report.blockers[0]).toMatchObject({
			surface: "checks",
			classification: "external_service",
			fixableByCodex: false,
		});
	});

	it("prioritizes failed checks over pending checks", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				checks: [
					{ name: "security-scan", state: "PENDING", source: "circleci" },
					{ name: "lint", state: "FAILURE", source: "circleci" },
				],
			}),
		);

		expect(report.status).toBe("fixable");
		expect(report.nextAction).toBe("codex_can_fix_now");
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "checks",
					reason: "Check failed: lint.",
					fixableByCodex: true,
				}),
				expect.objectContaining({
					surface: "checks",
					reason: "Check is still pending: security-scan.",
					fixableByCodex: false,
				}),
			]),
		);
	});

	it("requires pushed branch evidence before closeout", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				branch: {
					clean: true,
					pushed: false,
					behindBase: false,
					hasConflicts: false,
				},
			}),
		);

		expect(report.status).toBe("cleanup_required");
		expect(report.nextAction).toBe("cleanup_before_continue");
		expect(report.blockers[0]).toMatchObject({
			surface: "branch",
			reason: "Branch has not been pushed to the remote PR head.",
			fixableByCodex: true,
		});
	});
});
