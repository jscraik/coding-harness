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

/**
 * Coerces a value to a string when it is already a string, otherwise returns `null`.
 *
 * @param value - The value to coerce
 * @returns `value` if it is a string, `null` otherwise.
 */
function asString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

/**
 * Return the input value if it is an integer number, otherwise `null`.
 *
 * @param value - The value to test for an integer number
 * @returns `value` as an integer number if it is an integer, `null` otherwise
 */
function asNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isInteger(value) ? value : null;
}

/**
 * Coerces an unknown value to a boolean, or returns `null` when it is not a boolean.
 *
 * @param value - The value to coerce
 * @returns `value` if it is a boolean, `null` otherwise.
 */
function asBoolean(value: unknown): boolean | null {
	return typeof value === "boolean" ? value : null;
}

/**
 * Builds a PrCloseoutPullRequestInput from a raw GitHub CLI PR object by coercing fields to their expected types.
 *
 * @param value - Raw parsed object produced by `gh pr view --json ...`
 * @param prNumber - Fallback PR number used when `value.number` is missing or not an integer
 * @returns A `PrCloseoutPullRequestInput` whose `number` is the coerced `value.number` or `prNumber` when coercion fails; other fields are returned as strings/booleans when valid or `null` when not
 */
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

/**
 * Converts a raw GitHub CLI checks value into an array of check input objects.
 *
 * @param value - The raw value returned by `gh pr checks ...`; may be any JSON value.
 * @returns An array of check objects where each entry has `name` (defaults to `"unknown"` if not a string), `state` (`string` or `null`), `url` (`string` or `null`), and `source` set to `"github"`.
 */
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

/**
 * Extracts the repository owner and name from a GitHub CLI repo JSON object.
 *
 * @param value - The raw `gh repo view --json owner,name` object. `owner` may be a string or an object containing a `login` string; `name` is the repository name.
 * @returns An object with `owner` and `repo` as strings.
 * @throws Error if either the owner login or the repository name is missing or not a string.
 */
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

/**
 * Extracts review-thread resolution counts from a GitHub GraphQL response.
 *
 * Accepts the raw GraphQL JSON returned by the GitHub CLI and validates the
 * presence of `data.repository.pullRequest.reviewThreads`. If `reviewThreads.pageInfo.hasNextPage`
 * is `true`, returns all `null` fields to indicate pagination. Otherwise counts
 * nodes with `isResolved === false` as `unresolved`.
 *
 * @param value - The GraphQL response object expected to include `data.repository.pullRequest.reviewThreads`
 * @returns An object with:
 *  - `unresolved`: the number of unresolved review thread nodes, or `null` when paginated
 *  - `needsHuman`: always `null` (reserved for future use)
 *  - `autofixable`: equal to `unresolved` when available, or `null` when paginated
 * @throws Error if the response is missing or has an unexpected shape for any of `data`, `repository`, `pullRequest`, `reviewThreads`, or `nodes`
 */
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

/**
 * Determine availability and status of an external command by attempting to execute it.
 *
 * @param name - Tool identifier to record in the returned entry
 * @param command - Executable to invoke (for example, `"gh"` or `"snyk"`)
 * @param args - Arguments to pass to the executable
 * @param options - Execution context:
 *   - repoRoot: working directory for the invocation
 *   - env: environment variables for the invocation
 *   - runner: function used to invoke the command
 * @returns A `PrCloseoutToolInput` describing the tool: `available` is `true` when the command ran without throwing and `false` otherwise; `ref` is the invoked command string; `status` indicates usability (`"usable"` or `"missing"`); `failureClass` contains a sanitized classification of any error or `null` when available.
 */
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

/**
 * Determine whether the git working tree at the given repository root is clean.
 *
 * @param repoRoot - Filesystem path to the repository root where `git status --porcelain` will be executed
 * @returns `true` if the working tree has no changes, `false` if there are uncommitted changes, `null` if cleanliness could not be determined due to an error
 */
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

/**
 * Detects whether a PR body field value looks like a placeholder.
 *
 * @param value - The field text to evaluate; surrounding whitespace is ignored.
 * @returns `true` if the trimmed value is a placeholder (e.g. "list", "map", "pending", or a `<...>` token), `false` otherwise.
 */
function isPlaceholderBodyField(value: string): boolean {
	return /^(?:list\b|map\b|pending\b|<[^>]+>\s*$)/iu.test(value.trim());
}

/**
 * Extracts a labeled field value from a PR body written in markdown-style checklist lines.
 *
 * Searches the `body` for a line beginning with `- <label>:` and returns the captured content up to the next checklist field, a new section heading, or the end of the body. The returned value is trimmed; if no value is found, the captured value is empty, or it matches placeholder-like content, the function returns `null`.
 *
 * @param body - The pull request body text to search
 * @param label - The label name to locate (matched literally)
 * @returns The trimmed field value when present and not placeholder-like, `null` otherwise
 */
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

