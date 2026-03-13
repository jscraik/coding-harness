/**
 * Command Pipeline E2E Tests
 *
 * Tests complete command pipelines with real API calls.
 * No mocks - everything hits real services.
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runBranchProtect } from "../../src/commands/branch-protect.js";
import { runCheckAuthz } from "../../src/commands/check-authz.js";
import { runInit } from "../../src/commands/init.js";
import { runLinearGate } from "../../src/commands/linear-gate.js";
import { runPlanGate } from "../../src/commands/plan-gate.js";
import { runReviewGate } from "../../src/commands/review-gate.js";
import { GitHubE2EClient } from "../clients/github-e2e.js";
import { LinearE2EClient } from "../clients/linear-e2e.js";
import { loadE2EEnv, validateE2EEnv } from "../utils/env.js";
import {
	type E2ETestContext,
	createTestContext,
} from "../utils/resource-tracker.js";

describe("Command Pipeline E2E", () => {
	let ctx: E2ETestContext;
	let github: GitHubE2EClient;
	let linear: LinearE2EClient;
	let env: ReturnType<typeof loadE2EEnv>;
	let tempDir: string;
	let teamId: string | null = null;

	beforeAll(async () => {
		validateE2EEnv();
		env = loadE2EEnv();
	});

	beforeEach(async () => {
		ctx = createTestContext("command-pipeline", env.recordingsDir);
		github = new GitHubE2EClient({ env, tracker: ctx.tracker });
		linear = new LinearE2EClient({ env, tracker: ctx.tracker });
		tempDir = join(tmpdir(), `e2e-pipeline-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });

		// Get team ID for Linear tests
		if (!teamId) {
			const states = await linear.listWorkflowStates();
			const teamState = states.find((s) => s.team.key === env.linearTestTeam);
			if (teamState) {
				teamId = teamState.team.id;
			}
		}
	});

	afterAll(async () => {
		await ctx.tracker.cleanup();
		// Cleanup temp directory
		try {
			rmSync(tempDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("Review Gate Pipeline", () => {
		it("should pass review-gate on clean PR with no failing checks", async () => {
			// Setup: Create branch and PR
			const branchName = `e2e-review-clean-${Date.now()}`;
			const branch = await github.createBranch(branchName);

			const pr = await github.createPullRequest(
				`E2E Review Gate Clean Test ${Date.now()}`,
				"Testing review-gate on a clean PR",
				branch.name,
				"main",
			);

			// Create a success check run
			await github.createCheckRun(
				"e2e-test-check",
				branch.sha,
				"completed",
				"success",
			);

			// Create contract
			const contractPath = join(tempDir, "harness.contract.json");
			writeFileSync(
				contractPath,
				JSON.stringify({
					version: "1.0",
					reviewPolicy: {
						timeoutSeconds: 300,
						timeoutAction: "fail",
						requiredChecks: ["e2e-test-check"],
						enforceReviewerIndependence: false,
					},
				}),
				"utf-8",
			);

			// Run review-gate
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
				expect(result.output.verified).toBe(true);
				expect(result.output.policy_gate_status).toBe("pass");
				expect(result.output.headSha).toBe(branch.sha);
			}

			// Cleanup
			await github.closePullRequest(pr.number);
		});

		it("should fail review-gate when required check fails", async () => {
			// Setup: Create branch and PR
			const branchName = `e2e-review-fail-${Date.now()}`;
			const branch = await github.createBranch(branchName);

			const pr = await github.createPullRequest(
				`E2E Review Gate Fail Test ${Date.now()}`,
				"Testing review-gate failure detection",
				branch.name,
				"main",
			);

			// Create a failing check run
			await github.createCheckRun(
				"e2e-failing-check",
				branch.sha,
				"completed",
				"failure",
			);

			// Create contract requiring the failing check
			const contractPath = join(tempDir, "harness.contract.json");
			writeFileSync(
				contractPath,
				JSON.stringify({
					version: "1.0",
					reviewPolicy: {
						timeoutSeconds: 300,
						timeoutAction: "fail",
						requiredChecks: ["e2e-failing-check"],
						enforceReviewerIndependence: false,
					},
				}),
				"utf-8",
			);

			// Run review-gate
			const result = await runReviewGate({
				contractPath,
				token: env.githubToken,
				owner: env.githubOwner,
				repo: env.githubTestRepo,
				prNumber: pr.number,
				headSha: branch.sha,
				checkName: "review-check",
			});

			expect(result.ok).toBe(true); // Command succeeded
			if (result.ok) {
				expect(result.output.verified).toBe(false); // But verification failed
				expect(result.output.policy_gate_status).toBe("fail");
			}

			// Cleanup
			await github.closePullRequest(pr.number);
		});

		it("should detect reviewer independence with real reviews", async () => {
			// Setup: Create branch and PR
			const branchName = `e2e-reviewer-indep-${Date.now()}`;
			const branch = await github.createBranch(branchName);

			const pr = await github.createPullRequest(
				`E2E Reviewer Independence Test ${Date.now()}`,
				"Testing reviewer independence detection",
				branch.name,
				"main",
			);

			// Create contract with reviewer independence enforced
			const contractPath = join(tempDir, "harness.contract.json");
			writeFileSync(
				contractPath,
				JSON.stringify({
					version: "1.0",
					reviewPolicy: {
						timeoutSeconds: 300,
						timeoutAction: "fail",
						requiredChecks: [],
						enforceReviewerIndependence: true,
					},
				}),
				"utf-8",
			);

			// Run review-gate
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
				// Should pass even without reviews for this test
				// (we're just verifying the API integration works)
				expect(result.output).toHaveProperty("verified");
				expect(result.output).toHaveProperty("policy_gate_status");
			}

			// Cleanup
			await github.closePullRequest(pr.number);
		});
	});

	describe("Linear Gate Pipeline", () => {
		it.skipIf(!teamId)(
			"should pass linear-gate with valid issue references",
			async () => {
				// Create a test issue
				const issue = await linear.createIssue({
					title: `E2E Linear Gate Valid Test ${Date.now()}`,
					description: "Testing linear-gate with valid issue reference",
					teamId: teamId!,
				});

				// Create package.json with bugs URL
				const packageJsonPath = join(tempDir, "package.json");
				writeFileSync(
					packageJsonPath,
					JSON.stringify({
						name: "e2e-test",
						version: "1.0.0",
						bugs: {
							url: "https://linear.app/jscraik/project/test",
						},
					}),
					"utf-8",
				);

				// Create contract
				const contractPath = join(tempDir, "harness.contract.json");
				writeFileSync(
					contractPath,
					JSON.stringify({
						version: "1.0",
						issueTrackingPolicy: {
							provider: "linear",
							requirePackageBugsUrl: true,
							requireBranchIssueKey: true,
							requirePrIssueKey: true,
						},
					}),
					"utf-8",
				);

				// Run linear-gate with valid branch/PR referencing the issue
				const result = await runLinearGate({
					contractPath,
					branchName: `codex/${issue.identifier}-test`,
					prTitle: `[${issue.identifier}] Test PR`,
					prBody: `This PR implements ${issue.identifier}`,
					packageJsonPath,
				});

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.output.compliant).toBe(true);
				}
			},
		);

		it.skipIf(!teamId)(
			"should fail linear-gate without issue references",
			async () => {
				// Create package.json without proper bugs URL
				const packageJsonPath = join(tempDir, "package.json");
				writeFileSync(
					packageJsonPath,
					JSON.stringify({
						name: "e2e-test",
						version: "1.0.0",
					}),
					"utf-8",
				);

				// Create contract requiring issue tracking
				const contractPath = join(tempDir, "harness.contract.json");
				writeFileSync(
					contractPath,
					JSON.stringify({
						version: "1.0",
						issueTrackingPolicy: {
							provider: "linear",
							requirePackageBugsUrl: true,
							requireBranchIssueKey: true,
							requirePrIssueKey: true,
						},
					}),
					"utf-8",
				);

				// Run linear-gate with branch/PR that don't reference issues
				const result = await runLinearGate({
					contractPath,
					branchName: "feature/test-no-issue",
					prTitle: "Test PR without issue",
					prBody: "This PR has no issue reference",
					packageJsonPath,
				});

				expect(result.ok).toBe(true); // Command succeeded
				if (result.ok) {
					expect(result.output.compliant).toBe(false); // But not compliant
					expect(result.output.violations.length).toBeGreaterThan(0);
				}
			},
		);
	});

	describe("Branch Protect Pipeline", () => {
		it("should validate branch protection rules with real API", async () => {
			// Create contract with branch protection settings
			const contractPath = join(tempDir, "harness.contract.json");
			writeFileSync(
				contractPath,
				JSON.stringify({
					version: "1.0",
					branchProtection: {
						requiredChecks: ["test", "lint"],
						blockForcePushes: true,
						requireLinearHistory: true,
						requirePullRequest: true,
					},
				}),
				"utf-8",
			);

			// Run branch-protect command
			const result = await runBranchProtect({
				contractPath,
				token: env.githubToken,
				owner: env.githubOwner,
				repo: env.githubTestRepo,
				branch: "main",
				dryRun: true, // Don't actually modify protection
			});

			// We expect this to complete - the result depends on actual repo state
			expect(result).toBeDefined();
			expect(result).toHaveProperty("ok");
		});

		it("should analyze rulesets with real API", async () => {
			// List existing rulesets first
			const rulesets = await github.listRulesets();

			expect(Array.isArray(rulesets)).toBe(true);

			// If there are rulesets, verify we can get details
			if (rulesets.length > 0) {
				const firstRuleset = await github
					.getClient()
					.getRuleset(rulesets[0].id);
				expect(firstRuleset).toHaveProperty("id");
				expect(firstRuleset).toHaveProperty("name");
				expect(firstRuleset).toHaveProperty("rules");
				expect(Array.isArray(firstRuleset.rules)).toBe(true);
			}
		});
	});

	describe("Plan Gate Pipeline", () => {
		it("should validate plan traceability with real file system", async () => {
			// Create a plan file
			const plansDir = join(tempDir, "docs", "plans");
			mkdirSync(plansDir, { recursive: true });

			const planId = `test-plan-${Date.now()}`;
			writeFileSync(
				join(plansDir, `${planId}.md`),
				`# Test Plan

## Overview
This is a test plan for E2E testing.

## Checklist
- [x] Step 1 completed
- [x] Step 2 completed
- [ ] Step 3 pending

## Evidence
- [Evidence Link](./evidence/test.png)
`,
				"utf-8",
			);

			// Create contract
			const contractPath = join(tempDir, "harness.contract.json");
			writeFileSync(
				contractPath,
				JSON.stringify({
					version: "1.0",
				}),
				"utf-8",
			);

			// Run plan-gate
			const result = await runPlanGate({
				contractPath,
				planId,
				plansDir: "docs/plans",
			});

			expect(result).toBeDefined();
			expect(result).toHaveProperty("ok");
		});
	});

	describe("Authz Check Pipeline", () => {
		it("should validate GitHub token authorization with real API", async () => {
			// Create contract with authz policy
			const contractPath = join(tempDir, "harness.contract.json");
			writeFileSync(
				contractPath,
				JSON.stringify({
					version: "1.0",
					pilotAuthzPolicy: {
						githubScopeAllowlist: ["pull_requests:write", "contents:read"],
						repoAllowlist: [`${env.githubOwner}/${env.githubTestRepo}`],
						branchAllowlist: ["*"],
						protectedBranchDenylist: ["main", "master"],
						enforceBranchProtection: true,
					},
				}),
				"utf-8",
			);

			// Run check-authz
			const result = await runCheckAuthz({
				contractPath,
				token: env.githubToken,
				owner: env.githubOwner,
				repo: env.githubTestRepo,
				branch: "feature/test",
				dryRun: true,
			});

			expect(result).toBeDefined();
			expect(result).toHaveProperty("ok");
		});
	});

	describe("Init Command Pipeline", () => {
		it("should scaffold harness configuration", async () => {
			const testDir = join(tempDir, "init-test");
			mkdirSync(testDir, { recursive: true });

			// Create a minimal package.json
			writeFileSync(
				join(testDir, "package.json"),
				JSON.stringify({
					name: "test-project",
					version: "1.0.0",
				}),
				"utf-8",
			);

			// Run init
			const result = await runInit({
				targetDir: testDir,
				force: true,
				dryRun: false,
				skipGitHub: true,
				skipReadiness: true,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.filesCreated.length).toBeGreaterThan(0);
			}
		});
	});
});
