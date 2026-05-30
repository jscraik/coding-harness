import { sanitizeError } from "../../lib/input/sanitize.js";
import type {
	PrCloseoutBranchInput,
	PrCloseoutCheckInput,
	PrCloseoutInput,
	PrCloseoutPullRequestInput,
	PrCloseoutRollbackInput,
	PrCloseoutToolInput,
	PrCloseoutTraceabilityInput,
} from "../../lib/pr-closeout.js";
import {
	applyCheckHeadProof,
	fetchCheckHeadProof,
	fetchReviewThreads,
	normalizeGhChecks,
} from "../pr-closeout-github.js";
import type { PrCloseoutCLIOptions } from "./args.js";
import { loadPrCloseoutEnvFile } from "./env.js";
import type { CommandRunner } from "./types.js";

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
		headSha: asString(value.headRefOid) ?? asString(value.headSha),
		headRefName: asString(value.headRefName),
		baseRefName: asString(value.baseRefName),
		reviewDecision: asString(value.reviewDecision),
		body: asString(value.body),
	};
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

function inspectGitBranch(
	repoRoot: string,
	runner: CommandRunner,
): PrCloseoutBranchInput {
	const branch: PrCloseoutBranchInput = {
		clean: inspectGitClean(repoRoot, runner),
		worktreeRole: "unknown",
	};
	try {
		const headSha = runner("git", ["rev-parse", "HEAD"], {
			cwd: repoRoot,
		}).trim();
		if (headSha.length > 0) branch.headSha = headSha;
	} catch {
		// Head SHA is optional evidence; keep the rest of the branch snapshot.
	}
	try {
		const drift = runner(
			"git",
			["rev-list", "--left-right", "--count", "@{upstream}...HEAD"],
			{ cwd: repoRoot },
		)
			.trim()
			.split(/\s+/u)
			.map((value) => Number.parseInt(value, 10));
		if (Number.isInteger(drift[0])) branch.behindBy = drift[0] ?? null;
		if (Number.isInteger(drift[1])) branch.aheadBy = drift[1] ?? null;
		branch.behindBase = (branch.behindBy ?? 0) > 0;
	} catch {
		branch.behindBy = null;
		branch.aheadBy = null;
	}
	branch.worktreeRole =
		branch.clean === true && branch.behindBy === 0
			? "implementation"
			: "orientation";
	return branch;
}

function linearMutationAvailability(
	env: NodeJS.ProcessEnv,
): NonNullable<PrCloseoutInput["linearMutation"]> {
	return env.LINEAR_API_KEY?.trim() ? "available" : "blocked";
}

function isPlaceholderBodyField(value: string): boolean {
	const trimmed = value.trim();
	const normalized = trimmed.replace(/\u0060/gu, "");
	const templatePrompts = [
		/^list Codex(?: thread\/session|-?session-collector\/harness session) IDs\b/iu,
		/^list CI(?: workflow\/job URLs|, harness, eval,)\b/iu,
		/^map the AI session or trace reference to the work it supports\b/iu,
		/^pending (?:completion|confirmation)\b/iu,
	];
	if (templatePrompts.some((pattern) => pattern.test(normalized))) return true;
	const angleMatch = /^<([^>]+)>\s*$/u.exec(trimmed);
	if (!angleMatch) return false;
	return !/^[a-z][a-z0-9+.-]*:/iu.test(angleMatch[1]?.trim() ?? "");
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

function rollbackFromBody(
	body: string | null | undefined,
): PrCloseoutRollbackInput | undefined {
	const rollback =
		bodyField(body, "Rollback") ?? bodyField(body, "Risk and rollback plan");
	if (!rollback) return undefined;
	if (/^(?:n\.?a\.?|not applicable|none required)\b/iu.test(rollback)) {
		return { notApplicable: true, evidenceRef: "pr-body:rollback" };
	}
	return { path: rollback, evidenceRef: "pr-body:rollback" };
}

function inspectLiveTools(
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
	options: PrCloseoutCLIOptions & { prNumber: number },
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
				String(options.prNumber),
				"--json",
				"number,title,state,isDraft,mergeStateStatus,url,headRefOid,headRefName,baseRefName,reviewDecision,body",
			],
			{ cwd: options.repoRoot, env },
		);
		return normalizeGhPr(
			parseJsonObject(prRaw, "gh pr view"),
			options.prNumber,
		);
	} catch (error) {
		tools.push({
			name: "github_cli",
			available: false,
			ref: `command:gh pr view ${String(options.prNumber)} --json number,title,state,isDraft,mergeStateStatus,url,headRefOid,headRefName,baseRefName,reviewDecision,body`,
			status: "blocked",
			failureClass: `pr_view_unreadable:${sanitizeError(error)}`,
		});
		return {
			number: options.prNumber,
			state: null,
			isDraft: null,
			mergeStateStatus: null,
			body: null,
		};
	}
}

