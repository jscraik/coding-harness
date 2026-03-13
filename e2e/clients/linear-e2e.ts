/**
 * Linear E2E Client
 *
 * Extended Linear client with E2E testing utilities.
 * Wraps the production LinearClient with resource tracking and test helpers.
 */

import { LinearClient } from "../../src/lib/linear/client.js";
import type { E2EEnv } from "../utils/env.js";
import type { ResourceTracker } from "../utils/resource-tracker.js";

export interface LinearE2EOptions {
	env: E2EEnv;
	tracker: ResourceTracker;
}

export interface TestLinearIssue {
	id: string;
	identifier: string;
	title: string;
	url: string;
	stateId: string;
	stateName: string;
}

export interface TestLinearComment {
	id: string;
	body: string;
	issueId: string;
}

export interface TestLinearAttachment {
	id: string;
	title: string;
	url: string;
	issueId: string;
}

export class LinearE2EClient {
	private client: LinearClient;
	private tracker: ResourceTracker;
	private env: E2EEnv;

	constructor(options: LinearE2EOptions) {
		this.env = options.env;
		this.tracker = options.tracker;
		this.client = new LinearClient({
			token: options.env.linearToken,
		});
	}

	/**
	 * Get the underlying Linear client for direct API access
	 */
	getClient(): LinearClient {
		return this.client;
	}

