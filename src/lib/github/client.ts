import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import { Octokit } from "@octokit/rest";
import { GitHubApiError } from "./errors.js";
import { mutationQueue } from "./mutation-queue.js";

const MyOctokit = Octokit.plugin(throttling, retry);

export interface GitHubClientOptions {
	token: string;
	owner: string;
	repo: string;
}

export interface CheckRun {
	id: number;
	name: string;
	status: "completed" | "in_progress" | "queued" | "pending";
	conclusion: string | null;
	head_sha: string;
}

export interface Comment {
	id: number;
	body: string;
	created_at: string;
	html_url: string;
	user: {
		login: string;
	};
}

export interface PullRequest {
	number: number;
	title?: string;
	body?: string | null;
	user?: {
		login: string;
	};
	head: {
		sha: string;
		ref: string;
	};
}

export interface PullRequestFile {
	filename: string;
	status?: string;
}

export interface PullRequestReview {
	id: number;
	state: string;
	commit_id?: string | null;
	submitted_at?: string | null;
	user?: {
		login?: string;
	};
}

export interface PullRequestReviewThreadComment {
	author?: {
		login?: string;
	} | null;
}

export interface PullRequestReviewThread {
	id: string;
	isResolved: boolean;
	comments: PullRequestReviewThreadComment[];
}

export interface RulesetRule {
	type: string;
	parameters?: Record<string, unknown>;
}

export interface RulesetBypassActor {
	actor_id?: number | null;
	actor_type:
		| "Integration"
		| "OrganizationAdmin"
		| "RepositoryRole"
		| "Team"
		| "DeployKey";
	bypass_mode?: "pull_request" | "always";
}

export interface BranchRulesetConditions {
	ref_name?: {
		include?: string[];
		exclude?: string[];
	};
}

export interface RulesetSummary {
	id: number;
	name: string;
	target: string;
	enforcement: string;
	conditions?: BranchRulesetConditions;
}

export interface Ruleset {
	id: number;
	name: string;
	target: string;
	enforcement: string;
	bypass_actors: RulesetBypassActor[];
	conditions: BranchRulesetConditions;
	rules: RulesetRule[];
}

export interface RulesetPayload {
	name: string;
	target: "branch";
	enforcement: "active" | "disabled" | "evaluate";
	bypass_actors: RulesetBypassActor[];
	conditions: BranchRulesetConditions;
	rules: RulesetRule[];
}

export interface RepositoryMergeSettings {
	allowMergeCommit: boolean;
	allowSquashMerge: boolean;
	allowRebaseMerge: boolean;
}

function createOctokit(token: string): InstanceType<typeof MyOctokit> {
	return new MyOctokit({
		auth: token,
		throttle: {
			onRateLimit: (
				retryAfter: number,
				options: { method?: string; url?: string },
				octokit: {
					log: {
						warn: (message: string) => void;
						info: (message: string) => void;
					};
				},
				retryCount: number,
			) => {
				octokit.log.warn(`Rate limit hit for ${options.method} ${options.url}`);
				if (retryCount < 3) {
					octokit.log.info(`Retrying after ${retryAfter} seconds`);
					return true;
				}
				return false;
			},
			onSecondaryRateLimit: (
				_retryAfter: number,
				options: { method?: string; url?: string },
				octokit: { log: { warn: (message: string) => void } },
			) => {
				octokit.log.warn(
					`Secondary rate limit for ${options.method} ${options.url}`,
				);
				return false;
			},
		},
	});
}

export class GitHubClient {
	private octokit: InstanceType<typeof MyOctokit>;
	private owner: string;
	private repo: string;

	constructor(options: GitHubClientOptions) {
		this.octokit = createOctokit(options.token);
		this.owner = options.owner;
		this.repo = options.repo;
	}

	getRepositoryIdentifier(): string {
		return `${this.owner}/${this.repo}`;
	}

	async listCheckRunsForRef(ref: string): Promise<CheckRun[]> {
		try {
			const response = await this.octokit.paginate(
				this.octokit.checks.listForRef,
				{
					owner: this.owner,
					repo: this.repo,
					ref,
					per_page: 100,
				},
			);
			return response as CheckRun[];
		} catch (error) {
			throw this.classifyError(error);
		}
	}

	async createIssueComment(
		issueNumber: number,
		body: string,
	): Promise<Comment> {
		try {
			const response = await mutationQueue.execute(() =>
				this.octokit.issues.createComment({
					owner: this.owner,
					repo: this.repo,
					issue_number: issueNumber,
					body,
				}),
			);
			return response.data as Comment;
		} catch (error) {
			throw this.classifyError(error);
		}
	}

	async getPullRequest(number: number): Promise<PullRequest> {
		try {
			const response = await this.octokit.pulls.get({
				owner: this.owner,
				repo: this.repo,
				pull_number: number,
			});
			return response.data as PullRequest;
		} catch (error) {
			throw this.classifyError(error);
		}
	}

	async listPullRequestReviews(
		pullNumber: number,
	): Promise<PullRequestReview[]> {
		try {
			const response = await this.octokit.paginate(
				this.octokit.pulls.listReviews,
				{
					owner: this.owner,
					repo: this.repo,
					pull_number: pullNumber,
					per_page: 100,
				},
			);
			return response as PullRequestReview[];
		} catch (error) {
			throw this.classifyError(error);
		}
	}

	async listPullRequestFiles(pullNumber: number): Promise<PullRequestFile[]> {
		try {
			const response = await this.octokit.paginate(
				this.octokit.pulls.listFiles,
				{
					owner: this.owner,
					repo: this.repo,
					pull_number: pullNumber,
					per_page: 100,
				},
			);
			return response as PullRequestFile[];
		} catch (error) {
			throw this.classifyError(error);
		}
	}

