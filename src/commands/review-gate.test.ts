import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckRun } from "../lib/github/client.js";
import { runReviewGate } from "./review-gate.js";

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
	ShaValidationError: class ShaValidationError extends Error {
		constructor(sha: string) {
			super(`Invalid SHA format: ${sha}`);
			this.name = "ShaValidationError";
		}
	},
}));

import { loadContract } from "../lib/contract/loader.js";
import { GitHubClient } from "../lib/github/client.js";
import { validateSha } from "../lib/github/sha.js";

const mockGitHubClient = vi.mocked(GitHubClient);
const mockLoadContract = vi.mocked(loadContract);
const mockValidateSha = vi.mocked(validateSha);

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
			reviewPolicy: { timeoutSeconds: 600, timeoutAction: "fail" },
		});
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

	it("returns not_found when check run does not exist", async () => {
		const mockListCheckRuns = vi.fn().mockResolvedValue([]);
		mockGitHubClient.mockImplementation(
			() =>
				({
					listCheckRunsForRef: mockListCheckRuns,
				}) as unknown as GitHubClient,
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.checkStatus).toBe("not_found");
			expect(result.output.needsRerun).toBe(true);
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
		mockGitHubClient.mockImplementation(
			() =>
				({
					listCheckRunsForRef: mockListCheckRuns,
				}) as unknown as GitHubClient,
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(true);
			expect(result.output.checkStatus).toBe("completed");
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
		mockGitHubClient.mockImplementation(
			() =>
				({
					listCheckRunsForRef: mockListCheckRuns,
				}) as unknown as GitHubClient,
		);

		const result = await runReviewGate(defaultOptions);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.verified).toBe(false);
			expect(result.output.checkConclusion).toBe("failure");
			expect(result.output.needsRerun).toBe(true);
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
