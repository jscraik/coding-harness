import { sanitizeError } from "../lib/input/sanitize.js";
import type {
	PrCloseoutCheckInput,
	PrCloseoutReviewThreadsInput,
	PrCloseoutToolInput,
} from "../lib/pr-closeout.js";
import type { PrCloseoutCLIOptions } from "./pr-closeout/args.js";
import type { CommandRunner } from "./pr-closeout/types.js";

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

function checkProofKey(name: string, url: string | null): string {
	return `${name}\0${url ?? ""}`;
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
		const url = asString(record.details_url) ?? asString(record.html_url);
		const headSha = asString(record.head_sha) ?? asString(record.headSha);
		if (name && url && headSha) proof.set(checkProofKey(name, url), headSha);
	}
	return proof;
}

function normalizeGhStatuses(
	value: unknown,
	headSha: string,
): Map<string, string> {
	const statuses = Array.isArray(value)
		? value
		: value && typeof value === "object"
			? (value as Record<string, unknown>).statuses
			: null;
	if (!Array.isArray(statuses)) return new Map();
	const proof = new Map<string, string>();
	for (const item of statuses) {
		if (!item || typeof item !== "object" || Array.isArray(item)) continue;
		const record = item as Record<string, unknown>;
		const name = asString(record.context);
		const url = asString(record.target_url) ?? asString(record.targetUrl);
		const statusSha = asString(record.sha);
		const isCurrentHead = !statusSha || statusSha === headSha;
		if (name && url && isCurrentHead) {
			proof.set(checkProofKey(name, url), headSha);
		} else if (name && !url && isCurrentHead) {
			proof.set(checkProofKey(name, null), headSha);
		}
	}
	return proof;
}

function checkRunCount(value: unknown): number {
	if (Array.isArray(value)) return value.length;
	const checkRuns =
		value && typeof value === "object"
			? (value as Record<string, unknown>).check_runs
			: null;
	return Array.isArray(checkRuns) ? checkRuns.length : 0;
}

function statusCount(value: unknown): number {
	if (Array.isArray(value)) return value.length;
	const statuses =
		value && typeof value === "object"
			? (value as Record<string, unknown>).statuses
			: null;
	return Array.isArray(statuses) ? statuses.length : 0;
}

function hasUnprovenCheck(
	checks: readonly PrCloseoutCheckInput[],
	proof: ReadonlyMap<string, string>,
): boolean {
	return checks.some(
		(check) =>
			!proof.has(checkProofKey(check.name, check.url ?? null)) &&
			(Boolean(check.url) || !proof.has(checkProofKey(check.name, null))),
	);
}

/** Attach observed current-head proof from GitHub's check-runs endpoint. */
export function applyCheckHeadProof(
	checks: readonly PrCloseoutCheckInput[],
	proof: ReadonlyMap<string, string>,
): PrCloseoutCheckInput[] {
	return checks.map((check) => ({
		...check,
		headSha:
			check.headSha ??
			(check.url ? proof.get(checkProofKey(check.name, check.url)) : null) ??
			(check.url ? null : proof.get(checkProofKey(check.name, null))) ??
			null,
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
	checks: readonly PrCloseoutCheckInput[],
	headSha: string | null | undefined,
): Map<string, string> {
	if (!headSha) return new Map();
	try {
		const repo = fetchRepoInfo(options, env, runner);
		const proof = new Map<string, string>();
		const perPage = 100;
		let checkRunsError: unknown = null;
		try {
			for (let page = 1; ; page += 1) {
				const raw = runner(
					"gh",
					[
						"api",
						`repos/${repo.owner}/${repo.repo}/commits/${headSha}/check-runs?per_page=${perPage}&page=${page}`,
						"--jq",
						".check_runs",
					],
					{ cwd: options.repoRoot, env },
				);
				const parsed = JSON.parse(raw) as unknown;
				for (const [key, value] of normalizeGhCheckRuns(parsed)) {
					proof.set(key, value);
				}
				if (checkRunCount(parsed) < perPage) break;
			}
		} catch (error) {
			checkRunsError = error;
		}
		if (!hasUnprovenCheck(checks, proof)) return proof;
		for (let page = 1; ; page += 1) {
			let parsed: unknown;
			try {
				const raw = runner(
					"gh",
					[
						"api",
						`repos/${repo.owner}/${repo.repo}/commits/${headSha}/statuses?per_page=${perPage}&page=${page}`,
						"--jq",
						".",
					],
					{ cwd: options.repoRoot, env },
				);
				parsed = JSON.parse(raw) as unknown;
			} catch (error) {
				tools.push({
					name: "github_cli",
					available: true,
					ref:
						"command:gh api repos/:owner/:repo/commits/:head/statuses page=" +
						String(page),
					status: "blocked",
					failureClass: `pr_check_status_proof_unreadable:${sanitizeError(error)}`,
				});
				return proof;
			}
			for (const [key, value] of normalizeGhStatuses(parsed, headSha)) {
				proof.set(key, value);
			}
			if (statusCount(parsed) < perPage) break;
		}
		if (checkRunsError && hasUnprovenCheck(checks, proof)) {
			tools.push({
				name: "github_cli",
				available: true,
				ref: "command:gh api repos/:owner/:repo/commits/:head/check-runs",
				status: "blocked",
				failureClass: `pr_check_head_proof_unreadable:${sanitizeError(checkRunsError)}`,
			});
		}
		return proof;
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
): PrCloseoutReviewThreadsInput & {
	hasNextPage: boolean;
	endCursor: string | null;
} {
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
	let hasNextPage = false;
	let endCursor: string | null = null;
	if (pageInfo && typeof pageInfo === "object" && !Array.isArray(pageInfo)) {
		hasNextPage = (pageInfo as Record<string, unknown>).hasNextPage === true;
		endCursor = asString((pageInfo as Record<string, unknown>).endCursor);
	}
	const nodes = (reviewThreads as Record<string, unknown>).nodes;
	if (!Array.isArray(nodes)) {
		throw new Error("reviewThreads GraphQL response must include nodes");
	}
	const unresolved = nodes.filter((node) => {
		if (!node || typeof node !== "object" || Array.isArray(node)) return false;
		return (node as Record<string, unknown>).isResolved === false;
	}).length;
	return {
		unresolved,
		needsHuman: null,
		autofixable: unresolved,
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
			const raw = runner("gh", args, { cwd: options.repoRoot, env });
			const page = normalizeReviewThreadsGraphql(
				parseJsonObject(raw, "gh api graphql reviewThreads"),
			);
			unresolved += page.unresolved ?? 0;
			if (!page.hasNextPage) {
				return { unresolved, needsHuman: null, autofixable: unresolved };
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
			ref: "command:gh api graphql reviewThreads(first:100)",
			status: "blocked",
			failureClass: `pr_review_threads_unreadable:${sanitizeError(error)}`,
		});
		return { unresolved: null, needsHuman: null, autofixable: null };
	}
}