function fetchChecks(
	options: PrCloseoutCLIOptions & { prNumber: number },
	env: NodeJS.ProcessEnv,
	runner: CommandRunner,
	tools: PrCloseoutToolInput[],
	pullRequest: PrCloseoutPullRequestInput,
): PrCloseoutCheckInput[] {
	const applyHeadProof = (checksRaw: string): PrCloseoutCheckInput[] => {
		const checks = normalizeGhChecks(JSON.parse(checksRaw) as unknown);
		return applyCheckHeadProof(
			checks,
			fetchCheckHeadProof(
				options,
				env,
				runner,
				tools,
				checks,
				pullRequest.headSha,
			),
		);
	};
	try {
		const checksRaw = runner(
			"gh",
			[
				"pr",
				"checks",
				String(options.prNumber),
				"--required",
				"--json",
				"name,state,link",
			],
			{ cwd: options.repoRoot, env },
		);
		return applyHeadProof(checksRaw);
	} catch (error) {
		const checksRaw = commandErrorStdout(error);
		if (checksRaw) {
			try {
				return applyHeadProof(checksRaw);
			} catch {
				// Preserve the original command failure below when stdout is not valid check evidence.
			}
		}
		tools.push({
			name: "github_cli",
			available: false,
			ref: `command:gh pr checks ${String(options.prNumber)} --required --json name,state,link`,
			status: "blocked",
			failureClass: `pr_checks_unreadable:${sanitizeError(error)}`,
		});
		return [];
	}
}

function commandErrorStdout(error: unknown): string | null {
	if (!error || typeof error !== "object") return null;
	const stdout = (error as { stdout?: unknown }).stdout;
	if (typeof stdout === "string" && stdout.trim().length > 0) {
		return stdout.trim();
	}
	if (stdout instanceof Buffer && stdout.length > 0) {
		return stdout.toString("utf8").trim();
	}
	return null;
}

/** Builds live PR closeout input from local command and GitHub evidence. */
export function buildLivePrCloseoutInput(
	options: PrCloseoutCLIOptions,
	runner: CommandRunner,
): PrCloseoutInput {
	if (options.prNumber === undefined) {
		throw new Error("--pr is required for live closeout input");
	}
	const envLoad = loadPrCloseoutEnvFile(options.envFilePath);
	const liveOptions = { ...options, prNumber: options.prNumber };
	const tools: PrCloseoutToolInput[] = [
		envLoad.tool,
		...inspectLiveTools(options, envLoad.env, runner),
	];
	const pullRequest = fetchPullRequest(liveOptions, envLoad.env, runner, tools);
	const checks = fetchChecks(
		liveOptions,
		envLoad.env,
		runner,
		tools,
		pullRequest,
	);
	const reviewThreads = fetchReviewThreads(options, envLoad.env, runner, tools);
	const rollback = rollbackFromBody(pullRequest.body);
	return {
		pullRequest,
		branch: inspectGitBranch(options.repoRoot, runner),
		checks,
		reviewThreads,
		traceability: traceabilityFromBody(pullRequest.body),
		...(rollback ? { rollback } : {}),
		tools,
		linearMutation: linearMutationAvailability(envLoad.env),
		releaseReadinessImpact: "unknown",
	};
}
