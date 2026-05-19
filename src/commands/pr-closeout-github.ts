import { sanitizeError } from "../lib/input/sanitize.js";
import type {
	PrCloseoutCheckInput,
	PrCloseoutReviewThreadsInput,
	PrCloseoutToolInput,
} from "../lib/pr-closeout.js";
import type { CommandRunner, PrCloseoutCLIOptions } from "./pr-closeout.js";

function asString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
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

/** Normalize gh pr checks output without inventing current-head proof. */
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
			source: "github",
		}));
}

function normalizeGhCheckRuns(value: unknown): Map<string, string> {
	const checkRuns = Array.isArray(value)
		? value
		: value && typeof value === "object"
			? (value as Record<string, unknown>).check_runs
			: null;
	if (!Array.isArray(checkRuns)) return new Map();
	const proof = new Map<string, string>();
	for (const item of checkRuns) {
		if (!item || typeof item !== "object" || Array.isArray(item)) continue;
		const record = item as Record<string, unknown>;
		const name = asString(record.name);
		const headSha = asString(record.head_sha) ?? asString(record.headSha);
		if (name && headSha) proof.set(name, headSha);
	}
	return proof;
}

/** Attach observed current-head proof from GitHub's check-runs endpoint. */
export function applyCheckHeadProof(
	checks: readonly PrCloseoutCheckInput[],
	proof: ReadonlyMap<string, string>,
): PrCloseoutCheckInput[] {
	return checks.map((check) => ({
		...check,
		headSha: check.headSha ?? proof.get(check.name) ?? null,
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
	return normalizeGhRepo(
		parseJsonObject(
			runner("gh", ["repo", "view", "--json", "owner,name"], {
				cwd: options.repoRoot,
				env,
			}),
			"gh repo view",
		),
	);
}

/** Fetch current-head check-run proof for live pr-closeout evidence. */
export function fetchCheckHeadProof(
	options: PrCloseoutCLIOptions,
	env: NodeJS.ProcessEnv,
	runner: CommandRunner,
	tools: PrCloseoutToolInput[],
	headSha: string | null | undefined,
): Map<string, string> {
	if (!headSha) return new Map();
	try {
		const repo = fetchRepoInfo(options, env, runner);
		const raw = runner(
			"gh",
			[
				"api",
				`repos/${repo.owner}/${repo.repo}/commits/${headSha}/check-runs`,
				"--jq",
				".check_runs",
			],
			{ cwd: options.repoRoot, env },
		);
		return normalizeGhCheckRuns(JSON.parse(raw) as unknown);
	} catch (error) {
		tools.push({
			name: "github_cli",
			available: true,
			ref: "command:gh api repos/:owner/:repo/commits/:head/check-runs",
			status: "blocked",
			failureClass: `pr_check_head_proof_unreadable:${sanitizeError(error)}`,
		});
		return new Map();
	}
}

function normalizeReviewThreadsGraphql(
	value: Record<string, unknown>,
): PrCloseoutReviewThreadsInput {
	const data = value.data;
	if (!data || typeof data !== "object" || Array.isArray(data)) {
		throw new Error("reviewThreads GraphQL response must include data");
	}
	const repository = (data as Record<string, unknown>).repository;
	if (
		!repository ||
		typeof repository !== "object" ||
		Array.isArray(repository)
	) {
		throw new Error("reviewThreads GraphQL response must include repository");
	}
	const pullRequest = (repository as Record<string, unknown>).pullRequest;
	if (
		!pullRequest ||
		typeof pullRequest !== "object" ||
		Array.isArray(pullRequest)
	) {
		throw new Error("reviewThreads GraphQL response must include pullRequest");
	}
	const reviewThreads = (pullRequest as Record<string, unknown>).reviewThreads;
	if (
		!reviewThreads ||
		typeof reviewThreads !== "object" ||
		Array.isArray(reviewThreads)
	) {
		throw new Error(
			"reviewThreads GraphQL response must include reviewThreads",
		);
	}
	const pageInfo = (reviewThreads as Record<string, unknown>).pageInfo;
	if (pageInfo && typeof pageInfo === "object" && !Array.isArray(pageInfo)) {
		const hasNextPage = (pageInfo as Record<string, unknown>).hasNextPage;
		if (hasNextPage === true) {
			return { unresolved: null, needsHuman: null, autofixable: null };
		}
	}
	const nodes = (reviewThreads as Record<string, unknown>).nodes;
	if (!Array.isArray(nodes)) {
		throw new Error("reviewThreads GraphQL response must include nodes");
	}
	const unresolved = nodes.filter((node) => {
		if (!node || typeof node !== "object" || Array.isArray(node)) return false;
		return (node as Record<string, unknown>).isResolved === false;
	}).length;
	return { unresolved, needsHuman: null, autofixable: unresolved };
}

/** Fetch live GitHub review-thread state for pr-closeout. */
export function fetchReviewThreads(
	options: PrCloseoutCLIOptions,
	env: NodeJS.ProcessEnv,
	runner: CommandRunner,
	tools: PrCloseoutToolInput[],
): PrCloseoutReviewThreadsInput {
	const query =
		"query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads(first:100){pageInfo{hasNextPage}nodes{isResolved}}}}}";
	try {
		const repo = fetchRepoInfo(options, env, runner);
		const raw = runner(
			"gh",
			[
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
			],
			{ cwd: options.repoRoot, env },
		);
		const reviewThreads = normalizeReviewThreadsGraphql(
			parseJsonObject(raw, "gh api graphql reviewThreads"),
		);
		if (reviewThreads.unresolved === null) {
			tools.push({
				name: "github_cli",
				available: true,
				ref: "command:gh api graphql reviewThreads(first:100)",
				status: "blocked",
				failureClass: "review_threads_paginated",
			});
		}
		return reviewThreads;
	} catch (error) {
		tools.push({
			name: "github_cli",
			available: true,
			ref: "command:gh api graphql reviewThreads(first:100)",
			status: "blocked",
			failureClass: `pr_review_threads_unreadable:${sanitizeError(error)}`,
		});
		return { unresolved: null, needsHuman: null, autofixable: null };
	}
}
