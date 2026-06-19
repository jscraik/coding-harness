import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
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
import { fetchReviewThreads } from "./pr-closeout-github.js";

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

	it("fails closed when reviewThreads nodes are malformed", () => {
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
				return JSON.stringify({
					data: {
						repository: {
							pullRequest: {
								reviewThreads: {
									pageInfo: { hasNextPage: false, endCursor: null },
									nodes: [{ isResolved: "false" }],
								},
							},
						},
					},
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

		expect(reviewThreads.unresolved).toBeNull();
		expect(tools).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					failureClass: expect.stringContaining("pr_review_threads_unreadable"),
				}),
			]),
		);
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
