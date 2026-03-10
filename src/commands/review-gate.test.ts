import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckRun } from "../lib/github/client.js";
import {
	EXIT_CODES,
	postRerunCommentIfNeeded,
	runReviewGate,
	runReviewGateCLI,
} from "./review-gate.js";

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

vi.mock("./check-authz.js", () => ({
	runCheckAuthz: vi.fn(),
}));

import { loadContract } from "../lib/contract/loader.js";
import { GitHubClient } from "../lib/github/client.js";
import { validateSha } from "../lib/github/sha.js";
import { runCheckAuthz } from "./check-authz.js";

const mockGitHubClient = vi.mocked(GitHubClient);
const mockLoadContract = vi.mocked(loadContract);
const mockValidateSha = vi.mocked(validateSha);
const mockRunCheckAuthz = vi.mocked(runCheckAuthz);

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
		mockValidateSha.mockReturnValue(undefined); // No-op = valid
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
		mockGitHubClient.mockImplementation(
			() =>
				({
					getPullRequest: vi.fn().mockResolvedValue({
						number: defaultOptions.prNumber,
						user: { login: "coding-actor" },
						head: { sha: validSha, ref: "feature/test" },
					}),
					listCheckRunsForRef: vi.fn().mockResolvedValue([]),
				}) as unknown as GitHubClient,
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
		mockGitHubClient.mockImplementation(
			() =>
				({
					getPullRequest: vi.fn().mockResolvedValue({
						number: defaultOptions.prNumber,
						user: { login: "coding-actor" },
						head: { sha: validSha, ref: "feature/test" },
					}),
				}) as unknown as GitHubClient,
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

	it("returns not_found when check run does not exist", async () => {
		const mockListCheckRuns = vi.fn().mockResolvedValue([]);
		mockGitHubClient.mockImplementation(
			() =>
				({
					getPullRequest: vi.fn().mockResolvedValue({
						number: defaultOptions.prNumber,
						user: { login: "coding-actor" },
						head: { sha: validSha, ref: "feature/test" },
					}),
					listCheckRunsForRef: mockListCheckRuns,
				}) as unknown as GitHubClient,
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.checkStatus).toBe("not_found");
			expect(result.output.needsRerun).toBe(true);
			expect(result.output.policy_gate_status).toBe("missing");
			expect(result.output.blockers.length).toBeGreaterThan(0);
			expect(result.output.actionable_count).toBeGreaterThan(0);
			expect(result.output.informational_count).toBe(1);
			expect(result.output.confidence_rubric.level).toBe("low");
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
		mockGitHubClient.mockImplementation(
			() =>
				({
					listCheckRunsForRef: mockListCheckRuns,
					getPullRequest: mockGetPullRequest,
					listPullRequestReviews: mockListReviews,
				}) as unknown as GitHubClient,
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
		mockGitHubClient.mockImplementation(
			() =>
				({
					listCheckRunsForRef: mockListCheckRuns,
					getPullRequest: mockGetPullRequest,
					listPullRequestReviews: mockListReviews,
				}) as unknown as GitHubClient,
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
		mockGitHubClient.mockImplementation(
			() =>
				({
					listCheckRunsForRef: mockListCheckRuns,
					getPullRequest: mockGetPullRequest,
					listPullRequestReviews: mockListReviews,
				}) as unknown as GitHubClient,
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(true);
			expect(result.output.policy_gate_status).toBe("pass");
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
		mockGitHubClient.mockImplementation(
			() =>
				({
					listCheckRunsForRef: mockListCheckRuns,
					getPullRequest: mockGetPullRequest,
					listPullRequestReviews: mockListReviews,
				}) as unknown as GitHubClient,
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
		mockGitHubClient.mockImplementation(
			() =>
				({
					listCheckRunsForRef: mockListCheckRuns,
					getPullRequest: mockGetPullRequest,
					listPullRequestReviews: mockListReviews,
				}) as unknown as GitHubClient,
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
		mockGitHubClient.mockImplementation(
			() =>
				({
					listCheckRunsForRef: mockListCheckRuns,
					getPullRequest: mockGetPullRequest,
					listPullRequestReviews: mockListReviews,
				}) as unknown as GitHubClient,
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
		mockGitHubClient.mockImplementation(
			() =>
				({
					listCheckRunsForRef: mockListCheckRuns,
					getPullRequest: mockGetPullRequest,
					listPullRequestReviews: mockListReviews,
				}) as unknown as GitHubClient,
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
				requiredChecks: ["security-scan", "Greptile Review", "Codex Review"],
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
		mockGitHubClient.mockImplementation(
			() =>
				({
					listCheckRunsForRef: mockListCheckRuns,
					getPullRequest: mockGetPullRequest,
					listPullRequestReviews: mockListReviews,
				}) as unknown as GitHubClient,
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.policy_gate_status).toBe("pass");
			expect(result.output.blockers.join(" ")).toContain("security-scan");
			expect(result.output.blockers.join(" ")).toContain("Greptile Review");
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
				requiredChecks: ["security-scan", "Greptile Review", "Codex Review"],
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
			},
			{
				id: 3,
				name: "Greptile Review",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
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
		mockGitHubClient.mockImplementation(
			() =>
				({
					listCheckRunsForRef: mockListCheckRuns,
					getPullRequest: mockGetPullRequest,
					listPullRequestReviews: mockListReviews,
				}) as unknown as GitHubClient,
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(true);
			expect(result.output.policy_gate_status).toBe("pass");
			expect(result.output.blockers).toEqual([]);
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
		mockGitHubClient.mockImplementation(
			() =>
				({
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
				}) as unknown as GitHubClient,
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

	it("allows unresolved bot-only review threads", async () => {
		const mockCheckRuns: CheckRun[] = [
			{
				id: 1,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: validSha,
			},
		];
		mockGitHubClient.mockImplementation(
			() =>
				({
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
							comments: [{ author: { login: "greptile[bot]" } }],
						},
					]),
				}) as unknown as GitHubClient,
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
			},
			{
				id: 5,
				name: "security-scan",
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
		mockGitHubClient.mockImplementation(
			() =>
				({
					listCheckRunsForRef: mockListCheckRuns,
					getPullRequest: mockGetPullRequest,
					listPullRequestReviews: mockListReviews,
				}) as unknown as GitHubClient,
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(true);
			expect(result.output.blockers).toEqual([]);
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
		mockGitHubClient.mockImplementation(
			() =>
				({
					getPullRequest: vi.fn().mockResolvedValue({
						number: defaultOptions.prNumber,
						user: { login: "coding-actor" },
						head: { sha: validSha, ref: "feature/test" },
					}),
					listCheckRunsForRef: mockListCheckRuns,
				}) as unknown as GitHubClient,
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
		mockGitHubClient.mockImplementation(
			() =>
				({
					getPullRequest: vi.fn().mockResolvedValue({
						number: defaultOptions.prNumber,
						user: { login: "coding-actor" },
						head: { sha: validSha, ref: "feature/test" },
					}),
					listCheckRunsForRef: mockListCheckRuns,
				}) as unknown as GitHubClient,
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("TIMEOUT");
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
		mockValidateSha.mockReturnValue(undefined);
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
		const mockListCheckRuns = vi.fn().mockResolvedValue([]);
		mockGitHubClient.mockImplementation(
			() =>
				({
					getPullRequest: vi.fn().mockResolvedValue({
						number: defaultOptions.prNumber,
						user: { login: "coding-actor" },
						head: { sha: validSha, ref: "feature/test" },
					}),
					listCheckRunsForRef: mockListCheckRuns,
				}) as unknown as GitHubClient,
		);

		const exitCode = await runReviewGateCLI(defaultOptions);

		expect(exitCode).toBe(EXIT_CODES.REVIEW_NOT_VERIFIED);
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
	});
});

describe("postRerunCommentIfNeeded", () => {
	const headSha = "0123456789abcdef0123456789abcdef01234567";

	const mockRepositoryIdentifier = "acme/repo";
	const mockBranch = "feature/review-gate";
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
		({
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
					head: {
						ref: mockBranch,
						sha: "1111111111111111111111111111111111111111",
					},
				}),
			getRepositoryIdentifier:
				overrides.getRepositoryIdentifier ??
				vi.fn().mockReturnValue(mockRepositoryIdentifier),
		}) as unknown as GitHubClient;

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
});
