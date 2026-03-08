const LINEAR_API_URL = "https://api.linear.app/graphql";

export class LinearAPIError extends Error {
	readonly code: string;

	constructor(code: string, message: string) {
		super(message);
		this.name = "LinearAPIError";
		this.code = code;
	}
}

export interface LinearClientOptions {
	token: string;
}

export interface LinearTeamSummary {
	id: string;
	key: string;
	name: string;
}

export interface LinearIssueSummary {
	id: string;
	identifier: string;
	title: string;
	url: string;
	branchName?: string | null;
	team: LinearTeamSummary;
	state: {
		id: string;
		name: string;
		type: string;
	};
}

export interface LinearWorkflowState {
	id: string;
	name: string;
	type: string;
	team: LinearTeamSummary;
}

export interface LinearViewer {
	id: string;
	name: string;
	email: string;
}

interface GraphQLResponse<T> {
	data?: T;
	errors?: Array<{
		message?: string;
		extensions?: {
			code?: string;
			userPresentableMessage?: string;
			userError?: boolean;
		};
	}>;
}

function parseErrorMessage(errors: GraphQLResponse<unknown>["errors"]): {
	code: string;
	message: string;
} {
	const first = errors?.[0];
	const code = first?.extensions?.code ?? "LINEAR_API_ERROR";
	const message =
		first?.extensions?.userPresentableMessage ??
		first?.message ??
		"Linear API request failed.";
	return { code, message };
}

export class LinearClient {
	private readonly token: string;

	constructor(options: LinearClientOptions) {
		this.token = options.token;
	}

	private async graphql<T>(
		query: string,
		variables?: Record<string, unknown>,
	): Promise<T> {
		const response = await fetch(LINEAR_API_URL, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: this.token,
			},
			body: JSON.stringify({ query, variables }),
		});

		let payload: GraphQLResponse<T>;
		try {
			payload = (await response.json()) as GraphQLResponse<T>;
		} catch {
			throw new LinearAPIError(
				"LINEAR_API_ERROR",
				`Linear API returned a non-JSON response (${response.status}).`,
			);
		}

		if (!response.ok || (payload.errors?.length ?? 0) > 0 || !payload.data) {
			const error = parseErrorMessage(payload.errors);
			throw new LinearAPIError(error.code, error.message);
		}

		return payload.data;
	}

	async getViewer(): Promise<LinearViewer> {
		const data = await this.graphql<{ viewer: LinearViewer }>(`
			query Viewer {
				viewer {
					id
					name
					email
				}
			}
		`);
		return data.viewer;
	}

	async searchIssues(term: string): Promise<LinearIssueSummary[]> {
		const data = await this.graphql<{
			searchIssues: { nodes: LinearIssueSummary[] };
		}>(
			`
			query SearchIssues($term: String!) {
				searchIssues(term: $term) {
					nodes {
						id
						identifier
						title
						url
						branchName
						team {
							id
							key
							name
						}
						state {
							id
							name
							type
						}
					}
				}
			}
		`,
			{ term },
		);
		return data.searchIssues.nodes;
	}

	async listWorkflowStates(): Promise<LinearWorkflowState[]> {
		const data = await this.graphql<{
			workflowStates: { nodes: LinearWorkflowState[] };
		}>(`
			query WorkflowStates {
				workflowStates {
					nodes {
						id
						name
						type
						team {
							id
							key
							name
						}
					}
				}
			}
		`);
		return data.workflowStates.nodes;
	}

	async updateIssue(
		issueId: string,
		input: Record<string, unknown>,
	): Promise<void> {
		await this.graphql<{ issueUpdate: { success: boolean } }>(
			`
			mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
				issueUpdate(id: $id, input: $input) {
					success
				}
			}
		`,
			{ id: issueId, input },
		);
	}

	async createComment(issueId: string, body: string): Promise<void> {
		await this.graphql<{ commentCreate: { success: boolean } }>(
			`
			mutation CommentCreate($input: CommentCreateInput!) {
				commentCreate(input: $input) {
					success
				}
			}
		`,
			{ input: { issueId, body } },
		);
	}

	async createAttachment(input: {
		issueId: string;
		title: string;
		url: string;
		commentBody?: string;
	}): Promise<void> {
		await this.graphql<{ attachmentCreate: { success: boolean } }>(
			`
			mutation AttachmentCreate($input: AttachmentCreateInput!) {
				attachmentCreate(input: $input) {
					success
				}
			}
		`,
			{ input },
		);
	}
}
