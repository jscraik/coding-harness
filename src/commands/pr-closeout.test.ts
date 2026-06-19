import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	HARNESS_CLOSEOUT_GATE_IDS,
	HE_GATE_RESULT_SCHEMA_VERSION,
	HE_PHASE_EXIT_SCHEMA_VERSION,
	type HeGateId,
	type HeGatePayload,
} from "../lib/decision/he-phase-exit.js";
import { runPrCloseoutCLI } from "./pr-closeout.js";

type TestRunner = NonNullable<Parameters<typeof runPrCloseoutCLI>[1]>["runner"];

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

const PASSING_PHASE_EXIT = {
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
	gates: HARNESS_CLOSEOUT_GATE_IDS.map((gateId) => {
		const notApplicable = gateId === "he_fix_bugs" || gateId === "autofix";
		return {
			schemaVersion: HE_GATE_RESULT_SCHEMA_VERSION,
			gateId,
			required: gateId !== "autofix" && gateId !== "ubiquitous_language",
			executionMode: notApplicable ? "not_applicable" : "direct_skill",
			status: notApplicable ? "not_applicable" : "pass",
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
			reason: notApplicable
				? `${gateId} not applicable to this closeout.`
				: null,
			blockedReason: null,
		};
	}),
};

const PASSING_ASSURANCE = [
	{
		layer: "unit",
		status: "pass",
		evidence: ["test:unit"],
	},
	{
		layer: "boundary",
		status: "pass",
		evidence: ["test:boundary"],
	},
	{
		layer: "mock_integration",
		status: "pass",
		evidence: ["test:mock-integration"],
	},
	{
		layer: "e2e",
		status: "pass",
		evidence: ["test:e2e"],
	},
	{
		layer: "security",
		status: "pass",
		evidence: ["test:security"],
	},
	{
		layer: "load_stress",
		status: "pass",
		evidence: ["test:load-stress"],
		threshold: {
			metric: "runtime",
			operator: "<=",
			unit: "ms",
			value: 60_000,
			observed: 42_000,
		},
	},
	{
		layer: "lifecycle_closeout",
		status: "pass",
		evidence: ["test:lifecycle-closeout"],
		lifecycleState: {
			automationState: "n.a.",
			branchWorktreeState: "clean",
			linearState: "aligned",
			mergeState: "ready",
			nextLaneRouting: "n.a.",
			prState: "open-ready",
			reviewThreadState: "resolved",
		},
	},
];

const PASSING_RUNTIME_EVIDENCE = {
	schemaVersion: "runtime-evidence-contract/v1",
	declaredIntent: {
		objective: "Close PR with verifier-owned evidence.",
		requestedScope: "closeout",
		sourceRefs: ["input:test"],
	},
	resolvedState: {
		permissionProfile: "workspace_write",
		goalStatus: null,
		serviceTier: "default",
		model: "gpt-5",
		pluginAttribution: ["harness-engineering"],
		runtimeProbe: {
			roleName: "harness-product-code-reviewer",
			spawnOutcome: "available",
			checkedAt: "2026-05-22T00:00:00.000Z",
			sessionId: "codex-session:2026-05-22",
			checkout: "/Users/jamiecraik/dev/coding-harness",
			blockerClass: null,
		},
	},
	verifierResult: {
		status: "pass",
		owner: "validator",
		evidenceRefs: ["test:runtime-evidence"],
		verifiedAt: "2026-05-22T00:01:00.000Z",
		reason: null,
	},
	claimTraceConsistency: "consistent",
	evaluation: {
		portable: true,
		command: "pnpm vitest run src/commands/pr-closeout.test.ts",
		status: "pass",
	},
	outcomeMapping: {
		outcome: "success",
		exitClassification: "ok",
	},
};

function reviewerArtifactReceipt(
	path = ".harness/review/pr-258-codex.md",
	producer = "codex",
) {
	return {
		schemaVersion: "evidence-receipt/v1",
		kind: "review_artifact",
		ref: `review-state:${path}`,
		producer,
		status: "pass",
		freshness: "current",
		evidenceUse: "claim_support",
		blockerClass: null,
		verifiedAt: "2026-05-22T00:01:00.000Z",
		headSha: "abc123",
		sizeBytes: 2048,
	};
}