	/**
	 * Search for issues matching a term
	 */
	async searchIssues(
		term: string,
	): Promise<ReturnType<LinearClient["searchIssues"]>> {
		const startTime = Date.now();

		try {
			const issues = await this.client.searchIssues(term);

			this.tracker.recordAPICall({
				provider: "linear",
				method: "searchIssues",
				request: { term },
				response: { count: issues.length },
				durationMs: Date.now() - startTime,
			});

			return issues;
		} catch (error) {
			this.tracker.recordAPICall({
				provider: "linear",
				method: "searchIssues",
				request: { term },
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * List all workflow states
	 */
	async listWorkflowStates(): Promise<
		ReturnType<LinearClient["listWorkflowStates"]>
	> {
		const startTime = Date.now();

		try {
			const states = await this.client.listWorkflowStates();

			this.tracker.recordAPICall({
				provider: "linear",
				method: "workflowStates",
				response: { count: states.length },
				durationMs: Date.now() - startTime,
			});

			return states;
		} catch (error) {
			this.tracker.recordAPICall({
				provider: "linear",
				method: "workflowStates",
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * Get the current viewer (authenticated user)
	 */
	async getViewer(): Promise<ReturnType<LinearClient["getViewer"]>> {
		const startTime = Date.now();

		try {
			const viewer = await this.client.getViewer();

			this.tracker.recordAPICall({
				provider: "linear",
				method: "viewer",
				response: { id: viewer.id, name: viewer.name, email: viewer.email },
				durationMs: Date.now() - startTime,
			});

			return viewer;
		} catch (error) {
			this.tracker.recordAPICall({
				provider: "linear",
				method: "viewer",
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * Update an issue
	 */
	async updateIssue(
		issueId: string,
		input: Record<string, unknown>,
	): Promise<void> {
		const startTime = Date.now();

		try {
			await this.client.updateIssue(issueId, input);

			this.tracker.recordAPICall({
				provider: "linear",
				method: "issueUpdate",
				request: { id: issueId, input },
				durationMs: Date.now() - startTime,
			});
		} catch (error) {
			this.tracker.recordAPICall({
				provider: "linear",
				method: "issueUpdate",
				request: { id: issueId, input },
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * Create a comment on an issue
	 */
	async createComment(issueId: string, body: string): Promise<void> {
		const startTime = Date.now();

		try {
			await this.client.createComment(issueId, body);

			this.tracker.track(
				"linear-comment",
				`${issueId}_${Date.now()}`,
				`Comment on ${issueId}`,
				{
					issueId,
					body: body.substring(0, 100),
				},
			);

			this.tracker.recordAPICall({
				provider: "linear",
				method: "commentCreate",
				request: { issueId, body: body.substring(0, 100) },
				durationMs: Date.now() - startTime,
			});
		} catch (error) {
			this.tracker.recordAPICall({
				provider: "linear",
				method: "commentCreate",
				request: { issueId },
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * Create an attachment on an issue
	 */
	async createAttachment(input: {
		issueId: string;
		title: string;
		url: string;
		commentBody?: string;
	}): Promise<void> {
		const startTime = Date.now();

		try {
			await this.client.createAttachment(input);

			this.tracker.track(
				"linear-attachment",
				`${input.issueId}_${Date.now()}`,
				`Attachment: ${input.title}`,
				{
					issueId: input.issueId,
					title: input.title,
					url: input.url,
				},
			);

			this.tracker.recordAPICall({
				provider: "linear",
				method: "attachmentCreate",
				request: { issueId: input.issueId, title: input.title },
				durationMs: Date.now() - startTime,
			});
		} catch (error) {
			this.tracker.recordAPICall({
				provider: "linear",
				method: "attachmentCreate",
				request: { issueId: input.issueId },
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * Create an issue using GraphQL directly with more control
	 */
	async createIssue(params: {
		title: string;
		description?: string;
		teamId: string;
		stateId?: string;
		labelIds?: string[];
		assigneeId?: string;
		parentId?: string;
	}): Promise<TestLinearIssue> {
		const startTime = Date.now();

		try {
			// Use direct GraphQL call for issue creation
			const query = `
				mutation IssueCreate($input: IssueCreateInput!) {
					issueCreate(input: $input) {
						success
						issue {
							id
							identifier
							title
							url
							state {
								id
								name
							}
						}
					}
				}
			`;

			const variables = {
				input: {
					title: params.title,
					description: params.description,
					teamId: params.teamId,
					stateId: params.stateId,
					labelIds: params.labelIds,
					assigneeId: params.assigneeId,
					parentId: params.parentId,
				},
			};

			// Access the underlying client method via type assertion
			const graphql = (
				this.client as unknown as {
					graphql: <T>(
						query: string,
						variables?: Record<string, unknown>,
					) => Promise<T>;
				}
			).graphql;

			const result = await graphql<{
				issueCreate: {
					success: boolean;
					issue: {
						id: string;
						identifier: string;
						title: string;
						url: string;
						state: { id: string; name: string };
					};
				};
			}>(query, variables);

			if (!result.issueCreate.success) {
				throw new Error("Failed to create issue");
			}

			const issue = result.issueCreate.issue;

			const testIssue: TestLinearIssue = {
				id: issue.id,
				identifier: issue.identifier,
				title: issue.title,
				url: issue.url,
				stateId: issue.state.id,
				stateName: issue.state.name,
			};

			// Track for cleanup
			this.tracker.track(
				"linear-issue",
				testIssue.id,
				`Issue ${testIssue.identifier}: ${testIssue.title}`,
				{
					identifier: testIssue.identifier,
					url: testIssue.url,
					stateName: testIssue.stateName,
					cleanupFunction: async () => {
						await this.archiveIssue(testIssue.id);
					},
				},
			);

			this.tracker.recordAPICall({
				provider: "linear",
				method: "issueCreate",
				request: { title: params.title, teamId: params.teamId },
				response: { id: testIssue.id, identifier: testIssue.identifier },
				durationMs: Date.now() - startTime,
			});

			return testIssue;
		} catch (error) {
			this.tracker.recordAPICall({
				provider: "linear",
				method: "issueCreate",
				request: { title: params.title, teamId: params.teamId },
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * Archive (soft delete) an issue
	 */
	async archiveIssue(issueId: string): Promise<void> {
		const startTime = Date.now();

		try {
			const query = `
				mutation IssueArchive($id: String!) {
					issueArchive(id: $id) {
						success
					}
				}
			`;

			const graphql = (
				this.client as unknown as {
					graphql: <T>(
						query: string,
						variables?: Record<string, unknown>,
					) => Promise<T>;
				}
			).graphql;

			await graphql<{ issueArchive: { success: boolean } }>(query, {
				id: issueId,
			});

			this.tracker.recordAPICall({
				provider: "linear",
				method: "issueArchive",
				request: { id: issueId },
				durationMs: Date.now() - startTime,
			});
		} catch (error) {
			this.tracker.recordAPICall({
				provider: "linear",
				method: "issueArchive",
				request: { id: issueId },
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Transition an issue to a different state
	 */
	async transitionIssue(issueId: string, stateId: string): Promise<void> {
		const startTime = Date.now();

		try {
			await this.client.updateIssue(issueId, { stateId });

			this.tracker.recordAPICall({
				provider: "linear",
				method: "issueUpdate (transition)",
				request: { id: issueId, stateId },
				durationMs: Date.now() - startTime,
			});
		} catch (error) {
			this.tracker.recordAPICall({
				provider: "linear",
				method: "issueUpdate (transition)",
				request: { id: issueId, stateId },
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}
}
