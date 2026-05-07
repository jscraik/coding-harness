import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import { Octokit } from "@octokit/rest";
import { GitHubApiError } from "./errors.js";
import { mutationQueue } from "./mutation-queue.js";

const MyOctokit = Octokit.plugin(throttling, retry);
const TRANSIENT_RETRY_DELAYS_MS = [250, 1000] as const;

/** Options used to bind the GitHub client to one repository. */
export interface GitHubClientOptions {
	token: string;
	owner: string;
	repo: string;
}

/** Normalized GitHub check-run data consumed by harness gates. */
export interface CheckRun {
	id: number;
	name: string;
	status: "completed" | "in_progress" | "queued" | "pending";
	conclusion: string | null;
	head_sha: string;
	app?: {
		id?: number;
		slug?: string;
		name?: string;
	};
}

/** Normalized GitHub issue or pull request comment data. */
export interface Comment {
	id: number;
	body: string;
	created_at: string;
	html_url: string;
	user: {
		login: string;
	};
}

/** Pull request fields required by harness review and workflow commands. */
export interface PullRequest {
	number: number;
	title?: string;
	body?: string | null;
	user?: {
		login: string;
	};
	base?: {
		ref: string;
	};
	head: {
		sha: string;
		ref: string;
	};
}

/** File entry returned for a pull request diff. */
export interface PullRequestFile {
	filename: string;
	status?: string;
}

/** Pull request review metadata used to evaluate review readiness. */
export interface PullRequestReview {
	id: number;
	state: string;
	commit_id?: string | null;
	submitted_at?: string | null;
	user?: {
		login?: string;
	};
}

/** Commit metadata for a pull request head history entry. */
export interface PullRequestCommit {
	sha: string;
	author?: {
		login?: string;
	} | null;
	committer?: {
		login?: string;
	} | null;
}

/** Minimal review-thread comment author data needed for independence checks. */
export interface PullRequestReviewThreadComment {
	author?: {
		login?: string;
	} | null;
}

/** Pull request review thread state returned by the GraphQL API. */
export interface PullRequestReviewThread {
	id: string;
	isResolved: boolean;
	comments: PullRequestReviewThreadComment[];
}

/** GitHub repository ruleset rule record. */
export interface RulesetRule {
	type: string;
	parameters?: Record<string, unknown>;
}

/** GitHub ruleset bypass actor record. */
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

/** Branch matching conditions for GitHub repository rulesets. */
export interface BranchRulesetConditions {
	ref_name?: {
		include?: string[];
		exclude?: string[];
	};
}

/** Summary record returned when listing repository rulesets. */
export interface RulesetSummary {
	id: number;
	name: string;
	target: string;
	enforcement: string;
	conditions?: BranchRulesetConditions;
}

/** Full GitHub repository ruleset used for branch-protection reconciliation. */
export interface Ruleset {
	id: number;
	name: string;
	target: string;
	enforcement: string;
	bypass_actors: RulesetBypassActor[];
	conditions: BranchRulesetConditions;
	rules: RulesetRule[];
}

/** Payload accepted when creating or updating a branch ruleset. */
export interface RulesetPayload {
	name: string;
	target: "branch";
	enforcement: "active" | "disabled" | "evaluate";
	bypass_actors: RulesetBypassActor[];
	conditions: BranchRulesetConditions;
	rules: RulesetRule[];
}

/** Repository merge strategy flags managed by harness governance commands. */
export interface RepositoryMergeSettings {
	allowMergeCommit: boolean;
	allowSquashMerge: boolean;
	allowRebaseMerge: boolean;
}

/**
 * Pause execution for the specified number of milliseconds.
 *
 * @param ms - Number of milliseconds to wait.
 * @returns A promise that resolves when the delay has completed.
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determines whether an error represents a transient GitHub server error (HTTP status 500 or greater).
 *
 * @param error - The error to classify
 * @returns `true` if `error` is a `GitHubApiError` with `status` >= 500, `false` otherwise
 */
function isTransientGitHubError(error: Error): boolean {
	return error instanceof GitHubApiError && error.status >= 500;
}

/**
 * Create an Octokit client configured for the repository with throttling behavior.
 * Octokit's retry plugin remains active for general API calls; listCheckRunsForRef adds a small explicit retry loop for its check-run polling path.
 *
 * @param token - The authentication token used by Octokit for API requests
 * @returns An Octokit instance configured to use the provided token and built-in throttling handlers
 */
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

/** Repository-scoped GitHub API adapter used by harness workflow commands. */
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
		for (
			let attempt = 0;
			attempt <= TRANSIENT_RETRY_DELAYS_MS.length;
			attempt++
		) {
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
				return response.map((item) => ({
					id: item.id,
					name: item.name,
					status: item.status as CheckRun["status"],
					conclusion: item.conclusion,
					head_sha: typeof item.head_sha === "string" ? item.head_sha : "",
					...(item.app
						? {
								app: {
									...(typeof item.app.id === "number"
										? { id: item.app.id }
										: {}),
									...(typeof item.app.slug === "string"
										? { slug: item.app.slug }
										: {}),
									...(typeof item.app.name === "string"
										? { name: item.app.name }
										: {}),
								},
							}
						: {}),
				}));
			} catch (error) {
				const classifiedError = this.classifyError(error);
				const retryDelay = TRANSIENT_RETRY_DELAYS_MS[attempt];
				if (
					retryDelay !== undefined &&
					isTransientGitHubError(classifiedError)
				) {
					await sleep(retryDelay);
					continue;
				}
				throw classifiedError;
			}
		}

		throw new GitHubApiError({
			code: "SYSTEM_ERROR",
			status: 0,
			message: "GitHub check run listing failed after retries",
		});
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

	async listPullRequestCommits(
		pullNumber: number,
	): Promise<PullRequestCommit[]> {
		try {
			const response = await this.octokit.paginate(
				this.octokit.pulls.listCommits,
				{
					owner: this.owner,
					repo: this.repo,
					pull_number: pullNumber,
					per_page: 100,
				},
			);
			return response as PullRequestCommit[];
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