/**
 * Parse an evidence reference string into an array of individual references.
 *
 * @param value - A possibly-null string containing evidence references separated by newlines or commas; entries may be prefixed with list markers (`- ` or `* `) or be the literal `n.a.` (case-insensitive).
 * @returns An array of trimmed, non-empty evidence reference strings. Returns an empty array if `value` is null, empty, or begins with `n.a.`.
 */
function splitEvidenceRefs(value: string | null): string[] {
	if (!value || /^n\.a\./iu.test(value)) return [];
	return value
		.split(/[\n,]/u)
		.map((item) => item.replace(/^[-*]\s*/u, "").trim())
		.filter((item) => item.length > 0);
}

/**
 * Extracts traceability information from a PR body.
 *
 * Scans the provided PR body for the labeled sections "Session IDs", "Trace IDs",
 * and "AI session / traceability". The ID sections are parsed into arrays of evidence
 * references; the AI session/traceability section is returned as a trimmed string or `null`.
 *
 * @param body - The full PR body text (or `null`/`undefined`) to read traceability fields from
 * @returns An object with:
 *   - `sessionIds`: an array of evidence references parsed from the "Session IDs" field
 *   - `traceIds`: an array of evidence references parsed from the "Trace IDs" field
 *   - `aiSessionTraceability`: the raw value of the "AI session / traceability" field, or `null`
 */
function traceabilityFromBody(
	body: string | null | undefined,
): PrCloseoutTraceabilityInput {
	return {
		sessionIds: splitEvidenceRefs(bodyField(body, "Session IDs")),
		traceIds: splitEvidenceRefs(bodyField(body, "Trace IDs")),
		aiSessionTraceability: bodyField(body, "AI session / traceability"),
	};
}

/**
 * Retrieve a summary of review-thread resolutions for the configured pull request using the GitHub CLI.
 *
 * If review-thread data is available and not paginated, returns counts derived from the GraphQL response.
 * If the query is paginated or cannot be read, appends a `github_cli` blocked tool entry to `tools` and returns an object where `unresolved`, `needsHuman`, and `autofixable` are all `null`.
 *
 * @param options - CLI options containing at least `repoRoot` and `prNumber` identifying the repository and PR to query
 * @param tools - Mutable array that may receive a `github_cli` tool status entry when review-thread data is paginated or unreadable
 * @returns A `PrCloseoutReviewThreadsInput` with resolved counts, or with `unresolved`, `needsHuman`, and `autofixable` set to `null` when the data is unavailable
 */
