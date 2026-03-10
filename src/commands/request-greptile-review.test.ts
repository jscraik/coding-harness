import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	EXIT_CODES,
	requestGreptileReview,
	runRequestGreptileReviewCLI,
} from "./request-greptile-review.js";

// Mock the GitHub client
vi.mock("../lib/github/client.js", () => ({
	GitHubClient: vi.fn().mockImplementation(() => ({
		createIssueComment: vi.fn().mockResolvedValue({
			html_url: "https://github.com/owner/repo/issues/1#issuecomment-123",
		}),
	})),
}));

describe("request-greptile-review", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		vi.clearAllMocks();
		// Isolate environment to prevent env vars from affecting tests
		process.env = { ...originalEnv };
		process.env.GITHUB_TOKEN = undefined;
		process.env.GITHUB_PERSONAL_ACCESS_TOKEN = undefined;
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe("requestGreptileReview", () => {
		it("returns error when token is missing", async () => {
			const result = await requestGreptileReview({
				owner: "test-owner",
				repo: "test-repo",
				pr: 1,
			});

			expect(result.ok).toBe(false);
			expect(result.error?.code).toBe("VALIDATION_ERROR");
			expect(result.error?.message).toContain("Missing GitHub token");
		});

		it("returns error when owner is missing", async () => {
			const result = await requestGreptileReview({
				token: "test-token",
				repo: "test-repo",
				pr: 1,
			});

			expect(result.ok).toBe(false);
			expect(result.error?.code).toBe("VALIDATION_ERROR");
			expect(result.error?.message).toContain("--owner");
		});

		it("returns error when repo is missing", async () => {
			const result = await requestGreptileReview({
				token: "test-token",
				owner: "test-owner",
				pr: 1,
			});

			expect(result.ok).toBe(false);
			expect(result.error?.code).toBe("VALIDATION_ERROR");
			expect(result.error?.message).toContain("--repo");
		});

		it("returns error when PR number is invalid", async () => {
			const result = await requestGreptileReview({
				token: "test-token",
				owner: "test-owner",
				repo: "test-repo",
				pr: 0,
			});

			expect(result.ok).toBe(false);
			expect(result.error?.code).toBe("VALIDATION_ERROR");
			expect(result.error?.message).toContain("--pr");
		});

		it("successfully requests review with default message", async () => {
			const { GitHubClient } = await import("../lib/github/client.js");

			const result = await requestGreptileReview({
				token: "test-token",
				owner: "test-owner",
				repo: "test-repo",
				pr: 1,
			});

			expect(result.ok).toBe(true);
			expect(result.commentUrl).toBe(
				"https://github.com/owner/repo/issues/1#issuecomment-123",
			);

			const mockClient = vi.mocked(GitHubClient).mock.results[0]?.value;
			expect(mockClient?.createIssueComment).toHaveBeenCalledWith(
				1,
				"@greptile please review the latest changes",
			);
		});

		it("successfully requests review with custom message", async () => {
			const { GitHubClient } = await import("../lib/github/client.js");

			const result = await requestGreptileReview({
				token: "test-token",
				owner: "test-owner",
				repo: "test-repo",
				pr: 1,
				message: "@greptile please review this PR for security issues",
			});

			expect(result.ok).toBe(true);

			const mockClient = vi.mocked(GitHubClient).mock.results[0]?.value;
			expect(mockClient?.createIssueComment).toHaveBeenCalledWith(
				1,
				"@greptile please review this PR for security issues",
			);
		});
	});

	describe("runRequestGreptileReviewCLI", () => {
		it("returns SUCCESS exit code on success", async () => {
			const exitCode = await runRequestGreptileReviewCLI({
				token: "test-token",
				owner: "test-owner",
				repo: "test-repo",
				pr: 1,
			});

			expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		});

		it("returns VALIDATION_ERROR exit code on failure", async () => {
			const exitCode = await runRequestGreptileReviewCLI({
				owner: "test-owner",
				repo: "test-repo",
				pr: 1,
			});

			expect(exitCode).toBe(EXIT_CODES.VALIDATION_ERROR);
		});

		it("outputs JSON when --json flag is set", async () => {
			const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {
				/* suppress console output */
			});

			await runRequestGreptileReviewCLI({
				token: "test-token",
				owner: "test-owner",
				repo: "test-repo",
				pr: 1,
				json: true,
			});

			expect(consoleSpy).toHaveBeenCalled();
			const output = consoleSpy.mock.calls[0]?.[0];
			const parsed = JSON.parse(output as string);
			expect(parsed.ok).toBe(true);
			expect(parsed.commentUrl).toBeDefined();

			consoleSpy.mockRestore();
		});
	});
});
