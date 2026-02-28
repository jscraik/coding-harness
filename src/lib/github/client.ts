import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import type { RequestError } from "@octokit/request-error";
import { Octokit } from "@octokit/rest";
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
	user: {
		login: string;
	};
}

export interface PullRequest {
	number: number;
	head: {
		sha: string;
		ref: string;
	};
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

	private classifyError(error: unknown): Error {
		if (error instanceof Error && error.name === "HttpError") {
			const requestError = error as RequestError;
			const status = requestError.status;

			if (status === 404) {
				const notFoundError = new Error("Resource not found");
				notFoundError.name = "NotFoundError";
				return notFoundError;
			}
			if (status === 403) {
				const forbiddenError = new Error("Permission denied");
				forbiddenError.name = "ForbiddenError";
				return forbiddenError;
			}
			if (status === 401) {
				const authError = new Error("Authentication failed");
				authError.name = "UnauthorizedError";
				return authError;
			}
		}
		return error instanceof Error ? error : new Error(String(error));
	}
}
