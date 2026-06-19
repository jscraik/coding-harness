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
import { fetchCheckHeadProof } from "./pr-closeout-github.js";

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

function checkRunsPage(runs: Array<Record<string, unknown>>): string {
	return JSON.stringify(runs);
}

function commitStatuses(statuses: Array<Record<string, unknown>>): string {
	return JSON.stringify(statuses);
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

	it("does not fall back when checks already carry the current head sha", () => {
		const tools: Parameters<typeof fetchCheckHeadProof>[3] = [];
		const commands: string[] = [];
		const runner = (
			command: string,
			args: readonly string[],
			_options: { cwd: string; env?: NodeJS.ProcessEnv },
		): string => {
			commands.push(`${command} ${args.join(" ")}`);
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
				return JSON.stringify([]);
			}
			throw new Error(`unexpected command: ${command} ${args.join(" ")}`);
		};

		const proof = fetchCheckHeadProof(
			{ json: true, repoRoot: process.cwd(), prNumber: 258 },
			process.env,
			runner,
			tools,
			[
				{
					name: "pr-pipeline",
					state: "SUCCESS",
					url: null,
					headSha: "abc123",
					required: true,
					source: "github",
				},
			],
			"abc123",
		);

		expect(proof.size).toBe(0);
		expect(commands.some((command) => command.includes("/statuses"))).toBe(
			false,
		);
		expect(tools).toEqual([]);
	});
});