function writeAssuranceMatrix(dir: string): string {
	const baseDir = join(dir, ".harness");
	mkdirSync(baseDir, { recursive: true });
	const path = join(baseDir, "assurance.json");
	writeFileSync(path, JSON.stringify({ entries: PASSING_ASSURANCE }));
	return path;
}

function writeEnvFile(dir: string): string {
	const path = join(dir, "codex.env");
	writeFileSync(path, "LINEAR_API_KEY=test-linear-key\n");
	return path;
}

async function capture(
	args: string[],
	runner?: TestRunner,
): Promise<{
	exitCode: number;
	output: string;
	error: string;
}> {
	const output: string[] = [];
	const error: string[] = [];
	const infoSpy = vi
		.spyOn(console, "info")
		.mockImplementation((message = "") => {
			output.push(String(message));
		});
	const errorSpy = vi
		.spyOn(console, "error")
		.mockImplementation((message = "") => {
			error.push(String(message));
		});
	try {
		const runArgs = [...args];
		if (runArgs.includes("--pr") && !runArgs.includes("--env-file")) {
			runArgs.push(
				"--env-file",
				writeEnvFile(mkdtempSync(join(tmpdir(), "pr-closeout-env-"))),
			);
		}
		if (runArgs.includes("--pr") && !runArgs.includes("--assurance")) {
			let repoRoot = flagValue(runArgs, "--repo");
			if (!repoRoot) {
				repoRoot = mkdtempSync(join(tmpdir(), "pr-closeout-repo-"));
				runArgs.push("--repo", repoRoot);
			}
			runArgs.push("--assurance", writeAssuranceMatrix(repoRoot));
		}
		const runOptions = runner
			? {
					runner: (
						command: string,
						args: readonly string[],
						options: { cwd: string; env?: NodeJS.ProcessEnv },
					) => {
						const result = runner(command, args, options);
						if (
							command === "git" &&
							args[0] === "rev-parse" &&
							(result === "ok" || result === "")
						) {
							return "abc123";
						}
						return result;
					},
				}
			: {};
		return {
			exitCode: await runPrCloseoutCLI(runArgs, runOptions),
			output: output.join("\n"),
			error: error.join("\n"),
		};
	} finally {
		infoSpy.mockRestore();
		errorSpy.mockRestore();
	}
}

