import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import {
	type HePhaseExit,
	validateHePhaseExit,
} from "../decision/he-phase-exit.js";
import { sanitizeError } from "../input/sanitize.js";
import { LinearAPIError, LinearClient } from "../linear/client.js";
import { inspectRuntimeEvidenceBundle } from "./runtime-evidence-adapter.js";
import {
	RUNTIME_CARD_SCHEMA_VERSION,
	type RuntimeCard,
	type RuntimeCardArtifactState,
	type RuntimeCardLifecycleState,
	type RuntimeCardPhaseExitState,
	type RuntimeCardSource,
	validateRuntimeCard,
} from "./runtime-card.js";

const ACTIVE_ARTIFACTS_PATH = ".harness/active-artifacts.md";
const MARKDOWN_CODE_MARKER = String.fromCharCode(96);
const LIVE_PROVIDER_TIMEOUT_MS = 10_000;

/** Function used to run read-only git commands while building a local runtime card. */
export type RuntimeCardGitRunner = (
	args: readonly string[],
) => string | undefined;

/** Inputs for building a local runtime-card/v1 artifact. */
export interface LocalRuntimeCardOptions {
	/** Repository root to inspect. */
	repoRoot: string;
	/** Optional tracker key to prefer over branch or artifact-derived keys. */
	issueKey?: string;
	/** Optional HePhaseExit/v1 artifact to collapse into the runtime card. */
	phaseExitPath?: string;
	/** Optional normalized runtime evidence bundle from session or CI collectors. */
	evidenceBundle?: unknown;
	/** Clock override for deterministic tests. */
	now?: Date;
	/** Optional git runner override for deterministic tests. */
	git?: RuntimeCardGitRunner;
}

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

/** Inputs for building a local runtime card with optional live provider evidence. */
export interface LiveRuntimeCardOptions extends LocalRuntimeCardOptions {
	/** Optional live provider override for deterministic tests. */
	liveProvider?: RuntimeCardLiveProvider;
	/** Environment override used by the default provider. */
	env?: NodeJS.ProcessEnv;
}

interface GitSnapshot {
	branchName: string | null;
	clean: boolean | null;
	ref: string | null;
	source: RuntimeCardSource;
}

interface ArtifactSnapshot {
	issueKey: string | null;
	artifacts: RuntimeCardArtifactState;
	source: RuntimeCardSource;
	blockers: string[];
}

interface PhaseExitSnapshot {
	phaseExit: RuntimeCardPhaseExitState;
	source?: RuntimeCardSource;
	blockers: string[];
}

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

function defaultGitRunner(repoRoot: string): RuntimeCardGitRunner {
	return (args) => {
		try {
			return execFileSync("git", [...args], {
				cwd: repoRoot,
				encoding: "utf8",
				stdio: ["ignore", "pipe", "ignore"],
			}).trim();
		} catch {
			return undefined;
		}
	};
}

