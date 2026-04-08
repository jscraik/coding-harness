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

export interface LinearIssueLabelSummary {
	id: string;
	name: string;
}

export interface LinearCycleSummary {
	id: string;
	name?: string | null;
	number?: number | null;
	startsAt?: string | null;
	endsAt?: string | null;
}

export interface LinearProjectSummary {
	id: string;
	name: string;
	slugId?: string | null;
}

export interface LinearTeamIssue extends LinearIssueSummary {
	description?: string | null;
	priority?: number | null;
	estimate?: number | null;
	labels: LinearIssueLabelSummary[];
	cycle?: LinearCycleSummary | null;
	project?: LinearProjectSummary | null;
}

export interface LinearCreateIssueInput {
	teamId: string;
	title: string;
	description?: string;
	labelIds?: string[];
	priority?: number;
}

export interface LinearCreatedIssueSummary {
	id: string;
	identifier: string;
	title: string;
	url: string;
}

export interface LinearLabelSummary {
	id: string;
	name: string;
	team?: LinearTeamSummary | null;
}

export interface LinearCreateLabelInput {
	name: string;
	teamId?: string;
	color?: string;
	description?: string;
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

	async listTeamIssues(
		teamId: string,
		options: { first?: number } = {},
	): Promise<LinearTeamIssue[]> {
		const first = options.first ?? 250;
		const nodes: Array<
			Omit<LinearTeamIssue, "labels"> & {
				labels: { nodes: LinearIssueLabelSummary[] };
			}
		> = [];
		let cursor: string | undefined;

		for (;;) {
			const data = await this.graphql<{
				team: {
					issues: {
						nodes: Array<
							Omit<LinearTeamIssue, "labels"> & {
								labels: { nodes: LinearIssueLabelSummary[] };
							}
						>;
						pageInfo: {
							hasNextPage: boolean;
							endCursor?: string | null;
						};
					};
				} | null;
			}>(
				`
				query TeamIssues($teamId: String!, $first: Int!, $after: String) {
					team(id: $teamId) {
						issues(first: $first, after: $after) {
							nodes {
								id
								identifier
								title
								url
								branchName
								description
								priority
								estimate
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
								cycle {
									id
									name
									number
									startsAt
									endsAt
								}
								project {
									id
									name
									slugId
								}
								labels {
									nodes {
										id
										name
									}
								}
							}
							pageInfo {
								hasNextPage
								endCursor
							}
						}
					}
				}
			`,
				{ teamId, first, after: cursor },
			);

			if (!data.team) {
				throw new LinearAPIError(
					"NOT_FOUND",
					`Linear team ${teamId} was not found.`,
				);
			}

			nodes.push(...data.team.issues.nodes);
			const pageInfo = data.team.issues.pageInfo;
			if (!pageInfo?.hasNextPage) {
				break;
			}

			const nextCursor = pageInfo.endCursor ?? undefined;
			if (!nextCursor) {
				throw new LinearAPIError(
					"LINEAR_API_ERROR",
					"Linear API did not return a pagination cursor for team issues.",
				);
			}
			cursor = nextCursor;
		}

		return nodes.map((issue) => ({
			...issue,
			labels: issue.labels.nodes,
		}));
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

	async listTeams(): Promise<LinearTeamSummary[]> {
		const data = await this.graphql<{
			teams: { nodes: LinearTeamSummary[] };
		}>(`
			query Teams {
				teams {
					nodes {
						id
						key
						name
					}
				}
			}
		`);
		return data.teams.nodes;
	}

	async listLabels(teamId?: string): Promise<LinearLabelSummary[]> {
		const data = await this.graphql<{
			issueLabels: { nodes: LinearLabelSummary[] };
		}>(`
			query IssueLabels {
				issueLabels {
					nodes {
						id
						name
						team {
							id
							key
							name
						}
					}
				}
			}
		`);
		const all = data.issueLabels.nodes;
		return teamId ? all.filter((l) => !l.team || l.team.id === teamId) : all;
	}

	async createLabel(
		input: LinearCreateLabelInput,
	): Promise<LinearLabelSummary> {
		const data = await this.graphql<{
			issueLabelCreate: { issueLabel: LinearLabelSummary | null };
		}>(
			`
			mutation IssueLabelCreate($input: IssueLabelCreateInput!) {
				issueLabelCreate(input: $input) {
					issueLabel {
						id
						name
						team {
							id
							key
							name
						}
					}
				}
			}
		`,
			{ input },
		);

		if (!data.issueLabelCreate.issueLabel) {
			throw new LinearAPIError(
				"LINEAR_API_ERROR",
				"Linear API did not return the created label.",
			);
		}

		return data.issueLabelCreate.issueLabel;
	}

	async createIssue(
		input: LinearCreateIssueInput,
	): Promise<LinearCreatedIssueSummary> {
		const data = await this.graphql<{
			issueCreate: { issue: LinearCreatedIssueSummary };
		}>(
			`
			mutation IssueCreate($input: IssueCreateInput!) {
				issueCreate(input: $input) {
					issue {
						id
						identifier
						title
						url
					}
				}
			}
		`,
			{ input },
		);
		return data.issueCreate.issue;
	}
}