function fetchReviewThreads(
	options: PrCloseoutCLIOptions,
	env: NodeJS.ProcessEnv,
	runner: CommandRunner,
	tools: PrCloseoutToolInput[],
): PrCloseoutReviewThreadsInput {
	const query =
		"query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads(first:100){pageInfo{hasNextPage}nodes{isResolved}}}}}";
	const ref = "command:gh api graphql reviewThreads(first:100)";
	let repoRaw: string;
	try {
		repoRaw = runner("gh", ["repo", "view", "--json", "owner,name"], {
			cwd: options.repoRoot,
			env,
		});
	} catch (error) {
		tools.push({
			name: "github_cli",
			available: false,
			ref: "command:gh repo view --json owner,name",
			status: "blocked",
			failureClass: `pr_review_threads_unavailable:${sanitizeError(error)}`,
		});
		return { unresolved: null, needsHuman: null, autofixable: null };
	}
	let repo: { owner: string; repo: string };
	try {
		repo = normalizeGhRepo(parseJsonObject(repoRaw, "gh repo view"));
	} catch (error) {
		tools.push({
			name: "github_cli",
			available: true,
			ref: "command:gh repo view --json owner,name",
			status: "blocked",
			failureClass: `pr_review_threads_unreadable:${sanitizeError(error)}`,
		});
		return { unresolved: null, needsHuman: null, autofixable: null };
	}
	let raw: string;
	try {
		raw = runner(
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
	} catch (error) {
		tools.push({
			name: "github_cli",
			available: false,
			ref,
			status: "blocked",
			failureClass: `pr_review_threads_unavailable:${sanitizeError(error)}`,
		});
		return { unresolved: null, needsHuman: null, autofixable: null };
	}
	try {
		const reviewThreads = normalizeReviewThreadsGraphql(
			parseJsonObject(raw, "gh api graphql reviewThreads"),
		);
		if (reviewThreads.unresolved === null) {
			tools.push({
				name: "github_cli",
				available: true,
				ref,
				status: "blocked",
				failureClass: "review_threads_paginated",
			});
		}
		return reviewThreads;
	} catch (error) {
		tools.push({
			name: "github_cli",
			available: true,
			ref,
			status: "blocked",
			failureClass: `pr_review_threads_unreadable:${sanitizeError(error)}`,
		});
		return { unresolved: null, needsHuman: null, autofixable: null };
	}
}

/**
 * Probe the local environment for the closeout CLI tools required by the closeout workflow.
 *
 * Uses `options.repoRoot` as the working directory when executing each probe. Probes the
 * following tools: `github_cli` (`gh --version`), `circleci_cli` (`circleci version`),
 * `coderabbit_cli` (`coderabbit --version`), and `snyk_cli` (`snyk --version`).
 *
 * @param options - CLI options; `options.repoRoot` is used as the working directory when probing tools
 * @returns An array of `PrCloseoutToolInput` entries for the probed tools, each describing `available`, `status`, and `failureClass` when applicable
 */
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

/**
 * Retrieves the pull request data for `prNumber` using the GitHub CLI and returns it in the normalized closeout PR shape.
 *
 * On error, appends a `github_cli` blocked tool entry to `tools` with a failure classification and returns a fallback object with `number` set to `prNumber` and `state`, `isDraft`, `mergeStateStatus`, and `body` set to `null`.
 *
 * @param options - CLI options; `repoRoot` is used as the working directory for the CLI invocation
 * @param prNumber - The pull request number to fetch
 * @param env - Environment variables to use when running the GitHub CLI
 * @param runner - Command runner used to execute the GitHub CLI
 * @param tools - Mutable list of tool inspection results; a `github_cli` failure entry is appended on error
 * @returns The normalized pull request data, or a fallback with `number` set to `prNumber` and `state`, `isDraft`, `mergeStateStatus`, and `body` set to `null`
 */
function fetchPullRequest(
	options: PrCloseoutCLIOptions,
	prNumber: number,
	env: NodeJS.ProcessEnv,
	runner: CommandRunner,
	tools: PrCloseoutToolInput[],
): PrCloseoutPullRequestInput {
	const ref = `command:gh pr view ${String(prNumber)} --json number,title,state,isDraft,mergeStateStatus,url,headRefName,baseRefName,reviewDecision,body`;
	let prRaw: string;
	try {
		prRaw = runner(
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
	} catch (error) {
		tools.push({
			name: "github_cli",
			available: false,
			ref,
			status: "blocked",
			failureClass: `pr_view_unavailable:${sanitizeError(error)}`,
		});
		return {
			number: prNumber,
			state: null,
			isDraft: null,
			mergeStateStatus: null,
			body: null,
		};
	}
	try {
		return normalizeGhPr(parseJsonObject(prRaw, "gh pr view"), prNumber);
	} catch (error) {
		tools.push({
			name: "github_cli",
			available: true,
			ref,
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

/**
 * Fetches PR checks via the GitHub CLI and returns them normalized.
 *
 * Attempts to run `gh pr checks <prNumber> --json name,state,link` in the repository
 * specified by `options.repoRoot`. Command execution failures are classified as unavailable;
 * malformed JSON output is classified as unreadable.
 *
 * @param options - CLI options; `repoRoot` is used as the working directory for the command
 * @param prNumber - Pull request number to query
 * @param env - Environment variables to use when running the command
 * @param runner - Function to execute shell commands
 * @param tools - Mutable list of detected tools; a `github_cli` entry will be pushed on failure
 * @returns An array of `PrCloseoutCheckInput` representing the PR checks; returns `[]` if unreadable
 */
function fetchChecks(
	options: PrCloseoutCLIOptions,
	prNumber: number,
	env: NodeJS.ProcessEnv,
	runner: CommandRunner,
	tools: PrCloseoutToolInput[],
): PrCloseoutCheckInput[] {
	const ref = `command:gh pr checks ${String(prNumber)} --json name,state,link`;
	let checksRaw: string;
	try {
		checksRaw = runner(
			"gh",
			["pr", "checks", String(prNumber), "--json", "name,state,link"],
			{ cwd: options.repoRoot, env },
		);
	} catch (error) {
		tools.push({
			name: "github_cli",
			available: false,
			ref,
			status: "blocked",
			failureClass: `pr_checks_unavailable:${sanitizeError(error)}`,
		});
		return [];
	}
	try {
		return normalizeGhChecks(JSON.parse(checksRaw) as unknown);
	} catch (error) {
		tools.push({
			name: "github_cli",
			available: true,
			ref,
			status: "blocked",
			failureClass: `pr_checks_unreadable:${sanitizeError(error)}`,
		});
		return [];
	}
}

/**
 * Builds a normalized live closeout input for a pull request by inspecting the local git checkout and GitHub CLI state.
 *
 * @param options - CLI options specifying the PR number and repository/env file locations
 * @param runner - Command runner used to execute external tools (e.g., `gh`, `git`, `circleci`)
 * @returns An object containing the normalized pull request, branch cleanliness, checks, review-thread summary, traceability extracted from the PR body, and inspected tool metadata
 * @throws Error when `options.prNumber` is not provided
 */
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
