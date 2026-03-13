/**
 * GitHub E2E Client
 *
 * Extended GitHub client with E2E testing utilities.
 * Wraps the production GitHubClient with resource tracking and test helpers.
 */

import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GitHubClient } from "../../src/lib/github/client.js";
import type { E2EEnv } from "../utils/env.js";
import type { ResourceTracker } from "../utils/resource-tracker.js";

export interface GitHubE2EOptions {
	env: E2EEnv;
	tracker: ResourceTracker;
}

export interface TestRepository {
	owner: string;
	name: string;
	fullName: string;
	cloneUrl: string;
	defaultBranch: string;
}

export interface TestPullRequest {
	number: number;
	title: string;
	body: string;
	headBranch: string;
	baseBranch: string;
	headSha: string;
	url: string;
}

export interface TestBranch {
	name: string;
	sha: string;
}

export class GitHubE2EClient {
	private client: GitHubClient;
	private tracker: ResourceTracker;
	private env: E2EEnv;

	constructor(options: GitHubE2EOptions) {
		this.env = options.env;
		this.tracker = options.tracker;
		this.client = new GitHubClient({
			token: options.env.githubToken,
			owner: options.env.githubOwner,
			repo: options.env.githubTestRepo,
		});
	}

	/**
	 * Get the underlying GitHub client for direct API access
	 */
	getClient(): GitHubClient {
		return this.client;
	}