	async listPullRequestReviewThreads(
		pullNumber: number,
	): Promise<PullRequestReviewThread[]> {
		try {
			const threads: PullRequestReviewThread[] = [];
			let cursor: string | null = null;

			do {
				const response = (await this.octokit.graphql(
					`query($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewThreads(first: 100, after: $cursor) {
        nodes {
          id
          isResolved
          comments(first: 100) {
            nodes {
              author {
                login
              }
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
}`,
					{
						owner: this.owner,
						repo: this.repo,
						number: pullNumber,
						cursor,
					},
				)) as {
					repository?: {
						pullRequest?: {
							reviewThreads?: {
								nodes?: Array<{
									id?: string | null;
									isResolved?: boolean | null;
									comments?: {
										nodes?: Array<PullRequestReviewThreadComment | null>;
									} | null;
								} | null>;
								pageInfo?: {
									hasNextPage?: boolean | null;
									endCursor?: string | null;
								} | null;
							} | null;
						} | null;
					} | null;
				};

				const reviewThreads = response.repository?.pullRequest?.reviewThreads;
				const nodes = reviewThreads?.nodes ?? [];
				for (const node of nodes) {
					if (!node?.id) {
						continue;
					}

					threads.push({
						id: node.id,
						isResolved: node.isResolved ?? false,
						comments: (node.comments?.nodes ?? []).filter(
							(comment): comment is PullRequestReviewThreadComment =>
								comment !== null,
						),
					});
				}

				if (!reviewThreads?.pageInfo?.hasNextPage) {
					break;
				}
				cursor = reviewThreads.pageInfo.endCursor ?? null;
			} while (cursor !== null);

			return threads;
		} catch (error) {
			throw this.classifyError(error);
		}
	}

	async resolvePullRequestReviewThread(threadId: string): Promise<void> {
		try {
			await mutationQueue.execute(() =>
				this.octokit.graphql(
					`mutation($threadId: ID!) {
  resolveReviewThread(input: { threadId: $threadId }) {
    thread {
      id
      isResolved
    }
  }
}`,
					{ threadId },
				),
			);
		} catch (error) {
			throw this.classifyError(error);
		}
	}

	async getDefaultBranch(): Promise<string> {
		try {
			const response = await this.octokit.repos.get({
				owner: this.owner,
				repo: this.repo,
			});
			return response.data.default_branch;
		} catch (error) {
			throw this.classifyError(error);
		}
	}

	async getRepositoryVisibility(): Promise<string> {
		try {
			const response = await this.octokit.repos.get({
				owner: this.owner,
				repo: this.repo,
			});
			const visibility = response.data.visibility;
			if (typeof visibility === "string" && visibility.trim().length > 0) {
				return visibility;
			}
			return response.data.private ? "private" : "public";
		} catch (error) {
			throw this.classifyError(error);
		}
	}

	async listIssueComments(issueNumber: number): Promise<Comment[]> {
		try {
			const response = await this.octokit.paginate(
				this.octokit.issues.listComments,
				{
					owner: this.owner,
					repo: this.repo,
					issue_number: issueNumber,
					per_page: 100,
				},
			);
			return response as Comment[];
		} catch (error) {
			throw this.classifyError(error);
		}
	}

	async listRulesets(): Promise<RulesetSummary[]> {
		try {
			const response = await this.octokit.paginate(
				"GET /repos/{owner}/{repo}/rulesets",
				{
					owner: this.owner,
					repo: this.repo,
					per_page: 100,
				},
			);
			return response as RulesetSummary[];
		} catch (error) {
			throw this.classifyError(error);
		}
	}

	async getRuleset(rulesetId: number): Promise<Ruleset> {
		try {
			const response = await this.octokit.request(
				"GET /repos/{owner}/{repo}/rulesets/{ruleset_id}",
				{
					owner: this.owner,
					repo: this.repo,
					ruleset_id: rulesetId,
				},
			);
			return response.data as Ruleset;
		} catch (error) {
			throw this.classifyError(error);
		}
	}

	async createRuleset(payload: RulesetPayload): Promise<Ruleset> {
		try {
			const response = await mutationQueue.execute(() =>
				this.octokit.request("POST /repos/{owner}/{repo}/rulesets", {
					owner: this.owner,
					repo: this.repo,
					...payload,
				} as never),
			);
			return response.data as Ruleset;
		} catch (error) {
			throw this.classifyError(error);
		}
	}

	async updateRuleset(
		rulesetId: number,
		payload: RulesetPayload,
	): Promise<Ruleset> {
		try {
			const response = await mutationQueue.execute(() =>
				this.octokit.request(
					"PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}",
					{
						owner: this.owner,
						repo: this.repo,
						ruleset_id: rulesetId,
						...payload,
					} as never,
				),
			);
			return response.data as Ruleset;
		} catch (error) {
			throw this.classifyError(error);
		}
	}

	async updateRepositoryMergeSettings(
		settings: RepositoryMergeSettings,
	): Promise<void> {
		try {
			await mutationQueue.execute(() =>
				this.octokit.repos.update({
					owner: this.owner,
					repo: this.repo,
					allow_merge_commit: settings.allowMergeCommit,
					allow_squash_merge: settings.allowSquashMerge,
					allow_rebase_merge: settings.allowRebaseMerge,
				}),
			);
		} catch (error) {
			throw this.classifyError(error);
		}
	}

	private classifyError(error: unknown): Error {
		return GitHubApiError.fromError(error);
	}
}
