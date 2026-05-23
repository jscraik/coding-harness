import { execFileSync } from "node:child_process";
import { sanitizeError } from "../input/sanitize.js";
import { LinearAPIError, LinearClient } from "../linear/client.js";
import { issueKeysMatch } from "./issue-key.js";
import type { RuntimeCard, RuntimeCardSource } from "./runtime-card.js";

const LIVE_PROVIDER_TIMEOUT_MS = 10_000;

/** Context passed to live runtime-card provider inspectors. */
export interface RuntimeCardLiveProviderContext {
	/** Repository root being inspected. */
	repoRoot: string;
	/** Local branch name, when git can determine it. */
	branchName: string | null;
	/** Current issue key after local git/artifact inference. */
	issueKey: string | null;
}

/** Live provider evidence that can be merged into a local runtime card. */
export interface RuntimeCardLiveEvidence {
	/** Optional live pull-request state. */
	pullRequest?: RuntimeCard["pullRequest"];
	/** Optional live tracker state. */
	linear?: RuntimeCard["linear"];
	/** Evidence sources inspected by the provider. */
	sources?: RuntimeCardSource[];
	/** Provider blockers that should stop continuation. */
	blockers?: string[];
}

/** Inspector used to add bounded live provider evidence to a runtime card. */
export type RuntimeCardLiveProvider = (
	context: RuntimeCardLiveProviderContext,
) => Promise<RuntimeCardLiveEvidence> | RuntimeCardLiveEvidence;

interface GitHubLiveSnapshot {
	pullRequest: RuntimeCard["pullRequest"];
	source: RuntimeCardSource;
	blockers: string[];
}

interface LinearLiveSnapshot {
	linear: RuntimeCard["linear"];
	source: RuntimeCardSource;
	blockers: string[];
}

function emptyPullRequest(): RuntimeCard["pullRequest"] {
	return {
		number: null,
		state: null,
		isDraft: null,
		mergeStateStatus: null,
		url: null,
	};
}

function githubMergeBlockers(
	pullRequest: RuntimeCard["pullRequest"],
): string[] {
	const blockers: string[] = [];
	if (pullRequest.isDraft) {
		blockers.push(
			"GitHub PR is draft; keep closeout actions blocked until it is ready for review.",
		);
	}
	if (
		pullRequest.mergeStateStatus &&
		["BLOCKED", "DIRTY", "UNKNOWN"].includes(pullRequest.mergeStateStatus)
	) {
		blockers.push(
			`GitHub PR merge state is ${pullRequest.mergeStateStatus}; resolve PR blockers before continuing.`,
		);
	}
	return blockers;
}

function defaultGitHubPrSnapshot(
	repoRoot: string,
	branchName: string | null,
): GitHubLiveSnapshot {
	if (!branchName) {
		return {
			pullRequest: emptyPullRequest(),
			source: {
				kind: "pr",
				ref: "command:gh pr view",
				freshness: "missing",
				status: "empty",
				failureClass: "branch_unavailable",
			},
			blockers: [],
		};
	}
	try {
		const output = execFileSync(
			"gh",
			["pr", "view", "--json", "number,state,isDraft,mergeStateStatus,url"],
			{
				cwd: repoRoot,
				encoding: "utf8",
				stdio: ["ignore", "pipe", "ignore"],
				timeout: LIVE_PROVIDER_TIMEOUT_MS,
			},
		);
		const parsed = JSON.parse(output) as Partial<RuntimeCard["pullRequest"]>;
		const pullRequest: RuntimeCard["pullRequest"] = {
			number: typeof parsed.number === "number" ? parsed.number : null,
			state: typeof parsed.state === "string" ? parsed.state : null,
			isDraft: typeof parsed.isDraft === "boolean" ? parsed.isDraft : null,
			mergeStateStatus:
				typeof parsed.mergeStateStatus === "string"
					? parsed.mergeStateStatus
					: null,
			url: typeof parsed.url === "string" ? parsed.url : null,
		};
		return {
			pullRequest,
			source: {
				kind: "pr",
				ref: "command:gh pr view --json number,state,isDraft,mergeStateStatus,url",
				freshness: "current",
				status: "usable",
				failureClass: null,
			},
			blockers: githubMergeBlockers(pullRequest),
		};
	} catch (error) {
		return {
			pullRequest: emptyPullRequest(),
			source: {
				kind: "pr",
				ref: "command:gh pr view",
				freshness: "unknown",
				status: "blocked",
				failureClass: `github_pr_unavailable:${sanitizeError(error)}`,
			},
			blockers: ["Live GitHub PR state could not be refreshed."],
		};
	}
}

