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
import { normalizeGhChecks } from "./pr-closeout-github.js";

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

function checkRunsPage(runs: Array<Record<string, unknown>>): string {
	return JSON.stringify(runs);
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

	it("attaches current-head proof by check name when URLs are unavailable", async () => {
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
		expect(report.status).toBe("ready");
		expect(report.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					claim: "required_checks_match_current_head",
					freshness: "current",
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
});
