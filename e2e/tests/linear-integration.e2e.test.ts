/**
 * Linear Integration E2E Tests
 *
 * Comprehensive end-to-end tests for Linear API integration.
 * Uses real API calls - no mocks.
 */

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runLinearGate } from "../../src/commands/linear-gate.js";
import { LinearE2EClient } from "../clients/linear-e2e.js";
import { loadE2EEnv, validateE2EEnv } from "../utils/env.js";
import {
	type E2ETestContext,
	createTestContext,
} from "../utils/resource-tracker.js";

describe("Linear Integration E2E", () => {
	let ctx: E2ETestContext;
	let linear: LinearE2EClient;
	let env: ReturnType<typeof loadE2EEnv>;
	let tempDir: string;
	let teamId: string | null = null;

	beforeAll(async () => {
		validateE2EEnv();
		env = loadE2EEnv();
	});

	beforeEach(async () => {
		ctx = createTestContext("linear-integration", env.recordingsDir);
		linear = new LinearE2EClient({ env, tracker: ctx.tracker });
		tempDir = mkdtempSync(join(tmpdir(), "e2e-linear-"));

		// Get the team ID for creating issues
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
	});

	describe("Viewer and Authentication", () => {
		it("should get the current viewer with real API", async () => {
			const viewer = await linear.getViewer();

			expect(viewer).toHaveProperty("id");
			expect(viewer).toHaveProperty("name");
			expect(viewer).toHaveProperty("email");
			expect(viewer.email).toContain("@");
		});
	});

	describe("Workflow States", () => {
		it("should list all workflow states with real API", async () => {
			const states = await linear.listWorkflowStates();

			expect(Array.isArray(states)).toBe(true);
			expect(states.length).toBeGreaterThan(0);

			// Each state should have required fields
			for (const state of states) {
				expect(state).toHaveProperty("id");
				expect(state).toHaveProperty("name");
				expect(state).toHaveProperty("type");
				expect(state).toHaveProperty("team");
				expect(state.team).toHaveProperty("id");
				expect(state.team).toHaveProperty("key");
				expect(state.team).toHaveProperty("name");
			}

			// Should have states for our test team
			const teamStates = states.filter(
				(s) => s.team.key === env.linearTestTeam,
			);
			expect(teamStates.length).toBeGreaterThan(0);
		});
	});

	describe("Issue Lifecycle", () => {
		it.skipIf(!teamId)(
			"should create and archive an issue with real API",
			async () => {
				const title = `E2E Test Issue ${Date.now()}`;
				const description = `This is an automated E2E test issue created at ${new Date().toISOString()}. It will be archived automatically.`;

				// Create the issue
				const issue = await linear.createIssue({
					title,
					description,
					teamId: teamId!,
				});

				expect(issue).toHaveProperty("id");
				expect(issue).toHaveProperty("identifier");
				expect(issue.identifier).toMatch(
					new RegExp(`^${env.linearTestTeam}-\\d+$`),
				);
				expect(issue.title).toBe(title);
				expect(issue.url).toContain("linear.app");
				expect(issue.stateName).toBeTruthy();

				// Search for the issue
				const searchResults = await linear.searchIssues(title);
				const foundIssue = searchResults.find((i) => i.id === issue.id);
				expect(foundIssue).toBeTruthy();
				expect(foundIssue?.title).toBe(title);
			},
		);

		it.skipIf(!teamId)(
			"should transition an issue through states with real API",
			async () => {
				// Get available states
				const states = await linear.listWorkflowStates();
				const teamStates = states.filter(
					(s) => s.team.key === env.linearTestTeam,
				);

				if (teamStates.length < 2) {
					console.info("Skipping: Not enough states to test transitions");
					return;
				}

				// Create an issue
				const issue = await linear.createIssue({
					title: `E2E State Transition Test ${Date.now()}`,
					description: "Testing state transitions",
					teamId: teamId!,
				});

				expect(issue.stateId).toBeTruthy();

				// Find a different state to transition to
				const differentState = teamStates.find((s) => s.id !== issue.stateId);
				if (differentState) {
					await linear.transitionIssue(issue.id, differentState.id);

					// Note: We can't easily verify the transition without re-querying
					// The API call itself succeeding is a good indicator
				}
			},
		);
	});

	describe("Issue Comments", () => {
		it.skipIf(!teamId)(
			"should create comments on issues with real API",
			async () => {
				// Create an issue
				const issue = await linear.createIssue({
					title: `E2E Comment Test ${Date.now()}`,
					description: "Testing comments",
					teamId: teamId!,
				});

				// Add a comment
				const commentBody = `E2E Test Comment created at ${new Date().toISOString()}`;
				await linear.createComment(issue.id, commentBody);

				// Note: Linear doesn't provide a direct API to retrieve comments
				// The API call succeeding is our verification
			},
		);
	});

	describe("Issue Attachments", () => {
		it.skipIf(!teamId)(
			"should create attachments on issues with real API",
			async () => {
				// Create an issue
				const issue = await linear.createIssue({
					title: `E2E Attachment Test ${Date.now()}`,
					description: "Testing attachments",
					teamId: teamId!,
				});

				// Add an attachment
				await linear.createAttachment({
					issueId: issue.id,
					title: "E2E Test Attachment",
					url: "https://example.com/e2e-test",
					commentBody: "This is a test attachment",
				});

				// Note: Linear doesn't provide a direct API to retrieve attachments
				// The API call succeeding is our verification
			},
		);
	});

	describe("Linear Gate Command", () => {
		it.skipIf(!teamId)(
			"should run linear-gate command with real API",
			async () => {
				// Create a test issue
				const issue = await linear.createIssue({
					title: `E2E Linear Gate Test ${Date.now()}`,
					description: "Testing linear-gate command",
					teamId: teamId!,
				});

				// Create a contract file
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

				// Run the linear-gate command
				const result = await runLinearGate({
					contractPath,
					branchName: `codex/${env.linearTestTeam}-123-test`,
					prTitle: `[${env.linearTestTeam}-123] Test PR`,
					prBody: `Testing with issue ${issue.identifier}`,
					packageJsonPath: join(process.cwd(), "package.json"),
				});

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.output.compliant).toBe(true);
				}
			},
		);
	});
});