function flagValue(args: readonly string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	return index === -1 ? undefined : args[index + 1];
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("runPrCloseoutCLI", () => {
	it("builds a JSON report from a normalized input file", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const inputPath = join(dir, "input.json");
		writeFileSync(
			inputPath,
			JSON.stringify({
				pullRequest: {
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headSha: "abc123",
					reviewDecision: "APPROVED",
					body: "Refs JSC-327\n",
				},
				branch: {
					clean: true,
					headSha: "abc123",
					worktreeRole: "implementation",
				},
				checks: [{ name: "pr-pipeline", state: "SUCCESS", headSha: "abc123" }],
				reviewThreads: {
					unresolved: 0,
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
				closeoutGates: PASSING_PHASE_EXIT,
				assurance: PASSING_ASSURANCE,
				runtimeEvidence: PASSING_RUNTIME_EVIDENCE,
				reviewArtifacts: [
					{
						path: ".harness/review/pr-258-codex.md",
						producer: "codex",
						status: "present",
						evidenceRef: "artifact:.harness/review/pr-258-codex.md",
					},
				],
				reviewerArtifactProofs: [
					{
						path: ".harness/review/pr-258-codex.md",
						producer: "codex",
						evidenceVerified: true,
						receipt: reviewerArtifactReceipt(),
					},
				],
				linearMutation: "available",
			}),
		);

		const result = await capture(["--json", "--input", inputPath]);

		expect(result.exitCode).toBe(0);
		expect(result.error).toBe("");
		expect(JSON.parse(result.output)).toMatchObject({
			schemaVersion: "pr-closeout/v1",
			pr: 258,
			status: "ready",
			nextAction: "ready_to_merge",
			lifecycleSnapshot: {
				schemaVersion: "delivery-lifecycle-snapshot/v1",
				worktreeRole: "implementation",
				linearMutation: "available",
				releaseReadinessImpact: "none",
				handoffRequiredEvidence: [],
				reviewArtifacts: {
					expected: 1,
					missing: 0,
				},
				continuation: {
					nextSafeAction: "ready_to_merge",
					waitingOwner: "unknown",
				},
			},
			runtimeEvidence: {
				present: true,
				valid: true,
				verifierStatus: "pass",
			},
		});
	});

	for (const linearMutationCase of [
		{
			mutation: "blocked" as const,
			expectedStatus: "blocked",
			expectedNextAction: "needs_jamie_decision",
			expectedClaimStatus: "blocked",
			expectedBlockerClass: "external_service",
		},
		{
			mutation: "unknown" as const,
			expectedStatus: "fixable",
			expectedNextAction: "codex_can_fix_now",
			expectedClaimStatus: "unknown",
			expectedBlockerClass: "unknown",
		},
	] as const) {
		it(`does not mark Linear closeout ready when Linear mutation availability is ${linearMutationCase.mutation}`, async () => {
			const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
			const inputPath = join(dir, "input.json");
			writeFileSync(
				inputPath,
				JSON.stringify({
					pullRequest: {
						number: 258,
						state: "OPEN",
						isDraft: false,
						mergeStateStatus: "CLEAN",
						headSha: "abc123",
						reviewDecision: "APPROVED",
						body: "Refs JSC-327\n",
					},
					branch: {
						clean: true,
						headSha: "abc123",
						worktreeRole: "implementation",
					},
					checks: [
						{ name: "pr-pipeline", state: "SUCCESS", headSha: "abc123" },
					],
					reviewThreads: { unresolved: 0 },
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
					closeoutGates: PASSING_PHASE_EXIT,
					assurance: PASSING_ASSURANCE,
					runtimeEvidence: PASSING_RUNTIME_EVIDENCE,
					reviewArtifacts: [
						{
							path: ".harness/review/pr-258-codex.md",
							producer: "codex",
							status: "present",
							evidenceRef: "artifact:.harness/review/pr-258-codex.md",
						},
					],
					reviewerArtifactProofs: [
						{
							path: ".harness/review/pr-258-codex.md",
							producer: "codex",
							evidenceVerified: true,
							receipt: reviewerArtifactReceipt(),
						},
					],
					linearMutation: linearMutationCase.mutation,
				}),
			);

			const result = await capture(["--json", "--input", inputPath]);
			const report = JSON.parse(result.output) as {
				status: string;
				nextAction: string;
				mergeable: boolean;
				blockers: Array<{
					surface: string;
					classification?: string;
					kind?: string;
					ref?: string;
				}>;
				claims: Array<{
					claim: string;
					status: string;
					freshness: string;
					evidenceRef: string | null;
				}>;
			};

			expect(result.exitCode).toBe(0);
			expect(report.status).toBe(linearMutationCase.expectedStatus);
			expect(report.nextAction).toBe(linearMutationCase.expectedNextAction);
			expect(report.mergeable).toBe(false);
			expect(report.claims).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						claim: "linear_tracker_state_aligned",
						status: linearMutationCase.expectedClaimStatus,
						freshness: "missing",
						evidenceRef: `linearMutation:${linearMutationCase.mutation}`,
					}),
				]),
			);
			expect(report.blockers).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						surface: "linear",
						classification: linearMutationCase.expectedBlockerClass,
						kind: "closeout_claim",
						ref: `linearMutation:${linearMutationCase.mutation}`,
					}),
				]),
			);
		});
	}

	it("applies release-readiness CLI classification to input files", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const inputPath = join(dir, "input.json");
		writeFileSync(
			inputPath,
			JSON.stringify({
				pullRequest: {
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headSha: "abc123",
					reviewDecision: "APPROVED",
					body: "Refs JSC-327\n",
				},
				branch: {
					clean: true,
					headSha: "abc123",
					worktreeRole: "implementation",
				},
				checks: [{ name: "pr-pipeline", state: "SUCCESS", headSha: "abc123" }],
				reviewThreads: { unresolved: 0 },
				traceability: {
					sessionIds: ["codex-session:2026-05-16"],
					traceIds: ["circleci:workflow-123"],
					aiSessionTraceability:
						"JSC-327 -> PR #258 -> Codex session -> commit -> validation",
				},
				rollback: { notApplicable: true, evidenceRef: "pr-body:rollback" },
				closeoutGates: PASSING_PHASE_EXIT,
				assurance: PASSING_ASSURANCE,
				runtimeEvidence: PASSING_RUNTIME_EVIDENCE,
				linearMutation: "available",
				releaseReadinessImpact: "none",
			}),
		);

		const result = await capture([
			"--json",
			"--input",
			inputPath,
			"--release-readiness-impact",
			"release_blocker",
		]);
		const report = JSON.parse(result.output) as {
			status: string;
			mergeable: boolean;
			blockers: Array<{
				surface: string;
				classification: string;
				ref?: string;
			}>;
			lifecycleSnapshot: {
				releaseReadinessImpact: string;
			};
		};

		expect(result.exitCode).toBe(0);
		expect(report.status).toBe("needs_jamie");
		expect(report.mergeable).toBe(false);
		expect(report.lifecycleSnapshot.releaseReadinessImpact).toBe(
			"release_blocker",
		);
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "release_readiness",
					classification: "needs_jamie_decision",
					ref: "input:releaseReadinessImpact:release_blocker",
				}),
			]),
		);
	});

	it("projects release blockers into the release-readiness lifecycle lane", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const inputPath = join(dir, "input.json");
		writeFileSync(
			inputPath,
			JSON.stringify({
				pullRequest: {
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headSha: "abc123",
					reviewDecision: "APPROVED",
					body: "Refs JSC-327\n",
				},
				branch: {
					clean: true,
					headSha: "abc123",
					worktreeRole: "implementation",
				},
				checks: [{ name: "pr-pipeline", state: "SUCCESS", headSha: "abc123" }],
				reviewThreads: { unresolved: 0 },
				traceability: {
					sessionIds: ["codex-session:2026-05-16"],
					traceIds: ["circleci:workflow-123"],
					aiSessionTraceability:
						"JSC-327 -> PR #258 -> Codex session -> validation",
				},
				rollback: { notApplicable: true, evidenceRef: "pr-body:rollback" },
				closeoutGates: PASSING_PHASE_EXIT,
				assurance: PASSING_ASSURANCE,
				runtimeEvidence: PASSING_RUNTIME_EVIDENCE,
				linearMutation: "available",
				releaseReadinessImpact: "release_blocker",
			}),
		);

		const result = await capture(["--json", "--input", inputPath]);
		const report = JSON.parse(result.output) as {
			status: string;
			mergeable: boolean;
			blockers: Array<{
				surface: string;
				classification: string;
				ref?: string;
			}>;
			lifecycleSnapshot: {
				handoffRequiredEvidence: Array<{
					lane: string;
					evidenceRef: string;
				}>;
				lanes: Array<{
					lane: string;
					status: string;
					freshness: string;
					evidenceRef: string | null;
					blockerClass: string | null;
					nextAction: string;
				}>;
			};
		};
		const releaseReadinessLane = report.lifecycleSnapshot.lanes.find(
			(lane) => lane.lane === "release_readiness",
		);

		expect(result.exitCode).toBe(0);
		expect(report.status).toBe("needs_jamie");
		expect(report.mergeable).toBe(false);
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "release_readiness",
					classification: "needs_jamie_decision",
					ref: "input:releaseReadinessImpact:release_blocker",
				}),
			]),
		);
		expect(releaseReadinessLane).toMatchObject({
			status: "blocked",
			freshness: "current",
			evidenceRef: "input:releaseReadinessImpact:release_blocker",
			blockerClass: "needs_jamie_decision",
			nextAction: "Resolve the release-readiness blocker before closeout.",
		});
		expect(report.lifecycleSnapshot.handoffRequiredEvidence).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					lane: "release_readiness",
					evidenceRef: "input:releaseReadinessImpact:release_blocker",
				}),
			]),
		);
	});

	it("requires release-readiness evidence for governed changes before closeout", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const inputPath = join(dir, "input.json");
		writeFileSync(
			inputPath,
			JSON.stringify({
				pullRequest: {
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headSha: "abc123",
					reviewDecision: "APPROVED",
					body: "Refs JSC-327\n",
				},
				branch: {
					clean: true,
					headSha: "abc123",
					worktreeRole: "implementation",
				},
				checks: [{ name: "pr-pipeline", state: "SUCCESS", headSha: "abc123" }],
				reviewThreads: { unresolved: 0 },
				traceability: {
					sessionIds: ["codex-session:2026-05-16"],
					traceIds: ["circleci:workflow-123"],
					aiSessionTraceability:
						"JSC-327 -> PR #258 -> Codex session -> validation",
				},
				rollback: { notApplicable: true, evidenceRef: "pr-body:rollback" },
				closeoutGates: PASSING_PHASE_EXIT,
				assurance: PASSING_ASSURANCE,
				runtimeEvidence: PASSING_RUNTIME_EVIDENCE,
				linearMutation: "available",
				releaseReadinessImpact: "governed_change",
			}),
		);

		const result = await capture(["--json", "--input", inputPath]);
		const report = JSON.parse(result.output) as {
			status: string;
			mergeable: boolean;
			blockers: Array<{
				surface: string;
				classification: string;
				fixableByCodex: boolean;
				ref?: string;
			}>;
			lifecycleSnapshot: {
				lanes: Array<{
					lane: string;
					status: string;
					freshness: string;
					evidenceRef: string | null;
					blockerClass: string | null;
					nextAction: string;
				}>;
			};
		};
		const releaseReadinessLane = report.lifecycleSnapshot.lanes.find(
			(lane) => lane.lane === "release_readiness",
		);

		expect(result.exitCode).toBe(0);
		expect(report.status).toBe("fixable");
		expect(report.mergeable).toBe(false);
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "release_readiness",
					classification: "unknown",
					fixableByCodex: true,
					ref: "input:releaseReadinessImpact:governed_change",
				}),
			]),
		);
		expect(releaseReadinessLane).toMatchObject({
			status: "fail",
			freshness: "current",
			evidenceRef: "input:releaseReadinessImpact:governed_change",
			blockerClass: "unknown",
			nextAction: "Attach release-readiness evidence before closeout.",
		});
	});

	it("keeps fixable lane blockers separate from Jamie-decision blockers", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const inputPath = join(dir, "input.json");
		writeFileSync(
			inputPath,
			JSON.stringify({
				pullRequest: {
					number: 258,
					state: "OPEN",
					isDraft: true,
					mergeStateStatus: "CLEAN",
					headSha: "abc123",
					reviewDecision: "APPROVED",
					body: "Refs JSC-327\n",
				},
				branch: {
					clean: true,
					headSha: "abc123",
					worktreeRole: "implementation",
				},
				checks: [
					{
						name: "pr-pipeline",
						state: "FAILURE",
						headSha: "abc123",
					},
				],
				reviewThreads: { unresolved: 0 },
				traceability: {
					sessionIds: ["codex-session:2026-05-16"],
					traceIds: ["circleci:workflow-123"],
					aiSessionTraceability:
						"JSC-327 -> PR #258 -> Codex session -> validation",
				},
				rollback: { notApplicable: true, evidenceRef: "pr-body:rollback" },
				closeoutGates: PASSING_PHASE_EXIT,
				assurance: PASSING_ASSURANCE,
				runtimeEvidence: PASSING_RUNTIME_EVIDENCE,
				linearMutation: "available",
				releaseReadinessImpact: "release_blocker",
			}),
		);

		const result = await capture(["--json", "--input", inputPath]);
		const report = JSON.parse(result.output) as {
			status: string;
			lifecycleSnapshot: {
				handoffRequiredEvidence: Array<{
					lane: string;
					evidenceRef: string;
				}>;
				lanes: Array<{
					lane: string;
					status: string;
					blockerClass: string | null;
				}>;
			};
		};
		const ciLane = report.lifecycleSnapshot.lanes.find(
			(lane) => lane.lane === "ci_state",
		);
		const releaseReadinessLane = report.lifecycleSnapshot.lanes.find(
			(lane) => lane.lane === "release_readiness",
		);

		expect(result.exitCode).toBe(0);
		expect(report.status).toBe("needs_jamie");
		expect(ciLane).toMatchObject({
			status: "fail",
			blockerClass: "introduced",
		});
		expect(report.lifecycleSnapshot.handoffRequiredEvidence).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					lane: "local_validation",
					evidenceRef: "check:pr-pipeline",
				}),
				expect.objectContaining({
					lane: "ci_state",
					evidenceRef: "pr-pipeline",
				}),
			]),
		);
		expect(releaseReadinessLane).toMatchObject({
			status: "blocked",
			blockerClass: "needs_jamie_decision",
		});
	});

	it("blocks CI closeout when CircleCI telemetry cannot identify failures", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const inputPath = join(dir, "input.json");
		writeFileSync(
			inputPath,
			JSON.stringify({
				pullRequest: {
					number: 258,
					state: "OPEN",
					isDraft: false,
					headSha: "abc123",
					body: "Refs JSC-363",
					reviewDecision: "APPROVED",
				},
				branch: {
					clean: true,
					pushed: true,
					behindBase: false,
					hasConflicts: false,
					matchesPullRequestHead: true,
					headSha: "abc123",
					worktreeRole: "implementation",
				},
				checks: [
					{
						name: "unit-tests",
						state: "SUCCESS",
						required: true,
						headSha: "abc123",
						source: "github",
					},
				],
				ciTelemetry: [
					{
						provider: "circleci",
						source: "circleci_otel",
						evidenceRef:
							"~/.agents/otel-collector/data/processed/stats.json#circleci_issues",
						freshness: "current",
						totalSpans: 5786,
						statusCounts: { unknown: 5786 },
						canIdentifyIssues: false,
						blockedReason:
							"CircleCI spans do not include status or failure attributes",
					},
				],
				reviewThreads: { unresolved: 0 },
				traceability: {
					sessionIds: ["codex-session:2026-06-08"],
					traceIds: ["circleci:otel-stats"],
					aiSessionTraceability:
						"JSC-363 -> CircleCI telemetry visibility -> pr-closeout",
				},
				rollback: { notApplicable: true, evidenceRef: "pr-body:rollback" },
				closeoutGates: PASSING_PHASE_EXIT,
				assurance: PASSING_ASSURANCE,
				runtimeEvidence: PASSING_RUNTIME_EVIDENCE,
				linearMutation: "available",
				releaseReadinessImpact: "none",
			}),
		);

		const result = await capture(["--json", "--input", inputPath]);
		const report = JSON.parse(result.output) as {
			status: string;
			nextAction: string;
			blockers: Array<{
				surface: string;
				classification: string;
				ref?: string;
				reason: string;
			}>;
			ciTelemetry: Array<{ provider: string; canIdentifyIssues: boolean }>;
			lifecycleSnapshot: {
				handoffRequiredEvidence: Array<{
					lane: string;
					evidenceRef: string;
				}>;
				lanes: Array<{
					lane: string;
					status: string;
					blockerClass: string | null;
					evidenceRef: string | null;
				}>;
			};
		};
		const ciLane = report.lifecycleSnapshot.lanes.find(
			(lane) => lane.lane === "ci_state",
		);

		expect(result.exitCode).toBe(0);
		expect(report.status).toBe("waiting");
		expect(report.nextAction).toBe("wait_for_external_check");
		expect(report.ciTelemetry).toEqual([
			expect.objectContaining({
				provider: "circleci",
				canIdentifyIssues: false,
			}),
		]);
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "checks",
					classification: "external_service",
					ref: "~/.agents/otel-collector/data/processed/stats.json#circleci_issues",
					reason: expect.stringContaining(
						"CircleCI telemetry is present but cannot identify CI failures",
					),
				}),
			]),
		);
		expect(ciLane).toMatchObject({
			status: "blocked",
			blockerClass: "external_service",
			evidenceRef:
				"~/.agents/otel-collector/data/processed/stats.json#circleci_issues",
		});
		expect(report.lifecycleSnapshot.handoffRequiredEvidence).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					lane: "ci_state",
					evidenceRef:
						"~/.agents/otel-collector/data/processed/stats.json#circleci_issues",
				}),
			]),
		);
	});
});
