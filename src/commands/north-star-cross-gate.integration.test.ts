import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	NORTH_STAR_DECISION_QUESTION_SPECS,
	NORTH_STAR_PRIMARY_BOTTLENECK,
	NORTH_STAR_PRIMARY_METRIC,
} from "../lib/contract/types.js";
import type { CheckRun } from "../lib/github/client.js";
import { GitHubClient } from "../lib/github/client.js";
import { normaliseReviewGateResult } from "../lib/output/normalise.js";
import { runPlanGate } from "../lib/plan-gate/detector.js";
import { runPreflightGate } from "../lib/preflight/validator.js";
import { runDriftGate } from "./drift-gate.js";
import { runReviewGate } from "./review-gate.js";

vi.mock("../lib/github/client.js", () => ({
	GitHubClient: vi.fn(),
}));
vi.mock("../lib/plan-gate/detector.js", () => ({
	runPlanGate: vi.fn(),
}));

const mockGitHubClient = vi.mocked(GitHubClient);
const mockRunPlanGate = vi.mocked(runPlanGate);

function write(path: string, content: string): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content, "utf-8");
}

function copyFromRepo(
	repoRoot: string,
	fixtureRoot: string,
	relativePath: string,
): void {
	write(
		join(fixtureRoot, relativePath),
		readFileSync(join(repoRoot, relativePath), "utf-8"),
	);
}