function defaultGitHubPrSnapshot(
	repoRoot: string,
	branchName: string | null,
): GitHubLiveSnapshot {
	if (!branchName) {
		return {
			pullRequest: {
				number: null,
				state: null,
				isDraft: null,
				mergeStateStatus: null,
				url: null,
			},
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
		return {
			pullRequest,
			source: {
				kind: "pr",
				ref: "command:gh pr view --json number,state,isDraft,mergeStateStatus,url",
				freshness: "current",
				status: "usable",
				failureClass: null,
			},
			blockers,
		};
	} catch (error) {
		return {
			pullRequest: {
				number: null,
				state: null,
				isDraft: null,
				mergeStateStatus: null,
				url: null,
			},
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
		const issue = issues.find((candidate) => candidate.identifier === issueKey);
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

async function defaultLiveProvider(
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

function detectIssueKey(
	...values: Array<string | null | undefined>
): string | null {
	for (const value of values) {
		const match = value?.match(/\b[A-Z][A-Z0-9]+-\d+\b/iu);
		if (match) return match[0].toUpperCase();
	}
	return null;
}

function inspectGit(repoRoot: string, git?: RuntimeCardGitRunner): GitSnapshot {
	const runGit = git ?? defaultGitRunner(repoRoot);
	const branchName = runGit(["branch", "--show-current"]) ?? null;
	const ref = runGit(["rev-parse", "HEAD"]) ?? null;
	const status = runGit(["status", "--porcelain"]);
	const gitUsable = branchName !== null || ref !== null || status !== undefined;
	return {
		branchName,
		clean: status === undefined ? null : status.length === 0,
		ref,
		source: {
			kind: "git",
			ref: "command:git status --porcelain",
			freshness: gitUsable ? "current" : "unknown",
			status: gitUsable ? "usable" : "blocked",
			failureClass: gitUsable ? null : "git_unavailable",
		},
	};
}

function hasCodePath(line: string, path: string): boolean {
	return line.includes(MARKDOWN_CODE_MARKER + path);
}

function extractCodePath(line: string, prefix: string): string | null {
	const expression = new RegExp(
		`${MARKDOWN_CODE_MARKER}([^${MARKDOWN_CODE_MARKER}]+)${MARKDOWN_CODE_MARKER}`,
		"gu",
	);
	const matches = line.matchAll(expression);
	for (const match of matches) {
		const path = match[1];
		if (path?.startsWith(prefix)) return path;
	}
	return null;
}

function findArtifactLine(
	activeArtifacts: string,
	issueKey: string | null,
): string | null {
	const lines = activeArtifacts.split(/\r?\n/u);
	if (issueKey) {
		const issueLine = lines.find(
			(line) =>
				line.includes(`| ${issueKey} |`) &&
				line.includes(`${MARKDOWN_CODE_MARKER}.harness/`),
		);
		if (issueLine) return issueLine;
	}
	return (
		lines.find(
			(line) =>
				hasCodePath(line, ".harness/specs/") &&
				hasCodePath(line, ".harness/plan/"),
		) ?? null
	);
}

function inspectArtifacts(
	repoRoot: string,
	issueKey: string | null,
): ArtifactSnapshot {
	const activePath = join(repoRoot, ACTIVE_ARTIFACTS_PATH);
	if (!existsSync(activePath)) {
		return {
			issueKey,
			artifacts: {
				activeSpec: null,
				activePlan: null,
				status: "missing",
				staleRefs: [],
			},
			source: {
				kind: "artifact",
				ref: `path:${ACTIVE_ARTIFACTS_PATH}`,
				freshness: "missing",
				status: "empty",
				failureClass: "active_artifacts_missing",
			},
			blockers: [],
		};
	}

	let activeArtifacts: string;
	try {
		activeArtifacts = readFileSync(activePath, "utf8");
	} catch (error) {
		return {
			issueKey,
			artifacts: {
				activeSpec: null,
				activePlan: null,
				status: "unknown",
				staleRefs: [],
			},
			source: {
				kind: "artifact",
				ref: `path:${ACTIVE_ARTIFACTS_PATH}`,
				freshness: "unknown",
				status: "blocked",
				failureClass: `active_artifacts_unreadable:${sanitizeError(error)}`,
			},
			blockers: ["Active artifact index could not be read."],
		};
	}

	const line = findArtifactLine(activeArtifacts, issueKey);
	const activeSpec = line ? extractCodePath(line, ".harness/specs/") : null;
	const activePlan = line ? extractCodePath(line, ".harness/plan/") : null;
	const derivedIssueKey = detectIssueKey(issueKey, line);
	const staleRefs = [activeSpec, activePlan].filter(
		(path): path is string =>
			path !== null && !existsSync(join(repoRoot, path)),
	);
	const status =
		activeSpec === null && activePlan === null
			? "unknown"
			: staleRefs.length > 0
				? "stale"
				: "current";
	return {
		issueKey: derivedIssueKey,
		artifacts: {
			activeSpec,
			activePlan,
			status,
			staleRefs,
		},
		source: {
			kind: "artifact",
			ref: `path:${ACTIVE_ARTIFACTS_PATH}`,
			freshness: status === "current" ? "current" : "unknown",
			status: status === "current" ? "usable" : "invalid",
			failureClass: status === "current" ? null : "active_artifacts_unresolved",
		},
		blockers:
			status === "stale"
				? ["Active spec or plan references are stale or missing on disk."]
				: [],
	};
}

function resolveArtifactPath(repoRoot: string, artifactPath: string): string {
	return isAbsolute(artifactPath) ? artifactPath : join(repoRoot, artifactPath);
}

function collapsePhaseExit(result: HePhaseExit): RuntimeCardPhaseExitState {
	if (result.recommendation !== "continue") {
		return {
			status: result.blockers.length > 0 ? "blocked" : "fail",
			reason:
				result.blockers[0] ??
				"HE phase-exit recommendation blocks continuation.",
		};
	}
	if (!result.commitAllowed || !result.exitAllowed) {
		return {
			status: "blocked",
			reason: "HE phase-exit commit or exit readiness is false.",
		};
	}
	return {
		status: "pass",
		reason: result.warnings[0] ?? "Required phase-exit gates passed.",
	};
}

function inspectPhaseExit(
	repoRoot: string,
	phaseExitPath: string | undefined,
): PhaseExitSnapshot {
	if (!phaseExitPath) {
		return {
			phaseExit: {
				status: "not_run",
				reason: "No phase-exit artifact was supplied.",
			},
			blockers: [],
		};
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(
			readFileSync(resolveArtifactPath(repoRoot, phaseExitPath), "utf8"),
		);
	} catch (error) {
		return {
			phaseExit: {
				status: "blocked",
				reason:
					"Phase-exit artifact could not be read or parsed: " +
					sanitizeError(error),
			},
			source: {
				kind: "phase_exit",
				ref: `artifact:${phaseExitPath}`,
				freshness: "unknown",
				status: "invalid",
				failureClass: "phase_exit_artifact_invalid",
			},
			blockers: ["Phase-exit artifact could not be read or parsed."],
		};
	}

	const validation = validateHePhaseExit(parsed);
	if (!validation.valid) {
		return {
			phaseExit: {
				status: "blocked",
				reason: "Phase-exit artifact is not valid HePhaseExit/v1.",
			},
			source: {
				kind: "phase_exit",
				ref: `artifact:${phaseExitPath}`,
				freshness: "unknown",
				status: "invalid",
				failureClass: "phase_exit_artifact_invalid",
			},
			blockers: ["Phase-exit artifact is not valid HePhaseExit/v1."],
		};
	}

	const phaseExit = collapsePhaseExit(parsed as HePhaseExit);
	return {
		phaseExit,
		source: {
			kind: "phase_exit",
			ref: `artifact:${phaseExitPath}`,
			freshness: "current",
			status: phaseExit.status === "pass" ? "usable" : "blocked",
			failureClass: phaseExit.status === "pass" ? null : "phase_exit_blocks",
		},
		blockers:
			phaseExit.status === "pass"
				? []
				: [phaseExit.reason ?? "Phase-exit evidence blocks continuation."],
	};
}

function deriveLifecycle(args: {
	blockers: readonly string[];
	artifacts: RuntimeCardArtifactState;
	phaseExit: RuntimeCardPhaseExitState;
}): RuntimeCardLifecycleState {
	if (args.blockers.length > 0) return "blocked";
	if (args.phaseExit.status === "pass") return "locally_validated";
	if (args.artifacts.status === "current") return "active";
	if (args.artifacts.status === "stale") return "stale";
	return "unknown";
}

/**
 * Selects the next recommended safe action based on the card's blockers and phase-exit state.
 *
 * @param card - Object containing `blockers` and `phaseExit` used to determine the action
 * @returns A concise instruction: the first blocker message if any blockers exist; if not and the phase-exit status is `"not_run"`, guidance to run focused validation and provide a HePhaseExit/v1 artifact; otherwise the default `harness next` command instruction.
 */
function nextSafeAction(
	card: Pick<RuntimeCard, "blockers" | "phaseExit">,
): string {
	if (card.blockers.length > 0) return card.blockers[0] ?? "Resolve blockers.";
	if (card.phaseExit.status === "not_run") {
		return "Run focused validation and supply a HePhaseExit/v1 artifact before closeout.";
	}
	return "Run harness next --json --runtime-card <runtime-card.json>.";
}

/**
 * Generate a validated runtime-card/v1 artifact from local repository state and an optional runtime evidence bundle.
 *
 * @param options - Configuration for card generation (repo root, optional preferred issue key, optional phase-exit artifact path, optional normalized evidence bundle, deterministic `now` override, and optional git runner override).
 * @returns The validated `RuntimeCard` describing the repository's local runtime state.
 * @throws Error - If the constructed runtime card fails schema validation.
 */
export function buildLocalRuntimeCard(
	options: LocalRuntimeCardOptions,
): RuntimeCard {
	const git = inspectGit(options.repoRoot, options.git);
	const evidence = inspectRuntimeEvidenceBundle(
		options.evidenceBundle,
		collapsePhaseExit,
	);
	const localIssueKey = detectIssueKey(options.issueKey, git.branchName);
	const artifacts = inspectArtifacts(
		options.repoRoot,
		localIssueKey ?? evidence.issueKey,
	);
	const phaseExit =
		options.phaseExitPath !== undefined
			? inspectPhaseExit(options.repoRoot, options.phaseExitPath)
			: (evidence.phaseExit ?? inspectPhaseExit(options.repoRoot, undefined));
	const issueKey = detectIssueKey(
		options.issueKey,
		artifacts.issueKey,
		git.branchName,
		evidence.issueKey,
	);
	const evidenceBlockers =
		options.phaseExitPath !== undefined && evidence.phaseExit !== undefined
			? []
			: evidence.blockers;
	const blockers = [
		...artifacts.blockers,
		...phaseExit.blockers,
		...evidenceBlockers,
	];
	const sources = [
		git.source,
		artifacts.source,
		...(phaseExit.source ? [phaseExit.source] : []),
		...evidence.sources,
	];
	const partial = {
		blockers,
		phaseExit: phaseExit.phaseExit,
	};
	const card: RuntimeCard = {
		schemaVersion: RUNTIME_CARD_SCHEMA_VERSION,
		generatedAt: (options.now ?? new Date()).toISOString(),
		issueKey,
		lifecycle: deriveLifecycle({
			blockers,
			artifacts: artifacts.artifacts,
			phaseExit: phaseExit.phaseExit,
		}),
		summary:
			blockers.length > 0
				? "Local runtime evidence has blockers."
				: "Local runtime evidence was assembled from available repo state.",
		nextSafeAction: nextSafeAction(partial),
		branch: {
			name: git.branchName,
			clean: git.clean,
			ref: git.ref,
		},
		pullRequest: {
			number: evidence.pullRequest?.number ?? null,
			state: evidence.pullRequest?.state ?? null,
			isDraft: evidence.pullRequest?.isDraft ?? null,
			mergeStateStatus: evidence.pullRequest?.mergeStateStatus ?? null,
			url: evidence.pullRequest?.url ?? null,
		},
		artifacts: artifacts.artifacts,
		linear: evidence.linear ?? {
			issueKey,
			freshness: issueKey ? "unknown" : "missing",
			status: null,
			statusType: null,
			url: null,
			actionRequired:
				"Live Linear state was not refreshed by local runtime-card generation.",
		},
		phaseExit: phaseExit.phaseExit,
		sources,
		blockers,
	};
	const validation = validateRuntimeCard(card);
	if (!validation.valid) {
		throw new Error(
			"generated runtime card failed validation: " +
				validation.errors.map((error) => error.code).join("; "),
		);
	}
	return card;
}

/** Build a runtime-card/v1 artifact from local evidence plus opt-in live provider state. */
export async function buildLiveRuntimeCard(
	options: LiveRuntimeCardOptions,
): Promise<RuntimeCard> {
	const base = buildLocalRuntimeCard(options);
	const provider =
		options.liveProvider ??
		((context: RuntimeCardLiveProviderContext) =>
			defaultLiveProvider(context, options.env ?? process.env));
	const live = await provider({
		repoRoot: options.repoRoot,
		branchName: base.branch.name,
		issueKey: base.issueKey,
	});
	const blockers = [...base.blockers, ...(live.blockers ?? [])];
	const card: RuntimeCard = {
		...base,
		pullRequest: live.pullRequest ?? base.pullRequest,
		linear: live.linear ?? base.linear,
		sources: [...base.sources, ...(live.sources ?? [])],
		blockers,
		lifecycle: deriveLifecycle({
			blockers,
			artifacts: base.artifacts,
			phaseExit: base.phaseExit,
		}),
		summary:
			blockers.length > 0
				? "Runtime evidence has blockers."
				: "Runtime evidence was assembled from local and live provider state.",
		nextSafeAction: nextSafeAction({
			blockers,
			phaseExit: base.phaseExit,
		}),
	};
	const validation = validateRuntimeCard(card);
	if (!validation.valid) {
		throw new Error(
			"generated runtime card failed validation: " +
				validation.errors.map((error) => error.code).join("; "),
		);
	}
	return card;
}