function missingLinearSnapshot(
	issueKey: string | null,
	status: RuntimeCardSource["status"],
	freshness: RuntimeCardSource["freshness"],
	failureClass: string,
	blocker?: string,
): LinearLiveSnapshot {
	return {
		linear: {
			issueKey,
			freshness,
			status: null,
			statusType: null,
			url: null,
			actionRequired: blocker ?? null,
		},
		source: {
			kind: "linear",
			ref: issueKey ? `api:linear:${issueKey}` : "api:linear",
			freshness,
			status,
			failureClass,
		},
		blockers: blocker ? [blocker] : [],
	};
}

async function defaultLinearSnapshot(
	issueKey: string | null,
	env: NodeJS.ProcessEnv,
): Promise<LinearLiveSnapshot> {
	if (!issueKey) {
		return missingLinearSnapshot(null, "empty", "missing", "issue_key_missing");
	}
	const token = env.LINEAR_API_KEY?.trim();
	if (!token) {
		return missingLinearSnapshot(
			issueKey,
			"blocked",
			"unknown",
			"linear_token_missing",
			"Live Linear state could not be refreshed because LINEAR_API_KEY is not set.",
		);
	}
	try {
		const client = new LinearClient({
			token,
			timeoutMs: LIVE_PROVIDER_TIMEOUT_MS,
		});
		const issues = await client.searchIssues(issueKey);
		const issue = issues.find((candidate) =>
			issueKeysMatch(candidate.identifier, issueKey),
		);
		if (!issue) {
			return missingLinearSnapshot(
				issueKey,
				"empty",
				"missing",
				"linear_issue_not_found",
				`Linear issue ${issueKey} was not found by live search.`,
			);
		}
		const actionRequired =
			issue.state.type === "canceled"
				? "Linear issue is canceled; choose a current work item before continuing."
				: null;
		return {
			linear: {
				issueKey: issue.identifier,
				freshness: "current",
				status: issue.state.name,
				statusType: issue.state.type,
				url: issue.url,
				actionRequired,
			},
			source: {
				kind: "linear",
				ref: `api:linear:${issue.identifier}`,
				freshness: "current",
				status: "usable",
				failureClass: null,
			},
			blockers: actionRequired ? [actionRequired] : [],
		};
	} catch (error) {
		const failureClass =
			error instanceof LinearAPIError
				? `linear_api_error:${error.code}`
				: `linear_api_error:${sanitizeError(error)}`;
		return missingLinearSnapshot(
			issueKey,
			"blocked",
			"unknown",
			failureClass,
			"Live Linear state could not be refreshed.",
		);
	}
}

/** Build bounded live GitHub and Linear evidence for runtime-card generation. */
export async function defaultLiveProvider(
	context: RuntimeCardLiveProviderContext,
	env: NodeJS.ProcessEnv,
): Promise<RuntimeCardLiveEvidence> {
	const github = defaultGitHubPrSnapshot(context.repoRoot, context.branchName);
	const linear = await defaultLinearSnapshot(context.issueKey, env);
	return {
		pullRequest: github.pullRequest,
		linear: linear.linear,
		sources: [github.source, linear.source],
		blockers: [...github.blockers, ...linear.blockers],
	};
}