describe("north-star cross-gate consistency", () => {
	let tempDir: string;
	let originalCwd: string;
	let contractPath: string;

	beforeEach(() => {
		vi.clearAllMocks();
		mockRunPlanGate.mockReturnValue({
			passed: true,
			artifacts: [],
			errors: [],
			traceability: {
				planIds: ["feat-north-star-cross-gate"],
				matchedPlanIds: ["feat-north-star-cross-gate"],
				changedFiles: ["src/commands/review-gate.ts"],
			},
		});
		originalCwd = process.cwd();
		tempDir = join(
			tmpdir(),
			`harness-north-star-cross-gate-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
		);
		mkdirSync(tempDir, { recursive: true });
		process.chdir(tempDir);
		mkdirSync(".git", { recursive: true });
		contractPath = "harness.contract.json";
	});

	afterEach(() => {
		process.chdir(originalCwd);
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("blocks consistently across preflight, review-gate, and drift-gate for north-star contradictions", async () => {
		const firstSurface = {
			surfaceId: "review-gate",
			surfaceType: "command" as const,
			class: "core" as const,
			owner: "harness-core",
			northStarContribution: "Blocks north-star drift before merge.",
			manualGlueReductionClaim: "Replaces manual reviewer coordination loops.",
			reliabilityContribution: "Deterministic merge-readiness output.",
			evidenceReference: "docs/roadmap/north-star.md:1",
			ownedPaths: ["src/commands/review-gate.ts"],
			lastReviewedAt: "2026-04-22",
		};
		const contract = {
			version: "1.6.0",
			riskTierRules: {},
			reviewPolicy: {
				timeoutSeconds: 600,
				timeoutAction: "fail",
				enforceReviewerIndependence: true,
			},
			northStar: {
				mission:
					"Coding Harness exists to let humans steer and agents execute safely, with PR lead time as the primary north-star metric.",
				primaryMetric: NORTH_STAR_PRIMARY_METRIC,
				primaryBottleneck: NORTH_STAR_PRIMARY_BOTTLENECK,
				autonomyBoundary:
					"Low and medium-risk autonomy should be automated where evidence is deterministic and rollback is clear; high-risk changes remain human-mediated.",
				safetyFloor: [
					"deterministic evidence over intuition",
					"strict current-head SHA discipline",
				],
				nonGoals: ["governance surface area as a proxy for progress"],
				decisionQuestions: NORTH_STAR_DECISION_QUESTION_SPECS.map(
					(question) => ({
						id: question.id,
						prompt: question.prompt,
					}),
				),
			},
			productSurface: {
				surfaces: [firstSurface],
			},
			overrideReviewerRegistry: {
				trustedReviewers: [
					{
						reviewerId: "jscraik",
						reviewerType: "user",
						signatureRef: "github:jscraik",
						displayName: "Jamie Craik",
						status: "active",
					},
				],
			},
		};

		writeFileSync(
			join(tempDir, contractPath),
			JSON.stringify(contract, null, 2),
			"utf-8",
		);
		write(
			join(tempDir, "README.md"),
			[
				"# Coding Harness",
				"",
				"Primary metric: `cycle_time`.",
				"Primary bottleneck: `review_rework_loop`.",
			].join("\n"),
		);
		write(
			join(tempDir, "docs/roadmap/north-star.md"),
			[
				"# North Star",
				"",
				"- Primary metric: `cycle_time`",
				"- Primary bottleneck: `review_rework_loop`",
			].join("\n"),
		);
		write(
			join(tempDir, "docs/roadmap/agent-first-status.md"),
			[
				"# Matrix",
				"",
				"| Metric | Current | Trend |",
				"| --- | --- | --- |",
				"| `pr_lead_time_p50` | 18h | improving |",
			].join("\n"),
		);
		write(
			"docs/plans/2026-04-22-feat-north-star-cross-gate-plan.md",
			[
				"---",
				"title: North Star Cross Gate",
				"date: 2026-04-22",
				"type: feat",
				"status: draft",
				"plan_id: feat-north-star-cross-gate",
				"---",
				"",
				"## Implementation Steps",
				"",
				"- Keep preflight, review, and drift gates aligned.",
				"",
				"## Acceptance Checklist",
				"",
				"- [x] Cross-gate happy path includes evidence: [review-gate](/src/commands/review-gate.ts:1)",
			].join("\n"),
		);
		write(
			join(tempDir, "src/commands/review-gate.ts"),
			"export const placeholder = true;\n",
		);

		const preflightResult = await runPreflightGate({
			contractPath,
			files: [firstSurface.ownedPaths[0] ?? "README.md"],
			admission: {
				north_star_metric: "cycle_time",
				primary_bottleneck: NORTH_STAR_PRIMARY_BOTTLENECK,
				affected_surface_ids: [firstSurface.surfaceId],
				affected_surface_classes: [firstSurface.class],
				why_this_improves_throughput_or_reliability:
					"Exercises deterministic cross-gate contradiction handling.",
				evidence_links: [firstSurface.evidenceReference],
				metric_impact_declared: "path_strengthening",
				manual_glue_delta: 1,
				policy_surface_delta: 0,
			},
		});
		expect(preflightResult.passed).toBe(false);
		const admissionCheck = preflightResult.checks.find(
			(check) => check.id === "admission-declaration",
		);
		expect(
			admissionCheck,
			`admission-declaration check missing. checks=${JSON.stringify(preflightResult.checks)}`,
		).toBeDefined();
		if (!admissionCheck) {
			return;
		}
		expect(admissionCheck.message).toContain(
			"admission_incomplete: north_star_metric must match contract primaryMetric",
		);

		const headSha = "a".repeat(40);
		const checkRuns: CheckRun[] = [
			{
				id: 1001,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: headSha,
			},
		];
		mockGitHubClient.mockImplementation(
			() =>
				({
					listCheckRunsForRef: vi.fn().mockResolvedValue(checkRuns),
					getPullRequest: vi.fn().mockResolvedValue({
						number: 1,
						title: "North-star contradiction fixture",
						body: "- Plan IDs: `feat-north-star-cross-gate`",
						user: { login: "coding-actor" },
						head: { sha: headSha, ref: "feature/north-star" },
					}),
					listPullRequestReviews: vi.fn().mockResolvedValue([
						{
							state: "APPROVED",
							commit_id: headSha,
							user: { login: "independent-reviewer" },
						},
					]),
					listPullRequestFiles: vi
						.fn()
						.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				}) as unknown as GitHubClient,
		);

		const reviewResult = await runReviewGate({
			contractPath,
			token: "test-token",
			owner: "acme",
			repo: "repo",
			prNumber: 1,
			headSha,
			checkName: "review-check",
		});
		expect(reviewResult.ok).toBe(true);
		if (reviewResult.ok) {
			expect(reviewResult.output.verified).toBe(false);
			expect(
				reviewResult.output.blockers.some((blocker) =>
					blocker.startsWith("review_evidence_contradiction:"),
				),
			).toBe(true);
			const normalised = normaliseReviewGateResult(reviewResult);
			const blockedFailureClasses = (
				normalised.meta as { blockedFailureClasses?: string[] } | undefined
			)?.blockedFailureClasses;
			expect(blockedFailureClasses).toContain("review_evidence_contradiction");
		}

		const driftResult = runDriftGate({
			repoRoot: tempDir,
			mode: "health",
			seedBaseline: false,
		});
		expect(driftResult.exitCode).toBe(1);
		expect(
			driftResult.report.findings.some(
				(finding) =>
					finding.rule_id ===
					"status.north_star.contract_parity.north_star_doc",
			),
		).toBe(true);
	});

	it("passes consistently across preflight, review-gate, and drift-gate for aligned north-star surfaces", async () => {
		const productSurfaces = [
			{
				surfaceId: "review-gate",
				surfaceType: "command" as const,
				class: "core" as const,
				owner: "workflow",
				northStarContribution:
					"Enforces merge-readiness decisions on the throughput path with strict SHA and independent review checks.",
				manualGlueReductionClaim:
					"Converts repeated review comments into deterministic gate outcomes.",
				reliabilityContribution:
					"Maintains consistent merge-readiness decisions across reruns.",
				evidenceReference: "src/commands/review-gate.ts",
				ownedPaths: ["src/commands/review-gate.ts"],
				lastReviewedAt: "2026-04-21",
			},
			{
				surfaceId: "drift-gate",
				surfaceType: "command" as const,
				class: "core" as const,
				owner: "workflow",
				northStarContribution:
					"Fails fast when canonical north-star and status surfaces drift apart.",
				manualGlueReductionClaim:
					"Eliminates repetitive manual parity checks between roadmap and runtime-facing docs.",
				reliabilityContribution:
					"Produces deterministic drift findings with machine-readable remediation.",
				evidenceReference: "src/commands/drift-gate.ts",
				ownedPaths: [
					"src/commands/drift-gate.ts",
					"docs/roadmap/north-star.md",
					"docs/roadmap/agent-first-status.md",
					"README.md",
				],
				lastReviewedAt: "2026-04-21",
			},
			{
				surfaceId: "preflight-gate",
				surfaceType: "command" as const,
				class: "adjacent" as const,
				owner: "workflow",
				northStarContribution:
					"Blocks unjustified policy-surface additions before review and merge work starts.",
				manualGlueReductionClaim:
					"Promotes repeated human admission feedback into reusable guardrail checks.",
				reliabilityContribution:
					"Standardizes admission declarations before review-gate execution.",
				evidenceReference: "src/commands/preflight-gate.ts",
				reviewCadence: "per_release" as const,
				ownedPaths: ["src/commands/preflight-gate.ts"],
				lastReviewedAt: "2026-04-21",
			},
			{
				surfaceId: "north-star-roadmap-doc",
				surfaceType: "document" as const,
				class: "adjacent" as const,
				owner: "workflow",
				northStarContribution:
					"Defines the canonical mission, metric, bottleneck, and safety floor consumed by runtime checks.",
				manualGlueReductionClaim:
					"Removes ad-hoc interpretation by keeping one canonical narrative source.",
				reliabilityContribution:
					"Anchors runtime and status surfaces to stable canonical wording.",
				evidenceReference: "docs/roadmap/north-star.md",
				reviewCadence: "per_release" as const,
				ownedPaths: ["docs/roadmap/north-star.md"],
				lastReviewedAt: "2026-04-21",
			},
			{
				surfaceId: "agent-first-status-matrix",
				surfaceType: "document" as const,
				class: "adjacent" as const,
				owner: "workflow",
				northStarContribution:
					"Tracks north-star outcomes with throughput-path and guardrail effectiveness metrics.",
				manualGlueReductionClaim:
					"Reduces manual interpretation overhead during readiness and release checks.",
				reliabilityContribution:
					"Keeps status reporting constrained to canonical outcome metrics.",
				evidenceReference: "docs/roadmap/agent-first-status.md",
				reviewCadence: "weekly" as const,
				ownedPaths: ["docs/roadmap/agent-first-status.md"],
				lastReviewedAt: "2026-04-21",
			},
		];
		const firstSurface = productSurfaces[0]!;
		const contract = {
			version: "1.6.0",
			riskTierRules: {},
			reviewPolicy: {
				timeoutSeconds: 600,
				timeoutAction: "fail",
				enforceReviewerIndependence: true,
			},
			northStar: {
				mission:
					"Coding Harness exists to let humans steer and agents execute safely, with PR lead time as the primary north-star metric.",
				primaryMetric: NORTH_STAR_PRIMARY_METRIC,
				primaryBottleneck: NORTH_STAR_PRIMARY_BOTTLENECK,
				autonomyBoundary:
					"Low and medium-risk autonomy should be automated where evidence is deterministic and rollback is clear; high-risk changes remain human-mediated.",
				safetyFloor: [
					"deterministic evidence over intuition",
					"strict current-head SHA discipline",
				],
				nonGoals: ["governance surface area as a proxy for progress"],
				decisionQuestions: NORTH_STAR_DECISION_QUESTION_SPECS.map(
					(question) => ({
						id: question.id,
						prompt: question.prompt,
					}),
				),
			},
			productSurface: {
				surfaces: productSurfaces,
			},
			overrideReviewerRegistry: {
				trustedReviewers: [
					{
						reviewerId: "jscraik",
						reviewerType: "user",
						signatureRef: "github:jscraik",
						displayName: "Jamie Craik",
						status: "active",
					},
				],
			},
		};

		writeFileSync(
			join(tempDir, contractPath),
			JSON.stringify(contract, null, 2),
			"utf-8",
		);
		copyFromRepo(originalCwd, tempDir, "README.md");
		copyFromRepo(originalCwd, tempDir, "docs/cli-reference.md");
		copyFromRepo(originalCwd, tempDir, "docs/QUALITY_SCORE.md");
		copyFromRepo(originalCwd, tempDir, "docs/roadmap/north-star.md");
		copyFromRepo(originalCwd, tempDir, "docs/roadmap/agent-first-status.md");
		copyFromRepo(originalCwd, tempDir, "src/cli.ts");
		copyFromRepo(originalCwd, tempDir, "src/lib/cli/registry/command-specs.ts");
		copyFromRepo(originalCwd, tempDir, "src/lib/cli/command-registry.ts");
		copyFromRepo(originalCwd, tempDir, "src/commands/review-gate.ts");
		copyFromRepo(originalCwd, tempDir, "src/commands/drift-gate.ts");
		copyFromRepo(originalCwd, tempDir, "src/commands/preflight-gate.ts");
		mkdirSync(join(tempDir, "todos"), { recursive: true });
		write(
			join(
				tempDir,
				".harness/guardrails/north-star/drift-baseline-latest.json",
			),
			JSON.stringify(
				{
					schemaVersion: "1.0.0",
					generated_at: "2026-04-22T00:00:00.000Z",
					findings: [],
				},
				null,
				2,
			),
		);

		const preflightResult = await runPreflightGate({
			contractPath,
			files: [firstSurface.ownedPaths[0] ?? "README.md"],
			admission: {
				north_star_metric: NORTH_STAR_PRIMARY_METRIC,
				primary_bottleneck: NORTH_STAR_PRIMARY_BOTTLENECK,
				affected_surface_ids: [firstSurface.surfaceId],
				affected_surface_classes: [firstSurface.class],
				why_this_improves_throughput_or_reliability:
					"Exercises the aligned happy path across north-star gates.",
				evidence_links: [firstSurface.evidenceReference],
				metric_impact_declared: "path_strengthening",
				manual_glue_delta: -1,
				policy_surface_delta: 0,
			},
		});
		expect(preflightResult.passed).toBe(true);

		const headSha = "b".repeat(40);
		const checkRuns: CheckRun[] = [
			{
				id: 1002,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: headSha,
			},
		];
		mockGitHubClient.mockImplementation(
			() =>
				({
					listCheckRunsForRef: vi.fn().mockResolvedValue(checkRuns),
					getPullRequest: vi.fn().mockResolvedValue({
						number: 1,
						title: "North-star aligned fixture",
						body: [
							"- Plan IDs: `feat-north-star-cross-gate`",
							"- lead_time_path: yes. Evidence: docs/roadmap/north-star.md:3",
							"- manual_glue: yes. Evidence: docs/roadmap/agent-first-status.md:5",
							"- agent_reliability: yes. Evidence: src/commands/review-gate.ts:1",
							"- safety_floor: yes. Evidence: harness.contract.json:1",
						].join("\n"),
						user: { login: "coding-actor" },
						head: { sha: headSha, ref: "feature/north-star" },
					}),
					listPullRequestReviews: vi.fn().mockResolvedValue([
						{
							state: "APPROVED",
							commit_id: headSha,
							user: { login: "independent-reviewer" },
						},
					]),
					listPullRequestFiles: vi
						.fn()
						.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				}) as unknown as GitHubClient,
		);

		const reviewResult = await runReviewGate({
			contractPath,
			token: "test-token",
			owner: "acme",
			repo: "repo",
			prNumber: 1,
			headSha,
			checkName: "review-check",
		});
		expect(reviewResult.ok).toBe(true);
		if (reviewResult.ok) {
			expect(reviewResult.output.verified).toBe(true);
			expect(reviewResult.output.blockers).toEqual([]);
		}

		const driftResult = runDriftGate({
			repoRoot: tempDir,
			mode: "health",
			seedBaseline: false,
		});
		expect(
			driftResult.exitCode,
			JSON.stringify(driftResult.report.findings, null, 2),
		).toBe(0);
		expect(driftResult.report.findings).toEqual([]);
	});
});