	/**
	 * Create a test repository for E2E testing
	 */
	async createTestRepository(
		name: string,
		description?: string,
	): Promise<TestRepository> {
		const startTime = Date.now();

		try {
			// Note: Repository creation requires org-level permissions or user scope
			// For E2E tests, we typically use a pre-created test repo
			// This method documents the expected interface
			const repo: TestRepository = {
				owner: this.env.githubOwner,
				name: name,
				fullName: `${this.env.githubOwner}/${name}`,
				cloneUrl: `https://github.com/${this.env.githubOwner}/${name}.git`,
				defaultBranch: "main",
			};

			this.tracker.track("github-repo", repo.fullName, repo.name, {
				description,
				cloneUrl: repo.cloneUrl,
			});

			this.tracker.recordAPICall({
				provider: "github",
				method: "repos.createForAuthenticatedUser",
				request: { name, description },
				response: repo,
				durationMs: Date.now() - startTime,
			});

			return repo;
		} catch (error) {
			this.tracker.recordAPICall({
				provider: "github",
				method: "repos.createForAuthenticatedUser",
				request: { name, description },
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * Create a test branch in the repository
	 */
	async createBranch(name: string, fromBranch = "main"): Promise<TestBranch> {
		const startTime = Date.now();

		try {
			// Get the SHA of the base branch
			const { spawnSync } = await import("node:child_process");

			// Create a temporary directory for git operations
			const tempDir = join(tmpdir(), `github-e2e-${Date.now()}`);

			// Clone the repo
			const cloneResult = spawnSync(
				"git",
				[
					"clone",
					"--depth",
					"1",
					"-c",
					"user.email=e2e@example.com",
					"-c",
					"user.name=E2E Test",
					`https://${this.env.githubToken}@github.com/${this.env.githubOwner}/${this.env.githubTestRepo}.git`,
					tempDir,
				],
				{ encoding: "utf-8" },
			);

			if (cloneResult.error || cloneResult.status !== 0) {
				throw new Error(
					`Failed to clone repo: ${cloneResult.stderr || cloneResult.error?.message}`,
				);
			}

			// Create and checkout new branch
			const checkoutResult = spawnSync("git", ["checkout", "-b", name], {
				cwd: tempDir,
				encoding: "utf-8",
			});

			if (checkoutResult.error || checkoutResult.status !== 0) {
				throw new Error(
					`Failed to create branch: ${checkoutResult.stderr || checkoutResult.error?.message}`,
				);
			}

			// Create a test file to have something to push
			const testFile = join(tempDir, "e2e-test.txt");
			writeFileSync(testFile, `E2E Test Run: ${Date.now()}\n`, "utf-8");

			// Add, commit, and push
			spawnSync("git", ["add", "."], { cwd: tempDir, encoding: "utf-8" });
			spawnSync("git", ["commit", "-m", `E2E Test: ${name}`], {
				cwd: tempDir,
				encoding: "utf-8",
			});

			const pushResult = spawnSync("git", ["push", "origin", name], {
				cwd: tempDir,
				encoding: "utf-8",
			});

			if (pushResult.error || pushResult.status !== 0) {
				throw new Error(
					`Failed to push branch: ${pushResult.stderr || pushResult.error?.message}`,
				);
			}

			// Get the commit SHA
			const shaResult = spawnSync("git", ["rev-parse", "HEAD"], {
				cwd: tempDir,
				encoding: "utf-8",
			});

			const sha = shaResult.stdout.trim();

			// Cleanup temp directory
			spawnSync("rm", ["-rf", tempDir]);

			const branch: TestBranch = { name, sha };

			// Track for cleanup
			this.tracker.track(
				"github-branch",
				`${this.env.githubOwner}/${this.env.githubTestRepo}:${name}`,
				name,
				{
					sha,
					fromBranch,
					cleanupFunction: async () => {
						await this.deleteBranch(name);
					},
				},
			);

			this.tracker.recordAPICall({
				provider: "github",
				method: "git.createRef",
				request: { ref: `refs/heads/${name}`, sha },
				response: branch,
				durationMs: Date.now() - startTime,
			});

			return branch;
		} catch (error) {
			this.tracker.recordAPICall({
				provider: "github",
				method: "git.createRef",
				request: { ref: `refs/heads/${name}` },
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * Delete a branch
	 */
	async deleteBranch(name: string): Promise<void> {
		const startTime = Date.now();

		try {
			// Note: Using Octokit directly for branch deletion
			// This requires the Octokit instance to have access to git.deleteRef
			const octokit = (
				this.client as unknown as {
					octokit: {
						git: { deleteRef: (params: unknown) => Promise<unknown> };
					};
				}
			).octokit;

			if (octokit?.git?.deleteRef) {
				await octokit.git.deleteRef({
					owner: this.env.githubOwner,
					repo: this.env.githubTestRepo,
					ref: `heads/${name}`,
				});
			}

			this.tracker.recordAPICall({
				provider: "github",
				method: "git.deleteRef",
				request: { ref: `heads/${name}` },
				durationMs: Date.now() - startTime,
			});
		} catch (error) {
			this.tracker.recordAPICall({
				provider: "github",
				method: "git.deleteRef",
				request: { ref: `heads/${name}` },
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			});
			// Don't throw on cleanup failure
		}
	}

	/**
	 * Create a pull request
	 */
	async createPullRequest(
		title: string,
		body: string,
		headBranch: string,
		baseBranch = "main",
	): Promise<TestPullRequest> {
		const startTime = Date.now();

		try {
			// Using the underlying Octokit instance
			const octokit = (
				this.client as unknown as {
					octokit: {
						pulls: {
							create: (params: unknown) => Promise<{
								data: {
									number: number;
									title: string;
									body: string | null;
									head: { sha: string; ref: string };
									base: { ref: string };
									html_url: string;
								};
							}>;
						};
					};
				}
			).octokit;

			if (!octokit?.pulls?.create) {
				throw new Error("Octokit pulls.create not available");
			}

			const response = await octokit.pulls.create({
				owner: this.env.githubOwner,
				repo: this.env.githubTestRepo,
				title,
				body,
				head: headBranch,
				base: baseBranch,
			});

			const pr: TestPullRequest = {
				number: response.data.number,
				title: response.data.title,
				body: response.data.body || "",
				headBranch: response.data.head.ref,
				baseBranch: response.data.base.ref,
				headSha: response.data.head.sha,
				url: response.data.html_url,
			};

			// Track for cleanup
			this.tracker.track(
				"github-pr",
				`${this.env.githubOwner}/${this.env.githubTestRepo}#${pr.number}`,
				`PR #${pr.number}: ${title}`,
				{
					number: pr.number,
					headBranch: pr.headBranch,
					baseBranch: pr.baseBranch,
					url: pr.url,
				},
				async () => {
					await this.closePullRequest(pr.number);
				},
			);

			this.tracker.recordAPICall({
				provider: "github",
				method: "pulls.create",
				request: { title, body, head: headBranch, base: baseBranch },
				response: { number: pr.number, title: pr.title },
				durationMs: Date.now() - startTime,
			});

			return pr;
		} catch (error) {
			this.tracker.recordAPICall({
				provider: "github",
				method: "pulls.create",
				request: { title, body, head: headBranch, base: baseBranch },
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * Close a pull request
	 */
	async closePullRequest(number: number): Promise<void> {
		const startTime = Date.now();

		try {
			const octokit = (
				this.client as unknown as {
					octokit: { pulls: { update: (params: unknown) => Promise<unknown> } };
				}
			).octokit;

			if (octokit?.pulls?.update) {
				await octokit.pulls.update({
					owner: this.env.githubOwner,
					repo: this.env.githubTestRepo,
					pull_number: number,
					state: "closed",
				});
			}

			this.tracker.recordAPICall({
				provider: "github",
				method: "pulls.update",
				request: { pull_number: number, state: "closed" },
				durationMs: Date.now() - startTime,
			});
		} catch (error) {
			this.tracker.recordAPICall({
				provider: "github",
				method: "pulls.update",
				request: { pull_number: number, state: "closed" },
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			});
			// Don't throw on cleanup failure
		}
	}

	/**
	 * Create an issue comment
	 */
	async createIssueComment(
		issueNumber: number,
		body: string,
	): Promise<{ id: number; body: string }> {
		const startTime = Date.now();

		try {
			const comment = await this.client.createIssueComment(issueNumber, body);

			this.tracker.track(
				"github-comment",
				String(comment.id),
				`Comment on #${issueNumber}`,
				{
					issueNumber,
					body: body.substring(0, 100),
					cleanupFunction: async () => {
						await this.deleteComment(comment.id);
					},
				},
			);

			this.tracker.recordAPICall({
				provider: "github",
				method: "issues.createComment",
				request: { issue_number: issueNumber, body: body.substring(0, 100) },
				response: { id: comment.id },
				durationMs: Date.now() - startTime,
			});

			return { id: comment.id, body: comment.body };
		} catch (error) {
			this.tracker.recordAPICall({
				provider: "github",
				method: "issues.createComment",
				request: { issue_number: issueNumber },
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * Delete a comment
	 */
	async deleteComment(commentId: number): Promise<void> {
		const startTime = Date.now();

		try {
			const octokit = (
				this.client as unknown as {
					octokit: {
						issues: { deleteComment: (params: unknown) => Promise<unknown> };
					};
				}
			).octokit;

			if (octokit?.issues?.deleteComment) {
				await octokit.issues.deleteComment({
					owner: this.env.githubOwner,
					repo: this.env.githubTestRepo,
					comment_id: commentId,
				});
			}

			this.tracker.recordAPICall({
				provider: "github",
				method: "issues.deleteComment",
				request: { comment_id: commentId },
				durationMs: Date.now() - startTime,
			});
		} catch (error) {
			this.tracker.recordAPICall({
				provider: "github",
				method: "issues.deleteComment",
				request: { comment_id: commentId },
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Create a check run (for testing check run APIs)
	 */
	async createCheckRun(
		name: string,
		headSha: string,
		status: "queued" | "in_progress" | "completed" = "completed",
		conclusion?:
			| "success"
			| "failure"
			| "neutral"
			| "cancelled"
			| "skipped"
			| "timed_out"
			| "action_required",
	): Promise<{
		id: number;
		name: string;
		status: string;
		conclusion?: string | null;
	}> {
		const startTime = Date.now();

		try {
			const octokit = (
				this.client as unknown as {
					octokit: {
						checks: {
							create: (params: unknown) => Promise<{
								data: {
									id: number;
									name: string;
									status: string;
									conclusion: string | null;
								};
							}>;
						};
					};
				}
			).octokit;

			if (!octokit?.checks?.create) {
				throw new Error("Octokit checks.create not available");
			}

			const response = await octokit.checks.create({
				owner: this.env.githubOwner,
				repo: this.env.githubTestRepo,
				name,
				head_sha: headSha,
				status,
				conclusion,
				output: {
					title: "E2E Test Check Run",
					summary: `This is an E2E test check run created at ${new Date().toISOString()}`,
				},
			});

			const checkRun = {
				id: response.data.id,
				name: response.data.name,
				status: response.data.status,
				conclusion: response.data.conclusion,
			};

			this.tracker.track(
				"github-check-run",
				String(checkRun.id),
				`Check Run: ${name}`,
				{
					name: checkRun.name,
					status: checkRun.status,
					conclusion: checkRun.conclusion,
					headSha,
				},
			);

			this.tracker.recordAPICall({
				provider: "github",
				method: "checks.create",
				request: { name, head_sha: headSha, status, conclusion },
				response: checkRun,
				durationMs: Date.now() - startTime,
			});

			return checkRun;
		} catch (error) {
			this.tracker.recordAPICall({
				provider: "github",
				method: "checks.create",
				request: { name, head_sha: headSha, status, conclusion },
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * List check runs for a reference
	 */
	async listCheckRunsForRef(
		ref: string,
	): Promise<ReturnType<GitHubClient["listCheckRunsForRef"]>> {
		const startTime = Date.now();

		try {
			const checkRuns = await this.client.listCheckRunsForRef(ref);

			this.tracker.recordAPICall({
				provider: "github",
				method: "checks.listForRef",
				request: { ref },
				response: { count: checkRuns.length },
				durationMs: Date.now() - startTime,
			});

			return checkRuns;
		} catch (error) {
			this.tracker.recordAPICall({
				provider: "github",
				method: "checks.listForRef",
				request: { ref },
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * Get a pull request
	 */
	async getPullRequest(
		number: number,
	): Promise<ReturnType<GitHubClient["getPullRequest"]>> {
		const startTime = Date.now();

		try {
			const pr = await this.client.getPullRequest(number);

			this.tracker.recordAPICall({
				provider: "github",
				method: "pulls.get",
				request: { pull_number: number },
				response: { number: pr.number, title: pr.title },
				durationMs: Date.now() - startTime,
			});

			return pr;
		} catch (error) {
			this.tracker.recordAPICall({
				provider: "github",
				method: "pulls.get",
				request: { pull_number: number },
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * List PR reviews
	 */
	async listPullRequestReviews(
		number: number,
	): Promise<ReturnType<GitHubClient["listPullRequestReviews"]>> {
		const startTime = Date.now();

		try {
			const reviews = await this.client.listPullRequestReviews(number);

			this.tracker.recordAPICall({
				provider: "github",
				method: "pulls.listReviews",
				request: { pull_number: number },
				response: { count: reviews.length },
				durationMs: Date.now() - startTime,
			});

			return reviews;
		} catch (error) {
			this.tracker.recordAPICall({
				provider: "github",
				method: "pulls.listReviews",
				request: { pull_number: number },
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * List PR review threads
	 */
	async listPullRequestReviewThreads(
		number: number,
	): Promise<ReturnType<GitHubClient["listPullRequestReviewThreads"]>> {
		const startTime = Date.now();

		try {
			const threads = await this.client.listPullRequestReviewThreads(number);

			this.tracker.recordAPICall({
				provider: "github",
				method: "pulls.listReviewThreads (GraphQL)",
				request: { number },
				response: { count: threads.length },
				durationMs: Date.now() - startTime,
			});

			return threads;
		} catch (error) {
			this.tracker.recordAPICall({
				provider: "github",
				method: "pulls.listReviewThreads (GraphQL)",
				request: { number },
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * Resolve a review thread
	 */
	async resolvePullRequestReviewThread(threadId: string): Promise<void> {
		const startTime = Date.now();

		try {
			await this.client.resolvePullRequestReviewThread(threadId);

			this.tracker.recordAPICall({
				provider: "github",
				method: "resolveReviewThread (GraphQL)",
				request: { threadId },
				durationMs: Date.now() - startTime,
			});
		} catch (error) {
			this.tracker.recordAPICall({
				provider: "github",
				method: "resolveReviewThread (GraphQL)",
				request: { threadId },
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * List rulesets
	 */
	async listRulesets(): Promise<ReturnType<GitHubClient["listRulesets"]>> {
		const startTime = Date.now();

		try {
			const rulesets = await this.client.listRulesets();

			this.tracker.recordAPICall({
				provider: "github",
				method: "repos.listRulesets",
				response: { count: rulesets.length },
				durationMs: Date.now() - startTime,
			});

			return rulesets;
		} catch (error) {
			this.tracker.recordAPICall({
				provider: "github",
				method: "repos.listRulesets",
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * Create a ruleset
	 */
	async createRuleset(
		payload: Parameters<GitHubClient["createRuleset"]>[0],
	): Promise<ReturnType<GitHubClient["createRuleset"]>> {
		const startTime = Date.now();

		try {
			const ruleset = await this.client.createRuleset(payload);

			this.tracker.track(
				"github-ruleset",
				String(ruleset.id),
				`Ruleset: ${ruleset.name}`,
				{
					name: ruleset.name,
					target: ruleset.target,
					enforcement: ruleset.enforcement,
					cleanupFunction: async () => {
						await this.deleteRuleset(ruleset.id);
					},
				},
			);

			this.tracker.recordAPICall({
				provider: "github",
				method: "repos.createRuleset",
				request: { name: payload.name, target: payload.target },
				response: { id: ruleset.id, name: ruleset.name },
				durationMs: Date.now() - startTime,
			});

			return ruleset;
		} catch (error) {
			this.tracker.recordAPICall({
				provider: "github",
				method: "repos.createRuleset",
				request: { name: payload.name, target: payload.target },
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * Delete a ruleset
	 */
	async deleteRuleset(rulesetId: number): Promise<void> {
		const startTime = Date.now();

		try {
			const octokit = (
				this.client as unknown as {
					octokit: {
						request: (route: string, params: unknown) => Promise<unknown>;
					};
				}
			).octokit;

			if (octokit?.request) {
				await octokit.request(
					"DELETE /repos/{owner}/{repo}/rulesets/{ruleset_id}",
					{
						owner: this.env.githubOwner,
						repo: this.env.githubTestRepo,
						ruleset_id: rulesetId,
					},
				);
			}

			this.tracker.recordAPICall({
				provider: "github",
				method: "repos.deleteRuleset",
				request: { ruleset_id: rulesetId },
				durationMs: Date.now() - startTime,
			});
		} catch (error) {
			this.tracker.recordAPICall({
				provider: "github",
				method: "repos.deleteRuleset",
				request: { ruleset_id: rulesetId },
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
}
