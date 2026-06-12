import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import {
	HE_GATE_RESULT_SCHEMA_VERSION,
	HE_PHASE_EXIT_SCHEMA_VERSION,
	type HeGateId,
	type HeGatePayload,
	type HeGateResult,
	type HePhaseExit,
} from "./decision/he-phase-exit.js";
import type { EvidenceReceipt } from "./evidence/evidence-receipt.js";
import {
	buildPrCloseoutReport,
	buildPrCloseoutReportEffect,
	type PrCloseoutInput,
	type PrCloseoutDeliveryTruthVerdict,
} from "./pr-closeout.js";
import { expectBehavior } from "./testing/expect-behavior.js";

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
	const input: PrCloseoutInput = {
		pullRequest: {
			number: 258,
			state: "OPEN",
			isDraft: false,
			mergeStateStatus: "CLEAN",
			url: "https://github.com/jscraik/coding-harness/pull/258",
			headSha: "abc123",
			reviewDecision: "APPROVED",
			body: "Refs JSC-327\n",
		},
		branch: {
			clean: true,
			pushed: true,
			behindBase: false,
			hasConflicts: false,
			headSha: "abc123",
		},
		checks: [
			{
				name: "pr-pipeline",
				state: "SUCCESS",
				headSha: "abc123",
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
		rollback: {
			notApplicable: true,
			evidenceRef: "pr-body:rollback",
		},
		phaseExit: passingPhaseExit(),
		assurance: passingAssurance(),
		tools: [
			{
				name: "github_cli",
				available: true,
				ref: "command:gh --version",
				status: "usable",
				failureClass: null,
			},
		],
	};
	return { ...input, ...overrides } as PrCloseoutInput;
}

function passingAssurance(): NonNullable<PrCloseoutInput["assurance"]> {
	const base = {
		status: "pass" as const,
		evidence: ["closeout:evidence"],
	};
	return [
		{ ...base, layer: "unit" as const },
		{ ...base, layer: "boundary" as const },
		{ ...base, layer: "mock_integration" as const },
		{ ...base, layer: "e2e" as const },
		{ ...base, layer: "security" as const },
		{
			...base,
			layer: "load_stress" as const,
			threshold: {
				metric: "duration",
				operator: "<=" as const,
				unit: "ms",
				value: 1000,
			},
		},
		{
			...base,
			layer: "lifecycle_closeout" as const,
			lifecycleState: {
				automationState: "n.a.",
				branchWorktreeState: "clean",
				linearState: "aligned",
				mergeState: "ready",
				nextLaneRouting: "none",
				prState: "ready",
				reviewThreadState: "resolved",
			},
		},
	];
}

function deliveryTruthVerdict(
	overrides: Partial<PrCloseoutDeliveryTruthVerdict> = {},
): PrCloseoutDeliveryTruthVerdict {
	return {
		schemaVersion: "delivery-truth/v1",
		claim: "merge_ready",
		status: "pass",
		statusLabel: "merge_ready pass",
		source: "external_state",
		evidenceRef: "external-state:pr-258/checks",
		evidenceRefs: [
			"external-state:pr-258/checks",
			"review-state:pr-258/threads",
			"pr-closeout:pr-258/report",
		],
		blockerRefs: [],
		headSha: "abc123",
		verdictHeadSha: "abc123",
		freshness: "current",
		blockerClass: null,
		blockerCode: null,
		verifiedAt: "2026-05-16T12:00:00.000Z",
		evidenceUse: "claim_support",
		...overrides,
	};
}

function reviewArtifactReceipt(
	path: string,
	producer: string,
	overrides: Partial<EvidenceReceipt> = {},
): EvidenceReceipt {
	return {
		schemaVersion: "evidence-receipt/v1",
		kind: "review_artifact",
		ref: `review-state:${path}`,
		producer,
		status: "pass",
		freshness: "current",
		evidenceUse: "claim_support",
		blockerClass: null,
		verifiedAt: "2026-05-16T12:00:00.000Z",
		headSha: "abc123",
		sizeBytes: 2048,
		...overrides,
	};
}

describe("buildPrCloseoutReport", () => {
	it("marks a fully evidenced PR ready to merge", () => {
		const report = buildPrCloseoutReport(baseInput(), {
			now: new Date("2026-05-16T12:00:00.000Z"),
		});

		expectBehavior({
			given: "a fully evidenced PR closeout input",
			should: "produce a ready pr-closeout/v1 report",
			actual: {
				checks: report.checks,
				generatedAt: report.generatedAt,
				mergeable: report.mergeable,
				nextAction: report.nextAction,
				pr: report.pr,
				schemaVersion: report.schemaVersion,
				status: report.status,
				traceabilityComplete: report.traceability.complete,
			},
			expected: {
				checks: {
					failed: 0,
					passed: 1,
					pending: 0,
					total: 1,
					unknown: 0,
				},
				generatedAt: "2026-05-16T12:00:00.000Z",
				mergeable: true,
				nextAction: "ready_to_merge",
				pr: 258,
				schemaVersion: "pr-closeout/v1",
				status: "ready",
				traceabilityComplete: true,
			},
		});
		expectBehavior({
			given: "a fully evidenced PR closeout report",
			should: "mark the PR ready without blockers",
			actual: { status: report.status, blockers: report.blockers.length },
			expected: { status: "ready", blockers: 0 },
		});
		expect(report.blockers).toEqual([]);
		expect(report.attemptLedger).toMatchObject({
			schemaVersion: "attempt-ledger/v1",
			command: "pr-closeout",
			attempt: 1,
			maxAttempts: 1,
			firstFailure: null,
			retryDecision: "none",
			owner: "codex",
			stopReason: null,
			nextAction: "ready_to_merge",
		});
		expect(report.recoveryEvent).toBeNull();
		expect(report.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					claim: "tests_passed",
					status: "pass",
					evidenceRef: "check:pr-pipeline",
					headSha: "abc123",
					freshness: "current",
					blockerClass: null,
					verifiedAt: "2026-05-16T12:00:00.000Z",
				}),
				expect.objectContaining({
					claim: "required_checks_match_current_head",
					status: "pass",
					freshness: "current",
				}),
			]),
		);
	});

	it("sets lifecycle snapshot owner and resume guidance for pending checks", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				checks: [
					{
						name: "pr-pipeline",
						state: "PENDING",
						headSha: "abc123",
						source: "github",
					},
				],
			}),
			{ now: new Date("2026-05-16T12:00:00.000Z") },
		);

		expect(report.status).toBe("waiting");
		expect(report.lifecycleSnapshot.latestValidationBlocker).toMatchObject({
			failureClass: "external_service",
			reason: "Check is still pending: pr-pipeline.",
			resumeCommand: null,
		});
		expect(report.lifecycleSnapshot.continuation).toMatchObject({
			waitingOwner: "external_service",
		});
		expect(report.lifecycleSnapshot.lanes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					lane: "ci_state",
					owner: "external_service",
					blockerClass: "external_service",
				}),
			]),
		);
	});

	it("sets lifecycle snapshot resume guidance for harness gate blockers", () => {
		const phaseExit = passingPhaseExit();
		phaseExit.commitAllowed = false;
		phaseExit.exitAllowed = false;
		phaseExit.gates = phaseExit.gates.map((gate) =>
			gate.gateId === "he_code_review"
				? {
						...gate,
						status: "fail",
						blockedReason: "Independent review gate failed.",
					}
				: gate,
		);
		const report = buildPrCloseoutReport(baseInput({ phaseExit }), {
			now: new Date("2026-05-16T12:00:00.000Z"),
		});

		expect(report.lifecycleSnapshot.latestValidationBlocker).toMatchObject({
			failureClass: "introduced",
			reason: "Independent review gate failed.",
			resumeCommand: "bash scripts/verify-work.sh --resume",
		});
		expect(report.lifecycleSnapshot.handoffRequiredEvidence).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					lane: "local_validation",
					sourceOfTruth: "harness-gates",
				}),
			]),
		);
	});

	it("routes lifecycle snapshot ownership for human review blockers", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				reviewThreads: {
					unresolved: 2,
					needsHuman: 1,
					autofixable: 1,
				},
			}),
			{ now: new Date("2026-05-16T12:00:00.000Z") },
		);

		expect(report.status).toBe("needs_jamie");
		expect(report.lifecycleSnapshot.continuation.waitingOwner).toBe("reviewer");
		expect(report.lifecycleSnapshot.lanes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					lane: "review_state",
					owner: "operator",
					blockerClass: "needs_jamie_decision",
				}),
			]),
		);
	});

	it.each([
		{ status: "missing" as const, fixableByCodex: true },
		{ status: "empty" as const, fixableByCodex: true },
		{ status: "unknown" as const, fixableByCodex: true },
		{ status: "ignored_runtime_path" as const, fixableByCodex: false },
	])("classifies review artifact status $status as fixable=$fixableByCodex", ({
		status,
		fixableByCodex,
	}) => {
		const path = `.harness/review/pr-258-${status}.md`;
		const report = buildPrCloseoutReport(
			baseInput({
				reviewArtifacts: [
					{
						path,
						producer: "harness-product-code-reviewer",
						status,
					},
				],
			}),
			{ now: new Date("2026-05-16T12:00:00.000Z") },
		);

		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "review_artifact",
					reason: `Review artifact ${path} is ${status}.`,
					fixableByCodex,
				}),
			]),
		);
	});

	it("blocks present review artifacts that lack matching verifier proof", () => {
		const path = ".harness/review/pr-258-reviewer.md";
		const report = buildPrCloseoutReport(
			baseInput({
				reviewArtifacts: [
					{
						path,
						producer: "harness-product-code-reviewer",
						status: "present",
						evidenceRef: `artifact:${path}`,
					},
				],
			}),
			{ now: new Date("2026-05-16T12:00:00.000Z") },
		);

		expect(report.status).toBe("fixable");
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "review_artifact",
					reason: `Review artifact ${path} is present but lacks matching verifier proof.`,
					fixableByCodex: true,
					ref: `artifact:${path}`,
				}),
			]),
		);
		expect(report.lifecycleSnapshot.continuation.waitingOwner).toBe("reviewer");
	});

	it("accepts present review artifacts only when matching proof is receipt-backed", () => {
		const path = ".harness/review/pr-258-reviewer.md";
		const producer = "harness-product-code-reviewer";
		const report = buildPrCloseoutReport(
			baseInput({
				reviewArtifacts: [
					{
						path,
						producer,
						status: "present",
						evidenceRef: `artifact:${path}`,
					},
				],
				reviewerArtifactProofs: [
					{
						path,
						producer,
						evidenceVerified: true,
						receipt: reviewArtifactReceipt(path, producer),
					},
				],
			}),
			{ now: new Date("2026-05-16T12:00:00.000Z") },
		);

		expect(report.status).toBe("ready");
		expect(report.blockers).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "review_artifact",
				}),
			]),
		);
	});

	it("blocks boolean-only review artifact proofs without receipt-backed evidence", () => {
		const path = ".harness/review/pr-258-reviewer.md";
		const producer = "harness-product-code-reviewer";
		const report = buildPrCloseoutReport(
			baseInput({
				reviewArtifacts: [
					{
						path,
						producer,
						status: "present",
						evidenceRef: `artifact:${path}`,
					},
				],
				reviewerArtifactProofs: [
					{
						path,
						producer,
						evidenceVerified: true,
						receipt: `artifact-proof:${path}` as unknown as EvidenceReceipt,
					},
				],
			}),
			{ now: new Date("2026-05-16T12:00:00.000Z") },
		);

		expect(report.status).toBe("fixable");
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "review_artifact",
					reason: `Review artifact ${path} is present but its verifier proof is not backed by a current claim-support receipt.`,
					ref: `artifact:${path}`,
				}),
			]),
		);
	});

	it("blocks malformed review artifact proofs with null receipts without throwing", () => {
		const path = ".harness/review/pr-258-reviewer.md";
		const producer = "harness-product-code-reviewer";
		const report = buildPrCloseoutReport(
			baseInput({
				reviewArtifacts: [
					{
						path,
						producer,
						status: "present",
						evidenceRef: `artifact:${path}`,
					},
				],
				reviewerArtifactProofs: [
					{
						path,
						producer,
						evidenceVerified: true,
						receipt: null as unknown as EvidenceReceipt,
					},
				],
			}),
			{ now: new Date("2026-05-16T12:00:00.000Z") },
		);

		expect(report.status).toBe("fixable");
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "review_artifact",
					reason: `Review artifact ${path} is present but its verifier proof is not backed by a current claim-support receipt.`,
					ref: `artifact:${path}`,
				}),
			]),
		);
	});

	it("blocks review artifact proofs generated for a different PR head", () => {
		const path = ".harness/review/pr-258-reviewer.md";
		const producer = "harness-product-code-reviewer";
		const report = buildPrCloseoutReport(
			baseInput({
				reviewArtifacts: [
					{
						path,
						producer,
						status: "present",
						evidenceRef: `artifact:${path}`,
					},
				],
				reviewerArtifactProofs: [
					{
						path,
						producer,
						evidenceVerified: true,
						receipt: reviewArtifactReceipt(path, producer, {
							headSha: "previous-head",
						}),
					},
				],
			}),
			{ now: new Date("2026-05-16T12:00:00.000Z") },
		);

		expect(report.status).toBe("fixable");
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "review_artifact",
					reason: `Review artifact ${path} is present but its verifier proof is not backed by a current claim-support receipt.`,
					ref: `review-state:${path}`,
				}),
			]),
		);
	});

	it("compares review artifact proof receipts against the branch head when PR head is missing", () => {
		const path = ".harness/review/pr-258-reviewer.md";
		const producer = "harness-product-code-reviewer";
		const report = buildPrCloseoutReport(
			baseInput({
				pullRequest: {
					...baseInput().pullRequest,
					headSha: null,
				},
				branch: {
					...baseInput().branch,
					headSha: "current-branch-head",
				},
				reviewArtifacts: [
					{
						path,
						producer,
						status: "present",
						evidenceRef: `artifact:${path}`,
					},
				],
				reviewerArtifactProofs: [
					{
						path,
						producer,
						evidenceVerified: true,
						receipt: reviewArtifactReceipt(path, producer, {
							headSha: "previous-head",
						}),
					},
				],
			}),
			{ now: new Date("2026-05-16T12:00:00.000Z") },
		);

		expect(report.status).toBe("fixable");
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "review_artifact",
					reason: `Review artifact ${path} is present but its verifier proof is not backed by a current claim-support receipt.`,
					ref: `review-state:${path}`,
				}),
			]),
		);
	});

	it("blocks review artifact proofs without receipt timestamps", () => {
		const path = ".harness/review/pr-258-reviewer.md";
		const producer = "harness-product-code-reviewer";
		const {
			producedAt: _producedAt,
			verifiedAt: _verifiedAt,
			...receipt
		} = reviewArtifactReceipt(path, producer);
		const report = buildPrCloseoutReport(
			baseInput({
				reviewArtifacts: [
					{
						path,
						producer,
						status: "present",
						evidenceRef: `artifact:${path}`,
					},
				],
				reviewerArtifactProofs: [
					{
						path,
						producer,
						evidenceVerified: true,
						receipt,
					},
				],
			}),
			{ now: new Date("2026-05-16T12:00:00.000Z") },
		);

		expect(report.status).toBe("fixable");
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "review_artifact",
					reason: `Review artifact ${path} is present but its verifier proof is not backed by a current claim-support receipt.`,
					ref: `review-state:${path}`,
				}),
			]),
		);
	});

	it("blocks review artifact proofs with malformed receipt timestamps", () => {
		const path = ".harness/review/pr-258-reviewer.md";
		const producer = "harness-product-code-reviewer";
		const report = buildPrCloseoutReport(
			baseInput({
				reviewArtifacts: [
					{
						path,
						producer,
						status: "present",
						evidenceRef: `artifact:${path}`,
					},
				],
				reviewerArtifactProofs: [
					{
						path,
						producer,
						evidenceVerified: true,
						receipt: reviewArtifactReceipt(path, producer, {
							verifiedAt: "not-a-date",
						}),
					},
				],
			}),
			{ now: new Date("2026-05-16T12:00:00.000Z") },
		);

		expect(report.status).toBe("fixable");
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "review_artifact",
					reason: `Review artifact ${path} is present but its verifier proof is not backed by a current claim-support receipt.`,
					ref: `review-state:${path}`,
				}),
			]),
		);
	});

	it("blocks review artifact proofs with fractional receipt sizes", () => {
		const path = ".harness/review/pr-258-reviewer.md";
		const producer = "harness-product-code-reviewer";
		const report = buildPrCloseoutReport(
			baseInput({
				reviewArtifacts: [
					{
						path,
						producer,
						status: "present",
						evidenceRef: `artifact:${path}`,
					},
				],
				reviewerArtifactProofs: [
					{
						path,
						producer,
						evidenceVerified: true,
						receipt: reviewArtifactReceipt(path, producer, {
							sizeBytes: 0.5,
						}),
					},
				],
			}),
			{ now: new Date("2026-05-16T12:00:00.000Z") },
		);

		expect(report.status).toBe("fixable");
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "review_artifact",
					reason: `Review artifact ${path} is present but its verifier proof is not backed by a current claim-support receipt.`,
					ref: `review-state:${path}`,
				}),
			]),
		);
	});

	it.each([
		{
			name: "receipt ref",
			receiptOverride: {
				ref: "review-state:.harness/review/pr-258-reviewer.md\nraw prompt",
			},
		},
		{
			name: "receipt producer",
			receiptOverride: {
				producer: "harness-product-code-reviewer\ntoken=unsafe",
			},
		},
	] as const)("blocks review artifact proofs with unsafe $name pointers", ({
		receiptOverride,
	}) => {
		const path = ".harness/review/pr-258-reviewer.md";
		const producer = "harness-product-code-reviewer";
		const report = buildPrCloseoutReport(
			baseInput({
				reviewArtifacts: [
					{
						path,
						producer,
						status: "present",
						evidenceRef: `artifact:${path}`,
					},
				],
				reviewerArtifactProofs: [
					{
						path,
						producer,
						evidenceVerified: true,
						receipt: reviewArtifactReceipt(path, producer, receiptOverride),
					},
				],
			}),
			{ now: new Date("2026-05-16T12:00:00.000Z") },
		);

		expect(report.status).toBe("fixable");
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "review_artifact",
					reason: `Review artifact ${path} is present but its verifier proof is not backed by a current claim-support receipt.`,
				}),
			]),
		);
	});

	it("projects supplied delivery-truth verdicts without replacing closeout claims", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				deliveryTruth: [deliveryTruthVerdict()],
			}),
			{ now: new Date("2026-05-16T12:00:00.000Z") },
		);

		expect(report.status).toBe("ready");
		expect(report.deliveryTruth).toMatchObject({
			present: true,
			blockingVerdicts: [],
			mergeReady: expect.objectContaining({
				claim: "merge_ready",
				status: "pass",
				freshness: "current",
				verdictHeadSha: "abc123",
			}),
		});
		expect(report.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					claim: "tests_passed",
					status: "pass",
					evidenceRef: "check:pr-pipeline",
				}),
				expect.objectContaining({
					claim: "review_threads_resolved",
					status: "pass",
				}),
			]),
		);
	});

	it("derives only allowed state-packet delivery-truth claims when explicitly requested", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				pullRequest: {
					...baseInput().pullRequest,
					headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
					headRefName: "codex/jsc-363-closeout",
					baseRefName: "main",
				},
				checks: [
					{
						name: "ci/circleci: test",
						state: "SUCCESS",
						required: true,
						headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
						source: "circleci",
					},
				],
			}),
			{
				now: new Date("2026-05-16T12:00:00.000Z"),
				deriveDeliveryTruthFromStatePackets: {
					repository: "jscraik/coding-harness",
				},
			},
		);

		expect(report.deliveryTruth).toMatchObject({
			present: true,
			mergeReady: expect.objectContaining({
				claim: "merge_ready",
				status: "pass",
				freshness: "current",
			}),
		});
		expect(
			report.deliveryTruth.verdicts.map((verdict) => verdict.claim),
		).toEqual([
			"remote_checks_current",
			"review_threads_resolved",
			"linear_state_aligned",
			"merge_ready",
			"root_surface_tidy",
			"goal_ready_for_judge_pm",
		]);
		expect(report.deliveryTruth.blockingVerdicts).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					claim: "linear_state_aligned",
					status: "blocked",
					blockerCode: "non_claim_support_evidence",
				}),
				expect.objectContaining({
					claim: "root_surface_tidy",
					status: "unknown",
					blockerCode: "missing_evidence",
				}),
				expect.objectContaining({
					claim: "goal_ready_for_judge_pm",
					status: "unknown",
					blockerCode: "missing_evidence",
				}),
			]),
		);
		expect(report.deliveryTruth.verdicts).toEqual([
			expect.objectContaining({
				claim: "remote_checks_current",
				status: "pass",
				evidenceUse: "claim_support",
			}),
			expect.objectContaining({
				claim: "review_threads_resolved",
				status: "pass",
				evidenceUse: "claim_support",
			}),
			expect.objectContaining({
				claim: "linear_state_aligned",
				status: "blocked",
				evidenceUse: "orientation",
			}),
			expect.objectContaining({
				claim: "merge_ready",
				status: "pass",
				evidenceUse: "claim_support",
			}),
			expect.objectContaining({
				claim: "root_surface_tidy",
				status: "unknown",
				freshness: "missing",
			}),
			expect.objectContaining({
				claim: "goal_ready_for_judge_pm",
				status: "unknown",
				freshness: "missing",
			}),
		]);
	});

	it("blocks closeout when supplied delivery-truth evidence is stale", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				deliveryTruth: [
					deliveryTruthVerdict({
						status: "blocked",
						statusLabel: "merge_ready blocked: stale_evidence",
						freshness: "stale",
						blockerClass: "unknown",
						blockerCode: "stale_evidence",
					}),
				],
			}),
			{ now: new Date("2026-05-16T12:00:00.000Z") },
		);

		expect(report.status).toBe("blocked");
		expect(report.nextAction).toBe("needs_jamie_decision");
		expect(report.deliveryTruth.blockingVerdicts).toEqual([
			expect.objectContaining({
				claim: "merge_ready",
				status: "blocked",
				freshness: "stale",
			}),
		]);
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "delivery_truth",
					kind: "closeout_claim",
					reason:
						"Delivery-truth claim merge_ready has stale evidence for the current head.",
					ref: "external-state:pr-258/checks",
				}),
			]),
		);
		expect(report.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					claim: "ci_green",
					status: "pass",
				}),
			]),
		);
	});

	it("blocks closeout when supplied delivery-truth passes with stale freshness", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				deliveryTruth: [
					deliveryTruthVerdict({
						status: "pass",
						statusLabel: "merge_ready pass",
						freshness: "stale",
						blockerClass: "unknown",
						blockerCode: "stale_evidence",
					}),
				],
			}),
			{ now: new Date("2026-05-16T12:00:00.000Z") },
		);

		expect(report.status).not.toBe("ready");
		expect(report.deliveryTruth.blockingVerdicts).toEqual([
			expect.objectContaining({
				claim: "merge_ready",
				status: "pass",
				freshness: "stale",
			}),
		]);
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "delivery_truth",
					reason:
						"Delivery-truth claim merge_ready has stale evidence for the current head.",
				}),
			]),
		);
	});

	it("selects a blocking merge-ready verdict over an earlier passing duplicate", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				deliveryTruth: [
					deliveryTruthVerdict(),
					deliveryTruthVerdict({
						status: "pass",
						statusLabel: "merge_ready pass but stale",
						freshness: "stale",
						blockerClass: "unknown",
						blockerCode: "stale_evidence",
						evidenceRef: "external-state:pr-258/stale-checks",
						evidenceRefs: ["external-state:pr-258/stale-checks"],
					}),
				],
			}),
			{ now: new Date("2026-05-16T12:00:00.000Z") },
		);

		expect(report.status).toBe("blocked");
		expect(report.deliveryTruth.mergeReady).toEqual(
			expect.objectContaining({
				claim: "merge_ready",
				freshness: "stale",
				evidenceRef: "external-state:pr-258/stale-checks",
			}),
		);
		expect(report.deliveryTruth.blockingVerdicts).toEqual([
			expect.objectContaining({
				claim: "merge_ready",
				freshness: "stale",
			}),
		]);
	});

	it.each([
		{
			name: "not applicable merge readiness",
			claim: "merge_ready" as const,
			status: "not_applicable" as const,
			freshness: "current" as const,
			blockerClass: "unknown" as const,
			blockerCode: null,
			reason:
				"Delivery-truth claim merge_ready is not applicable and cannot support closeout.",
		},
		{
			name: "not applicable root hygiene",
			claim: "root_surface_tidy" as const,
			status: "not_applicable" as const,
			freshness: "current" as const,
			blockerClass: "unknown" as const,
			blockerCode: null,
			reason:
				"Delivery-truth claim root_surface_tidy is not applicable and cannot support closeout.",
		},
		{
			name: "missing evidence",
			claim: "merge_ready" as const,
			status: "unknown" as const,
			freshness: "missing" as const,
			blockerClass: "unknown" as const,
			blockerCode: "missing_evidence" as const,
			reason: "Delivery-truth claim merge_ready is missing required evidence.",
		},
		{
			name: "failed evidence",
			claim: "merge_ready" as const,
			status: "fail" as const,
			freshness: "current" as const,
			blockerClass: "unknown" as const,
			blockerCode: "receipt_failed" as const,
			reason: "Delivery-truth claim merge_ready failed verifier evidence.",
		},
		{
			name: "unknown evidence",
			claim: "merge_ready" as const,
			status: "unknown" as const,
			freshness: "unknown" as const,
			blockerClass: "unknown" as const,
			blockerCode: "unknown_evidence" as const,
			reason:
				"Delivery-truth claim merge_ready could not be proven from verifier evidence.",
		},
		{
			name: "introduced blocker with current failure",
			claim: "merge_ready" as const,
			status: "fail" as const,
			freshness: "current" as const,
			blockerClass: "introduced" as const,
			blockerCode: "receipt_failed" as const,
			reason: "Delivery-truth claim merge_ready failed verifier evidence.",
		},
	])("blocks closeout when supplied delivery-truth verdict has $name", ({
		claim,
		status,
		freshness,
		blockerClass,
		blockerCode,
		reason,
	}) => {
		const report = buildPrCloseoutReport(
			baseInput({
				deliveryTruth: [
					deliveryTruthVerdict({
						claim,
						status,
						statusLabel: `${claim} ${status}: ${blockerCode ?? "not_applicable"}`,
						freshness,
						blockerClass,
						blockerCode,
					}),
				],
			}),
			{ now: new Date("2026-05-16T12:00:00.000Z") },
		);

		expect(report.status).not.toBe("ready");
		expect(report.deliveryTruth.blockingVerdicts).toEqual([
			expect.objectContaining({
				claim,
				status,
				freshness,
			}),
		]);
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "delivery_truth",
					kind: "closeout_claim",
					reason,
					ref: "external-state:pr-258/checks",
					classification: blockerClass,
					fixableByCodex: expect.any(Boolean),
				}),
			]),
		);
	});

	it.each([
		{
			claim: "remote_checks_current" as const,
			source: "external_state" as const,
			evidenceRef: "external-state:pr-258/checks",
			reason:
				"Delivery-truth claim remote_checks_current is missing required evidence.",
		},
		{
			claim: "review_threads_resolved" as const,
			source: "review_state" as const,
			evidenceRef: "review-state:pr-258/threads",
			reason:
				"Delivery-truth claim review_threads_resolved is missing required evidence.",
		},
		{
			claim: "linear_state_aligned" as const,
			source: "external_state" as const,
			evidenceRef: "external-state:pr-258/linear",
			reason:
				"Delivery-truth claim linear_state_aligned is missing required evidence.",
		},
	])("blocks closeout when $claim verdict is unsupported independently", ({
		claim,
		source,
		evidenceRef,
		reason,
	}) => {
		const report = buildPrCloseoutReport(
			baseInput({
				deliveryTruth: [
					deliveryTruthVerdict({
						claim,
						status: "unknown",
						statusLabel: `${claim} unknown: missing_evidence`,
						source,
						evidenceRef,
						evidenceRefs: [evidenceRef],
						freshness: "missing",
						blockerClass: "unknown",
						blockerCode: "missing_evidence",
					}),
				],
			}),
			{ now: new Date("2026-05-16T12:00:00.000Z") },
		);

		expect(report.status).not.toBe("ready");
		expect(report.deliveryTruth.blockingVerdicts).toEqual([
			expect.objectContaining({
				claim,
				status: "unknown",
				freshness: "missing",
			}),
		]);
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "delivery_truth",
					kind: "closeout_claim",
					reason,
					ref: evidenceRef,
					fixableByCodex: true,
				}),
			]),
		);
	});

	it("blocks closeout when Judge/PM readiness is not supported", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				deliveryTruth: [
					deliveryTruthVerdict(),
					deliveryTruthVerdict({
						claim: "goal_ready_for_judge_pm",
						status: "fail",
						statusLabel: "goal_ready_for_judge_pm fail",
						source: "pr_closeout",
						evidenceRef: "pr-closeout:judge-pm-audit.json",
						evidenceRefs: ["pr-closeout:judge-pm-audit.json"],
						freshness: "current",
						blockerClass: "needs_jamie_decision",
						blockerCode: "receipt_failed",
					}),
				],
			}),
			{ now: new Date("2026-05-16T12:00:00.000Z") },
		);

		expect(report.status).not.toBe("ready");
		expect(report.deliveryTruth.verdicts).toHaveLength(2);
		expect(report.deliveryTruth.blockingVerdicts).toEqual([
			expect.objectContaining({
				claim: "goal_ready_for_judge_pm",
				status: "fail",
			}),
		]);
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "delivery_truth",
					kind: "closeout_claim",
					classification: "needs_jamie_decision",
					reason:
						"Delivery-truth claim goal_ready_for_judge_pm failed verifier evidence.",
					ref: "pr-closeout:judge-pm-audit.json",
					fixableByCodex: false,
				}),
			]),
		);
	});

	it("blocks closeout when a required delivery-truth claim is orientation-only", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				deliveryTruth: [
					deliveryTruthVerdict({
						evidenceUse: "orientation",
					}),
				],
			}),
			{ now: new Date("2026-05-16T12:00:00.000Z") },
		);

		expect(report.status).not.toBe("ready");
		expect(report.deliveryTruth.blockingVerdicts).toEqual([
			expect.objectContaining({
				claim: "merge_ready",
				evidenceUse: "orientation",
			}),
		]);
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "delivery_truth",
					kind: "closeout_claim",
					reason:
						"Delivery-truth claim merge_ready is not backed by claim-support evidence.",
					ref: "external-state:pr-258/checks",
				}),
			]),
		);
	});

	it("keeps the Effect API behind the same closeout evidence boundary", () => {
		const input = baseInput();
		const options = { now: new Date("2026-05-16T12:00:00.000Z") };
		const effectReport = Effect.runSync(
			buildPrCloseoutReportEffect(input, options),
		);

		// self-affirming-ok: pins sync/Effect boundary parity with adjacent
		// externally visible schema, status, and action assertions.
		expect(effectReport).toEqual(buildPrCloseoutReport(input, options));
		expect(effectReport).toMatchObject({
			schemaVersion: "pr-closeout/v1",
			status: "ready",
			nextAction: "ready_to_merge",
		});
	});

	it("blocks malformed runtime evidence without throwing", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				runtimeEvidence: {
					schemaVersion: "runtime-evidence-contract/v1",
				} as unknown as NonNullable<PrCloseoutInput["runtimeEvidence"]>,
			}),
		);

		expect(report.status).not.toBe("ready");
		expect(report.runtimeEvidence).toMatchObject({
			present: true,
			valid: false,
			verifierStatus: null,
			outcome: null,
			exitClassification: null,
		});
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "runtime_evidence",
					reason: "Runtime evidence is missing verifierResult.status.",
				}),
			]),
		);
	});

	it("accepts a single concrete session reference as traceability evidence", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				traceability: {
					sessionIds: ["codex-session:2026-05-16"],
					traceIds: [],
					aiSessionTraceability:
						"n.a. with reason: session ID is the concrete traceability reference.",
				},
			}),
		);

		expect(report.status).toBe("ready");
		expect(report.traceability.complete).toBe(true);
		expect(report.blockers).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ surface: "traceability" }),
			]),
		);
	});

	it("accepts a single concrete AI traceability reference", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				traceability: {
					sessionIds: [],
					traceIds: [],
					aiSessionTraceability:
						"Codex session validates PR closeout evidence.",
				},
			}),
		);

		expect(report.status).toBe("ready");
		expect(report.traceability.complete).toBe(true);
		expect(report.blockers).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ surface: "traceability" }),
			]),
		);
	});

	it("treats GitHub BEHIND merge state as stale branch evidence", () => {
		const input = baseInput();
		const report = buildPrCloseoutReport({
			...input,
			pullRequest: {
				...input.pullRequest,
				mergeStateStatus: "BEHIND",
			},
		});

		expect(report.status).not.toBe("ready");
		expect(report.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					claim: "branch_current_with_base",
					status: "fail",
					evidenceRef: "github:mergeStateStatus",
					freshness: "current",
				}),
			]),
		);
	});

	it("treats GitHub HAS_HOOKS merge state as current branch evidence", () => {
		const input = baseInput({
			branch: {
				clean: true,
				pushed: true,
				behindBase: null,
				hasConflicts: null,
				headSha: "abc123",
			},
		});
		const report = buildPrCloseoutReport({
			...input,
			pullRequest: {
				...input.pullRequest,
				mergeStateStatus: "HAS_HOOKS",
			},
		});

		expect(report.status).toBe("ready");
		expect(report.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					claim: "branch_current_with_base",
					status: "pass",
					evidenceRef: "github:mergeStateStatus",
					freshness: "current",
				}),
			]),
		);
	});

	it("blocks success when test evidence is missing", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				checks: [
					{
						name: "semgrep-cloud-platform/scan",
						state: "SUCCESS",
						headSha: "abc123",
						source: "github",
					},
				],
			}),
		);

		expect(report.status).not.toBe("ready");
		expect(report.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					claim: "tests_passed",
					status: "unknown",
					evidenceRef: null,
					freshness: "missing",
					missingContext: expect.objectContaining({
						class: "missing_verifier",
						destination: "validator",
					}),
				}),
			]),
		);
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "checks",
					reason: "Closeout claim tests_passed is missing required evidence.",
				}),
			]),
		);
	});

	it("blocks success when required check evidence is stale", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				checks: [
					{
						name: "pr-pipeline",
						state: "SUCCESS",
						headSha: "old456",
						source: "github",
					},
				],
			}),
		);

		expect(report.status).not.toBe("ready");
		expect(report.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					claim: "required_checks_match_current_head",
					status: "fail",
					headSha: "abc123",
					freshness: "stale",
					missingContext: expect.objectContaining({
						class: "unmodeled_current_state_dependency",
						destination: "validator",
					}),
				}),
			]),
		);
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "checks",
					reason:
						"Closeout claim required_checks_match_current_head has stale evidence for the current head.",
				}),
			]),
		);
	});

	it("blocks success when CI state is unknown", () => {
		const report = buildPrCloseoutReport(baseInput({ checks: [] }));

		expect(report.status).not.toBe("ready");
		expect(report.nextAction).toBe("codex_can_fix_now");
		expect(report.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					claim: "ci_green",
					status: "unknown",
					evidenceRef: null,
					freshness: "missing",
					missingContext: expect.objectContaining({
						class: "missing_verifier",
						destination: "validator",
					}),
				}),
			]),
		);
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "checks",
					fixableByCodex: true,
				}),
			]),
		);
		expect(report.attemptLedger).toMatchObject({
			firstFailure: {
				attempt: 1,
				status: "fixable",
				nextAction: "codex_can_fix_now",
			},
			retryDecision: "stop",
			owner: "codex",
			stopReason: "Closeout claim tests_passed is missing required evidence.",
			nextAction: "codex_can_fix_now",
		});
		expect(report.recoveryEvent).toMatchObject({
			schemaVersion: "recovery-event/v1",
			command: "pr-closeout",
			attempt: 1,
			owner: "codex",
			failureClass: "unknown",
			stopReason: "Closeout claim tests_passed is missing required evidence.",
			nextAction: "codex_can_fix_now",
			retryDecision: "stop",
		});
	});

	it("marks pending external checks as wait-owned recovery", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				checks: [
					{
						name: "pr-pipeline",
						state: "PENDING",
						headSha: "abc123",
						source: "github",
					},
				],
			}),
		);

		expect(report.status).toBe("waiting");
		expect(report.nextAction).toBe("wait_for_external_check");
		expect(report.attemptLedger).toMatchObject({
			retryDecision: "wait",
			owner: "external_service",
			firstFailure: {
				status: "waiting",
				nextAction: "wait_for_external_check",
			},
		});
		expect(report.recoveryEvent).toMatchObject({
			owner: "external_service",
			failureClass: "external_service",
			nextAction: "wait_for_external_check",
			retryDecision: "wait",
		});
	});

	it("blocks success when Linear tracker state is missing", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				pullRequest: {
					...baseInput().pullRequest,
					body: "No tracker reference yet.\n",
				},
			}),
		);

		expect(report.status).not.toBe("ready");
		expect(report.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					claim: "linear_tracker_state_aligned",
					status: "unknown",
					evidenceRef: null,
					freshness: "missing",
					missingContext: expect.objectContaining({
						class: "ambiguous_ownership_boundary",
						destination: "project_brain_learning",
					}),
				}),
			]),
		);
	});

	it("accepts Closes as PR tracker alignment evidence", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				pullRequest: {
					...baseInput().pullRequest,
					body: "Closes JSC-327\n",
				},
			}),
		);

		expect(report.status).toBe("ready");
		expect(report.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					claim: "linear_tracker_state_aligned",
					status: "pass",
					evidenceRef: "pr-body:linear-reference",
					freshness: "current",
				}),
			]),
		);
	});

	it("accepts Fixes as PR tracker alignment evidence", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				pullRequest: {
					...baseInput().pullRequest,
					body: "Fixes JSC-327\n",
				},
			}),
		);

		expect(report.status).toBe("ready");
		expect(report.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					claim: "linear_tracker_state_aligned",
					status: "pass",
					evidenceRef: "pr-body:linear-reference",
					freshness: "current",
				}),
			]),
		);
	});

	it("treats passing checks without SHA metadata as a verifier evidence gap", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				checks: [
					{
						name: "pr-pipeline",
						state: "SUCCESS",
						source: "github",
					},
				],
			}),
		);

		expect(report.status).toBe("fixable");
		expect(report.nextAction).toBe("codex_can_fix_now");
		expect(report.nextAction).not.toBe("wait_for_external_check");
		expect(report.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					claim: "ci_green",
					status: "blocked",
					freshness: "unknown",
					blockerClass: "unknown",
				}),
				expect.objectContaining({
					claim: "required_checks_match_current_head",
					status: "unknown",
					freshness: "unknown",
					blockerClass: "unknown",
				}),
			]),
		);
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "checks",
					fixableByCodex: true,
					reason:
						"Closeout claim ci_green could not be proven from verifier evidence.",
				}),
			]),
		);
	});

	it("blocks success when rollback evidence is missing", () => {
		const input = baseInput();
		delete input.rollback;
		const report = buildPrCloseoutReport(input);

		expect(report.status).not.toBe("ready");
		expect(report.status).toBe("fixable");
		expect(report.nextAction).toBe("codex_can_fix_now");
		expect(report.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					claim: "rollback_path_named_or_not_applicable",
					status: "unknown",
					evidenceRef: null,
					freshness: "missing",
					missingContext: expect.objectContaining({
						class: "missing_recovery_handler",
						destination: "roadmap_exception",
					}),
				}),
			]),
		);
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					ref: "rollback_path_named_or_not_applicable",
					fixableByCodex: true,
				}),
			]),
		);
	});

	it("derives passed test evidence from current required checks", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				checks: [
					{
						name: "build",
						state: "SUCCESS",
						headSha: "abc123",
						required: true,
						source: "github",
					},
				],
			}),
		);

		expect(report.status).toBe("ready");
		expect(report.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					claim: "tests_passed",
					status: "pass",
					evidenceRef: "check:build",
					freshness: "current",
				}),
			]),
		);
	});

	it.each([
		"NEUTRAL",
		"SKIPPED",
	] as const)("blocks required CI conclusions that are not explicit success: %s", (state) => {
		const report = buildPrCloseoutReport(
			baseInput({
				checks: [
					{
						name: "pr-pipeline",
						state,
						headSha: "abc123",
						required: true,
						source: "github",
					},
				],
			}),
		);

		expect(report.status).not.toBe("ready");
		expect(report.checks).toEqual({
			failed: 0,
			passed: 0,
			pending: 0,
			total: 1,
			unknown: 1,
		});
		expect(report.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					claim: "tests_passed",
					status: "blocked",
					evidenceRef: "check:pr-pipeline",
					freshness: "current",
				}),
				expect.objectContaining({
					claim: "ci_green",
					status: "blocked",
					evidenceRef: "check:pr-pipeline",
					freshness: "current",
				}),
				expect.objectContaining({
					claim: "required_checks_match_current_head",
					status: "pass",
				}),
			]),
		);
	});

	it.each([
		"NEUTRAL",
		"SKIPPED",
	] as const)("keeps optional CI conclusions diagnostic when required checks pass: %s", (state) => {
		const report = buildPrCloseoutReport(
			baseInput({
				checks: [
					{
						name: "pr-pipeline",
						state: "SUCCESS",
						headSha: "abc123",
						required: true,
						source: "github",
					},
					{
						name: "optional-tests",
						state,
						headSha: "abc123",
						required: false,
						source: "github",
					},
				],
			}),
		);

		expect(report.status).toBe("ready");
		expect(report.checks).toEqual({
			failed: 0,
			passed: 1,
			pending: 0,
			total: 2,
			unknown: 1,
		});
		expect(report.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					claim: "tests_passed",
					status: "pass",
					evidenceRef: "check:pr-pipeline",
					freshness: "current",
				}),
				expect.objectContaining({
					claim: "ci_green",
					status: "pass",
					evidenceRef: "check:pr-pipeline",
					freshness: "current",
				}),
			]),
		);
	});

	it.each([
		"NEUTRAL",
		"SKIPPED",
	] as const)("blocks required CI conclusions even when state is success: %s", (conclusion) => {
		const report = buildPrCloseoutReport(
			baseInput({
				checks: [
					{
						name: "pr-pipeline",
						conclusion,
						state: "SUCCESS",
						headSha: "abc123",
						required: true,
						source: "github",
					},
				],
			}),
		);

		expect(report.status).not.toBe("ready");
		expect(report.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					claim: "tests_passed",
					status: "blocked",
				}),
				expect.objectContaining({
					claim: "ci_green",
					status: "blocked",
				}),
			]),
		);
	});

	it.each([
		"NEUTRAL",
		"SKIPPED",
	] as const)("keeps optional CI conclusions diagnostic even when state is success: %s", (conclusion) => {
		const report = buildPrCloseoutReport(
			baseInput({
				checks: [
					{
						name: "pr-pipeline",
						state: "SUCCESS",
						headSha: "abc123",
						required: true,
						source: "github",
					},
					{
						name: "optional-tests",
						conclusion,
						state: "SUCCESS",
						headSha: "abc123",
						required: false,
						source: "github",
					},
				],
			}),
		);

		expect(report.status).toBe("ready");
		expect(report.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					claim: "tests_passed",
					status: "pass",
					evidenceRef: "check:pr-pipeline",
				}),
				expect.objectContaining({
					claim: "ci_green",
					status: "pass",
					evidenceRef: "check:pr-pipeline",
				}),
			]),
		);
	});

	it.each([
		{
			name: "passing conclusion overrides failed state",
			check: { conclusion: "SUCCESS", state: "FAILED" },
			expectedStatus: "ready",
			expectedClaimStatus: "pass",
		},
		{
			name: "non-passing conclusion overrides success state",
			check: { conclusion: "SKIPPED", state: "SUCCESS" },
			expectedStatus: "waiting",
			expectedClaimStatus: "blocked",
		},
	] as const)("uses conclusion before state for contradictory required CI payloads: $name", ({
		check,
		expectedStatus,
		expectedClaimStatus,
	}) => {
		const report = buildPrCloseoutReport(
			baseInput({
				checks: [
					{
						name: "pr-pipeline",
						...check,
						headSha: "abc123",
						required: true,
						source: "github",
					},
				],
			}),
		);

		expect(report.status).toBe(expectedStatus);
		expect(report.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					claim: "tests_passed",
					status: expectedClaimStatus,
					evidenceRef: "check:pr-pipeline",
				}),
				expect.objectContaining({
					claim: "ci_green",
					status: expectedClaimStatus,
					evidenceRef: "check:pr-pipeline",
				}),
			]),
		);
	});

	it.each([
		"CANCELLED",
		"TIMED_OUT",
	] as const)("fails required CI conclusions that are terminal failures: %s", (state) => {
		const report = buildPrCloseoutReport(
			baseInput({
				checks: [
					{
						name: "pr-pipeline",
						state,
						headSha: "abc123",
						required: true,
						source: "github",
					},
				],
			}),
		);

		expect(report.status).toBe("fixable");
		expect(report.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					claim: "tests_passed",
					status: "fail",
					evidenceRef: "check:pr-pipeline",
					freshness: "current",
				}),
				expect.objectContaining({
					claim: "ci_green",
					status: "fail",
					evidenceRef: "check:pr-pipeline",
					freshness: "current",
				}),
			]),
		);
	});

	it("marks first-class closeout-gates input without phase-exit presence", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				closeoutGates: passingPhaseExit(),
			}),
		);

		expect(report.status).toBe("ready");
		expect(report.harnessGates).toMatchObject({
			evidenceSource: "closeout_gates",
			closeoutGatesPresent: true,
			phaseExitPresent: false,
		});
	});

	it("keeps phase-exit normalized input as compatibility evidence", () => {
		const report = buildPrCloseoutReport(baseInput());

		expect(report.status).toBe("ready");
		expect(report.harnessGates).toMatchObject({
			evidenceSource: "phase_exit",
			closeoutGatesPresent: false,
			phaseExitPresent: true,
		});
	});

	it("fails closed when review thread state is unobserved", () => {
		const input = baseInput();
		delete input.reviewThreads;

		const report = buildPrCloseoutReport(input);

		expect(report.status).toBe("fixable");
		expect(report.nextAction).toBe("codex_can_fix_now");
		expect(report.reviewThreads.unresolved).toBeNull();
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "review",
					classification: "unknown",
					reason:
						"Review thread state is unobserved; live GitHub reviewThreads evidence is required before PR closeout.",
					fixableByCodex: true,
					ref: "github:reviewThreads",
				}),
			]),
		);
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
			closeoutGatesPresent: false,
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
						"Coding Harness closeout gates are missing closeout-gates evidence.",
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
					reason:
						"unslopify gate is missing from Coding Harness closeout-gates evidence.",
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
						"Coding Harness closeout gates deny closeout (recommendation=commit_blocked, commitAllowed=false, exitAllowed=false).",
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

	it("routes BEHIND merge state to branch cleanup", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				pullRequest: {
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "BEHIND",
					url: "https://github.com/jscraik/coding-harness/pull/258",
					headSha: "abc123",
					reviewDecision: "APPROVED",
					body: "Refs JSC-327\n",
				},
				branch: {
					clean: true,
					pushed: true,
					behindBase: null,
					hasConflicts: false,
					headSha: "abc123",
				},
			}),
		);

		expect(report.status).toBe("cleanup_required");
		expect(report.nextAction).toBe("cleanup_before_continue");
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "branch",
					reason: "Pull request merge state reports branch is behind base.",
					fixableByCodex: true,
				}),
			]),
		);
	});

	it("recognizes failed live CodeRabbit checks as known independent review evidence", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				pullRequest: {
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					url: "https://github.com/jscraik/coding-harness/pull/258",
					headSha: "abc123",
					reviewDecision: null,
					body: "Refs JSC-327\n",
				},
				checks: [
					{
						name: "CodeRabbit",
						state: "FAILURE",
						headSha: "abc123",
						source: "github",
					},
				],
			}),
		);
		const reviewClaim = report.claims.find(
			(claim) => claim.claim === "independent_review_status_known",
		);

		expect(reviewClaim).toMatchObject({
			status: "pass",
			evidenceRef: "check:coderabbit",
			freshness: "current",
		});
	});
});
