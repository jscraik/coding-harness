import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	HARNESS_CLOSEOUT_GATES_SCHEMA_VERSION,
	HARNESS_CLOSEOUT_GATE_IDS,
	HE_GATE_RESULT_SCHEMA_VERSION,
	HE_PHASE_EXIT_SCHEMA_VERSION,
	type HeGateId,
	type HeGatePayload,
} from "../lib/decision/he-phase-exit.js";
import { runPrCloseoutCLI } from "./pr-closeout.js";
import { fetchReviewThreads, normalizeGhChecks } from "./pr-closeout-github.js";

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

const PASSING_CLOSEOUT_GATES = {
	...PASSING_PHASE_EXIT,
	schemaVersion: HARNESS_CLOSEOUT_GATES_SCHEMA_VERSION,
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

function writeCloseoutGates(
	dir: string,
	artifact: unknown = PASSING_CLOSEOUT_GATES,
): string {
	const baseDir = join(dir, "pr-closeout-tests");
	mkdirSync(baseDir, { recursive: true });
	const path = join(
		mkdtempSync(join(baseDir, "closeout-gates-")),
		"closeout-gates.json",
	);
	writeFileSync(path, JSON.stringify(artifact));
	return path;
}

function writeRuntimeEvidence(
	dir: string,
	artifact: unknown = PASSING_RUNTIME_EVIDENCE,
): string {
	const baseDir = join(dir, ".harness");
	mkdirSync(baseDir, { recursive: true });
	const path = join(baseDir, "runtime-evidence.json");
	writeFileSync(path, JSON.stringify(artifact));
	return path;
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

const PR_BODY_WITH_TRACEABILITY = `
Refs JSC-327

## Work performed

- Session IDs: codex-session:2026-05-16
- Trace IDs: circleci:workflow-123, artifacts/pr-closeout/pr-closeout.json
- AI session / traceability: Codex session validates PR closeout evidence.
- Rollback: not applicable; docs-only closeout.
- Completed work: command and tests
`.trim();

function reviewThreadsGraphql(
	unresolved = 0,
	pageInfo: { hasNextPage: boolean; endCursor?: string | null } = {
		hasNextPage: false,
	},
): string {
	return JSON.stringify({
		data: {
			repository: {
				pullRequest: {
					reviewThreads: {
						pageInfo: {
							hasNextPage: pageInfo.hasNextPage,
							endCursor: pageInfo.endCursor ?? null,
						},
						nodes: Array.from({ length: unresolved }, () => ({
							isResolved: false,
						})),
					},
				},
			},
		},
	});
}

function checkRunsForHead(headSha = "abc123"): string {
	return JSON.stringify([
		{
			name: "pr-pipeline",
			head_sha: headSha,
			html_url: "https://ci.example/pr-pipeline",
		},
	]);
}

function checkRunsPage(runs: Array<Record<string, unknown>>): string {
	return JSON.stringify(runs);
}

function commitStatuses(statuses: Array<Record<string, unknown>>): string {
	return JSON.stringify(statuses);
}

function prChecksForHead(): string {
	return JSON.stringify([
		{
			name: "pr-pipeline",
			state: "SUCCESS",
			link: "https://ci.example/pr-pipeline",
		},
	]);
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
						receipt: "artifact-proof:.harness/review/pr-258-codex.md",
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
							receipt: "artifact-proof:.harness/review/pr-258-codex.md",
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

	it("blocks closeout when an expected review artifact is missing", async () => {
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
					worktreeRole: "orientation",
				},
				checks: [{ name: "pr-pipeline", state: "SUCCESS", headSha: "abc123" }],
				reviewThreads: {
					unresolved: 0,
					ownerCounts: { codex: 0, jamie: 0 },
				},
				traceability: {
					sessionIds: ["codex-session:2026-05-16"],
				},
				rollback: {
					notApplicable: true,
					evidenceRef: "pr-body:rollback",
				},
				closeoutGates: PASSING_CLOSEOUT_GATES,
				assurance: PASSING_ASSURANCE,
				reviewArtifacts: [
					{
						path: ".harness/review/pr-258-reviewer.md",
						producer: "harness-product-code-reviewer",
						status: "missing",
						owner: "reviewer",
						unblockAction: "rerun reviewer artifact capture",
						nextCheckAt: "2026-05-30T21:00:00.000Z",
					},
				],
			}),
		);

		const result = await capture(["--json", "--input", inputPath]);
		const report = JSON.parse(result.output);

		expect(result.exitCode).toBe(0);
		expect(report).toMatchObject({
			status: "fixable",
			nextAction: "codex_can_fix_now",
			lifecycleSnapshot: {
				worktreeRole: "orientation",
				reviewArtifacts: {
					expected: 1,
					missing: 1,
				},
				continuation: {
					waitingOwner: "reviewer",
				},
			},
		});
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "review_artifact",
					reason:
						"Review artifact .harness/review/pr-258-reviewer.md is missing.",
				}),
			]),
		);
		expect(report.lifecycleSnapshot.handoffRequiredEvidence).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					lane: "review_state",
					evidenceRef: ".harness/review/pr-258-reviewer.md",
				}),
			]),
		);
	});

	it("accepts first-class Coding Harness closeout-gates schema in normalized input", async () => {
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
				closeoutGates: PASSING_CLOSEOUT_GATES,
				assurance: PASSING_ASSURANCE,
			}),
		);

		const result = await capture(["--json", "--input", inputPath]);

		expect(result.exitCode).toBe(0);
		expect(JSON.parse(result.output)).toMatchObject({
			status: "ready",
			harnessGates: {
				evidenceSource: "closeout_gates",
				closeoutGatesPresent: true,
			},
		});
	});

	it("fails closed when input embeds malformed closeout-gates evidence", async () => {
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
					body: "Refs JSC-327\n",
				},
				closeoutGates: {},
			}),
		);

		const result = await capture(["--json", "--input", inputPath]);

		expect(result.exitCode).toBe(1);
		expect(result.error).toBe("");
		expect(JSON.parse(result.output)).toMatchObject({
			schemaVersion: "pr-closeout-error/v1",
			status: "fail",
			error: expect.stringContaining(
				"closeoutGates must be a valid Coding Harness closeout-gates artifact",
			),
		});
	});

	it("fails closed when input embeds a malformed assurance entry", async () => {
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
					body: "Refs JSC-327\n",
				},
				assurance: [null],
			}),
		);

		const result = await capture(["--json", "--input", inputPath]);

		expect(result.exitCode).toBe(1);
		expect(JSON.parse(result.output)).toMatchObject({
			schemaVersion: "pr-closeout-error/v1",
			status: "fail",
			error: expect.stringContaining(
				"assurance.entries[0] must be a JSON object",
			),
		});
	});

	it("fails closed when input embeds malformed runtime evidence", async () => {
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
					body: "Refs JSC-327\n",
				},
				runtimeEvidence: {
					schemaVersion: "runtime-evidence-contract/v1",
				},
			}),
		);

		const result = await capture(["--json", "--input", inputPath]);

		expect(result.exitCode).toBe(1);
		expect(JSON.parse(result.output)).toMatchObject({
			schemaVersion: "pr-closeout-error/v1",
			status: "fail",
			error: expect.stringContaining(
				"runtimeEvidence.declaredIntent must be a JSON object",
			),
		});
	});

	it("fails closed when input supplies both closeout-gates and phase-exit evidence", async () => {
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
					body: "Refs JSC-327\n",
				},
				closeoutGates: PASSING_PHASE_EXIT,
				phaseExit: PASSING_PHASE_EXIT,
			}),
		);

		const result = await capture(["--json", "--input", inputPath]);

		expect(result.exitCode).toBe(1);
		expect(JSON.parse(result.output)).toMatchObject({
			schemaVersion: "pr-closeout-error/v1",
			status: "fail",
			error: expect.stringContaining(
				"must include either closeoutGates or phaseExit, not both",
			),
		});
	});

	it("rejects mixed input and CLI closeout gate sources", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const inputPath = join(dir, "input.json");
		const closeoutGatesPath = writeCloseoutGates(dir);
		writeFileSync(
			inputPath,
			JSON.stringify({
				pullRequest: {
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					body: "Refs JSC-327\n",
				},
				phaseExit: PASSING_PHASE_EXIT,
			}),
		);

		const result = await capture([
			"--json",
			"--input",
			inputPath,
			"--gates",
			closeoutGatesPath,
		]);

		expect(result.exitCode).toBe(1);
		expect(JSON.parse(result.output)).toMatchObject({
			schemaVersion: "pr-closeout-error/v1",
			status: "fail",
			error: expect.stringContaining(
				"Closeout evidence must come from either --input or --gates/--phase-exit, not both",
			),
		});
	});

	it("rejects closeout gate paths that escape the repo root", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const repoRoot = join(dir, "repo");
		mkdirSync(repoRoot);
		writeCloseoutGates(dir);
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					baseRefName: "main",
					reviewDecision: "APPROVED",
					body: PR_BODY_WITH_TRACEABILITY,
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				return prChecksForHead();
			}
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				return JSON.stringify({
					owner: { login: "jscraik" },
					name: "coding-harness",
				});
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/check-runs")
			) {
				return checkRunsForHead();
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return reviewThreadsGraphql();
			}
			if (command === "git") {
				if (args[0] === "rev-list") return "0\t0";
				return "";
			}
			return "ok";
		};

		const result = await capture(
			[
				"--json",
				"--repo",
				repoRoot,
				"--pr",
				"258",
				"--gates",
				"../closeout-gates.json",
			],
			runner,
		);

		expect(result.exitCode).toBe(1);
		expect(JSON.parse(result.output)).toMatchObject({
			schemaVersion: "pr-closeout-error/v1",
			status: "fail",
			error: expect.stringContaining(
				"Closeout gates path must stay within the repository root",
			),
		});
	});

	it("fails closed when closeout gates resolve through a symlink outside repo", async () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-pr-closeout-repo-"));
		const outsideRoot = mkdtempSync(
			join(tmpdir(), "harness-pr-closeout-outside-"),
		);
		const outsideGatesPath = writeCloseoutGates(outsideRoot);
		const linkPath = join(repoRoot, "safe-link");
		symlinkSync(outsideGatesPath, linkPath);
		const runner: TestRunner = (command, args) => {
			if (command === "git" && args[0] === "rev-parse") {
				return repoRoot;
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					isDraft: false,
					mergeable: "MERGEABLE",
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					baseRefName: "main",
					headRefName: "codex/test",
					url: "https://github.com/jscraik/coding-harness/pull/258",
					repository: {
						owner: { login: "jscraik" },
						name: "coding-harness",
					},
				});
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/check-runs")
			) {
				return checkRunsForHead();
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return reviewThreadsGraphql();
			}
			return "";
		};

		const result = await capture(
			["--json", "--repo", repoRoot, "--pr", "258", "--gates", "safe-link"],
			runner,
		);

		expect(result.exitCode).toBe(1);
		expect(JSON.parse(result.output)).toMatchObject({
			schemaVersion: "pr-closeout-error/v1",
			status: "fail",
			error: expect.stringContaining(
				"Closeout gates path must stay within the repository root",
			),
		});
	});

	it("returns usage errors for missing input", async () => {
		const result = await capture(["--json"]);

		expect(result.exitCode).toBe(2);
		expect(result.error).toContain("either --input or --pr is required");
	});

	it("rejects non-integer PR numbers", async () => {
		const result = await capture(["--json", "--pr", "258abc"]);

		expect(result.exitCode).toBe(2);
		expect(result.error).toContain("--pr requires a positive integer");
	});

	it("rejects invalid live release-readiness classifications", async () => {
		const result = await capture([
			"--json",
			"--pr",
			"258",
			"--release-readiness-impact",
			"maybe",
		]);

		expect(result.exitCode).toBe(2);
		expect(result.error).toContain(
			"--release-readiness-impact requires one of none, governed_change, release_blocker, unknown",
		);
	});

	it("collects live GitHub, CircleCI, CodeRabbit, and Snyk tool evidence", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const closeoutGatesPath = writeCloseoutGates(dir);
		const runtimeEvidencePath = writeRuntimeEvidence(dir);
		const calls: string[] = [];
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			calls.push([command, ...args].join(" "));
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					baseRefName: "main",
					reviewDecision: "APPROVED",
					body: PR_BODY_WITH_TRACEABILITY,
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				return JSON.stringify([
					{
						name: "pr-pipeline",
						state: "SUCCESS",
						link: "https://ci.example/pr-pipeline",
					},
				]);
			}
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				return JSON.stringify({
					owner: { login: "jscraik" },
					name: "coding-harness",
				});
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/check-runs")
			) {
				return checkRunsForHead();
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return reviewThreadsGraphql();
			}
			if (command === "git") {
				return "";
			}
			return "ok";
		};
		const result = await capture(
			[
				"--json",
				"--repo",
				dir,
				"--pr",
				"258",
				"--gates",
				closeoutGatesPath,
				"--runtime-evidence",
				runtimeEvidencePath,
				"--release-readiness-impact",
				"none",
			],
			runner,
		);

		expect(result.exitCode).toBe(0);
		expect(JSON.parse(result.output)).toMatchObject({
			status: "ready",
			harnessGates: {
				evidenceSource: "closeout_gates",
				closeoutGatesPresent: true,
				phaseExitPresent: false,
			},
			traceability: {
				complete: true,
				sessionIds: ["codex-session:2026-05-16"],
				traceIds: [
					"circleci:workflow-123",
					"artifacts/pr-closeout/pr-closeout.json",
				],
			},
			runtimeEvidence: {
				present: true,
				valid: true,
				verifierStatus: "pass",
			},
		});
		expect(calls).toEqual(
			expect.arrayContaining([
				"gh --version",
				"circleci version",
				"coderabbit --version",
				"snyk --version",
				"gh pr view 258 --json number,title,state,isDraft,mergeStateStatus,url,headRefOid,headRefName,baseRefName,reviewDecision,body",
				"gh pr checks 258 --required --json name,state,link",
				"gh repo view --json owner,name",
			]),
		);
		expect(calls.some((call) => call.startsWith("gh api graphql"))).toBe(true);
	});

	it("does not mark live worktree implementation-safe when base drift is unobserved", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const closeoutGatesPath = writeCloseoutGates(dir);
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					baseRefName: "main",
					reviewDecision: "APPROVED",
					body: PR_BODY_WITH_TRACEABILITY,
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				return prChecksForHead();
			}
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				return JSON.stringify({
					owner: { login: "jscraik" },
					name: "coding-harness",
				});
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/check-runs")
			) {
				return checkRunsForHead();
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return reviewThreadsGraphql();
			}
			if (command === "git" && args[0] === "status") return "";
			if (command === "git" && args[0] === "rev-parse") return "abc123";
			if (command === "git" && args[0] === "rev-list") {
				throw new Error("no upstream configured");
			}
			return "ok";
		};

		const result = await capture(
			[
				"--json",
				"--repo",
				dir,
				"--pr",
				"258",
				"--gates",
				closeoutGatesPath,
				"--release-readiness-impact",
				"none",
			],
			runner,
		);

		expect(result.exitCode).toBe(0);
		expect(JSON.parse(result.output)).toMatchObject({
			lifecycleSnapshot: {
				worktreeRole: "orientation",
			},
		});
	});

	it("compares live worktree drift against the PR base branch", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const closeoutGatesPath = writeCloseoutGates(dir);
		const gitCommandsSeen: string[] = [];
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					baseRefName: "main",
					reviewDecision: "APPROVED",
					body: PR_BODY_WITH_TRACEABILITY,
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				return prChecksForHead();
			}
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				return JSON.stringify({
					owner: { login: "jscraik" },
					name: "coding-harness",
				});
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/check-runs")
			) {
				return checkRunsForHead();
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return reviewThreadsGraphql();
			}
			if (command === "git") {
				gitCommandsSeen.push(args.join(" "));
				if (args[0] === "status") return "";
				if (args[0] === "rev-parse") return "abc123";
				if (args[0] === "rev-list") return "2\t0";
			}
			return "ok";
		};

		const result = await capture(
			[
				"--json",
				"--repo",
				dir,
				"--pr",
				"258",
				"--gates",
				closeoutGatesPath,
				"--release-readiness-impact",
				"none",
			],
			runner,
		);

		expect(result.exitCode).toBe(0);
		expect(gitCommandsSeen).toEqual(
			expect.arrayContaining([
				"rev-list --left-right --count refs/remotes/origin/main...HEAD",
			]),
		);
		expect(gitCommandsSeen).not.toContain(
			"rev-list --left-right --count @{upstream}...HEAD",
		);
		expect(JSON.parse(result.output)).toMatchObject({
			lifecycleSnapshot: {
				worktreeRole: "orientation",
			},
			blockers: expect.arrayContaining([
				expect.objectContaining({
					surface: "branch",
					classification: "introduced",
					reason: "Branch is behind its base branch.",
				}),
			]),
		});
	});

	it("does not mark live worktree implementation-safe when local head differs from PR head", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const closeoutGatesPath = writeCloseoutGates(dir);
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					baseRefName: "main",
					reviewDecision: "APPROVED",
					body: PR_BODY_WITH_TRACEABILITY,
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				return prChecksForHead();
			}
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				return JSON.stringify({
					owner: { login: "jscraik" },
					name: "coding-harness",
				});
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/check-runs")
			) {
				return checkRunsForHead();
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return reviewThreadsGraphql();
			}
			if (command === "git" && args[0] === "status") return "";
			if (command === "git" && args[0] === "rev-parse") return "local123";
			if (command === "git" && args[0] === "rev-list") return "0\t0";
			return "ok";
		};

		const result = await capture(
			[
				"--json",
				"--repo",
				dir,
				"--pr",
				"258",
				"--gates",
				closeoutGatesPath,
				"--release-readiness-impact",
				"none",
			],
			runner,
		);

		expect(result.exitCode).toBe(0);
		expect(JSON.parse(result.output)).toMatchObject({
			lifecycleSnapshot: {
				worktreeRole: "orientation",
			},
			blockers: expect.arrayContaining([
				expect.objectContaining({
					surface: "branch",
					classification: "introduced",
					reason: "Local HEAD does not match the pull request head.",
				}),
			]),
		});
	});

	it("does not mark live worktree implementation-safe when PR head evidence is missing", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const closeoutGatesPath = writeCloseoutGates(dir);
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					baseRefName: "main",
					reviewDecision: "APPROVED",
					body: PR_BODY_WITH_TRACEABILITY,
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				return prChecksForHead();
			}
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				return JSON.stringify({
					owner: { login: "jscraik" },
					name: "coding-harness",
				});
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/check-runs")
			) {
				return checkRunsForHead();
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return reviewThreadsGraphql();
			}
			if (command === "git" && args[0] === "status") return "";
			if (command === "git" && args[0] === "rev-parse") return "local123";
			if (command === "git" && args[0] === "rev-list") return "0\t0";
			return "ok";
		};

		const result = await capture(
			[
				"--json",
				"--repo",
				dir,
				"--pr",
				"258",
				"--gates",
				closeoutGatesPath,
				"--release-readiness-impact",
				"none",
			],
			runner,
		);

		expect(result.exitCode).toBe(0);
		expect(JSON.parse(result.output)).toMatchObject({
			lifecycleSnapshot: {
				worktreeRole: "orientation",
			},
			blockers: expect.arrayContaining([
				expect.objectContaining({
					surface: "branch",
					classification: "unknown",
					reason: "Unable to verify local HEAD against the pull request head.",
				}),
			]),
		});
	});

	it("does not mark live worktree implementation-safe when local head cannot be resolved", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const closeoutGatesPath = writeCloseoutGates(dir);
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					baseRefName: "main",
					reviewDecision: "APPROVED",
					body: PR_BODY_WITH_TRACEABILITY,
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				return prChecksForHead();
			}
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				return JSON.stringify({
					owner: { login: "jscraik" },
					name: "coding-harness",
				});
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/check-runs")
			) {
				return checkRunsForHead();
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return reviewThreadsGraphql();
			}
			if (command === "git" && args[0] === "status") return "";
			if (command === "git" && args[0] === "rev-parse") {
				throw new Error("HEAD unavailable");
			}
			if (command === "git" && args[0] === "rev-list") return "0\t0";
			return "ok";
		};

		const result = await capture(
			[
				"--json",
				"--repo",
				dir,
				"--pr",
				"258",
				"--gates",
				closeoutGatesPath,
				"--release-readiness-impact",
				"none",
			],
			runner,
		);

		expect(result.exitCode).toBe(0);
		expect(JSON.parse(result.output)).toMatchObject({
			lifecycleSnapshot: {
				worktreeRole: "orientation",
			},
			blockers: expect.arrayContaining([
				expect.objectContaining({
					surface: "branch",
					classification: "unknown",
					reason: "Unable to verify local HEAD against the pull request head.",
				}),
			]),
		});
	});

	it("falls back to a discovered remote base ref when origin is unavailable", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const closeoutGatesPath = writeCloseoutGates(dir);
		const gitCommandsSeen: string[] = [];
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					baseRefName: "main",
					reviewDecision: "APPROVED",
					body: PR_BODY_WITH_TRACEABILITY,
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				return prChecksForHead();
			}
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				return JSON.stringify({
					owner: { login: "jscraik" },
					name: "coding-harness",
				});
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/check-runs")
			) {
				return checkRunsForHead();
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return reviewThreadsGraphql();
			}
			if (command === "git") {
				gitCommandsSeen.push(args.join(" "));
				if (args[0] === "status") return "";
				if (args[0] === "rev-parse") return "abc123";
				if (args[0] === "for-each-ref") {
					return "refs/remotes/upstream/main\nrefs/remotes/origin/HEAD";
				}
				if (
					args[0] === "rev-list" &&
					args[3] === "refs/remotes/origin/main...HEAD"
				) {
					throw new Error("origin base ref missing");
				}
				if (
					args[0] === "rev-list" &&
					args[3] === "refs/remotes/upstream/main...HEAD"
				) {
					return "0\t1";
				}
			}
			return "ok";
		};

		const result = await capture(
			[
				"--json",
				"--repo",
				dir,
				"--pr",
				"258",
				"--gates",
				closeoutGatesPath,
				"--release-readiness-impact",
				"none",
			],
			runner,
		);

		expect(result.exitCode).toBe(0);
		expect(gitCommandsSeen).toEqual(
			expect.arrayContaining([
				"rev-list --left-right --count refs/remotes/origin/main...HEAD",
				"rev-list --left-right --count refs/remotes/upstream/main...HEAD",
			]),
		);
		expect(JSON.parse(result.output)).toMatchObject({
			lifecycleSnapshot: {
				worktreeRole: "implementation",
			},
		});
	});

	it("ignores remote refs that only share the base branch suffix", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const closeoutGatesPath = writeCloseoutGates(dir);
		const gitCommandsSeen: string[] = [];
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					baseRefName: "main",
					reviewDecision: "APPROVED",
					body: PR_BODY_WITH_TRACEABILITY,
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				return prChecksForHead();
			}
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				return JSON.stringify({
					owner: { login: "jscraik" },
					name: "coding-harness",
				});
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/check-runs")
			) {
				return checkRunsForHead();
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return reviewThreadsGraphql();
			}
			if (command === "git") {
				gitCommandsSeen.push(args.join(" "));
				if (args[0] === "status") return "";
				if (args[0] === "rev-parse") return "abc123";
				if (args[0] === "for-each-ref") {
					return "refs/remotes/upstream/release/main\nrefs/remotes/origin/HEAD";
				}
				if (args[0] === "rev-list") {
					throw new Error("base ref unavailable");
				}
			}
			return "ok";
		};

		const result = await capture(
			[
				"--json",
				"--repo",
				dir,
				"--pr",
				"258",
				"--gates",
				closeoutGatesPath,
				"--release-readiness-impact",
				"none",
			],
			runner,
		);

		expect(result.exitCode).toBe(0);
		expect(gitCommandsSeen).toEqual(
			expect.arrayContaining([
				"rev-list --left-right --count refs/remotes/origin/main...HEAD",
			]),
		);
		expect(gitCommandsSeen).not.toContain(
			"rev-list --left-right --count refs/remotes/upstream/release/main...HEAD",
		);
		expect(JSON.parse(result.output)).toMatchObject({
			lifecycleSnapshot: {
				worktreeRole: "orientation",
			},
		});
	});

	it("keeps --phase-exit as a compatibility alias for closeout gates", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const closeoutGatesPath = writeCloseoutGates(dir, PASSING_PHASE_EXIT);
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					baseRefName: "main",
					reviewDecision: "APPROVED",
					body: PR_BODY_WITH_TRACEABILITY,
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				return prChecksForHead();
			}
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				return JSON.stringify({
					owner: { login: "jscraik" },
					name: "coding-harness",
				});
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/check-runs")
			) {
				return checkRunsForHead();
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return reviewThreadsGraphql();
			}
			if (command === "git") {
				return "";
			}
			return "ok";
		};

		const result = await capture(
			[
				"--json",
				"--repo",
				dir,
				"--pr",
				"258",
				"--phase-exit",
				closeoutGatesPath,
				"--release-readiness-impact",
				"none",
			],
			runner,
		);

		expect(result.exitCode).toBe(0);
		expect(JSON.parse(result.output)).toMatchObject({
			status: "ready",
			harnessGates: {
				evidenceSource: "closeout_gates",
				closeoutGatesPresent: true,
				phaseExitPresent: false,
			},
		});
	});

	it("fails closed when live GitHub review threads cannot be observed", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const closeoutGatesPath = writeCloseoutGates(dir);
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					baseRefName: "main",
					reviewDecision: "APPROVED",
					body: PR_BODY_WITH_TRACEABILITY,
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				return prChecksForHead();
			}
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				throw new Error("repo metadata unavailable");
			}
			if (command === "git") {
				return "";
			}
			return "ok";
		};

		const result = await capture(
			[
				"--json",
				"--repo",
				dir,
				"--pr",
				"258",
				"--gates",
				closeoutGatesPath,
				"--release-readiness-impact",
				"none",
			],
			runner,
		);
		const report = JSON.parse(result.output);

		expect(result.exitCode).toBe(0);
		expect(report).toMatchObject({
			status: "blocked",
			nextAction: "needs_jamie_decision",
			reviewThreads: {
				unresolved: null,
			},
		});
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "review",
					reason:
						"Review thread state is unobserved; live GitHub reviewThreads evidence is required before PR closeout.",
				}),
			]),
		);
	});

	it("uses check evidence from non-zero gh pr checks stdout", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const closeoutGatesPath = writeCloseoutGates(dir);
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					baseRefName: "main",
					reviewDecision: "APPROVED",
					body: PR_BODY_WITH_TRACEABILITY,
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				const error = new Error(
					"gh pr checks exited with status 8",
				) as Error & {
					stdout: string;
				};
				error.stdout = prChecksForHead();
				throw error;
			}
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				return JSON.stringify({
					owner: { login: "jscraik" },
					name: "coding-harness",
				});
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/check-runs")
			) {
				return checkRunsForHead();
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return reviewThreadsGraphql();
			}
			if (command === "git") {
				return "";
			}
			return "ok";
		};

		const result = await capture(
			[
				"--json",
				"--repo",
				dir,
				"--pr",
				"258",
				"--gates",
				closeoutGatesPath,
				"--release-readiness-impact",
				"none",
			],
			runner,
		);
		const report = JSON.parse(result.output) as {
			status: string;
			tools: Array<{ failureClass: string | null }>;
		};

		expect(result.exitCode).toBe(0);
		expect(report.status).toBe("ready");
		expect(
			report.tools.some((tool) =>
				tool.failureClass?.startsWith("pr_checks_unreadable"),
			),
		).toBe(false);
	});

	it("asks GitHub for required PR checks only", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const closeoutGatesPath = writeCloseoutGates(dir);
		const checkArgs: string[][] = [];
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					baseRefName: "main",
					reviewDecision: "APPROVED",
					body: PR_BODY_WITH_TRACEABILITY,
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				checkArgs.push([...args]);
				return prChecksForHead();
			}
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				return JSON.stringify({
					owner: { login: "jscraik" },
					name: "coding-harness",
				});
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/check-runs")
			) {
				return checkRunsForHead();
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return reviewThreadsGraphql();
			}
			if (command === "git") {
				return "";
			}
			return "ok";
		};

		const result = await capture(
			[
				"--json",
				"--repo",
				dir,
				"--pr",
				"258",
				"--gates",
				closeoutGatesPath,
				"--release-readiness-impact",
				"none",
			],
			runner,
		);

		expect(result.exitCode).toBe(0);
		expect(checkArgs).toEqual([
			["pr", "checks", "258", "--required", "--json", "name,state,link"],
		]);
	});

	it("marks normalized gh pr checks as required", () => {
		expect(normalizeGhChecks(JSON.parse(prChecksForHead()) as unknown)).toEqual(
			[
				expect.objectContaining({
					name: "pr-pipeline",
					required: true,
				}),
			],
		);
	});

	it("does not attach current-head proof by check name alone", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const closeoutGatesPath = writeCloseoutGates(dir);
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					baseRefName: "main",
					reviewDecision: "APPROVED",
					body: PR_BODY_WITH_TRACEABILITY,
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				return JSON.stringify([
					{
						name: "pr-pipeline",
						state: "SUCCESS",
						link: "https://ci.example/stale-or-different-check",
					},
				]);
			}
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				return JSON.stringify({
					owner: { login: "jscraik" },
					name: "coding-harness",
				});
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/check-runs")
			) {
				return checkRunsForHead();
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return reviewThreadsGraphql();
			}
			if (command === "git") {
				return "";
			}
			return "ok";
		};

		const result = await capture(
			[
				"--json",
				"--repo",
				dir,
				"--pr",
				"258",
				"--gates",
				closeoutGatesPath,
				"--release-readiness-impact",
				"none",
			],
			runner,
		);
		const report = JSON.parse(result.output) as {
			status: string;
			claims: Array<{ claim: string; freshness: string }>;
		};

		expect(result.exitCode).toBe(0);
		expect(report.status).not.toBe("ready");
		expect(report.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					claim: "required_checks_match_current_head",
					freshness: "unknown",
				}),
			]),
		);
	});

	it("paginates current-head check proof", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const closeoutGatesPath = writeCloseoutGates(dir);
		const checkRunPages: string[] = [];
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					reviewDecision: "APPROVED",
					body: PR_BODY_WITH_TRACEABILITY,
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				return prChecksForHead();
			}
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				return JSON.stringify({
					owner: { login: "jscraik" },
					name: "coding-harness",
				});
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/check-runs")
			) {
				const path = String(args[1]);
				checkRunPages.push(path);
				if (path.includes("&page=1")) {
					return checkRunsPage(
						Array.from({ length: 100 }, (_, index) => ({
							name: `other-check-${index}`,
							head_sha: "abc123",
							html_url: `https://ci.example/other-${index}`,
						})),
					);
				}
				return checkRunsForHead();
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return reviewThreadsGraphql();
			}
			if (command === "git") {
				return "";
			}
			return "ok";
		};

		const result = await capture(
			[
				"--json",
				"--repo",
				dir,
				"--pr",
				"258",
				"--gates",
				closeoutGatesPath,
				"--release-readiness-impact",
				"none",
			],
			runner,
		);
		const report = JSON.parse(result.output) as { status: string };

		expect(result.exitCode).toBe(0);
		expect(report.status).toBe("ready");
		expect(checkRunPages).toEqual([
			expect.stringContaining("page=1"),
			expect.stringContaining("page=2"),
		]);
	});

	it("matches check-run proof by details URL before HTML URL", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const closeoutGatesPath = writeCloseoutGates(dir);
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					reviewDecision: "APPROVED",
					body: PR_BODY_WITH_TRACEABILITY,
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				return JSON.stringify([
					{
						name: "pr-pipeline",
						state: "SUCCESS",
						link: "https://ci.example/details",
					},
				]);
			}
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				return JSON.stringify({
					owner: { login: "jscraik" },
					name: "coding-harness",
				});
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/check-runs")
			) {
				return checkRunsPage([
					{
						name: "pr-pipeline",
						head_sha: "abc123",
						details_url: "https://ci.example/details",
						html_url: "https://ci.example/html",
					},
				]);
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return reviewThreadsGraphql();
			}
			if (command === "git") {
				return "";
			}
			return "ok";
		};

		const result = await capture(
			[
				"--json",
				"--repo",
				dir,
				"--pr",
				"258",
				"--gates",
				closeoutGatesPath,
				"--release-readiness-impact",
				"none",
			],
			runner,
		);
		const report = JSON.parse(result.output) as { status: string };

		expect(result.exitCode).toBe(0);
		expect(report.status).toBe("ready");
	});

	it.each([
		["explicit unknown", ["--release-readiness-impact", "unknown"] as const],
		["omitted flag", [] as const],
	])("blocks live closeout until release readiness is classified (%s)", async (_caseName, releaseReadinessArgs) => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const closeoutGatesPath = writeCloseoutGates(dir);
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					reviewDecision: "APPROVED",
					body: PR_BODY_WITH_TRACEABILITY,
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				return prChecksForHead();
			}
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				return JSON.stringify({
					owner: { login: "jscraik" },
					name: "coding-harness",
				});
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/check-runs")
			) {
				return checkRunsForHead();
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return reviewThreadsGraphql();
			}
			if (command === "git") {
				if (args[0] === "status") return "";
				if (args[0] === "rev-parse") return "abc123";
				if (args[0] === "rev-list") return "0\t0";
			}
			return "ok";
		};

		const result = await capture(
			[
				"--json",
				"--repo",
				dir,
				"--pr",
				"258",
				"--gates",
				closeoutGatesPath,
				...releaseReadinessArgs,
			],
			runner,
		);
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
		expect(report.status).toBe("blocked");
		expect(report.mergeable).toBe(false);
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "release_readiness",
					classification: "unknown",
					ref: "input:releaseReadinessImpact:unknown",
				}),
			]),
		);
		expect(report.lifecycleSnapshot.releaseReadinessImpact).toBe("unknown");
	});

	it("attaches current-head proof from classic commit statuses", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const closeoutGatesPath = writeCloseoutGates(dir);
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					reviewDecision: "APPROVED",
					body: PR_BODY_WITH_TRACEABILITY,
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				return JSON.stringify([
					{
						name: "pr-pipeline",
						state: "SUCCESS",
						link: "https://ci.example/status",
					},
				]);
			}
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				return JSON.stringify({
					owner: { login: "jscraik" },
					name: "coding-harness",
				});
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/check-runs")
			) {
				return checkRunsPage([]);
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/statuses")
			) {
				return commitStatuses([
					{
						context: "pr-pipeline",
						target_url: "https://ci.example/status",
						sha: "abc123",
					},
				]);
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return reviewThreadsGraphql();
			}
			if (command === "git") {
				return "";
			}
			return "ok";
		};

		const result = await capture(
			[
				"--json",
				"--repo",
				dir,
				"--pr",
				"258",
				"--gates",
				closeoutGatesPath,
				"--release-readiness-impact",
				"none",
			],
			runner,
		);
		const report = JSON.parse(result.output) as { status: string };

		expect(result.exitCode).toBe(0);
		expect(report.status).toBe("ready");
	});

	it("falls back to status context proof when the status URL differs", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const closeoutGatesPath = writeCloseoutGates(dir);
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					reviewDecision: "APPROVED",
					body: PR_BODY_WITH_TRACEABILITY,
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				return JSON.stringify([
					{
						name: "pr-pipeline",
						state: "SUCCESS",
						link: "https://checks.example/pr-pipeline",
					},
				]);
			}
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				return JSON.stringify({
					owner: { login: "jscraik" },
					name: "coding-harness",
				});
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/check-runs")
			) {
				return checkRunsPage([]);
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/statuses")
			) {
				return commitStatuses([
					{
						context: "pr-pipeline",
						target_url: "https://status.example/legacy-context",
						sha: "abc123",
					},
				]);
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return reviewThreadsGraphql();
			}
			if (command === "git") {
				return "";
			}
			return "ok";
		};

		const result = await capture(
			[
				"--json",
				"--repo",
				dir,
				"--pr",
				"258",
				"--gates",
				closeoutGatesPath,
				"--release-readiness-impact",
				"none",
			],
			runner,
		);
		const report = JSON.parse(result.output) as { status: string };

		expect(result.exitCode).toBe(0);
		expect(report.status).toBe("ready");
	});

	it("attaches current-head proof from classic statuses without target URLs", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const closeoutGatesPath = writeCloseoutGates(dir);
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					reviewDecision: "APPROVED",
					body: PR_BODY_WITH_TRACEABILITY,
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				return JSON.stringify([
					{
						name: "pr-pipeline",
						state: "SUCCESS",
					},
				]);
			}
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				return JSON.stringify({
					owner: { login: "jscraik" },
					name: "coding-harness",
				});
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/check-runs")
			) {
				return checkRunsPage([]);
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/statuses")
			) {
				return commitStatuses([
					{
						context: "pr-pipeline",
						sha: "abc123",
					},
				]);
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return reviewThreadsGraphql();
			}
			if (command === "git") {
				return "";
			}
			return "ok";
		};

		const result = await capture(
			[
				"--json",
				"--repo",
				dir,
				"--pr",
				"258",
				"--gates",
				closeoutGatesPath,
				"--release-readiness-impact",
				"none",
			],
			runner,
		);
		const report = JSON.parse(result.output) as { status: string };

		expect(result.exitCode).toBe(0);
		expect(report.status).toBe("ready");
	});

	it("attaches status-backed proof when status sha is omitted", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const closeoutGatesPath = writeCloseoutGates(dir);
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					reviewDecision: "APPROVED",
					body: PR_BODY_WITH_TRACEABILITY,
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				return JSON.stringify([
					{
						name: "pr-pipeline",
						state: "SUCCESS",
						link: "https://ci.example/status",
					},
				]);
			}
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				return JSON.stringify({
					owner: { login: "jscraik" },
					name: "coding-harness",
				});
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/check-runs")
			) {
				return checkRunsPage([]);
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/statuses")
			) {
				return commitStatuses([
					{
						context: "pr-pipeline",
						target_url: "https://ci.example/status",
					},
				]);
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return reviewThreadsGraphql();
			}
			if (command === "git") {
				return "";
			}
			return "ok";
		};

		const result = await capture(
			[
				"--json",
				"--repo",
				dir,
				"--pr",
				"258",
				"--gates",
				closeoutGatesPath,
				"--release-readiness-impact",
				"none",
			],
			runner,
		);
		const report = JSON.parse(result.output) as { status: string };

		expect(result.exitCode).toBe(0);
		expect(report.status).toBe("ready");
	});

	it("records tool evidence when status proof cannot be read", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const closeoutGatesPath = writeCloseoutGates(dir);
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					reviewDecision: "APPROVED",
					body: PR_BODY_WITH_TRACEABILITY,
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				return JSON.stringify([
					{
						name: "pr-pipeline",
						state: "SUCCESS",
						link: "https://ci.example/status",
					},
				]);
			}
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				return JSON.stringify({
					owner: { login: "jscraik" },
					name: "coding-harness",
				});
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/check-runs")
			) {
				return checkRunsPage([]);
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/statuses")
			) {
				throw new Error("statuses endpoint unavailable");
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return reviewThreadsGraphql();
			}
			if (command === "git") {
				return "";
			}
			return "ok";
		};

		const result = await capture(
			[
				"--json",
				"--repo",
				dir,
				"--pr",
				"258",
				"--gates",
				closeoutGatesPath,
				"--release-readiness-impact",
				"none",
			],
			runner,
		);
		const report = JSON.parse(result.output) as {
			tools: Array<{
				ref: string;
				status: string;
				failureClass: string | null;
			}>;
		};

		expect(result.exitCode).toBe(0);
		expect(report.tools).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					ref: expect.stringContaining("/statuses page=1"),
					status: "blocked",
					failureClass: expect.stringContaining(
						"pr_check_status_proof_unreadable",
					),
				}),
			]),
		);
	});

	it("uses HARNESS_GH_BIN and reports silent GitHub CLI failures", async () => {
		const previousOverride = process.env.HARNESS_GH_BIN;
		process.env.HARNESS_GH_BIN = "/opt/homebrew/bin/gh";
		const commandsSeen: string[] = [];
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "/opt/homebrew/bin/gh") {
				commandsSeen.push(args.join(" "));
				throw { status: -1, stdout: "", stderr: "" };
			}
			if (command === "git") return "";
			return "ok";
		};
		try {
			const result = await capture(["--json", "--pr", "258"], runner);
			const report = JSON.parse(result.output) as {
				tools: Array<{ failureClass: string | null; ref: string }>;
			};

			expect(commandsSeen).toContain("--version");
			expect(commandsSeen).toContain(
				"pr view 258 --json number,title,state,isDraft,mergeStateStatus,url,headRefOid,headRefName,baseRefName,reviewDecision,body",
			);
			expect(report.tools).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						ref: "command:gh --version",
						failureClass: expect.stringContaining("github_cli_failed_silently"),
					}),
					expect.objectContaining({
						ref: expect.stringContaining("command:gh pr view 258"),
						failureClass: expect.stringContaining("source=HARNESS_GH_BIN"),
					}),
				]),
			);
		} finally {
			if (previousOverride === undefined) {
				delete process.env.HARNESS_GH_BIN;
			} else {
				process.env.HARNESS_GH_BIN = previousOverride;
			}
		}
	});

	it("falls back to commit statuses when check-runs proof cannot be read", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const closeoutGatesPath = writeCloseoutGates(dir);
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					reviewDecision: "APPROVED",
					body: PR_BODY_WITH_TRACEABILITY,
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				return JSON.stringify([
					{
						name: "pr-pipeline",
						state: "SUCCESS",
						link: "https://ci.example/status",
					},
				]);
			}
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				return JSON.stringify({
					owner: { login: "jscraik" },
					name: "coding-harness",
				});
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/check-runs")
			) {
				throw new Error("check-runs endpoint unavailable");
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/statuses")
			) {
				return commitStatuses([
					{
						context: "pr-pipeline",
						target_url: "https://ci.example/status",
						sha: "abc123",
					},
				]);
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return reviewThreadsGraphql();
			}
			if (command === "git") return "";
			return "ok";
		};

		const result = await capture(
			[
				"--json",
				"--repo",
				dir,
				"--pr",
				"258",
				"--gates",
				closeoutGatesPath,
				"--release-readiness-impact",
				"none",
			],
			runner,
		);
		const report = JSON.parse(result.output) as { status: string };

		expect(result.exitCode).toBe(0);
		expect(report.status).toBe("ready");
	});

	it("paginates reviewThreads before classifying unresolved conversations", () => {
		const tools: Parameters<typeof fetchReviewThreads>[3] = [];
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				return JSON.stringify({
					owner: { login: "jscraik" },
					name: "coding-harness",
				});
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return args.some((arg) => arg === "after=cursor-1")
					? reviewThreadsGraphql(1)
					: reviewThreadsGraphql(0, {
							hasNextPage: true,
							endCursor: "cursor-1",
						});
			}
			return "ok";
		};

		const reviewThreads = fetchReviewThreads(
			{ json: true, repoRoot: process.cwd(), prNumber: 258 },
			process.env,
			runner,
			tools,
		);

		expect(reviewThreads.unresolved).toBe(1);
		expect(reviewThreads.autofixable).toBeNull();
		expect(tools).toEqual([]);
	});

	it("does not count PR template placeholders as traceability evidence", async () => {
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					reviewDecision: "APPROVED",
					body: `
Refs JSC-328

## Work performed

- Session IDs: list Codex thread/session IDs, session-collector artifact IDs or paths, harness run IDs, or n.a. with reason
- Trace IDs: list CI workflow/job URLs, harness/eval/runtime trace IDs, runtime-card/evidence bundle artifact paths, review trace IDs, or n.a. with reason
- AI session / traceability: map the AI session or trace reference to the work it supports
`.trim(),
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				return prChecksForHead();
			}
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				return JSON.stringify({
					owner: { login: "jscraik" },
					name: "coding-harness",
				});
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/check-runs")
			) {
				return checkRunsForHead();
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return reviewThreadsGraphql();
			}
			if (command === "git") {
				return "";
			}
			return "ok";
		};

		const result = await capture(["--json", "--pr", "258"], runner);
		const report = JSON.parse(result.output) as {
			status: string;
			traceability: { complete: boolean };
			blockers: Array<{ surface: string }>;
		};

		expect(result.exitCode).toBe(0);
		expect(report.status).toBe("fixable");
		expect(report.traceability.complete).toBe(false);
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ surface: "traceability" }),
			]),
		);
	});

	it("keeps concrete map-prefixed traceability text from PR body fields", async () => {
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					reviewDecision: "APPROVED",
					body: `
Refs JSC-328

## Work performed

- Session IDs: n.a. with reason: AI traceability field carries the concrete evidence.
- Trace IDs: n.a. with reason: no external trace was produced.
- AI session / traceability: map codex-session:2026-05-20 to the closeout parser fix.
`.trim(),
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				return prChecksForHead();
			}
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				return JSON.stringify({
					owner: { login: "jscraik" },
					name: "coding-harness",
				});
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/check-runs")
			) {
				return checkRunsForHead();
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return reviewThreadsGraphql();
			}
			if (command === "git") {
				return "";
			}
			return "ok";
		};

		const result = await capture(["--json", "--pr", "258"], runner);
		const report = JSON.parse(result.output) as {
			traceability: { complete: boolean; aiSessionTraceability: string | null };
			blockers: Array<{ surface: string }>;
		};

		expect(result.exitCode).toBe(0);
		expect(report.traceability).toMatchObject({
			complete: true,
			aiSessionTraceability:
				"map codex-session:2026-05-20 to the closeout parser fix.",
		});
		expect(report.blockers).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ surface: "traceability" }),
			]),
		);
	});

	it("accepts angle-bracketed evidence URLs from PR body fields", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const closeoutGatesPath = writeCloseoutGates(dir);
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					reviewDecision: "APPROVED",
					body: `
Refs JSC-328

## Work performed

- Session IDs: <https://codex.example/sessions/abc>
- Trace IDs: <https://circleci.com/workflow/123>
- AI session / traceability: <https://trace.example/run/456>
- Rollback: <https://github.com/jscraik/coding-harness/pull/265>
`.trim(),
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				return prChecksForHead();
			}
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				return JSON.stringify({
					owner: { login: "jscraik" },
					name: "coding-harness",
				});
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/check-runs")
			) {
				return checkRunsForHead();
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return reviewThreadsGraphql();
			}
			if (command === "git") {
				return "";
			}
			return "ok";
		};

		const result = await capture(
			[
				"--json",
				"--repo",
				dir,
				"--pr",
				"258",
				"--gates",
				closeoutGatesPath,
				"--release-readiness-impact",
				"none",
			],
			runner,
		);
		const report = JSON.parse(result.output) as {
			status: string;
			traceability: {
				complete: boolean;
				sessionIds: string[];
				traceIds: string[];
			};
			claims: Array<{
				claim: string;
				status: string;
				evidenceRef: string | null;
			}>;
		};

		expect(result.exitCode).toBe(0);
		expect(report.status).toBe("ready");
		expect(report.traceability).toMatchObject({
			complete: true,
			sessionIds: ["<https://codex.example/sessions/abc>"],
			traceIds: ["<https://circleci.com/workflow/123>"],
		});
		expect(report.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					claim: "rollback_path_named_or_not_applicable",
					status: "pass",
				}),
			]),
		);
	});

	it("blocks live reports when rollback evidence is missing", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const closeoutGatesPath = writeCloseoutGates(dir);
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					reviewDecision: "APPROVED",
					body: PR_BODY_WITH_TRACEABILITY.replace(/^- Rollback:.*\n/mu, ""),
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				return prChecksForHead();
			}
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				return JSON.stringify({
					owner: { login: "jscraik" },
					name: "coding-harness",
				});
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/check-runs")
			) {
				return checkRunsForHead();
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return reviewThreadsGraphql();
			}
			if (command === "git") {
				return "";
			}
			return "ok";
		};

		const result = await capture(
			[
				"--json",
				"--repo",
				dir,
				"--pr",
				"258",
				"--gates",
				closeoutGatesPath,
				"--release-readiness-impact",
				"none",
			],
			runner,
		);
		const report = JSON.parse(result.output) as {
			status: string;
			claims: Array<{
				claim: string;
				status: string;
				evidenceRef: string | null;
			}>;
		};

		expect(result.exitCode).toBe(0);
		expect(report.status).not.toBe("ready");
		expect(report.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					claim: "rollback_path_named_or_not_applicable",
					status: "unknown",
					evidenceRef: null,
				}),
			]),
		);
	});

	it("accepts the repo template risk and rollback plan field", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const closeoutGatesPath = writeCloseoutGates(dir);
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					reviewDecision: "APPROVED",
					body: PR_BODY_WITH_TRACEABILITY.replace(
						/^- Rollback:.*\n/mu,
						"- Risk and rollback plan: not applicable; docs-only closeout.\n",
					),
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				return prChecksForHead();
			}
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				return JSON.stringify({
					owner: { login: "jscraik" },
					name: "coding-harness",
				});
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/check-runs")
			) {
				return checkRunsForHead();
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return reviewThreadsGraphql();
			}
			if (command === "git") {
				return "";
			}
			return "ok";
		};

		const result = await capture(
			[
				"--json",
				"--repo",
				dir,
				"--pr",
				"258",
				"--gates",
				closeoutGatesPath,
				"--release-readiness-impact",
				"none",
			],
			runner,
		);
		const report = JSON.parse(result.output) as { status: string };

		expect(result.exitCode).toBe(0);
		expect(report.status).toBe("ready");
	});

	it("sanitizes caller git env vars for live git branch probes", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const closeoutGatesPath = writeCloseoutGates(dir);
		const envFile = join(dir, ".env");
		writeFileSync(
			envFile,
			[
				"PR_CLOSEOUT_TEST_TOKEN=loaded",
				"GIT_ALTERNATE_OBJECT_DIRECTORIES=/tmp/wrong-repo/alternates",
				"GIT_COMMON_DIR=/tmp/wrong-repo/.git",
				"GIT_DIR=/tmp/wrong-repo/.git",
				"GIT_INDEX_FILE=/tmp/wrong-repo/index",
				"GIT_OBJECT_DIRECTORY=/tmp/wrong-repo/objects",
				"GIT_QUARANTINE_PATH=/tmp/wrong-repo/quarantine",
				"GIT_WORK_TREE=/tmp/wrong-repo",
			].join("\n"),
		);
		const gitCommandsSeen: string[] = [];
		const taintedGitEnv = {
			GIT_ALTERNATE_OBJECT_DIRECTORIES: "/tmp/inherited-wrong-repo/alternates",
			GIT_COMMON_DIR: "/tmp/inherited-wrong-repo/.git",
			GIT_DIR: "/tmp/inherited-wrong-repo/.git",
			GIT_INDEX_FILE: "/tmp/inherited-wrong-repo/index",
			GIT_OBJECT_DIRECTORY: "/tmp/inherited-wrong-repo/objects",
			GIT_QUARANTINE_PATH: "/tmp/inherited-wrong-repo/quarantine",
			GIT_WORK_TREE: "/tmp/inherited-wrong-repo",
		};
		const previousGitEnv = new Map(
			Object.keys(taintedGitEnv).map((name) => [name, process.env[name]]),
		);
		for (const [name, value] of Object.entries(taintedGitEnv)) {
			process.env[name] = value;
		}
		const runner = (
			command: string,
			args: readonly string[],
			options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					baseRefName: "main",
					reviewDecision: "APPROVED",
					body: PR_BODY_WITH_TRACEABILITY,
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				return prChecksForHead();
			}
			if (command === "gh" && args[0] === "repo" && args[1] === "view") {
				return JSON.stringify({
					owner: { login: "jscraik" },
					name: "coding-harness",
				});
			}
			if (
				command === "gh" &&
				args[0] === "api" &&
				String(args[1]).includes("/check-runs")
			) {
				return checkRunsForHead();
			}
			if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
				return reviewThreadsGraphql();
			}
			if (command === "git") {
				gitCommandsSeen.push(args.join(" "));
				expect(options.env?.PR_CLOSEOUT_TEST_TOKEN).toBe("loaded");
				expect(options.env?.GIT_ALTERNATE_OBJECT_DIRECTORIES).toBeUndefined();
				expect(options.env?.GIT_COMMON_DIR).toBeUndefined();
				expect(options.env?.GIT_DIR).toBeUndefined();
				expect(options.env?.GIT_INDEX_FILE).toBeUndefined();
				expect(options.env?.GIT_OBJECT_DIRECTORY).toBeUndefined();
				expect(options.env?.GIT_QUARANTINE_PATH).toBeUndefined();
				expect(options.env?.GIT_WORK_TREE).toBeUndefined();
				if (args[0] === "status") return "";
				if (args[0] === "rev-parse") return "abc123";
				if (args[0] === "rev-list") return "0\t0";
			}
			return "ok";
		};

		try {
			const result = await capture(
				[
					"--json",
					"--repo",
					dir,
					"--pr",
					"258",
					"--gates",
					closeoutGatesPath,
					"--env-file",
					envFile,
				],
				runner,
			);

			expect(result.exitCode).toBe(0);
			expect(gitCommandsSeen).toEqual(
				expect.arrayContaining([
					"status --porcelain",
					"rev-parse HEAD",
					"rev-list --left-right --count refs/remotes/origin/main...HEAD",
				]),
			);
		} finally {
			for (const [name, value] of previousGitEnv) {
				if (value === undefined) {
					delete process.env[name];
				} else {
					process.env[name] = value;
				}
			}
		}
	});

	it("emits blocker evidence when live PR metadata cannot be read", async () => {
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				throw new Error("authentication failed");
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				throw new Error("checks unavailable");
			}
			if (command === "git") {
				return "";
			}
			return "ok";
		};

		const result = await capture(["--json", "--pr", "258"], runner);
		const report = JSON.parse(result.output) as {
			schemaVersion: string;
			pr: number;
			status: string;
			blockers: Array<{ surface: string; reason: string }>;
		};

		expect(result.exitCode).toBe(0);
		expect(report).toMatchObject({
			schemaVersion: "pr-closeout/v1",
			pr: 258,
			status: "blocked",
		});
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "tool",
					reason: expect.stringContaining("pr_view_unreadable"),
				}),
			]),
		);
	});

	it("blocks live reports when GitHub check evidence cannot be read", async () => {
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return JSON.stringify({
					number: 258,
					state: "OPEN",
					isDraft: false,
					mergeStateStatus: "CLEAN",
					headRefOid: "abc123",
					reviewDecision: "APPROVED",
					body: PR_BODY_WITH_TRACEABILITY,
				});
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
				throw new Error("checks unavailable");
			}
			if (command === "git") {
				return "";
			}
			return "ok";
		};

		const result = await capture(["--json", "--pr", "258"], runner);
		const report = JSON.parse(result.output) as {
			status: string;
			blockers: Array<{ surface: string; reason: string }>;
		};

		expect(result.exitCode).toBe(0);
		expect(report.status).toBe("blocked");
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "tool",
					reason: expect.stringContaining("github_cli is blocked"),
				}),
			]),
		);
	});
});
