import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type PartialDeep, fromPartial } from "@total-typescript/shoehorn";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeNorthStarOverrideAcknowledgement } from "../lib/contract/north-star-artifact-io.js";
import {
	NORTH_STAR_DECISION_QUESTION_SPECS,
	NORTH_STAR_PRIMARY_BOTTLENECK,
	NORTH_STAR_PRIMARY_METRIC,
} from "../lib/contract/types.js";
import type { CheckRun } from "../lib/github/client.js";
import {
	EXIT_CODES,
	postRerunCommentIfNeeded,
	runReviewGate,
	runReviewGateCLI,
} from "./review-gate.js";

const { emitReviewGateDecisionArtifactsMock } = vi.hoisted(() => ({
	emitReviewGateDecisionArtifactsMock: vi.fn(),
}));

// Mock the GitHub client
vi.mock("../lib/github/client.js", () => ({
	GitHubClient: vi.fn(),
}));

// Mock the contract loader
vi.mock("../lib/contract/loader.js", () => ({
	loadContract: vi.fn(),
	ContractLoadError: class ContractLoadError extends Error {
		errors: unknown[];
		constructor(message: string, errors: unknown[] = []) {
			super(message);
			this.name = "ContractLoadError";
			this.errors = errors;
		}
	},
}));

// Mock SHA validation
vi.mock("../lib/github/sha.js", () => ({
	validateSha: vi.fn(),
	isValidSha: (sha: string): boolean =>
		typeof sha === "string" && /^[0-9a-f]{40}$/.test(sha),
	ShaValidationError: class ShaValidationError extends Error {
		constructor(sha: string) {
			super(`Invalid SHA format: ${sha}`);
			this.name = "ShaValidationError";
		}
	},
}));

vi.mock("../lib/review-gate/authz.js", () => ({
	runCheckAuthz: vi.fn(),
}));

vi.mock("../lib/plan-gate/detector.js", () => ({
	runPlanGate: vi.fn(),
}));

vi.mock("../lib/review-gate/decision-packet.js", () => ({
	emitReviewGateDecisionArtifacts: emitReviewGateDecisionArtifactsMock,
}));

import { loadContract } from "../lib/contract/loader.js";
import { GitHubClient } from "../lib/github/client.js";
import { validateSha } from "../lib/github/sha.js";
import { runPlanGate } from "../lib/plan-gate/detector.js";
import { runCheckAuthz } from "../lib/review-gate/authz.js";
import { emitReviewGateDecisionArtifacts } from "../lib/review-gate/decision-packet.js";

const mockGitHubClient = vi.mocked(GitHubClient);
const mockReviewGateGitHubClient = (client: PartialDeep<GitHubClient>) =>
	fromPartial<GitHubClient>(client);
const mockGitHubClientImplementation = (createClient: () => GitHubClient) => {
	mockGitHubClient.mockImplementation(function GitHubClient() {
		return createClient();
	});
};

const mockLoadContract = vi.mocked(loadContract);
const mockValidateSha = vi.mocked(validateSha);
const mockRunPlanGate = vi.mocked(runPlanGate);
const mockRunCheckAuthz = vi.mocked(runCheckAuthz);
const mockEmitReviewGateDecisionArtifacts = vi.mocked(
	emitReviewGateDecisionArtifacts,
);

const authzPassOutput = {
	passed: true,
	violations: [],
	policyApplied: {
		githubScopeAllowlist: ["issues:write"],
		repoAllowlist: ["acme/*"],
		branchAllowlist: ["feature/*", "main"],
		protectedBranchDenylist: ["main"],
		enforceBranchProtection: false,
	},
};

