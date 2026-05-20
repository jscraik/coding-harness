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

function writeEnvFile(dir: string): string {
	const path = join(dir, "codex.env");
	writeFileSync(path, "# test env file\n");
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
		const runArgs =
			args.includes("--pr") && !args.includes("--env-file")
				? [
						...args,
						"--env-file",
						writeEnvFile(mkdtempSync(join(tmpdir(), "pr-closeout-env-"))),
					]
				: args;
		const runOptions = runner ? { runner } : {};
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
		});
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

	it("collects live GitHub, CircleCI, CodeRabbit, and Snyk tool evidence", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pr-closeout-cli-"));
		const closeoutGatesPath = writeCloseoutGates(dir);
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
			["--json", "--repo", dir, "--pr", "258", "--gates", closeoutGatesPath],
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
			["--json", "--repo", dir, "--pr", "258", "--gates", closeoutGatesPath],
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
			["--json", "--repo", dir, "--pr", "258", "--gates", closeoutGatesPath],
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
			["--json", "--repo", dir, "--pr", "258", "--gates", closeoutGatesPath],
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
			["--json", "--repo", dir, "--pr", "258", "--gates", closeoutGatesPath],
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
			["--json", "--repo", dir, "--pr", "258", "--gates", closeoutGatesPath],
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
			["--json", "--repo", dir, "--pr", "258", "--gates", closeoutGatesPath],
			runner,
		);
		const report = JSON.parse(result.output) as { status: string };

		expect(result.exitCode).toBe(0);
		expect(report.status).toBe("ready");
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
			["--json", "--repo", dir, "--pr", "258", "--gates", closeoutGatesPath],
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
			["--json", "--repo", dir, "--pr", "258", "--gates", closeoutGatesPath],
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
			["--json", "--repo", dir, "--pr", "258", "--gates", closeoutGatesPath],
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
			["--json", "--repo", dir, "--pr", "258", "--gates", closeoutGatesPath],
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
			["--json", "--repo", dir, "--pr", "258", "--gates", closeoutGatesPath],
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
			["--json", "--repo", dir, "--pr", "258", "--gates", closeoutGatesPath],
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
			["--json", "--repo", dir, "--pr", "258", "--gates", closeoutGatesPath],
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
			["--json", "--repo", dir, "--pr", "258", "--gates", closeoutGatesPath],
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
			["--json", "--repo", dir, "--pr", "258", "--gates", closeoutGatesPath],
			runner,
		);
		const report = JSON.parse(result.output) as { status: string };

		expect(result.exitCode).toBe(0);
		expect(report.status).toBe("ready");
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
