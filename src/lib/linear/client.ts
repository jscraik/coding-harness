const LINEAR_API_URL = "https://api.linear.app/graphql";

/** Error raised when a Linear GraphQL request fails or returns an unusable payload. */
export class LinearAPIError extends Error {
	/** Stable Linear or harness-side error code. */
	readonly code: string;

	constructor(code: string, message: string) {
		super(message);
		this.name = "LinearAPIError";
		this.code = code;
	}
}

/** Options used to construct a Linear API client. */
export interface LinearClientOptions {
	/** Linear API token used for GraphQL requests. */
	token: string;
	/** Optional per-request timeout in milliseconds for bounded live refreshes. */
	timeoutMs?: number;
}

/** Minimal Linear team identity returned by issue and team queries. */
export interface LinearTeamSummary {
	/** Linear team id. */
	id: string;
	/** Linear team key such as JSC. */
	key: string;
	/** Human-readable team name. */
	name: string;
}

/** Minimal Linear issue summary used by read-only command flows. */
export interface LinearIssueSummary {
	/** Linear issue id. */
	id: string;
	/** Linear issue identifier such as JSC-311. */
	identifier: string;
	/** Issue title. */
	title: string;
	/** Browser URL for the issue. */
	url: string;
	/** Branch name suggested by Linear, when present. */
	branchName?: string | null;
	/** Owning Linear team. */
	team: LinearTeamSummary;
	/** Current workflow state. */
	state: {
		/** Workflow-state id. */
		id: string;
		/** Human-readable workflow-state name. */
		name: string;
		/** Linear workflow-state type. */
		type: string;
	};
}

/** Linear issue label summary. */
export interface LinearIssueLabelSummary {
	/** Label id. */
	id: string;
	/** Label name. */
	name: string;
}

/** Linear cycle summary attached to an issue. */
export interface LinearCycleSummary {
	/** Cycle id. */
	id: string;
	/** Cycle name, when present. */
	name?: string | null;
	/** Cycle number, when present. */
	number?: number | null;
	/** ISO start time, when present. */
	startsAt?: string | null;
	/** ISO end time, when present. */
	endsAt?: string | null;
}

/** Linear project summary attached to an issue. */
export interface LinearProjectSummary {
	/** Project id. */
	id: string;
	/** Project name. */
	name: string;
	/** Project slug id, when present. */
	slugId?: string | null;
}

/** Linear issue with optional planning metadata used by team issue exports. */
export interface LinearTeamIssue extends LinearIssueSummary {
	/** Issue description markdown, when present. */
	description?: string | null;
	/** Linear priority value, when set. */
	priority?: number | null;
	/** Linear estimate value, when set. */
	estimate?: number | null;
	/** Issue labels. */
	labels: LinearIssueLabelSummary[];
	/** Assigned cycle, when present. */
	cycle?: LinearCycleSummary | null;
	/** Assigned project, when present. */
	project?: LinearProjectSummary | null;
}

/** Input for creating a Linear issue. */
export interface LinearCreateIssueInput {
	/** Team id where the issue should be created. */
	teamId: string;
	/** Issue title. */
	title: string;
	/** Optional issue description markdown. */
	description?: string;
	/** Optional label ids to attach. */
	labelIds?: string[];
	/** Optional Linear priority value. */
	priority?: number;
}

/** Summary returned after creating a Linear issue. */
export interface LinearCreatedIssueSummary {
	/** Created issue id. */
	id: string;
	/** Created issue identifier. */
	identifier: string;
	/** Created issue title. */
	title: string;
	/** Browser URL for the created issue. */
	url: string;
}

/** Linear label summary returned by label queries. */
export interface LinearLabelSummary {
	/** Label id. */
	id: string;
	/** Label name. */
	name: string;
	/** Owning team, when Linear returns one. */
	team?: LinearTeamSummary | null;
}

/** Input for creating a Linear label. */
export interface LinearCreateLabelInput {
	/** Label name. */
	name: string;
	/** Optional team id to scope the label. */
	teamId?: string;
	/** Optional hex color. */
	color?: string;
	/** Optional label description. */
	description?: string;
}

/** Linear workflow-state summary. */
export interface LinearWorkflowState {
	/** Workflow-state id. */
	id: string;
	/** Workflow-state name. */
	name: string;
	/** Workflow-state type. */
	type: string;
	/** Owning team. */
	team: LinearTeamSummary;
}

/** Authenticated Linear viewer identity. */
export interface LinearViewer {
	/** Viewer id. */
	id: string;
	/** Viewer name. */
	name: string;
	/** Viewer email. */
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

/** Minimal Linear GraphQL client used by harness commands. */
export class LinearClient {
	private readonly token: string;
	private readonly timeoutMs: number | undefined;

	constructor(options: LinearClientOptions) {
		this.token = options.token;
		this.timeoutMs = options.timeoutMs;
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
			...(this.timeoutMs !== undefined
				? { signal: AbortSignal.timeout(this.timeoutMs) }
				: {}),
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
