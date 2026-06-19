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
});