describe("runReviewGate", () => {
	const validSha = "0123456789abcdef0123456789abcdef01234567";
	const defaultOptions = {
		contractPath: "test-fixtures/contract.json",
		token: "test-token",
		owner: "test-owner",
		repo: "test-repo",
		prNumber: 123,
		headSha: validSha,
		checkName: "review-check",
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockGitHubClient.mockReset();
		mockEmitReviewGateDecisionArtifacts.mockReturnValue({
			runId: "review-gate-run-1",
			decisionPacketPath:
				"/tmp/agent-runs/review-gate-run-1/decision-packet.json",
			alignmentDecisionPath:
				"/tmp/agent-runs/review-gate-run-1/alignment-decision.json",
		});
		mockValidateSha.mockReturnValue(undefined); // No-op = valid
		mockRunPlanGate.mockReturnValue({
			passed: true,
			artifacts: [],
			errors: [],
			traceability: {
				planIds: ["feat-review-gate-traceability"],
				matchedPlanIds: ["feat-review-gate-traceability"],
				changedFiles: ["src/commands/review-gate.ts"],
			},
		});
		mockLoadContract.mockReturnValue({
			version: "1.0",
			riskTierRules: {},
			reviewPolicy: {
				timeoutSeconds: 600,
				timeoutAction: "fail",
				enforceReviewerIndependence: true,
			},
		});
		mockRunCheckAuthz.mockResolvedValue({
			ok: true,
			output: {
				...authzPassOutput,
				repoChecked: "acme/repo",
				branchChecked: "main",
			},
		});

		// Default: PR head SHA matches the supplied SHA so unchanged tests pass.
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					title: "Traceability hardening",
					body: "- Plan IDs: `feat-review-gate-traceability`",
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue([]),
			}),
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns validation error for invalid SHA", async () => {
		mockValidateSha.mockImplementation(() => {
			throw new Error("Invalid SHA format: invalid");
		});

		const result = await runReviewGate({
			...defaultOptions,
			headSha: "invalid",
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("VALIDATION_ERROR");
			expect(result.error.message).toContain("Invalid SHA format");
		}
	});

	// Security: provided SHA must match the PR's actual head SHA
	it("returns validation error when provided SHA does not match PR head", async () => {
		const mismatchedSha = "fedcba9876543210fedcba9876543210fedcba98";
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
			}),
		);

		const result = await runReviewGate({
			...defaultOptions,
			headSha: mismatchedSha,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("VALIDATION_ERROR");
			expect(result.error.message).toContain("does not match");
		}
	});

	it("returns timeout warn output when check run never appears", async () => {
		mockLoadContract.mockReturnValue({
			version: "1.0",
			riskTierRules: {},
			reviewPolicy: { timeoutSeconds: 0, timeoutAction: "warn" },
		});
		const mockListCheckRuns = vi.fn().mockResolvedValue([]);
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: mockListCheckRuns,
			}),
		);
		const result = await runReviewGate(defaultOptions);

		expect(mockListCheckRuns).not.toHaveBeenCalled();
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.checkStatus).toBe("not_found");
			expect(result.output.needsRerun).toBe(true);
			expect(result.output.timedOut).toBe(true);
			expect(result.output.policy_gate_status).toBe("missing");
			expect(result.output.blockers.length).toBeGreaterThan(0);
			expect(result.output.blockers.join(" ")).toContain(
				`${defaultOptions.checkName} check run not found`,
			);
			expect(result.output.actionable_count).toBeGreaterThan(0);
			expect(result.output.informational_count).toBe(1);
			expect(result.output.confidence_rubric.level).toBe("low");
		}
	});

	it("returns TIMEOUT error when check run does not appear before timeout in fail mode", async () => {
		mockLoadContract.mockReturnValue({
			version: "1.0",
			riskTierRules: {},
			reviewPolicy: { timeoutSeconds: 0, timeoutAction: "fail" },
		});
		const mockListCheckRuns = vi.fn().mockResolvedValue([]);
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: mockListCheckRuns,
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(mockListCheckRuns).not.toHaveBeenCalled();
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("TIMEOUT");
			expect(result.error.message).toContain("timed out");
		}
	});

	it("returns verified when check run is completed with success", async () => {
		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		const mockListCheckRuns = vi.fn().mockResolvedValue(mockCheckRuns);
		const mockGetPullRequest = vi.fn().mockResolvedValue({
			number: defaultOptions.prNumber,
			user: { login: "coding-actor" },
			head: { sha: validSha, ref: "feature/test" },
		});
		const mockListReviews = vi.fn().mockResolvedValue([
			{
				state: "APPROVED",
				commit_id: validSha,
				user: { login: "independent-reviewer" },
			},
		]);
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: mockListCheckRuns,
				getPullRequest: mockGetPullRequest,
				listPullRequestReviews: mockListReviews,
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(true);
			expect(result.output.checkStatus).toBe("completed");
			expect(result.output.checkConclusion).toBe("success");
			expect(result.output.needsRerun).toBe(false);
			expect(result.output.policy_gate_status).toBe("pass");
			expect(result.output.blockers).toEqual([]);
			expect(result.output.actionable_count).toBe(0);
			expect(result.output.informational_count).toBe(3);
			expect(result.output.confidence_rubric.score).toBe(5);
		}
	});

	it("keeps review-context advisory when a current artifact is supplied", async () => {
		const dir = mkdtempSync(join(tmpdir(), "review-gate-context-"));
		const reviewContextPath = join(dir, "review-context.json");
		writeFileSync(
			reviewContextPath,
			JSON.stringify({
				schemaVersion: "review-context/v1",
				status: "success",
				source: ".harness/learnings/coderabbit.local.json",
				generatedAt: new Date().toISOString(),
				sourceFingerprint: "abc123",
				repo: "coding-harness",
				changedFiles: ["src/commands/review-gate.ts"],
				applicableLearnings: [
					{
						id: "coderabbit.coding-harness.review-gate",
						usage: 100,
						classification: "review_context",
						enforcement: "error",
						promotionStatus: "candidate",
						summary: "Review context should be acknowledged.",
						matchedFiles: ["src/commands/review-gate.ts"],
						fix: "Acknowledge learned context.",
						evidenceRef: ["coderabbit_csv:file:///tmp/learnings.csv#row=2"],
					},
				],
				validationPlan: [],
				networkRequired: [],
				summary: {
					applicableLearnings: 1,
					validationCommands: 0,
					networkRequired: 0,
				},
			}),
			"utf-8",
		);
		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					title: "Traceability hardening",
					body: "- Plan IDs: `feat-review-gate-traceability`\n- review-context: coderabbit.coding-harness.review-gate acknowledged",
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		try {
			const result = await runReviewGate({
				...defaultOptions,
				reviewContextPath,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.verified).toBe(true);
				expect(result.output.review_context_status).toBe("warn");
				expect(result.output.blockers).toEqual([]);
			}
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("resolves contract-relative review-context paths from the contract directory", async () => {
		const dir = mkdtempSync(join(tmpdir(), "review-gate-context-relative-"));
		const contractDir = join(dir, "config");
		const contractPath = join(contractDir, "harness.contract.json");
		const reviewContextPath = join(contractDir, ".harness/review-context.json");
		mkdirSync(join(contractDir, ".harness"), { recursive: true });
		writeFileSync(contractPath, JSON.stringify({ version: "1.0" }), "utf-8");
		writeFileSync(
			reviewContextPath,
			JSON.stringify({
				schemaVersion: "review-context/v1",
				status: "success",
				source: ".harness/learnings/coderabbit.local.json",
				generatedAt: new Date().toISOString(),
				sourceFingerprint: "abc123",
				repo: "coding-harness",
				changedFiles: ["src/commands/review-gate.ts"],
				applicableLearnings: [
					{
						id: "coderabbit.coding-harness.contract-relative-context",
						usage: 100,
						classification: "review_context",
						enforcement: "error",
						promotionStatus: "candidate",
						summary: "Contract-relative review context should load.",
						matchedFiles: ["src/commands/review-gate.ts"],
						fix: "Acknowledge learned context.",
						evidenceRef: ["coderabbit_csv:file:///tmp/learnings.csv#row=4"],
					},
				],
				validationPlan: [],
				networkRequired: [],
				summary: {
					applicableLearnings: 1,
					validationCommands: 0,
					networkRequired: 0,
				},
			}),
			"utf-8",
		);
		mockLoadContract.mockReturnValue({
			version: "1.0",
			riskTierRules: {},
			reviewPolicy: {
				timeoutSeconds: 600,
				timeoutAction: "fail",
				enforceReviewerIndependence: true,
				reviewContextPath: ".harness/review-context.json",
			},
		});
		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					title: "Traceability hardening",
					body: "- Plan IDs: `feat-review-gate-traceability`\n- review-context: coderabbit.coding-harness.contract-relative-context acknowledged",
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		try {
			const result = await runReviewGate({
				...defaultOptions,
				contractPath,
				requireReviewContext: true,
				reviewContextMaxAgeMinutes: 60,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.review_context_status).toBe("warn");
				expect(result.output.blockers).toEqual([]);
			}
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("does not acknowledge review-context learnings through ID prefix matches", async () => {
		const dir = mkdtempSync(join(tmpdir(), "review-gate-context-prefix-"));
		const reviewContextPath = join(dir, "review-context.json");
		writeFileSync(
			reviewContextPath,
			JSON.stringify({
				schemaVersion: "review-context/v1",
				status: "success",
				source: ".harness/learnings/coderabbit.local.json",
				generatedAt: new Date().toISOString(),
				sourceFingerprint: "abc123",
				repo: "coding-harness",
				changedFiles: ["src/commands/review-gate.ts"],
				applicableLearnings: [
					{
						id: "coderabbit.coding-harness.review-gate",
						usage: 100,
						classification: "review_context",
						enforcement: "error",
						promotionStatus: "candidate",
						summary: "Review context should be acknowledged.",
						matchedFiles: ["src/commands/review-gate.ts"],
						fix: "Acknowledge learned context.",
						evidenceRef: ["coderabbit_csv:file:///tmp/learnings.csv#row=2"],
					},
				],
				validationPlan: [],
				networkRequired: [],
				summary: {
					applicableLearnings: 1,
					validationCommands: 0,
					networkRequired: 0,
				},
			}),
			"utf-8",
		);
		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					title: "Traceability hardening",
					body: "- review-context: coderabbit.coding-harness.review-gate-extra acknowledged",
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		try {
			const result = await runReviewGate({
				...defaultOptions,
				reviewContextPath,
				requireReviewContext: true,
				reviewContextMaxAgeMinutes: 60,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.review_context_status).toBe("stale");
				expect(result.output.blockers).toContain(
					"High-severity learning context was generated but not acknowledged in the PR body",
				);
			}
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("blocks only when strict review-context mode requires a missing artifact", async () => {
		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					title: "Traceability hardening",
					body: "- Plan IDs: `feat-review-gate-traceability`",
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		const result = await runReviewGate({
			...defaultOptions,
			requireReviewContext: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.review_context_status).toBe("missing");
			expect(result.output.blockers.join(" ")).toContain(
				"Review context artifact is required",
			);
		}
	});

	it("exercises CLI flag plumbing for --review-context-path and --require-review-context", async () => {
		const dir = mkdtempSync(join(tmpdir(), "review-gate-cli-flags-"));
		const reviewContextPath = join(dir, "review-context.json");
		writeFileSync(
			reviewContextPath,
			JSON.stringify({
				schemaVersion: "review-context/v1",
				status: "success",
				source: ".harness/learnings/coderabbit.local.json",
				generatedAt: new Date().toISOString(),
				sourceFingerprint: "abc123",
				repo: "coding-harness",
				changedFiles: ["src/commands/review-gate.ts"],
				applicableLearnings: [
					{
						id: "coderabbit.coding-harness.cli-review-gate",
						usage: 100,
						classification: "review_context",
						enforcement: "error",
						promotionStatus: "candidate",
						summary: "CLI flag plumbing must be tested.",
						matchedFiles: ["src/commands/review-gate.ts"],
						fix: "Acknowledge CLI context.",
						evidenceRef: ["coderabbit_csv:file:///tmp/learnings.csv#row=3"],
					},
				],
				validationPlan: [],
				networkRequired: [],
				summary: {
					applicableLearnings: 1,
					validationCommands: 0,
					networkRequired: 0,
				},
			}),
			"utf-8",
		);
		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					title: "Traceability hardening",
					body: "- Plan IDs: `feat-review-gate-traceability`\n- review-context: coderabbit.coding-harness.cli-review-gate acknowledged",
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		try {
			const exitCode = await runReviewGateCLI({
				...defaultOptions,
				reviewContextPath,
				requireReviewContext: true,
			});

			expect(exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(mockEmitReviewGateDecisionArtifacts).toHaveBeenCalled();
			const callArgs = mockEmitReviewGateDecisionArtifacts.mock.calls[0];
			expect(callArgs).toBeDefined();
			const artifactInput = callArgs?.[0];
			expect(artifactInput?.result.ok).toBe(true);
			const output = artifactInput?.result.ok
				? artifactInput.result.output
				: undefined;
			expect(output?.review_context_status).toBe("warn");
			expect(output?.blockers).toEqual([]);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("falls back to legacy risk-policy-gate check when code-review check is absent", async () => {
		mockLoadContract.mockReturnValue({
			version: "1.0",
			riskTierRules: {},
			reviewPolicy: {
				timeoutSeconds: 600,
				timeoutAction: "fail",
				enforceReviewerIndependence: true,
			},
		});
		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "risk-policy-gate",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		const result = await runReviewGate({
			...defaultOptions,
			checkName: "code-review",
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(true);
			expect(result.output.policy_gate_status).toBe("pass");
			expect(result.output.blockers).toEqual([]);
			expect(result.output.actionable_count).toBe(0);
		}
	});

	it("blocks merge when plan traceability fails", async () => {
		mockRunPlanGate.mockReturnValue({
			passed: false,
			artifacts: [],
			errors: [
				{
					code: "TRACEABILITY_MISSING",
					message:
						"Changed work cannot be mapped to plan IDs; add plan IDs to the PR title/body or pass --plan-ids",
				},
			],
			traceability: {
				planIds: [],
				matchedPlanIds: [],
				changedFiles: ["src/commands/review-gate.ts"],
			},
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					title: "Traceability hardening",
					body: "",
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.plan_traceability_status).toBe("missing");
			expect(result.output.blockers.join(" ")).toContain("Plan traceability");
			expect(result.output.plan_ids).toEqual([]);
		}
	});

	it("surfaces referenced plan IDs in review output", async () => {
		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					title: "Traceability hardening",
					body: "- Plan IDs: `feat-review-gate-traceability`",
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.plan_traceability_status).toBe("pass");
			expect(result.output.plan_ids).toEqual(["feat-review-gate-traceability"]);
		}
	});

	it("sets plan traceability status to fail when plan IDs exist but validation fails", async () => {
		mockRunPlanGate.mockReturnValue({
			passed: false,
			artifacts: [],
			errors: [
				{
					code: "TRACEABILITY_MISSING",
					path: "traceability.planIds",
					message: "Plan IDs were found but acceptance evidence was incomplete",
				},
			],
			traceability: {
				planIds: ["feat-review-gate-traceability"],
				matchedPlanIds: ["feat-review-gate-traceability"],
				changedFiles: ["src/commands/review-gate.ts"],
			},
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					title: "Traceability hardening",
					body: "- Plan IDs: `feat-review-gate-traceability`",
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.plan_traceability_status).toBe("fail");
			expect(result.output.plan_ids).toEqual(["feat-review-gate-traceability"]);
			expect(result.output.blockers.join(" ")).toContain("Plan traceability");
		}
	});

	it("enforces reviewer independence when coding actor is sole approver", async () => {
		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		const mockListCheckRuns = vi.fn().mockResolvedValue(mockCheckRuns);
		const mockGetPullRequest = vi.fn().mockResolvedValue({
			number: defaultOptions.prNumber,
			user: { login: "coding-actor" },
			head: { sha: validSha, ref: "feature/test" },
		});
		const mockListReviews = vi.fn().mockResolvedValue([
			{
				state: "APPROVED",
				commit_id: validSha,
				user: { login: "coding-actor" },
			},
		]);
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: mockListCheckRuns,
				getPullRequest: mockGetPullRequest,
				listPullRequestReviews: mockListReviews,
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.policy_gate_status).toBe("pass");
			expect(result.output.blockers.length).toBeGreaterThan(0);
			expect(result.output.blockers.join(" ")).toContain(
				"Reviewer independence failed",
			);
			expect(result.output.actionable_count).toBeGreaterThan(0);
		}
	});

	it("does not enforce north-star decision questions for legacy contract versions", async () => {
		mockLoadContract.mockReturnValue({
			version: "1.0",
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
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					title: "Traceability hardening",
					body: "- Plan IDs: `feat-review-gate-traceability`",
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(true);
			expect(
				result.output.blockers.some((blocker) =>
					blocker.includes("North-star decision questions"),
				),
			).toBe(false);
		}
	});

	it("blocks merge readiness when canonical north-star decision questions are missing", async () => {
		mockLoadContract.mockReturnValue({
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
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					title: "Traceability hardening",
					body: "- Plan IDs: `feat-review-gate-traceability`",
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.blockers.join(" ")).toContain(
				"North-star decision questions missing",
			);
			expect(result.output.blockers.join(" ")).toContain("lead_time_path");
			expect(result.output.blockers.join(" ")).toContain("manual_glue");
		}
	});

	it("blocks merge readiness when canonical contracts provide an empty decision-question array", async () => {
		mockLoadContract.mockReturnValue({
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
				decisionQuestions: [],
			},
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					title: "Traceability hardening",
					body: "- Plan IDs: `feat-review-gate-traceability`",
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.blockers).toContain(
				"contract_invalid:contract-missing-questions: Canonical north-star contracts must declare at least one decision question.",
			);
		}
	});

	it("suppresses decision question blockers overridden by a valid acknowledgement (SA15 runtime)", async () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "review-gate-override-"));
		const contractPath = join(repoRoot, "harness.contract.json");
		writeFileSync(contractPath, JSON.stringify({ version: "1.6.0" }), "utf-8");

		mockLoadContract.mockReturnValue({
			version: "1.6.0",
			riskTierRules: {},
			reviewPolicy: {
				timeoutSeconds: 600,
				timeoutAction: "fail",
				enforceReviewerIndependence: true,
			},
			northStar: {
				mission: "Test mission",
				primaryMetric: NORTH_STAR_PRIMARY_METRIC,
				primaryBottleneck: NORTH_STAR_PRIMARY_BOTTLENECK,
				autonomyBoundary: "Test boundary",
				safetyFloor: ["evidence"],
				nonGoals: [],
				decisionQuestions: NORTH_STAR_DECISION_QUESTION_SPECS.map((q) => ({
					id: q.id,
					prompt: q.prompt,
				})),
			},
			overrideReviewerRegistry: {
				trustedReviewers: [
					{
						reviewerId: "jamie-craik",
						reviewerType: "user",
						signatureRef: "refs/reviewers/jamie-craik",
						displayName: "Jamie Craik",
						status: "active",
					},
				],
			},
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];

		const prBody = [
			"- Plan IDs: `feat-review-gate-traceability`",
			"- agent_reliability: yes. Evidence: [tests](/artifacts/review/reliability.md:5)",
			"- safety_floor: yes. Evidence: [gate](/artifacts/review/safety.md:3)",
		].join("\n");

		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					title: "Traceability hardening",
					body: prBody,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		const resultWithoutOverride = await runReviewGate({
			...defaultOptions,
			contractPath,
		});
		expect(resultWithoutOverride.ok).toBe(true);
		if (resultWithoutOverride.ok) {
			expect(resultWithoutOverride.output.blockers.length).toBeGreaterThan(0);
			expect(
				resultWithoutOverride.output.blockers.some((b) =>
					b.includes("lead_time_path"),
				),
			).toBe(true);
		}

		const ack = {
			schemaVersion: "north-star-override-acknowledgement/v1" as const,
			overrideId: "ovr-missing-lead-time",
			timestampUtc: new Date().toISOString(),
			actor: "jamie-craik",
			reason: "Lead time path is implicit in this refactor",
			linkedFindingIds: ["missing-lead_time_path,manual_glue"],
			approvedUntilUtc: new Date(Date.now() + 86400000).toISOString(),
			compensatingControls: ["post-merge-metrics"],
			signatureRef: "refs/reviewers/jamie-craik",
		};
		writeNorthStarOverrideAcknowledgement(
			repoRoot,
			"2026-04-27",
			"ovr-missing-lead-time",
			ack,
		);

		try {
			const resultWithOverride = await runReviewGate({
				...defaultOptions,
				contractPath,
			});
			expect(resultWithOverride.ok).toBe(true);
			if (resultWithOverride.ok) {
				expect(
					resultWithOverride.output.blockers.some((b) =>
						b.includes("lead_time_path"),
					),
				).toBe(false);
			}
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("passes north-star decision checks when PR context includes canonical answers with evidence", async () => {
		mockLoadContract.mockReturnValue({
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
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		const prBody = [
			"- Plan IDs: `feat-review-gate-traceability`",
			"- lead_time_path: yes. Evidence: [lead-time-metrics](/artifacts/review/lead-time.md:12)",
			"- manual_glue: yes. Evidence: [workflow](/artifacts/review/glue.md:7)",
			"- agent_reliability: yes. Evidence: [tests](/artifacts/review/reliability.md:5)",
			"- safety_floor: yes. Evidence: [gate](/artifacts/review/safety.md:3)",
		].join("\n");
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					title: "Traceability hardening",
					body: prBody,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(true);
			expect(result.output.blockers).toEqual([]);
		}
	});

	it("accepts repo-relative file:line references as evidence", async () => {
		mockLoadContract.mockReturnValue({
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
		});

		const prBody = [
			"- Plan IDs: `feat-review-gate-traceability`",
			"- lead_time_path: yes. Evidence: README.md:12",
			"- manual_glue: yes. Evidence: docs/roadmap/north-star.md:21",
			"- agent_reliability: yes. Evidence: src/commands/review-gate.ts:220",
			"- safety_floor: yes. Evidence: src/commands/review-gate.test.ts:600",
		].join("\n");
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					title: "Traceability hardening",
					body: prBody,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue([
					{
						id: 1,
						name: "review-check",
						status: "completed",
						conclusion: "success",
						head_sha: validSha,
					},
				]),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(true);
			expect(result.output.blockers).toEqual([]);
		}
	});

	it("accepts extensionless and dotfile file:line evidence references", async () => {
		mockLoadContract.mockReturnValue({
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
		});

		const prBody = [
			"- Plan IDs: `feat-review-gate-traceability`",
			"- lead_time_path: yes. Evidence: Makefile:12",
			"- manual_glue: yes. Evidence: Dockerfile:8",
			"- agent_reliability: yes. Evidence: .github/workflows/pr-pipeline.yml:42",
			"- safety_floor: yes. Evidence: codex/hooks/pre-tool-use-guard.sh:19",
		].join("\n");
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					title: "Traceability hardening",
					body: prBody,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue([
					{
						id: 1,
						name: "review-check",
						status: "completed",
						conclusion: "success",
						head_sha: validSha,
					},
				]),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(true);
			expect(result.output.blockers).toEqual([]);
		}
	});

	it("passes north-star decision checks when responses use numbered list formatting", async () => {
		mockLoadContract.mockReturnValue({
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
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		const prBody = [
			"- Plan IDs: `feat-review-gate-traceability`",
			"1. lead_time_path: yes. Evidence: [lead-time-metrics](/artifacts/review/lead-time.md:12)",
			"2. manual_glue: yes. Evidence: [workflow](/artifacts/review/glue.md:7)",
			"3. agent_reliability: yes. Evidence: [tests](/artifacts/review/reliability.md:5)",
			"4. safety_floor: yes. Evidence: [gate](/artifacts/review/safety.md:3)",
		].join("\n");
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					title: "Traceability hardening",
					body: prBody,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(true);
			expect(result.output.blockers).toEqual([]);
		}
	});

	it("passes north-star decision checks when responses reference canonical prompts without IDs", async () => {
		mockLoadContract.mockReturnValue({
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
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		const prBody = [
			"- Plan IDs: `feat-review-gate-traceability`",
			...NORTH_STAR_DECISION_QUESTION_SPECS.map(
				(question, index) =>
					`- ${question.prompt}: yes. Evidence: [evidence-${index + 1}](/artifacts/review/proof-${index + 1}.md:1)`,
			),
		].join("\n");
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					title: "Traceability hardening",
					body: prBody,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(true);
			expect(result.output.blockers).toEqual([]);
		}
	});

	it("blocks north-star decision checks when canonical IDs exist without evidence references", async () => {
		mockLoadContract.mockReturnValue({
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
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		const prBody = [
			"- Plan IDs: `feat-review-gate-traceability`",
			"- lead_time_path: yes",
			"- manual_glue: yes",
			"- agent_reliability: yes",
			"- safety_floor: yes",
		].join("\n");
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					title: "Traceability hardening",
					body: prBody,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.blockers.join(" ")).toContain(
				"must include evidence references for each question",
			);
			expect(result.output.blockers.join(" ")).not.toContain(
				"North-star decision questions missing",
			);
		}
	});

	it("blocks north-star decision checks when only one response includes evidence", async () => {
		mockLoadContract.mockReturnValue({
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
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		const prBody = [
			"- Plan IDs: `feat-review-gate-traceability`",
			"- lead_time_path: yes. Evidence: [lead-time](/artifacts/review/lead-time.md:12)",
			"- manual_glue: yes",
			"- agent_reliability: yes",
			"- safety_floor: yes",
		].join("\n");
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					title: "Traceability hardening",
					body: prBody,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.blockers.join(" ")).toContain(
				"missing evidence for: manual_glue, agent_reliability, safety_floor",
			);
		}
	});

	it("does not attribute adjacent evidence across checklist-style decision responses", async () => {
		mockLoadContract.mockReturnValue({
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
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		const prBody = [
			"- Plan IDs: `feat-review-gate-traceability`",
			"- [x] lead_time_path: yes. Evidence: [lead-time](/artifacts/review/lead-time.md:12)",
			"- [x] manual_glue: yes",
			"- [x] agent_reliability: yes. Evidence: [tests](/artifacts/review/reliability.md:5)",
			"- [x] safety_floor: yes. Evidence: [gate](/artifacts/review/safety.md:3)",
		].join("\n");
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					title: "Traceability hardening",
					body: prBody,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.blockers.join(" ")).toContain(
				"missing evidence for: manual_glue",
			);
			expect(result.output.blockers.join(" ")).not.toContain(
				"agent_reliability",
			);
			expect(result.output.blockers.join(" ")).not.toContain("safety_floor");
		}
	});

	it("blocks north-star decision checks when a canonical response uses explicit negative answers", async () => {
		mockLoadContract.mockReturnValue({
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
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		const prBody = [
			"- Plan IDs: `feat-review-gate-traceability`",
			"- lead_time_path: yes. Evidence: [lead-time](/artifacts/review/lead-time.md:12)",
			"- manual_glue: no. Evidence: [workflow](/artifacts/review/glue.md:7)",
			"- agent_reliability: yes. Evidence: [tests](/artifacts/review/reliability.md:5)",
			"- safety_floor: yes. Evidence: [gate](/artifacts/review/safety.md:3)",
		].join("\n");
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					title: "Traceability hardening",
					body: prBody,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.blockers.join(" ")).toContain(
				"contradict throughput intent",
			);
			expect(result.output.blockers.join(" ")).toContain("manual_glue");
		}
	});

	it("blocks north-star decision checks when a canonical answer is negative on a continuation line", async () => {
		mockLoadContract.mockReturnValue({
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
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		const prBody = [
			"- Plan IDs: `feat-review-gate-traceability`",
			"- lead_time_path: yes. Evidence: [lead-time](/artifacts/review/lead-time.md:12)",
			"- manual_glue:",
			"  no, this adds manual coordination. Evidence: [workflow](/artifacts/review/glue.md:7)",
			"- agent_reliability: yes. Evidence: [tests](/artifacts/review/reliability.md:5)",
			"- safety_floor: yes. Evidence: [gate](/artifacts/review/safety.md:3)",
		].join("\n");
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					title: "Traceability hardening",
					body: prBody,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.blockers.join(" ")).toContain(
				"negative answers found for: manual_glue",
			);
		}
	});

	it("blocks north-star decision checks when a prompt-only response uses explicit false", async () => {
		mockLoadContract.mockReturnValue({
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
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		const manualGlueQuestion = NORTH_STAR_DECISION_QUESTION_SPECS.find(
			(question) => question.id === "manual_glue",
		);
		expect(manualGlueQuestion).toBeDefined();
		const prBody = [
			"- Plan IDs: `feat-review-gate-traceability`",
			...NORTH_STAR_DECISION_QUESTION_SPECS.map((question, index) => {
				const answerToken = question.id === "manual_glue" ? "false" : "yes";
				return `- ${question.prompt}: ${answerToken}. Evidence: [evidence-${index + 1}](/artifacts/review/proof-${index + 1}.md:1)`;
			}),
		].join("\n");
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					title: "Traceability hardening",
					body: prBody,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.blockers.join(" ")).toContain(
				"negative answers found for: manual_glue",
			);
		}
	});

	it("allows explicit no-impact negative responses when declaration includes non-positive policy surface delta", async () => {
		mockLoadContract.mockReturnValue({
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
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		const prBody = [
			"- Plan IDs: `feat-review-gate-traceability`",
			"- lead_time_path: yes. Evidence: [lead-time](/artifacts/review/lead-time.md:12)",
			"- manual_glue: no. Evidence: [workflow](/artifacts/review/glue.md:7)",
			"  metric_impact_declared: none; policy_surface_delta: 0",
			"- agent_reliability: yes. Evidence: [tests](/artifacts/review/reliability.md:5)",
			"- safety_floor: yes. Evidence: [gate](/artifacts/review/safety.md:3)",
		].join("\n");
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					title: "Traceability hardening",
					body: prBody,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(true);
			expect(result.output.blockers).toEqual([]);
		}
	});

	it("blocks north-star decision checks when one required question is missing from PR context", async () => {
		mockLoadContract.mockReturnValue({
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
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		const prBody = [
			"- Plan IDs: `feat-review-gate-traceability`",
			"- lead_time_path: yes. Evidence: [lead-time](/artifacts/review/lead-time.md:12)",
			"- manual_glue: yes. Evidence: [workflow](/artifacts/review/glue.md:7)",
			"- agent_reliability: yes. Evidence: [tests](/artifacts/review/reliability.md:5)",
		].join("\n");
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					title: "Traceability hardening",
					body: prBody,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.blockers.join(" ")).toContain(
				"North-star decision questions missing from PR context: safety_floor",
			);
		}
	});

	it("blocks no-impact exemptions when policy_surface_delta is positive", async () => {
		mockLoadContract.mockReturnValue({
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
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		const prBody = [
			"- Plan IDs: `feat-review-gate-traceability`",
			"- lead_time_path: yes. Evidence: [lead-time](/artifacts/review/lead-time.md:12)",
			"- manual_glue: no. Evidence: [workflow](/artifacts/review/glue.md:7)",
			"  metric_impact_declared: none; policy_surface_delta: 1",
			"- agent_reliability: yes. Evidence: [tests](/artifacts/review/reliability.md:5)",
			"- safety_floor: yes. Evidence: [gate](/artifacts/review/safety.md:3)",
		].join("\n");
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					title: "Traceability hardening",
					body: prBody,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.blockers.join(" ")).toContain(
				"negative answers found for: manual_glue",
			);
		}
	});

	it("preserves nested evidence bullets within a decision response block", async () => {
		mockLoadContract.mockReturnValue({
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
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		const prBody = [
			"- Plan IDs: `feat-review-gate-traceability`",
			"- lead_time_path: yes",
			"  - Evidence: [lead-time](/artifacts/review/lead-time.md:12)",
			"- manual_glue: yes. Evidence: [workflow](/artifacts/review/glue.md:7)",
			"- agent_reliability: yes. Evidence: [tests](/artifacts/review/reliability.md:5)",
			"- safety_floor: yes. Evidence: [gate](/artifacts/review/safety.md:3)",
		].join("\n");
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					title: "Traceability hardening",
					body: prBody,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(true);
			expect(result.output.blockers).toEqual([]);
		}
	});

	it("does not treat numeric time-like tokens as evidence references", async () => {
		mockLoadContract.mockReturnValue({
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
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		const prBody = [
			"- Plan IDs: `feat-review-gate-traceability`",
			"- lead_time_path: yes. Evidence: 12:34",
			"- manual_glue: yes. Evidence: [workflow](/artifacts/review/glue.md:7)",
			"- agent_reliability: yes. Evidence: [tests](/artifacts/review/reliability.md:5)",
			"- safety_floor: yes. Evidence: [gate](/artifacts/review/safety.md:3)",
		].join("\n");
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					title: "Traceability hardening",
					body: prBody,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.blockers.join(" ")).toContain(
				"missing evidence for: lead_time_path",
			);
		}
	});

	it("allows solo approval when reviewer independence is disabled", async () => {
		mockLoadContract.mockReturnValue({
			version: "1.0",
			riskTierRules: {},
			reviewPolicy: {
				timeoutSeconds: 600,
				timeoutAction: "fail",
				enforceReviewerIndependence: false,
			},
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		const mockListCheckRuns = vi.fn().mockResolvedValue(mockCheckRuns);
		const mockGetPullRequest = vi.fn().mockResolvedValue({
			number: defaultOptions.prNumber,
			user: { login: "coding-actor" },
			head: { sha: validSha, ref: "feature/test" },
		});
		const mockListReviews = vi.fn().mockResolvedValue([
			{
				state: "APPROVED",
				commit_id: validSha,
				user: { login: "coding-actor" },
			},
		]);
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: mockListCheckRuns,
				getPullRequest: mockGetPullRequest,
				listPullRequestReviews: mockListReviews,
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(true);
			expect(result.output.policy_gate_status).toBe("pass");
			expect(result.output.blockers).toEqual([]);
		}
	});

	it("enforces reviewer independence against the current head commit actor", async () => {
		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					user: { login: "automation-bot" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestCommits: vi.fn().mockResolvedValue([
					{
						sha: validSha,
						author: { login: "alice" },
					},
				]),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "alice" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.blockers.join(" ")).toContain(
				"Reviewer independence failed",
			);
			expect(result.output.blockers.join(" ")).toContain("alice");
		}
	});

	it("falls back to PR author when commit actor resolution errors during independence checks", async () => {
		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestCommits: vi
					.fn()
					.mockRejectedValue(new Error("github API unavailable")),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "reviewer-one" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(true);
			expect(result.output.blockers).toEqual([]);
			expect(result.output.policy_gate_status).toBe("pass");
		}
	});

	it("falls back to PR author when head commit is absent from commit metadata", async () => {
		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestCommits: vi.fn().mockResolvedValue([
					{
						sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
						author: { login: "coding-actor" },
					},
				]),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "reviewer-one" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(true);
			expect(result.output.blockers).not.toContain(
				"Unable to determine coding actor from PR commit metadata; cannot verify reviewer independence",
			);
		}
	});

	it("falls back to PR author when commit metadata API is unavailable", async () => {
		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "reviewer-one" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(true);
			expect(result.output.blockers).toEqual([]);
			expect(result.output.policy_gate_status).toBe("pass");
		}
	});

	it("treats reviewer login matching as case-insensitive for independence checks", async () => {
		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					user: { login: "automation-bot" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestCommits: vi.fn().mockResolvedValue([
					{
						sha: validSha,
						author: { login: "alice" },
					},
				]),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "Alice" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.blockers.join(" ")).toContain(
				"Reviewer independence failed",
			);
		}
	});

	it("does not treat bot-only approvals as satisfying human review requirement", async () => {
		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "coderabbitai[bot]" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.blockers).toContain(
				"No APPROVED reviews found for the current HEAD SHA",
			);
		}
	});

	it("allows independent human approval when bot approvals are also present", async () => {
		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "coderabbitai[bot]" },
					},
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(true);
			expect(result.output.blockers).toEqual([]);
		}
	});

	it("still requires an approval when reviewer independence is disabled", async () => {
		mockLoadContract.mockReturnValue({
			version: "1.0",
			riskTierRules: {},
			reviewPolicy: {
				timeoutSeconds: 600,
				timeoutAction: "fail",
				enforceReviewerIndependence: false,
			},
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		const mockListCheckRuns = vi.fn().mockResolvedValue(mockCheckRuns);
		const mockGetPullRequest = vi.fn().mockResolvedValue({
			number: defaultOptions.prNumber,
			user: { login: "coding-actor" },
			head: { sha: validSha, ref: "feature/test" },
		});
		// No reviews at all — this is the bypass vector
		const mockListReviews = vi.fn().mockResolvedValue([]);
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: mockListCheckRuns,
				getPullRequest: mockGetPullRequest,
				listPullRequestReviews: mockListReviews,
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			// Disabling independence must NOT skip the approval requirement
			expect(result.output.verified).toBe(false);
			expect(result.output.policy_gate_status).toBe("pass");
			expect(result.output.blockers.join(" ")).toContain(
				"No APPROVED reviews found for the current HEAD SHA",
			);
		}
	});

	it("defaults reviewer independence to enforced when not explicitly configured", async () => {
		mockLoadContract.mockReturnValue({
			version: "1.0",
			riskTierRules: {},
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
			{
				id: 2,
				name: "security-scan",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
				app: {
					slug: "circleci",
					id: 2,
				},
			},
			{
				id: 3,
				name: "dependency-review",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
			{
				id: 4,
				name: "actions-pinning",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		const mockListCheckRuns = vi.fn().mockResolvedValue(mockCheckRuns);
		const mockGetPullRequest = vi.fn().mockResolvedValue({
			number: defaultOptions.prNumber,
			user: { login: "coding-actor" },
			head: { sha: validSha, ref: "feature/test" },
		});
		const mockListReviews = vi.fn().mockResolvedValue([
			{
				state: "APPROVED",
				commit_id: validSha,
				user: { login: "coding-actor" },
			},
		]);
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: mockListCheckRuns,
				getPullRequest: mockGetPullRequest,
				listPullRequestReviews: mockListReviews,
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.blockers.join(" ")).toContain(
				"Reviewer independence failed",
			);
		}
	});

	it("uses the newest review state per reviewer before deduplicating approvals", async () => {
		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		const mockListCheckRuns = vi.fn().mockResolvedValue(mockCheckRuns);
		const mockGetPullRequest = vi.fn().mockResolvedValue({
			number: defaultOptions.prNumber,
			user: { login: "coding-actor" },
			head: { sha: validSha, ref: "feature/test" },
		});
		const mockListReviews = vi.fn().mockResolvedValue([
			{
				state: "APPROVED",
				commit_id: validSha,
				submitted_at: "2026-03-01T10:00:00Z",
				user: { login: "independent-reviewer" },
			},
			{
				state: "CHANGES_REQUESTED",
				commit_id: validSha,
				submitted_at: "2026-03-01T09:00:00Z",
				user: { login: "independent-reviewer" },
			},
		]);
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: mockListCheckRuns,
				getPullRequest: mockGetPullRequest,
				listPullRequestReviews: mockListReviews,
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(true);
			expect(result.output.policy_gate_status).toBe("pass");
			expect(result.output.blockers).toEqual([]);
		}
	});

	it("invalidates prior approvals when a later dismissal has no matching head commit", async () => {
		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		const mockListCheckRuns = vi.fn().mockResolvedValue(mockCheckRuns);
		const mockGetPullRequest = vi.fn().mockResolvedValue({
			number: defaultOptions.prNumber,
			user: { login: "coding-actor" },
			head: { sha: validSha, ref: "feature/test" },
		});
		const mockListReviews = vi.fn().mockResolvedValue([
			{
				state: "APPROVED",
				commit_id: validSha,
				submitted_at: "2026-03-01T09:00:00Z",
				user: { login: "independent-reviewer" },
			},
			{
				state: "DISMISSED",
				commit_id: null,
				submitted_at: "2026-03-01T10:00:00Z",
				user: { login: "independent-reviewer" },
			},
		]);
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: mockListCheckRuns,
				getPullRequest: mockGetPullRequest,
				listPullRequestReviews: mockListReviews,
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.blockers.join(" ")).toContain(
				"No APPROVED reviews found for the current HEAD SHA",
			);
		}
	});

	it("retains a valid approval when a later review is COMMENTED", async () => {
		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		const mockListCheckRuns = vi.fn().mockResolvedValue(mockCheckRuns);
		const mockGetPullRequest = vi.fn().mockResolvedValue({
			number: defaultOptions.prNumber,
			user: { login: "coding-actor" },
			head: { sha: validSha, ref: "feature/test" },
		});
		const mockListReviews = vi.fn().mockResolvedValue([
			{
				state: "APPROVED",
				commit_id: validSha,
				submitted_at: "2026-03-01T09:00:00Z",
				user: { login: "independent-reviewer" },
			},
			{
				state: "COMMENTED",
				commit_id: validSha,
				submitted_at: "2026-03-01T10:00:00Z",
				user: { login: "independent-reviewer" },
			},
		]);
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: mockListCheckRuns,
				getPullRequest: mockGetPullRequest,
				listPullRequestReviews: mockListReviews,
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(true);
			expect(result.output.policy_gate_status).toBe("pass");
			expect(result.output.blockers).toEqual([]);
		}
	});

	it("rejects approvals without a commit id when enforcing reviewer independence", async () => {
		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		const mockListCheckRuns = vi.fn().mockResolvedValue(mockCheckRuns);
		const mockGetPullRequest = vi.fn().mockResolvedValue({
			number: defaultOptions.prNumber,
			user: { login: "coding-actor" },
			head: { sha: validSha, ref: "feature/test" },
		});
		const mockListReviews = vi.fn().mockResolvedValue([
			{
				state: "APPROVED",
				commit_id: null,
				user: { login: "independent-reviewer" },
			},
		]);
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: mockListCheckRuns,
				getPullRequest: mockGetPullRequest,
				listPullRequestReviews: mockListReviews,
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.policy_gate_status).toBe("pass");
			expect(result.output.blockers.length).toBeGreaterThan(0);
			expect(result.output.blockers.join(" ")).toContain(
				"No APPROVED reviews found for the current HEAD SHA",
			);
			expect(result.output.actionable_count).toBeGreaterThan(0);
		}
	});

	it("blocks merge readiness when required checks are missing", async () => {
		mockLoadContract.mockReturnValue({
			version: "1.0",
			riskTierRules: {},
			reviewPolicy: {
				timeoutSeconds: 600,
				timeoutAction: "fail",
				requiredChecks: ["security-scan", "CodeRabbit", "Codex Review"],
			},
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		const mockListCheckRuns = vi.fn().mockResolvedValue(mockCheckRuns);
		const mockGetPullRequest = vi.fn().mockResolvedValue({
			number: defaultOptions.prNumber,
			user: { login: "coding-actor" },
			head: { sha: validSha, ref: "feature/test" },
		});
		const mockListReviews = vi.fn().mockResolvedValue([
			{
				state: "APPROVED",
				commit_id: validSha,
				user: { login: "independent-reviewer" },
			},
		]);
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: mockListCheckRuns,
				getPullRequest: mockGetPullRequest,
				listPullRequestReviews: mockListReviews,
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.policy_gate_status).toBe("pass");
			expect(result.output.blockers.join(" ")).toContain("security-scan");
			expect(result.output.blockers.join(" ")).toContain("CodeRabbit");
			expect(result.output.blockers.join(" ")).toContain("Codex Review");
		}
	});

	it("passes when required checks are present and successful", async () => {
		mockLoadContract.mockReturnValue({
			version: "1.0",
			riskTierRules: {},
			reviewPolicy: {
				timeoutSeconds: 600,
				timeoutAction: "fail",
				requiredChecks: ["security-scan", "CodeRabbit", "Codex Review"],
			},
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
			{
				id: 2,
				name: "security-scan",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
				app: {
					slug: "circleci",
					id: 2,
				},
			},
			{
				id: 3,
				name: "CodeRabbit",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
				app: {
					slug: "coderabbit",
					id: 3,
				},
			},
			{
				id: 4,
				name: "Codex Review",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		const mockListCheckRuns = vi.fn().mockResolvedValue(mockCheckRuns);
		const mockGetPullRequest = vi.fn().mockResolvedValue({
			number: defaultOptions.prNumber,
			user: { login: "coding-actor" },
			head: { sha: validSha, ref: "feature/test" },
		});
		const mockListReviews = vi.fn().mockResolvedValue([
			{
				state: "APPROVED",
				commit_id: validSha,
				user: { login: "independent-reviewer" },
			},
		]);
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: mockListCheckRuns,
				getPullRequest: mockGetPullRequest,
				listPullRequestReviews: mockListReviews,
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(true);
			expect(result.output.policy_gate_status).toBe("pass");
			expect(result.output.blockers).toEqual([]);
		}
	});

	it("resolves required-check aliases relative to contract path", async () => {
		const tempDir = mkdtempSync(join(tmpdir(), "review-gate-aliases-"));
		const manifestPath = join(
			tempDir,
			".harness",
			"ci-required-checks-alias-test.json",
		);
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		writeFileSync(
			manifestPath,
			JSON.stringify(
				{
					version: 1,
					activeProvider: "circleci",
					requiredChecks: [
						{
							displayName: "security-scan",
							sourceAppSlug: "circleci",
							sourceAppId: "circleci",
							externalIdPattern: "^pr-pipeline$",
							class: "required",
							githubCheckName: "pr-pipeline",
						},
					],
				},
				null,
				2,
			),
			"utf-8",
		);

		try {
			mockLoadContract.mockReturnValue({
				version: "1.0",
				riskTierRules: {},
				ciProviderPolicy: {
					activeProvider: "circleci",
					mode: "required",
					migrationStage: "circleci-only",
					transitionStatusArtifactPath:
						".harness/ci-provider-transition-status.json",
					authorityConfigPath:
						"docs/examples/ci-migrate/authority-config.example.json",
					requiredCheckManifestPath:
						".harness/ci-required-checks-alias-test.json",
				},
				reviewPolicy: {
					timeoutSeconds: 600,
					timeoutAction: "fail",
					requiredChecks: ["security-scan"],
				},
			});

			const mockCheckRuns: CheckRun[] = [
				{
					id: 1,
					name: "review-check",
					status: "completed",
					conclusion: "success",
					head_sha: validSha,
				},
				{
					id: 2,
					name: "pr-pipeline",
					status: "completed",
					conclusion: "success",
					head_sha: validSha,
					app: {
						slug: "circleci",
						id: 2,
					},
				},
			];
			mockGitHubClientImplementation(() =>
				mockReviewGateGitHubClient({
					listPullRequestFiles: vi
						.fn()
						.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
					listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
					getPullRequest: vi.fn().mockResolvedValue({
						number: defaultOptions.prNumber,
						user: { login: "coding-actor" },
						head: { sha: validSha, ref: "feature/test" },
					}),
					listPullRequestReviews: vi.fn().mockResolvedValue([
						{
							state: "APPROVED",
							commit_id: validSha,
							user: { login: "independent-reviewer" },
						},
					]),
				}),
			);

			const result = await runReviewGate({
				...defaultOptions,
				contractPath: join(tempDir, "harness.contract.json"),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.verified).toBe(true);
				expect(result.output.blockers).toEqual([]);
			}
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("resolves default required-check manifest from repo root for nested contract paths", async () => {
		const tempDir = mkdtempSync(join(tmpdir(), "review-gate-root-manifest-"));
		const manifestPath = join(tempDir, ".harness", "ci-required-checks.json");
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		mkdirSync(join(tempDir, ".git"), { recursive: true });
		mkdirSync(join(tempDir, "config"), { recursive: true });
		writeFileSync(
			manifestPath,
			JSON.stringify(
				{
					version: 1,
					activeProvider: "circleci",
					requiredChecks: [
						{
							displayName: "security-scan",
							sourceAppSlug: "circleci",
							sourceAppId: "circleci",
							externalIdPattern: "^pr-pipeline$",
							class: "required",
							githubCheckName: "pr-pipeline",
						},
					],
				},
				null,
				2,
			),
			"utf-8",
		);

		try {
			mockLoadContract.mockReturnValue({
				version: "1.0",
				riskTierRules: {},
				ciProviderPolicy: {
					activeProvider: "circleci",
					mode: "required",
					migrationStage: "circleci-only",
					transitionStatusArtifactPath:
						".harness/ci-provider-transition-status.json",
					authorityConfigPath:
						"docs/examples/ci-migrate/authority-config.example.json",
					requiredCheckManifestPath: ".harness/ci-required-checks.json",
				},
				reviewPolicy: {
					timeoutSeconds: 600,
					timeoutAction: "fail",
					requiredChecks: ["security-scan"],
				},
			});

			const mockCheckRuns: CheckRun[] = [
				{
					id: 1,
					name: "review-check",
					status: "completed",
					conclusion: "success",
					head_sha: validSha,
				},
				{
					id: 2,
					name: "pr-pipeline",
					status: "completed",
					conclusion: "success",
					head_sha: validSha,
					app: {
						slug: "circleci",
						id: 2,
					},
				},
			];

			mockGitHubClientImplementation(() =>
				mockReviewGateGitHubClient({
					listPullRequestFiles: vi
						.fn()
						.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
					listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
					getPullRequest: vi.fn().mockResolvedValue({
						number: defaultOptions.prNumber,
						user: { login: "coding-actor" },
						head: { sha: validSha, ref: "feature/test" },
					}),
					listPullRequestReviews: vi.fn().mockResolvedValue([
						{
							state: "APPROVED",
							commit_id: validSha,
							user: { login: "independent-reviewer" },
						},
					]),
				}),
			);

			const result = await runReviewGate({
				...defaultOptions,
				contractPath: join(tempDir, "config", "review.contract.json"),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.verified).toBe(true);
				expect(result.output.blockers).toEqual([]);
			}
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("derives default check identity from active provider metadata when --check is omitted", async () => {
		const tempDir = mkdtempSync(join(tmpdir(), "review-gate-default-check-"));
		const manifestPath = join(tempDir, ".harness", "ci-required-checks.json");
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		writeFileSync(
			manifestPath,
			JSON.stringify(
				{
					version: 1,
					activeProvider: "circleci",
					requiredChecks: [
						{
							displayName: "risk-policy-gate",
							sourceAppSlug: "circleci",
							sourceAppId: "circleci",
							externalIdPattern: "^pr-pipeline$",
							class: "required",
							githubCheckName: "pr-pipeline",
						},
					],
				},
				null,
				2,
			),
			"utf-8",
		);

		try {
			mockLoadContract.mockReturnValue({
				version: "1.0",
				riskTierRules: {},
				ciProviderPolicy: {
					activeProvider: "circleci",
					mode: "required",
					migrationStage: "circleci-only",
					transitionStatusArtifactPath:
						".harness/ci-provider-transition-status.json",
					authorityConfigPath:
						"docs/examples/ci-migrate/authority-config.example.json",
					requiredCheckManifestPath: ".harness/ci-required-checks.json",
				},
				reviewPolicy: {
					timeoutSeconds: 600,
					timeoutAction: "fail",
				},
			});

			const mockCheckRuns: CheckRun[] = [
				{
					id: 1,
					name: "pr-pipeline",
					status: "completed",
					conclusion: "success",
					head_sha: validSha,
				},
			];

			mockGitHubClientImplementation(() =>
				mockReviewGateGitHubClient({
					listPullRequestFiles: vi
						.fn()
						.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
					listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
					getPullRequest: vi.fn().mockResolvedValue({
						number: defaultOptions.prNumber,
						user: { login: "coding-actor" },
						head: { sha: validSha, ref: "feature/test" },
					}),
					listPullRequestReviews: vi.fn().mockResolvedValue([
						{
							state: "APPROVED",
							commit_id: validSha,
							user: { login: "independent-reviewer" },
						},
					]),
				}),
			);

			const result = await runReviewGate({
				...defaultOptions,
				checkName: "",
				contractPath: join(tempDir, "harness.contract.json"),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.verified).toBe(true);
				expect(result.output.blockers).toEqual([]);
			}
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("fails with VALIDATION_ERROR when required-check manifest JSON is malformed", async () => {
		const tempDir = mkdtempSync(
			join(tmpdir(), "review-gate-default-check-malformed-json-"),
		);
		const manifestPath = join(tempDir, ".harness", "ci-required-checks.json");
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		writeFileSync(manifestPath, "{ invalid-json", "utf-8");

		try {
			mockLoadContract.mockReturnValue({
				version: "1.0",
				riskTierRules: {},
				ciProviderPolicy: {
					activeProvider: "circleci",
					mode: "required",
					migrationStage: "circleci-only",
					transitionStatusArtifactPath:
						".harness/ci-provider-transition-status.json",
					authorityConfigPath:
						"docs/examples/ci-migrate/authority-config.example.json",
					requiredCheckManifestPath: ".harness/ci-required-checks.json",
				},
				reviewPolicy: {
					timeoutSeconds: 600,
					timeoutAction: "fail",
				},
			});

			const mockCheckRuns: CheckRun[] = [
				{
					id: 1,
					name: "pr-pipeline",
					status: "completed",
					conclusion: "success",
					head_sha: validSha,
				},
			];

			mockGitHubClientImplementation(() =>
				mockReviewGateGitHubClient({
					listPullRequestFiles: vi
						.fn()
						.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
					listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
					getPullRequest: vi.fn().mockResolvedValue({
						number: defaultOptions.prNumber,
						user: { login: "coding-actor" },
						head: { sha: validSha, ref: "feature/test" },
					}),
					listPullRequestReviews: vi.fn().mockResolvedValue([
						{
							state: "APPROVED",
							commit_id: validSha,
							user: { login: "independent-reviewer" },
						},
					]),
				}),
			);

			const result = await runReviewGate({
				...defaultOptions,
				checkName: "",
				contractPath: join(tempDir, "harness.contract.json"),
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("VALIDATION_ERROR");
				expect(result.error.message).toContain(
					"Invalid required-check manifest",
				);
				expect(result.error.message).toContain("malformed JSON");
			}
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("fails with VALIDATION_ERROR when required-check manifest shape is invalid", async () => {
		const tempDir = mkdtempSync(
			join(tmpdir(), "review-gate-default-check-invalid-manifest-"),
		);
		const manifestPath = join(tempDir, ".harness", "ci-required-checks.json");
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		writeFileSync(
			manifestPath,
			JSON.stringify(
				{
					version: 1,
					activeProvider: "circleci",
					requiredChecks: [
						{
							displayName: 123,
							class: "required",
						},
					],
				},
				null,
				2,
			),
			"utf-8",
		);

		try {
			mockLoadContract.mockReturnValue({
				version: "1.0",
				riskTierRules: {},
				ciProviderPolicy: {
					activeProvider: "circleci",
					mode: "required",
					migrationStage: "circleci-only",
					transitionStatusArtifactPath:
						".harness/ci-provider-transition-status.json",
					authorityConfigPath:
						"docs/examples/ci-migrate/authority-config.example.json",
					requiredCheckManifestPath: ".harness/ci-required-checks.json",
				},
				reviewPolicy: {
					timeoutSeconds: 600,
					timeoutAction: "fail",
				},
			});

			const mockCheckRuns: CheckRun[] = [
				{
					id: 1,
					name: "pr-pipeline",
					status: "completed",
					conclusion: "success",
					head_sha: validSha,
				},
			];

			mockGitHubClientImplementation(() =>
				mockReviewGateGitHubClient({
					listPullRequestFiles: vi
						.fn()
						.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
					listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
					getPullRequest: vi.fn().mockResolvedValue({
						number: defaultOptions.prNumber,
						user: { login: "coding-actor" },
						head: { sha: validSha, ref: "feature/test" },
					}),
					listPullRequestReviews: vi.fn().mockResolvedValue([
						{
							state: "APPROVED",
							commit_id: validSha,
							user: { login: "independent-reviewer" },
						},
					]),
				}),
			);

			const result = await runReviewGate({
				...defaultOptions,
				checkName: "",
				contractPath: join(tempDir, "harness.contract.json"),
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("VALIDATION_ERROR");
				expect(result.error.message).toContain(
					"Invalid required-check manifest",
				);
			}
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("derives default check from active required gate in mixed manifests", async () => {
		const tempDir = mkdtempSync(
			join(tmpdir(), "review-gate-default-check-mixed-manifest-"),
		);
		const manifestPath = join(tempDir, ".harness", "ci-required-checks.json");
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		writeFileSync(
			manifestPath,
			JSON.stringify(
				{
					version: 1,
					activeProvider: "circleci",
					requiredChecks: [
						{
							displayName: "disabled-required",
							sourceAppSlug: "circleci",
							sourceAppId: "circleci",
							externalIdPattern: "^disabled-required$",
							class: "required",
							githubCheckName: "disabled-required-check",
							enabled: false,
						},
						{
							displayName: "informational-only",
							sourceAppSlug: "circleci",
							sourceAppId: "circleci",
							externalIdPattern: "^informational-only$",
							class: "informational",
							githubCheckName: "informational-check",
						},
						{
							displayName: "off-provider-required",
							sourceAppSlug: "github-actions",
							sourceAppId: "github-actions",
							externalIdPattern: "^off-provider-required$",
							class: "required",
							githubCheckName: "gha-required-check",
						},
						{
							displayName: "active-provider-required",
							sourceAppSlug: "circleci",
							sourceAppId: "circleci",
							externalIdPattern: "^active-provider-required$",
							class: "required",
							githubCheckName: "circleci-required-check",
						},
					],
				},
				null,
				2,
			),
			"utf-8",
		);

		try {
			mockLoadContract.mockReturnValue({
				version: "1.0",
				riskTierRules: {},
				ciProviderPolicy: {
					activeProvider: "circleci",
					mode: "required",
					migrationStage: "circleci-only",
					transitionStatusArtifactPath:
						".harness/ci-provider-transition-status.json",
					authorityConfigPath:
						"docs/examples/ci-migrate/authority-config.example.json",
					requiredCheckManifestPath: ".harness/ci-required-checks.json",
				},
				reviewPolicy: {
					timeoutSeconds: 600,
					timeoutAction: "fail",
				},
			});

			const mockCheckRuns: CheckRun[] = [
				{
					id: 1,
					name: "circleci-required-check",
					status: "completed",
					conclusion: "success",
					head_sha: validSha,
				},
			];

			mockGitHubClientImplementation(() =>
				mockReviewGateGitHubClient({
					listPullRequestFiles: vi
						.fn()
						.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
					listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
					getPullRequest: vi.fn().mockResolvedValue({
						number: defaultOptions.prNumber,
						user: { login: "coding-actor" },
						head: { sha: validSha, ref: "feature/test" },
					}),
					listPullRequestReviews: vi.fn().mockResolvedValue([
						{
							state: "APPROVED",
							commit_id: validSha,
							user: { login: "independent-reviewer" },
						},
					]),
				}),
			);

			const result = await runReviewGate({
				...defaultOptions,
				checkName: "",
				contractPath: join(tempDir, "harness.contract.json"),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.checkStatus).toBe("completed");
				expect(result.output.verified).toBe(true);
				expect(result.output.blockers).toEqual([]);
			}
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("maps required checks through fan-in aliases when multiple checks share one github check name", async () => {
		const tempDir = mkdtempSync(join(tmpdir(), "review-gate-fanout-"));
		const manifestPath = join(tempDir, ".harness", "ci-required-checks.json");
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		writeFileSync(
			manifestPath,
			JSON.stringify(
				{
					version: 1,
					activeProvider: "circleci",
					requiredChecks: [
						{
							displayName: "security-scan",
							sourceAppSlug: "circleci",
							sourceAppId: "circleci",
							externalIdPattern: "^pr-pipeline$",
							class: "required",
							githubCheckName: "pr-pipeline",
						},
						{
							displayName: "dependency-scan",
							sourceAppSlug: "circleci",
							sourceAppId: "circleci",
							externalIdPattern: "^pr-pipeline$",
							class: "required",
							githubCheckName: "pr-pipeline",
						},
						{
							displayName: "docs-gate",
							sourceAppSlug: "circleci",
							sourceAppId: "circleci",
							externalIdPattern: "^pr-pipeline$",
							class: "required",
							githubCheckName: "pr-pipeline",
						},
					],
				},
				null,
				2,
			),
			"utf-8",
		);

		try {
			mockLoadContract.mockReturnValue({
				version: "1.0",
				riskTierRules: {},
				ciProviderPolicy: {
					activeProvider: "circleci",
					mode: "required",
					migrationStage: "circleci-only",
					transitionStatusArtifactPath:
						".harness/ci-provider-transition-status.json",
					authorityConfigPath:
						"docs/examples/ci-migrate/authority-config.example.json",
					requiredCheckManifestPath: ".harness/ci-required-checks.json",
				},
				reviewPolicy: {
					timeoutSeconds: 600,
					timeoutAction: "fail",
					requiredChecks: ["security-scan", "dependency-scan", "docs-gate"],
				},
			});

			const mockCheckRuns: CheckRun[] = [
				{
					id: 1,
					name: "review-check",
					status: "completed",
					conclusion: "success",
					head_sha: validSha,
				},
				{
					id: 2,
					name: "pr-pipeline",
					status: "in_progress",
					conclusion: null,
					head_sha: validSha,
					app: {
						slug: "circleci",
						id: 2,
					},
				},
			];

			mockGitHubClientImplementation(() =>
				mockReviewGateGitHubClient({
					listPullRequestFiles: vi
						.fn()
						.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
					listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
					getPullRequest: vi.fn().mockResolvedValue({
						number: defaultOptions.prNumber,
						user: { login: "coding-actor" },
						head: { sha: validSha, ref: "feature/test" },
					}),
					listPullRequestReviews: vi.fn().mockResolvedValue([
						{
							state: "APPROVED",
							commit_id: validSha,
							user: { login: "independent-reviewer" },
						},
					]),
				}),
			);

			const result = await runReviewGate({
				...defaultOptions,
				contractPath: join(tempDir, "harness.contract.json"),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.verified).toBe(false);
				expect(result.output.blockers.join("\n")).toContain(
					"Required check 'security-scan' is not complete (status: in_progress)",
				);
				expect(result.output.blockers.join("\n")).toContain(
					"Required check 'dependency-scan' is not complete (status: in_progress)",
				);
				expect(result.output.blockers.join("\n")).toContain(
					"Required check 'docs-gate' is not complete (status: in_progress)",
				);
			}
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("prefers active-provider check runs when duplicate check names exist across providers", async () => {
		const tempDir = mkdtempSync(
			join(tmpdir(), "review-gate-provider-source-filtering-"),
		);
		const manifestPath = join(tempDir, ".harness", "ci-required-checks.json");
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		writeFileSync(
			manifestPath,
			JSON.stringify(
				{
					version: 1,
					activeProvider: "circleci",
					requiredChecks: [
						{
							displayName: "security-scan",
							sourceAppSlug: "circleci",
							sourceAppId: "circleci",
							externalIdPattern: "^security-scan$",
							class: "required",
							githubCheckName: "security-scan",
						},
						{
							displayName: "security-scan",
							sourceAppSlug: "github-actions",
							sourceAppId: "github-actions",
							externalIdPattern: "^security-scan$",
							class: "required",
							githubCheckName: "security-scan",
						},
					],
				},
				null,
				2,
			),
			"utf-8",
		);

		try {
			mockLoadContract.mockReturnValue({
				version: "1.0",
				riskTierRules: {},
				ciProviderPolicy: {
					activeProvider: "circleci",
					mode: "required",
					migrationStage: "circleci-only",
					transitionStatusArtifactPath:
						".harness/ci-provider-transition-status.json",
					authorityConfigPath:
						"docs/examples/ci-migrate/authority-config.example.json",
					requiredCheckManifestPath: ".harness/ci-required-checks.json",
				},
				reviewPolicy: {
					timeoutSeconds: 600,
					timeoutAction: "fail",
					requiredChecks: ["security-scan"],
				},
			});

			const mockCheckRuns: CheckRun[] = [
				{
					id: 1,
					name: "review-check",
					status: "completed",
					conclusion: "success",
					head_sha: validSha,
					app: { id: 100, slug: "circleci", name: "CircleCI" },
				},
				{
					id: 10,
					name: "security-scan",
					status: "completed",
					conclusion: "success",
					head_sha: validSha,
					app: { id: 100, slug: "circleci", name: "CircleCI" },
				},
				{
					id: 20,
					name: "security-scan",
					status: "completed",
					conclusion: "failure",
					head_sha: validSha,
					app: { id: 200, slug: "github-actions", name: "GitHub Actions" },
				},
			];

			mockGitHubClientImplementation(() =>
				mockReviewGateGitHubClient({
					listPullRequestFiles: vi
						.fn()
						.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
					listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
					getPullRequest: vi.fn().mockResolvedValue({
						number: defaultOptions.prNumber,
						user: { login: "coding-actor" },
						head: { sha: validSha, ref: "feature/test" },
					}),
					listPullRequestReviews: vi.fn().mockResolvedValue([
						{
							state: "APPROVED",
							commit_id: validSha,
							user: { login: "independent-reviewer" },
						},
					]),
				}),
			);

			const result = await runReviewGate({
				...defaultOptions,
				contractPath: join(tempDir, "harness.contract.json"),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.verified).toBe(true);
				expect(result.output.blockers).toEqual([]);
			}
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("treats equivalent provider/source token punctuation as authoritative", async () => {
		const tempDir = mkdtempSync(
			join(tmpdir(), "review-gate-provider-source-punctuation-"),
		);
		const manifestPath = join(tempDir, ".harness", "ci-required-checks.json");
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		writeFileSync(
			manifestPath,
			JSON.stringify(
				{
					version: 1,
					activeProvider: "circleci",
					requiredChecks: [
						{
							displayName: "security-scan",
							sourceAppSlug: "github-actions",
							sourceAppId: "github-actions",
							externalIdPattern: "^security-scan$",
							class: "required",
							githubCheckName: "security-scan",
						},
					],
				},
				null,
				2,
			),
			"utf-8",
		);

		try {
			mockLoadContract.mockReturnValue({
				version: "1.0",
				riskTierRules: {},
				ciProviderPolicy: {
					activeProvider: "circleci",
					mode: "required",
					migrationStage: "circleci-only",
					transitionStatusArtifactPath:
						".harness/ci-provider-transition-status.json",
					authorityConfigPath:
						"docs/examples/ci-migrate/authority-config.example.json",
					requiredCheckManifestPath: ".harness/ci-required-checks.json",
				},
				reviewPolicy: {
					timeoutSeconds: 600,
					timeoutAction: "fail",
					requiredChecks: ["security-scan"],
				},
			});

			const mockCheckRuns: CheckRun[] = [
				{
					id: 1,
					name: "review-check",
					status: "completed",
					conclusion: "success",
					head_sha: validSha,
					app: { id: 100, slug: "circleci", name: "CircleCI" },
				},
				{
					id: 20,
					name: "security-scan",
					status: "completed",
					conclusion: "success",
					head_sha: validSha,
					app: { id: 200, slug: "github_actions", name: "GitHub Actions" },
				},
			];

			mockGitHubClientImplementation(() =>
				mockReviewGateGitHubClient({
					listPullRequestFiles: vi
						.fn()
						.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
					listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
					getPullRequest: vi.fn().mockResolvedValue({
						number: defaultOptions.prNumber,
						user: { login: "coding-actor" },
						head: { sha: validSha, ref: "feature/test" },
					}),
					listPullRequestReviews: vi.fn().mockResolvedValue([
						{
							state: "APPROVED",
							commit_id: validSha,
							user: { login: "independent-reviewer" },
						},
					]),
				}),
			);

			const result = await runReviewGate({
				...defaultOptions,
				contractPath: join(tempDir, "harness.contract.json"),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.verified).toBe(true);
				expect(result.output.blockers).toEqual([]);
			}
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("blocks when matching check name exists only from non-authoritative provider source", async () => {
		const tempDir = mkdtempSync(
			join(tmpdir(), "review-gate-provider-source-mismatch-"),
		);
		const manifestPath = join(tempDir, ".harness", "ci-required-checks.json");
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		writeFileSync(
			manifestPath,
			JSON.stringify(
				{
					version: 1,
					activeProvider: "circleci",
					requiredChecks: [
						{
							displayName: "security-scan",
							sourceAppSlug: "circleci",
							sourceAppId: "circleci",
							externalIdPattern: "^security-scan$",
							class: "required",
							githubCheckName: "security-scan",
						},
					],
				},
				null,
				2,
			),
			"utf-8",
		);

		try {
			mockLoadContract.mockReturnValue({
				version: "1.0",
				riskTierRules: {},
				ciProviderPolicy: {
					activeProvider: "circleci",
					mode: "required",
					migrationStage: "circleci-only",
					transitionStatusArtifactPath:
						".harness/ci-provider-transition-status.json",
					authorityConfigPath:
						"docs/examples/ci-migrate/authority-config.example.json",
					requiredCheckManifestPath: ".harness/ci-required-checks.json",
				},
				reviewPolicy: {
					timeoutSeconds: 600,
					timeoutAction: "fail",
					requiredChecks: ["security-scan"],
				},
			});

			const mockCheckRuns: CheckRun[] = [
				{
					id: 1,
					name: "review-check",
					status: "completed",
					conclusion: "success",
					head_sha: validSha,
					app: { id: 100, slug: "circleci", name: "CircleCI" },
				},
				{
					id: 20,
					name: "security-scan",
					status: "completed",
					conclusion: "success",
					head_sha: validSha,
					app: { id: 200, slug: "github-actions", name: "GitHub Actions" },
				},
			];

			mockGitHubClientImplementation(() =>
				mockReviewGateGitHubClient({
					listPullRequestFiles: vi
						.fn()
						.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
					listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
					getPullRequest: vi.fn().mockResolvedValue({
						number: defaultOptions.prNumber,
						user: { login: "coding-actor" },
						head: { sha: validSha, ref: "feature/test" },
					}),
					listPullRequestReviews: vi.fn().mockResolvedValue([
						{
							state: "APPROVED",
							commit_id: validSha,
							user: { login: "independent-reviewer" },
						},
					]),
				}),
			);

			const result = await runReviewGate({
				...defaultOptions,
				contractPath: join(tempDir, "harness.contract.json"),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.verified).toBe(false);
				expect(result.output.blockers.join(" ")).toContain(
					"Required check 'security-scan' was found, but only from non-authoritative providers",
				);
			}
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("blocks merge readiness when a required check is still in progress", async () => {
		mockLoadContract.mockReturnValue({
			version: "1.0",
			riskTierRules: {},
			reviewPolicy: {
				timeoutSeconds: 600,
				timeoutAction: "fail",
				requiredChecks: ["security-scan"],
			},
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
			{
				id: 2,
				name: "security-scan",
				status: "in_progress",
				conclusion: null,
				head_sha: validSha,
				app: {
					slug: "circleci",
					id: 2,
				},
			},
		];
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.blockers.join(" ")).toContain(
				"Required check 'security-scan' is not complete (status: in_progress)",
			);
		}
	});

	it("blocks merge readiness when a required check concludes with failure", async () => {
		mockLoadContract.mockReturnValue({
			version: "1.0",
			riskTierRules: {},
			reviewPolicy: {
				timeoutSeconds: 600,
				timeoutAction: "fail",
				requiredChecks: ["security-scan"],
			},
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
			{
				id: 2,
				name: "security-scan",
				status: "completed",
				conclusion: "failure",
				head_sha: validSha,
				app: {
					slug: "circleci",
					id: 2,
				},
			},
		];
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.blockers.join(" ")).toContain(
				"Required check 'security-scan' did not pass (conclusion: failure)",
			);
		}
	});

	it("blocks merge readiness when unresolved non-bot review threads remain", async () => {
		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
				listPullRequestReviewThreads: vi.fn().mockResolvedValue([
					{
						id: "thread-1",
						isResolved: false,
						comments: [{ author: { login: "independent-reviewer" } }],
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.blockers.join(" ")).toContain(
				"Unresolved review thread comments remain",
			);
		}
	});

	it.each([
		"coderabbitai",
		"coderabbitai[bot]",
	])("allows unresolved CodeRabbit-only review threads for %s", async (botLogin) => {
		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
				listPullRequestReviewThreads: vi.fn().mockResolvedValue([
					{
						id: "thread-1",
						isResolved: false,
						comments: [{ author: { login: botLogin } }],
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(true);
			expect(result.output.blockers).toEqual([]);
		}
	});

	it("uses the newest check run when duplicate required check names exist", async () => {
		mockLoadContract.mockReturnValue({
			version: "1.0",
			riskTierRules: {},
			reviewPolicy: {
				timeoutSeconds: 600,
				timeoutAction: "fail",
				requiredChecks: ["security-scan"],
			},
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
			{
				id: 2,
				name: "security-scan",
				status: "completed",
				conclusion: "failure",
				head_sha: validSha,
				app: {
					slug: "circleci",
					id: 2,
				},
			},
			{
				id: 5,
				name: "security-scan",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
				app: {
					slug: "circleci",
					id: 2,
				},
			},
		];
		const mockListCheckRuns = vi.fn().mockResolvedValue(mockCheckRuns);
		const mockGetPullRequest = vi.fn().mockResolvedValue({
			number: defaultOptions.prNumber,
			user: { login: "coding-actor" },
			head: { sha: validSha, ref: "feature/test" },
		});
		const mockListReviews = vi.fn().mockResolvedValue([
			{
				state: "APPROVED",
				commit_id: validSha,
				user: { login: "independent-reviewer" },
			},
		]);
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: mockListCheckRuns,
				getPullRequest: mockGetPullRequest,
				listPullRequestReviews: mockListReviews,
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(true);
			expect(result.output.blockers).toEqual([]);
		}
	});

	it("uses the newest primary review check run when duplicate names exist", async () => {
		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "failure",
				head_sha: validSha,
			},
			{
				id: 9,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestReviews: vi.fn().mockResolvedValue([
					{
						state: "APPROVED",
						commit_id: validSha,
						user: { login: "independent-reviewer" },
					},
				]),
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(true);
			expect(result.output.checkConclusion).toBe("success");
			expect(result.output.needsRerun).toBe(false);
		}
	});

	it("returns needsRerun when check run is completed with failure", async () => {
		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "failure",
				head_sha: validSha,
			},
		];
		const mockListCheckRuns = vi.fn().mockResolvedValue(mockCheckRuns);
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: mockListCheckRuns,
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.checkConclusion).toBe("failure");
			expect(result.output.needsRerun).toBe(true);
			expect(result.output.policy_gate_status).toBe("fail");
			expect(result.output.blockers.length).toBeGreaterThan(0);
			expect(result.output.actionable_count).toBeGreaterThan(0);
			expect(result.output.confidence_rubric.level).toBe("low");
		}
	});

	it("returns error on timeout with fail action", async () => {
		// Use a very short timeout for testing
		mockLoadContract.mockReturnValue({
			version: "1.0",
			riskTierRules: {},
			reviewPolicy: { timeoutSeconds: 0, timeoutAction: "fail" }, // 0 seconds = immediate timeout
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "in_progress",
				conclusion: null,
				head_sha: validSha,
			},
		];
		const mockListCheckRuns = vi.fn().mockResolvedValue(mockCheckRuns);
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: mockListCheckRuns,
			}),
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("TIMEOUT");
		}
	});

	it.each([
		"in_progress",
		"queued",
		"pending",
	] as const)("returns warn timeout output when timeoutAction is warn and check status is %s", async (checkStatus) => {
		mockLoadContract.mockReturnValue({
			version: "1.0",
			riskTierRules: {},
			reviewPolicy: { timeoutSeconds: 1, timeoutAction: "warn" },
		});

		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: checkStatus,
				conclusion: null,
				head_sha: validSha,
			},
		];
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: vi.fn().mockResolvedValue(mockCheckRuns),
			}),
		);

		vi.useFakeTimers();
		try {
			const resultPromise = runReviewGate(defaultOptions);
			await vi.advanceTimersByTimeAsync(1000);
			const result = await resultPromise;

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.verified).toBe(false);
				expect(result.output.timedOut).toBe(true);
				expect(result.output.needsRerun).toBe(true);
				expect(result.output.policy_gate_status).toBe("pending");
				expect(result.output.blockers.join(" ")).toContain(
					"verification is incomplete",
				);
			}
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("runReviewGateCLI", () => {
	const validSha = "0123456789abcdef0123456789abcdef01234567";
	const defaultOptions = {
		contractPath: "test-fixtures/contract.json",
		token: "test-token",
		owner: "test-owner",
		repo: "test-repo",
		prNumber: 123,
		headSha: validSha,
		checkName: "review-check",
		json: true,
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockEmitReviewGateDecisionArtifacts.mockReturnValue({
			runId: "review-gate-run-cli",
			decisionPacketPath:
				"/tmp/agent-runs/review-gate-run-cli/decision-packet.json",
			alignmentDecisionPath:
				"/tmp/agent-runs/review-gate-run-cli/alignment-decision.json",
		});
		mockValidateSha.mockReturnValue(undefined);
		mockRunPlanGate.mockReturnValue({
			passed: true,
			artifacts: [],
			errors: [],
			traceability: {
				planIds: ["feat-review-gate-traceability"],
				matchedPlanIds: ["feat-review-gate-traceability"],
				changedFiles: ["src/commands/review-gate.ts"],
			},
		});
		mockLoadContract.mockReturnValue({
			version: "1.0",
			riskTierRules: {},
			reviewPolicy: {
				timeoutSeconds: 600,
				timeoutAction: "fail",
				enforceReviewerIndependence: true,
			},
		});
		mockRunCheckAuthz.mockResolvedValue({
			ok: true,
			output: {
				...authzPassOutput,
				repoChecked: "acme/repo",
				branchChecked: "main",
			},
		});
	});

	it("returns REVIEW_NOT_VERIFIED when review follow-up is still required", async () => {
		const stdoutSpy = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);
		const mockListCheckRuns = vi.fn().mockResolvedValue([
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "failure",
				head_sha: validSha,
			},
		]);
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockResolvedValue({
					number: defaultOptions.prNumber,
					user: { login: "coding-actor" },
					head: { sha: validSha, ref: "feature/test" },
				}),
				listPullRequestFiles: vi
					.fn()
					.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
				listCheckRunsForRef: mockListCheckRuns,
			}),
		);

		const exitCode = await runReviewGateCLI(defaultOptions);

		expect(exitCode).toBe(EXIT_CODES.REVIEW_NOT_VERIFIED);
		const payload = stdoutSpy.mock.calls.at(-1)?.[0];
		expect(typeof payload).toBe("string");
		const parsed = JSON.parse(String(payload)) as {
			status: string;
			reason: string;
			action_now: unknown[];
			action_later: unknown[];
			evidence_ref: unknown[];
		};
		expect(parsed.status).toBe("fail");
		expect(typeof parsed.reason).toBe("string");
		expect(Array.isArray(parsed.action_now)).toBe(true);
		expect(Array.isArray(parsed.action_later)).toBe(true);
		expect(Array.isArray(parsed.evidence_ref)).toBe(true);
		expect(mockEmitReviewGateDecisionArtifacts).toHaveBeenCalledWith(
			expect.objectContaining({
				options: expect.objectContaining({
					owner: defaultOptions.owner,
					repo: defaultOptions.repo,
					prNumber: defaultOptions.prNumber,
				}),
				exitCode: EXIT_CODES.REVIEW_NOT_VERIFIED,
				result: expect.objectContaining({
					ok: true,
				}),
			}),
		);
	});

	it("returns VALIDATION_ERROR for invalid invocation state", async () => {
		mockValidateSha.mockImplementation(() => {
			throw new Error("Invalid SHA format: invalid");
		});

		const exitCode = await runReviewGateCLI({
			...defaultOptions,
			headSha: "invalid",
		});

		expect(exitCode).toBe(EXIT_CODES.VALIDATION_ERROR);
		expect(mockEmitReviewGateDecisionArtifacts).toHaveBeenCalledWith(
			expect.objectContaining({
				exitCode: EXIT_CODES.VALIDATION_ERROR,
				effectiveCheckName: defaultOptions.checkName,
				result: {
					ok: false,
					error: {
						code: "VALIDATION_ERROR",
						message: "Invalid SHA format: invalid",
					},
				},
			}),
		);
	});

	it("returns SYSTEM_ERROR when artifact emission fails on invalid input", async () => {
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		mockValidateSha.mockImplementation(() => {
			throw new Error("Invalid SHA format: invalid");
		});
		mockEmitReviewGateDecisionArtifacts.mockImplementation(() => {
			throw new Error("artifact write failed");
		});

		const exitCode = await runReviewGateCLI({
			...defaultOptions,
			headSha: "invalid",
		});

		expect(exitCode).toBe(EXIT_CODES.SYSTEM_ERROR);
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining("Failed to emit review-gate decision artifacts"),
		);
	});

	it("returns SYSTEM_ERROR when decision artifact emission fails on error path", async () => {
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockRejectedValue(
					Object.assign(new Error("PR not found"), {
						name: "NotFoundError",
					}),
				),
			}),
		);
		mockEmitReviewGateDecisionArtifacts.mockImplementation(() => {
			throw new Error("artifact write failed");
		});

		const exitCode = await runReviewGateCLI(defaultOptions);

		expect(exitCode).toBe(EXIT_CODES.SYSTEM_ERROR);
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining("Failed to emit review-gate decision artifacts"),
		);
	});

	it("emits canonical default check identity in error artifacts when --check is omitted", async () => {
		mockValidateSha.mockImplementation(() => {
			throw new Error("Invalid SHA format: invalid");
		});

		const exitCode = await runReviewGateCLI({
			...defaultOptions,
			headSha: "invalid",
			checkName: "",
		});

		expect(exitCode).toBe(EXIT_CODES.VALIDATION_ERROR);
		expect(mockEmitReviewGateDecisionArtifacts).toHaveBeenCalledWith(
			expect.objectContaining({
				effectiveCheckName: "pr-pipeline",
			}),
		);
	});

	it("returns PERMISSION_DENIED for ForbiddenError", async () => {
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockRejectedValue(
					Object.assign(new Error("Forbidden"), {
						name: "ForbiddenError",
					}),
				),
			}),
		);

		const exitCode = await runReviewGateCLI(defaultOptions);

		expect(exitCode).toBe(EXIT_CODES.PERMISSION_DENIED);
	});

	it("returns NOT_FOUND for NotFoundError", async () => {
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockRejectedValue(
					Object.assign(new Error("Not Found"), {
						name: "NotFoundError",
					}),
				),
			}),
		);

		const exitCode = await runReviewGateCLI(defaultOptions);

		expect(exitCode).toBe(EXIT_CODES.NOT_FOUND);
	});

	it("returns PERMISSION_DENIED for UnauthorizedError", async () => {
		mockGitHubClientImplementation(() =>
			mockReviewGateGitHubClient({
				getPullRequest: vi.fn().mockRejectedValue(
					Object.assign(new Error("Unauthorized"), {
						name: "UnauthorizedError",
					}),
				),
			}),
		);

		const exitCode = await runReviewGateCLI(defaultOptions);

		expect(exitCode).toBe(EXIT_CODES.PERMISSION_DENIED);
	});

	it("auto-resolves only bot-only unresolved threads when enabled", async () => {
		const stdoutSpy = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);
		const consoleInfoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);
		const mockResolveThread = vi.fn().mockResolvedValue(undefined);

		mockGitHubClient
			.mockImplementationOnce(function GitHubClient() {
				return mockReviewGateGitHubClient({
					getPullRequest: vi.fn().mockResolvedValue({
						number: defaultOptions.prNumber,
						user: { login: "coding-actor" },
						head: { sha: validSha, ref: "feature/test" },
					}),
					listPullRequestFiles: vi
						.fn()
						.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
					listCheckRunsForRef: vi.fn().mockResolvedValue([
						{
							id: 1,
							name: defaultOptions.checkName,
							status: "completed",
							conclusion: "success",
							head_sha: validSha,
						},
					]),
					listPullRequestReviews: vi.fn().mockResolvedValue([
						{
							state: "APPROVED",
							commit_id: validSha,
							user: { login: "independent-reviewer" },
						},
					]),
					listPullRequestReviewThreads: vi.fn().mockResolvedValue([]),
				});
			})
			.mockImplementationOnce(function GitHubClient() {
				return mockReviewGateGitHubClient({
					listPullRequestReviewThreads: vi.fn().mockResolvedValue([
						{
							id: "thread-bot-only",
							isResolved: false,
							comments: [{ author: { login: "coderabbitai[bot]" } }],
						},
						{
							id: "thread-mixed",
							isResolved: false,
							comments: [
								{ author: { login: "coderabbitai[bot]" } },
								{ author: { login: "independent-reviewer" } },
							],
						},
					]),
					resolvePullRequestReviewThread: mockResolveThread,
				});
			});

		const exitCode = await runReviewGateCLI({
			...defaultOptions,
			autoResolveBotThreads: true,
			json: false,
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(mockResolveThread).toHaveBeenCalledTimes(1);
		expect(mockResolveThread).toHaveBeenCalledWith("thread-bot-only");
		expect(consoleInfoSpy).toHaveBeenCalledWith(
			"Resolved 1 bot-only review thread(s).",
		);
		expect(stdoutSpy).not.toHaveBeenCalled();
	});

	it("emits JSON warning when auto-resolve thread mutation fails", async () => {
		const stdoutSpy = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		mockGitHubClient
			.mockImplementationOnce(function GitHubClient() {
				return mockReviewGateGitHubClient({
					getPullRequest: vi.fn().mockResolvedValue({
						number: defaultOptions.prNumber,
						user: { login: "coding-actor" },
						head: { sha: validSha, ref: "feature/test" },
					}),
					listPullRequestFiles: vi
						.fn()
						.mockResolvedValue([{ filename: "src/commands/review-gate.ts" }]),
					listCheckRunsForRef: vi.fn().mockResolvedValue([
						{
							id: 1,
							name: defaultOptions.checkName,
							status: "completed",
							conclusion: "success",
							head_sha: validSha,
						},
					]),
					listPullRequestReviews: vi.fn().mockResolvedValue([
						{
							state: "APPROVED",
							commit_id: validSha,
							user: { login: "independent-reviewer" },
						},
					]),
					listPullRequestReviewThreads: vi.fn().mockResolvedValue([]),
				});
			})
			.mockImplementationOnce(function GitHubClient() {
				return mockReviewGateGitHubClient({
					listPullRequestReviewThreads: vi
						.fn()
						.mockRejectedValue(new Error("resolve failure")),
				});
			});

		const exitCode = await runReviewGateCLI({
			...defaultOptions,
			autoResolveBotThreads: true,
			json: true,
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining("Failed to auto-resolve bot-only threads"),
		);
		expect(stdoutSpy).toHaveBeenCalled();
	});
});

describe("postRerunCommentIfNeeded", () => {
	const headSha = "0123456789abcdef0123456789abcdef01234567";

	const mockRepositoryIdentifier = "acme/repo";
	const mockBranch = "feature/review-gate";
	const mockBaseBranch = "main";
	const defaultOptions = {
		reason: "Need rerun",
		botLogin: "harness-bot",
		prNumber: 321,
	};

	const createMockClient = (overrides: {
		listIssueComments?: () => Promise<unknown>;
		createIssueComment?: () => Promise<unknown>;
		getPullRequest?: () => Promise<unknown>;
		getRepositoryIdentifier?: () => string;
	}) =>
		mockReviewGateGitHubClient({
			listIssueComments:
				overrides.listIssueComments ?? vi.fn().mockResolvedValue([]),
			createIssueComment:
				overrides.createIssueComment ??
				vi.fn().mockResolvedValue({
					id: 1,
					body: "comment",
					created_at: new Date().toISOString(),
					user: { login: "harness-bot" },
				}),
			getPullRequest:
				overrides.getPullRequest ??
				vi.fn().mockResolvedValue({
					base: {
						ref: mockBaseBranch,
					},
					head: {
						ref: mockBranch,
						sha: "1111111111111111111111111111111111111111",
					},
				}),
			getRepositoryIdentifier:
				overrides.getRepositoryIdentifier ??
				vi.fn().mockReturnValue(mockRepositoryIdentifier),
		});

	it("returns hold when authz preflight fails", async () => {
		const mockListIssueComments = vi.fn().mockResolvedValue([]);
		const mockClient = createMockClient({
			listIssueComments: mockListIssueComments,
			createIssueComment: vi.fn().mockResolvedValue({
				id: 1,
				body: "comment",
				created_at: new Date().toISOString(),
				user: { login: "harness-bot" },
			}),
		});

		mockRunCheckAuthz.mockResolvedValue({
			ok: true,
			output: {
				passed: false,
				violations: [
					{
						type: "repo_not_allowed",
						message: "Repository is not allowlisted",
					},
				],
				policyApplied: authzPassOutput.policyApplied,
			},
		});

		const result = await postRerunCommentIfNeeded(
			mockClient,
			defaultOptions.prNumber,
			headSha,
			defaultOptions.botLogin,
			defaultOptions.reason,
			"harness.contract.json",
			"feature/review-gate",
		);

		expect(result.posted).toBe(false);
		expect(result.message).toContain("Governance hold");
		expect(mockListIssueComments).not.toHaveBeenCalled();
	});

	it("posts rerun comment after authz preflight passes", async () => {
		mockRunCheckAuthz.mockResolvedValue({
			ok: true,
			output: {
				passed: true,
				violations: [],
				policyApplied: {
					...authzPassOutput.policyApplied,
				},
				repoChecked: mockRepositoryIdentifier,
				branchChecked: "feature/review-gate",
			},
		});

		const mockListIssueComments = vi.fn().mockResolvedValue([]);
		const mockCreateIssueComment = vi.fn().mockResolvedValue({
			id: 10,
			body: "comment",
			created_at: new Date().toISOString(),
			user: { login: "harness-bot" },
		});
		const mockClient = createMockClient({
			listIssueComments: mockListIssueComments,
			createIssueComment: mockCreateIssueComment,
		});

		const result = await postRerunCommentIfNeeded(
			mockClient,
			defaultOptions.prNumber,
			headSha,
			defaultOptions.botLogin,
			defaultOptions.reason,
			"harness.contract.json",
			"feature/review-gate",
		);

		expect(result).toEqual({ posted: true });
		expect(mockRunCheckAuthz).toHaveBeenCalledWith({
			contractPath: "harness.contract.json",
			repo: mockRepositoryIdentifier,
			branch: "feature/review-gate",
		});
		expect(mockListIssueComments).toHaveBeenCalledWith(defaultOptions.prNumber);
		expect(mockCreateIssueComment).toHaveBeenCalledTimes(1);
	});

	it("does not post duplicate rerun comment for same SHA and bot login", async () => {
		mockRunCheckAuthz.mockResolvedValue({
			ok: true,
			output: {
				passed: true,
				violations: [],
				policyApplied: {
					...authzPassOutput.policyApplied,
				},
				repoChecked: mockRepositoryIdentifier,
				branchChecked: "feature/review-gate",
			},
		});

		const existingTimestamp = new Date(Date.now() - 60_000).toISOString();
		const mockListIssueComments = vi.fn().mockResolvedValue([
			{
				id: 22,
				body: [
					"<!-- harness-review-rerun -->",
					"## Review Rerun Requested",
					"",
					`**SHA:** \`${headSha}\``,
					"**Reason:** duplicate check",
				].join("\n"),
				created_at: existingTimestamp,
				user: { login: defaultOptions.botLogin },
			},
		]);
		const mockCreateIssueComment = vi.fn();
		const mockClient = createMockClient({
			listIssueComments: mockListIssueComments,
			createIssueComment: mockCreateIssueComment,
		});

		const result = await postRerunCommentIfNeeded(
			mockClient,
			defaultOptions.prNumber,
			headSha,
			defaultOptions.botLogin,
			defaultOptions.reason,
			"harness.contract.json",
			"feature/review-gate",
		);

		expect(result.posted).toBe(false);
		expect(result.message).toContain(
			`Rerun comment already exists for SHA ${headSha}`,
		);
		expect(mockCreateIssueComment).not.toHaveBeenCalled();
	});

	it("returns a failure message when createIssueComment throws", async () => {
		mockRunCheckAuthz.mockResolvedValue({
			ok: true,
			output: {
				passed: true,
				violations: [],
				policyApplied: {
					...authzPassOutput.policyApplied,
				},
				repoChecked: mockRepositoryIdentifier,
				branchChecked: "feature/review-gate",
			},
		});

		const mockCreateIssueComment = vi
			.fn()
			.mockRejectedValue(new Error("comment API down"));
		const mockClient = createMockClient({
			listIssueComments: vi.fn().mockResolvedValue([]),
			createIssueComment: mockCreateIssueComment,
		});

		const result = await postRerunCommentIfNeeded(
			mockClient,
			defaultOptions.prNumber,
			headSha,
			defaultOptions.botLogin,
			defaultOptions.reason,
			"harness.contract.json",
			"feature/review-gate",
		);

		expect(result).toEqual({
			posted: false,
			message: "Failed to post rerun comment: comment API down",
		});
	});

	it("uses PR head branch for authz preflight when targetBranch is omitted", async () => {
		mockRunCheckAuthz.mockResolvedValue({
			ok: true,
			output: {
				passed: true,
				violations: [],
				policyApplied: {
					...authzPassOutput.policyApplied,
				},
				repoChecked: mockRepositoryIdentifier,
				branchChecked: mockBranch,
			},
		});

		const mockListIssueComments = vi.fn().mockResolvedValue([]);
		const mockCreateIssueComment = vi.fn().mockResolvedValue({
			id: 10,
			body: "comment",
			created_at: new Date().toISOString(),
			user: { login: "harness-bot" },
		});
		const mockClient = createMockClient({
			listIssueComments: mockListIssueComments,
			createIssueComment: mockCreateIssueComment,
		});

		const result = await postRerunCommentIfNeeded(
			mockClient,
			defaultOptions.prNumber,
			headSha,
			defaultOptions.botLogin,
			defaultOptions.reason,
		);

		expect(result).toEqual({ posted: true });
		expect(mockRunCheckAuthz).toHaveBeenCalledWith({
			contractPath: "harness.contract.json",
			repo: mockRepositoryIdentifier,
			branch: mockBranch,
		});
	});
});
