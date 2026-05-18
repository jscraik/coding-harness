import { sanitizeError } from "../lib/input/sanitize.js";
import type {
	PrCloseoutCheckInput,
	PrCloseoutInput,
	PrCloseoutPullRequestInput,
	PrCloseoutReviewThreadsInput,
	PrCloseoutTraceabilityInput,
	PrCloseoutToolInput,
} from "../lib/pr-closeout.js";
import type { PrCloseoutCLIOptions } from "./pr-closeout-args.js";
import { loadEnvFile, type CommandRunner } from "./pr-closeout-env.js";
import { parseJsonObject } from "./pr-closeout-input.js";

function asString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
	return typeof value === "boolean" ? value : null;
}

function normalizeGhPr(
	value: Record<string, unknown>,
	prNumber: number,
): PrCloseoutPullRequestInput {
	return {
		number: asNumber(value.number) ?? prNumber,
		title: asString(value.title),
		state: asString(value.state),
		isDraft: asBoolean(value.isDraft),
		mergeStateStatus: asString(value.mergeStateStatus),
		url: asString(value.url),
		headRefName: asString(value.headRefName),
		baseRefName: asString(value.baseRefName),
		reviewDecision: asString(value.reviewDecision),
		body: asString(value.body),
	};
}

function normalizeGhChecks(value: unknown): PrCloseoutCheckInput[] {
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

function inspectCommand(
	name: PrCloseoutToolInput["name"],
	command: string,
	args: readonly string[],
	options: { repoRoot: string; env: NodeJS.ProcessEnv; runner: CommandRunner },
): PrCloseoutToolInput {
	try {
		options.runner(command, args, { cwd: options.repoRoot, env: options.env });
		return {
			name,
			available: true,
			ref: `command:${[command, ...args].join(" ")}`,
			status: "usable",
			failureClass: null,
		};
	} catch (error) {
		return {
			name,
			available: false,
			ref: `command:${[command, ...args].join(" ")}`,
			status: "missing",
			failureClass: sanitizeError(error),
		};
	}
}

function inspectGitClean(
	repoRoot: string,
	runner: CommandRunner,
): boolean | null {
	try {
		return (
			runner("git", ["status", "--porcelain"], {
				cwd: repoRoot,
			}).length === 0
		);
	} catch {
		return null;
	}
}

function isPlaceholderBodyField(value: string): boolean {
	return /^(?:list\b|map\b|pending\b|<[^>]+>\s*$)/iu.test(value.trim());
}

function bodyField(
	body: string | null | undefined,
	label: string,
): string | null {
	if (!body) return null;
	const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const pattern = new RegExp(
		`^- ${escapedLabel}:\\s*(.*?)(?=\\n- [A-Z][^:]*:|\\n## |$)`,
		"imsu",
	);
	const match = pattern.exec(body);
	const value = match?.[1]?.trim();
	if (!value || isPlaceholderBodyField(value)) return null;
	return value;
}

function splitEvidenceRefs(value: string | null): string[] {
	if (!value || /^n\.a\./iu.test(value)) return [];
	return value
		.split(/[\n,]/u)
		.map((item) => item.replace(/^[-*]\s*/u, "").trim())
		.filter((item) => item.length > 0);
}

function traceabilityFromBody(
	body: string | null | undefined,
): PrCloseoutTraceabilityInput {
	return {
		sessionIds: splitEvidenceRefs(bodyField(body, "Session IDs")),
		traceIds: splitEvidenceRefs(bodyField(body, "Trace IDs")),
		aiSessionTraceability: bodyField(body, "AI session / traceability"),
	};
}

function fetchReviewThreads(
	options: PrCloseoutCLIOptions,
	env: NodeJS.ProcessEnv,
	runner: CommandRunner,
	tools: PrCloseoutToolInput[],
): PrCloseoutReviewThreadsInput {
	const query =
		"query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads(first:100){pageInfo{hasNextPage}nodes{isResolved}}}}}";
	try {
		const repo = normalizeGhRepo(
			parseJsonObject(
				runner("gh", ["repo", "view", "--json", "owner,name"], {
					cwd: options.repoRoot,
					env,
				}),
				"gh repo view",
			),
		);
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

function inspectCloseoutTools(
	options: PrCloseoutCLIOptions,
	env: NodeJS.ProcessEnv,
	runner: CommandRunner,
): PrCloseoutToolInput[] {
	return [
		inspectCommand("github_cli", "gh", ["--version"], {
			repoRoot: options.repoRoot,
			env,
			runner,
		}),
		inspectCommand("circleci_cli", "circleci", ["version"], {
			repoRoot: options.repoRoot,
			env,
			runner,
		}),
		inspectCommand("coderabbit_cli", "coderabbit", ["--version"], {
			repoRoot: options.repoRoot,
			env,
			runner,
		}),
		inspectCommand("snyk_cli", "snyk", ["--version"], {
			repoRoot: options.repoRoot,
			env,
			runner,
		}),
	];
}

function fetchPullRequest(
	options: PrCloseoutCLIOptions,
	prNumber: number,
	env: NodeJS.ProcessEnv,
	runner: CommandRunner,
	tools: PrCloseoutToolInput[],
): PrCloseoutPullRequestInput {
	try {
		const prRaw = runner(
			"gh",
			[
				"pr",
				"view",
				String(prNumber),
				"--json",
				"number,title,state,isDraft,mergeStateStatus,url,headRefName,baseRefName,reviewDecision,body",
			],
			{ cwd: options.repoRoot, env },
		);
		return normalizeGhPr(parseJsonObject(prRaw, "gh pr view"), prNumber);
	} catch (error) {
		tools.push({
			name: "github_cli",
			available: false,
			ref: `command:gh pr view ${String(prNumber)} --json number,title,state,isDraft,mergeStateStatus,url,headRefName,baseRefName,reviewDecision,body`,
			status: "blocked",
			failureClass: `pr_view_unreadable:${sanitizeError(error)}`,
		});
		return {
			number: prNumber,
			state: null,
			isDraft: null,
			mergeStateStatus: null,
			body: null,
		};
	}
}

function fetchChecks(
	options: PrCloseoutCLIOptions,
	prNumber: number,
	env: NodeJS.ProcessEnv,
	runner: CommandRunner,
	tools: PrCloseoutToolInput[],
): PrCloseoutCheckInput[] {
	try {
		const checksRaw = runner(
			"gh",
			["pr", "checks", String(prNumber), "--json", "name,state,link"],
			{ cwd: options.repoRoot, env },
		);
		return normalizeGhChecks(JSON.parse(checksRaw) as unknown);
	} catch (error) {
		tools.push({
			name: "github_cli",
			available: true,
			ref: `command:gh pr checks ${String(prNumber)} --json name,state,link`,
			status: "blocked",
			failureClass: `pr_checks_unreadable:${sanitizeError(error)}`,
		});
		return [];
	}
}

/** Build normalized PR closeout input by inspecting the local checkout and GitHub CLI state. */
export function buildLiveInput(
	options: PrCloseoutCLIOptions,
	runner: CommandRunner,
): PrCloseoutInput {
	if (options.prNumber === undefined) {
		throw new Error("--pr is required for live closeout input");
	}
	const envLoad = loadEnvFile(options.envFilePath);
	const tools: PrCloseoutToolInput[] = [envLoad.tool];
	tools.push(...inspectCloseoutTools(options, envLoad.env, runner));
	const pullRequest = fetchPullRequest(
		options,
		options.prNumber,
		envLoad.env,
		runner,
		tools,
	);
	const checks = fetchChecks(
		options,
		options.prNumber,
		envLoad.env,
		runner,
		tools,
	);
	const reviewThreads = fetchReviewThreads(options, envLoad.env, runner, tools);
	return {
		pullRequest,
		branch: {
			clean: inspectGitClean(options.repoRoot, runner),
		},
		checks,
		reviewThreads,
		traceability: traceabilityFromBody(pullRequest.body),
		tools,
	};
}
