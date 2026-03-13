/**
 * GitHub Integration E2E Tests
 *
 * Comprehensive end-to-end tests for GitHub API integration.
 * Uses real API calls - no mocks.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runReviewGate } from "../../src/commands/review-gate.js";
import { GitHubE2EClient } from "../clients/github-e2e.js";
import { loadE2EEnv, validateE2EEnv } from "../utils/env.js";
import {
	type E2ETestContext,
	createTestContext,
} from "../utils/resource-tracker.js";

describe("GitHub Integration E2E", () => {
	let ctx: E2ETestContext;
	let github: GitHubE2EClient;
	let env: ReturnType<typeof loadE2EEnv>;
	let tempDir: string;

	beforeAll(() => {
		validateE2EEnv();
		env = loadE2EEnv();
	});

	beforeEach(() => {
		ctx = createTestContext("github-integration", env.recordingsDir);
		github = new GitHubE2EClient({ env, tracker: ctx.tracker });
		tempDir = join(tmpdir(), `e2e-github-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
	});

	afterAll(async () => {
		await ctx.tracker.cleanup();
	});

	describe("Repository Operations", () => {
		it("should get repository information with real API", async () => {
			const client = github.getClient();
			const defaultBranch = await client.getDefaultBranch();

			expect(defaultBranch).toBeTruthy();
			expect(typeof defaultBranch).toBe("string");

			const visibility = await client.getRepositoryVisibility();
			expect(["public", "private", "internal"]).toContain(visibility);
		});

		it("should list rulesets with real API", async () => {
			const rulesets = await github.listRulesets();

			expect(Array.isArray(rulesets)).toBe(true);
			// Each ruleset should have required fields
			for (const ruleset of rulesets) {
				expect(ruleset).toHaveProperty("id");
				expect(ruleset).toHaveProperty("name");
				expect(ruleset).toHaveProperty("target");
				expect(ruleset).toHaveProperty("enforcement");
			}
		});
	});

	describe("Pull Request Lifecycle", () => {
		it("should create, retrieve, and close a PR with real API", async () => {
			// 1. Create a test branch
			const branchName = `e2e-pr-test-${Date.now()}`;
			const branch = await github.createBranch(branchName);

			expect(branch.name).toBe(branchName);
			expect(branch.sha).toBeTruthy();
			expect(branch.sha.length).toBe(40); // Full SHA

			// 2. Create a PR
			const pr = await github.createPullRequest(
				`E2E Test PR ${Date.now()}`,
				"This is an automated E2E test PR. It will be closed automatically.",
				branch.name,
				"main",
			);

			expect(pr.number).toBeGreaterThan(0);
			expect(pr.title).toContain("E2E Test PR");
			expect(pr.headBranch).toBe(branchName);
			expect(pr.baseBranch).toBe("main");
			expect(pr.headSha).toBeTruthy();
			expect(pr.url).toContain("github.com");

			// 3. Retrieve the PR
			const retrieved = await github.getPullRequest(pr.number);
			expect(retrieved.number).toBe(pr.number);
			expect(retrieved.head.sha).toBe(pr.headSha);

			// 4. List PR reviews (should be empty)
			const reviews = await github.listPullRequestReviews(pr.number);
			expect(Array.isArray(reviews)).toBe(true);

			// 5. Close the PR (cleanup)
			await github.closePullRequest(pr.number);

			// Verify it's closed
			const closed = await github.getPullRequest(pr.number);
			expect(closed.state).toBe("closed");
		});

		it("should create and retrieve PR review threads with real API", async () => {
			// Create branch and PR
			const branchName = `e2e-threads-test-${Date.now()}`;
			await github.createBranch(branchName);

			const pr = await github.createPullRequest(
				`E2E Test Threads ${Date.now()}`,
				"Testing review threads",
				branchName,
				"main",
			);

			// List review threads (may be empty but API should work)
			const threads = await github.listPullRequestReviewThreads(pr.number);
			expect(Array.isArray(threads)).toBe(true);

			// Cleanup
			await github.closePullRequest(pr.number);
		});
	});

	describe("Check Run Operations", () => {
		it("should create and list check runs with real API", async () => {
			// Get the default branch SHA
			const client = github.getClient();
			const _defaultBranch = await client.getDefaultBranch();

			// We need to use a real commit SHA
			// For this test, we'll use the branch tip
			const branchName = `e2e-checks-${Date.now()}`;
			const branch = await github.createBranch(branchName);

			// Create a check run
			const checkName = `e2e-check-${Date.now()}`;
			const checkRun = await github.createCheckRun(
				checkName,
				branch.sha,
				"completed",
				"success",
			);

			expect(checkRun.id).toBeGreaterThan(0);
			expect(checkRun.name).toBe(checkName);
			expect(checkRun.status).toBe("completed");
			expect(checkRun.conclusion).toBe("success");

			// List check runs for the ref
			const checkRuns = await github.listCheckRunsForRef(branch.sha);
			expect(Array.isArray(checkRuns)).toBe(true);

			const foundCheck = checkRuns.find((c) => c.id === checkRun.id);
			expect(foundCheck).toBeTruthy();
			expect(foundCheck?.name).toBe(checkName);
		});
	});

	describe("Issue Comment Operations", () => {
		it("should create and list issue comments with real API", async () => {
			// Create a branch and PR to comment on
			const branchName = `e2e-comment-test-${Date.now()}`;
			await github.createBranch(branchName);

			const pr = await github.createPullRequest(
				`E2E Test Comments ${Date.now()}`,
				"Testing comments",
				branchName,
				"main",
			);

			// Create a comment
			const commentBody = `E2E Test Comment created at ${new Date().toISOString()}`;
			const comment = await github.createIssueComment(pr.number, commentBody);

			expect(comment.id).toBeGreaterThan(0);
			expect(comment.body).toBe(commentBody);

			// List comments
			const comments = await github.getClient().listIssueComments(pr.number);
			expect(Array.isArray(comments)).toBe(true);

			const foundComment = comments.find((c) => c.id === comment.id);
			expect(foundComment).toBeTruthy();

			// Cleanup
			await github.closePullRequest(pr.number);
		});
	});

	describe("Ruleset Operations", () => {
		it("should create and verify rulesets with real API", async () => {
			const rulesetName = `e2e-ruleset-${Date.now()}`;

			// Create a ruleset
			const ruleset = await github.createRuleset({
				name: rulesetName,
				target: "branch",
				enforcement: "disabled", // Use disabled to avoid blocking other tests
				bypass_actors: [],
				conditions: {
					ref_name: {
						include: ["refs/heads/e2e/**"],
						exclude: [],
					},
				},
				rules: [{ type: "deletion" }, { type: "non_fast_forward" }],
			});

			expect(ruleset.id).toBeGreaterThan(0);
			expect(ruleset.name).toBe(rulesetName);
			expect(ruleset.target).toBe("branch");
			expect(ruleset.enforcement).toBe("disabled");
			expect(Array.isArray(ruleset.rules)).toBe(true);
			expect(ruleset.rules.length).toBeGreaterThanOrEqual(2);

			// List rulesets and verify our new one is there
			const rulesets = await github.listRulesets();
			const foundRuleset = rulesets.find((r) => r.id === ruleset.id);
			expect(foundRuleset).toBeTruthy();
			expect(foundRuleset?.name).toBe(rulesetName);

			// Get detailed ruleset info
			const detailed = await github.getClient().getRuleset(ruleset.id);
			expect(detailed.id).toBe(ruleset.id);
			expect(detailed.conditions.ref_name?.include).toContain(
				"refs/heads/e2e/**",
			);
		});
	});

	describe("Review Gate Command", () => {
		it("should run review-gate command against real PR", async () => {
			// Setup: Create branch and PR
			const branchName = `e2e-review-gate-${Date.now()}`;
			const branch = await github.createBranch(branchName);

			const pr = await github.createPullRequest(
				`E2E Review Gate Test ${Date.now()}`,
				"Testing review-gate command with real API",
				branch.name,
				"main",
			);

			// Create a contract file for the test
			const contractPath = join(tempDir, "harness.contract.json");
			writeFileSync(
				contractPath,
				JSON.stringify({
					version: "1.0",
					reviewPolicy: {
						timeoutSeconds: 300,
						timeoutAction: "fail",
						requiredChecks: [],
						enforceReviewerIndependence: false,
					},
				}),
				"utf-8",
			);

			// Run the review-gate command
			const result = await runReviewGate({
				contractPath,
				token: env.githubToken,
				owner: env.githubOwner,
				repo: env.githubTestRepo,
				prNumber: pr.number,
				headSha: branch.sha,
				checkName: "review-check",
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.headSha).toBe(branch.sha);
				expect(result.output.verified).toBe(true); // No failing checks
				expect(Array.isArray(result.output.blockers)).toBe(true);
			}

			// Cleanup
			await github.closePullRequest(pr.number);
		});
	});
});
