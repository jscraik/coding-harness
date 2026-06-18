import type {
	PrCloseoutCheckInput,
	PrCloseoutReviewThreadsInput,
	PrCloseoutToolInput,
} from "../lib/pr-closeout.js";
import type { PrCloseoutCLIOptions } from "./pr-closeout/args.js";
import type { CommandRunner } from "./pr-closeout/types.js";
import {
	formatGitHubCliFailure,
	formatGitHubCliRef,
	resolveGitHubCli,
} from "../lib/github/cli.js";

export {
	applyCheckHeadProof,
	fetchCheckHeadProof,
} from "./pr-closeout-github-proof.js";

function asString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

function asObject(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function parseJsonObject(
	value: string,
	source: string,
): Record<string, unknown> {
	const parsed = JSON.parse(value) as unknown;
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error(`${source} must contain a JSON object`);
	}
	return parsed as Record<string, unknown>;
}

/** Normalize required gh pr checks output without inventing current-head proof. */
export function normalizeGhChecks(value: unknown): PrCloseoutCheckInput[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter(
			(item): item is Record<string, unknown> =>
				Boolean(item) && typeof item === "object" && !Array.isArray(item),
		)
		.map((item) => ({
			name: asString(item.name) ?? "unknown",
			state: asString(item.state),
			url: asString(item.link),
			headSha: asString(item.headSha),
			required: true,
			source: "github",
		}));
}

function normalizeGhRepo(value: Record<string, unknown>): {
	owner: string;
	repo: string;
} {
	const ownerValue = value.owner;
	const owner =
		typeof ownerValue === "string"
			? ownerValue
			: ownerValue &&
					typeof ownerValue === "object" &&
					!Array.isArray(ownerValue)
				? asString((ownerValue as Record<string, unknown>).login)
				: null;
	const repo = asString(value.name);
	if (!owner || !repo) {
		throw new Error("gh repo view must include owner.login and name");
	}
	return { owner, repo };
}

function fetchRepoInfo(
	options: PrCloseoutCLIOptions,
	env: NodeJS.ProcessEnv,
	runner: CommandRunner,
): { owner: string; repo: string } {
	const githubCli = resolveGitHubCli(env);
	const args = ["repo", "view", "--json", "owner,name"];
	return normalizeGhRepo(
		parseJsonObject(
			runner(githubCli.command, args, {
				cwd: options.repoRoot,
				env,
			}),
			"gh repo view",
		),
	);
}

function requireGraphqlObject(
	value: unknown,
	label: string,
): Record<string, unknown> {
	const record = asObject(value);
	if (!record) {
		throw new Error(`reviewThreads GraphQL response must include ${label}`);
	}
	return record;
}

function reviewThreadConnection(
	value: Record<string, unknown>,
): Record<string, unknown> {
	const data = requireGraphqlObject(value.data, "data");
	const repository = requireGraphqlObject(data.repository, "repository");
	const pullRequest = requireGraphqlObject(
		repository.pullRequest,
		"pullRequest",
	);
	return requireGraphqlObject(pullRequest.reviewThreads, "reviewThreads");
}

function reviewThreadPageInfo(value: Record<string, unknown>): {
	hasNextPage: boolean;
	endCursor: string | null;
} {
	const pageInfo = asObject(value.pageInfo);
	return {
		hasNextPage: pageInfo?.hasNextPage === true,
		endCursor: asString(pageInfo?.endCursor),
	};
}

function reviewThreadNodes(value: Record<string, unknown>): unknown[] {
	const nodes = value.nodes;
	if (!Array.isArray(nodes)) {
		throw new Error("reviewThreads GraphQL response must include nodes");
	}
	return nodes;
}

function unresolvedReviewThreadCount(nodes: readonly unknown[]): number {
	return nodes.filter((node) => asObject(node)?.isResolved === false).length;
}

function normalizeReviewThreadsGraphql(
	value: Record<string, unknown>,
): PrCloseoutReviewThreadsInput & {
	hasNextPage: boolean;
	endCursor: string | null;
} {
	const reviewThreads = reviewThreadConnection(value);
	const { hasNextPage, endCursor } = reviewThreadPageInfo(reviewThreads);
	const unresolved = unresolvedReviewThreadCount(
		reviewThreadNodes(reviewThreads),
	);
	return {
		unresolved,
		needsHuman: null,
		autofixable: null,
		hasNextPage,
		endCursor,
	};
}

/** Fetch live GitHub review-thread state for pr-closeout. */
export function fetchReviewThreads(
	options: PrCloseoutCLIOptions,
	env: NodeJS.ProcessEnv,
	runner: CommandRunner,
	tools: PrCloseoutToolInput[],
): PrCloseoutReviewThreadsInput {
	const githubCli = resolveGitHubCli(env);
	const query =
		"query($owner:String!,$repo:String!,$number:Int!,$after:String){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads(first:100,after:$after){pageInfo{hasNextPage endCursor}nodes{isResolved}}}}}";
	try {
		const repo = fetchRepoInfo(options, env, runner);
		let after: string | null = null;
		let unresolved = 0;
		for (;;) {
			const args = [
				"api",
				"graphql",
				"-f",
				`query=${query}`,
				"-f",
				`owner=${repo.owner}`,
				"-f",
				`repo=${repo.repo}`,
				"-F",
				`number=${String(options.prNumber)}`,
			];
			if (after) args.push("-f", `after=${after}`);
			const raw = runner(githubCli.command, args, {
				cwd: options.repoRoot,
				env,
			});
			const page = normalizeReviewThreadsGraphql(
				parseJsonObject(raw, "gh api graphql reviewThreads"),
			);
			unresolved += page.unresolved ?? 0;
			if (!page.hasNextPage) {
				return { unresolved, needsHuman: null, autofixable: null };
			}
			if (!page.endCursor) {
				tools.push({
					name: "github_cli",
					available: true,
					ref: "command:gh api graphql reviewThreads(first:100)",
					status: "blocked",
					failureClass: "review_threads_paginated_missing_cursor",
				});
				return { unresolved: null, needsHuman: null, autofixable: null };
			}
			after = page.endCursor;
		}
	} catch (error) {
		tools.push({
			name: "github_cli",
			available: true,
			ref: formatGitHubCliRef(["api", "graphql", "reviewThreads(first:100)"]),
			status: "blocked",
			failureClass:
				"pr_review_threads_unreadable:" +
				formatGitHubCliFailure(error, ["api", "graphql"], githubCli),
		});
		return { unresolved: null, needsHuman: null, autofixable: null };
	}
}
