/** Schema version for the first read-only pull request closeout evidence report. */
export const PR_CLOSEOUT_SCHEMA_VERSION = "pr-closeout/v1" as const;

/** Closeout action recommended by the PR evidence classifier. */
export type PrCloseoutNextAction =
	| "ready_to_merge"
	| "codex_can_fix_now"
	| "wait_for_external_check"
	| "resolve_conflicts"
	| "needs_jamie_decision"
	| "cleanup_before_continue";

/** Collapsed closeout status for one pull request. */
export type PrCloseoutStatus =
	| "ready"
	| "fixable"
	| "waiting"
	| "blocked"
	| "needs_jamie"
	| "cleanup_required";

/** Ownership classification for a closeout blocker. */
export type PrCloseoutBlockerClassification =
	| "introduced"
	| "pre_existing"
	| "unrelated_dirty_worktree"
	| "external_service"
	| "needs_jamie_decision"
	| "unknown";

/** Normalized pull request state consumed by the closeout classifier. */
export interface PrCloseoutPullRequestInput {
	number: number;
	title?: string | null;
	state?: string | null;
	isDraft?: boolean | null;
	mergeStateStatus?: string | null;
	url?: string | null;
	headRefName?: string | null;
	baseRefName?: string | null;
	reviewDecision?: string | null;
	body?: string | null;
}

/** Normalized check state consumed by the closeout classifier. */
export interface PrCloseoutCheckInput {
	name: string;
	state?: string | null;
	conclusion?: string | null;
	required?: boolean | null;
	url?: string | null;
	source?: "github" | "circleci" | "coderabbit" | "other" | null;
}

/** Local branch/worktree state consumed by the closeout classifier. */
export interface PrCloseoutBranchInput {
	clean?: boolean | null;
	pushed?: boolean | null;
	behindBase?: boolean | null;
	hasConflicts?: boolean | null;
}

/** Review-thread counts consumed by the closeout classifier. */
export interface PrCloseoutReviewThreadsInput {
	unresolved: number | null;
	needsHuman?: number | null;
	autofixable?: number | null;
}

/** Session and trace references expected in professional PR handoff evidence. */
export interface PrCloseoutTraceabilityInput {
	sessionIds?: string[];
	traceIds?: string[];
	aiSessionTraceability?: string | null;
}

/** Dirty path classification supplied by a caller that has inspected the worktree. */
export interface PrCloseoutDirtyPathInput {
	path: string;
	classification:
		| "intended_source"
		| "generated_artifact"
		| "validation_output"
		| "temp_reference"
		| "unrelated_local_noise";
}

/** Tool availability and command evidence captured during live closeout inspection. */
export interface PrCloseoutToolInput {
	name:
		| "codex_env"
		| "github_cli"
		| "circleci_cli"
		| "coderabbit_cli"
		| "snyk_cli";
	available: boolean;
	ref: string;
	status: "usable" | "blocked" | "missing";
	failureClass: string | null;
}

/** Complete normalized input for one PR closeout classification pass. */
export interface PrCloseoutInput {
	pullRequest: PrCloseoutPullRequestInput;
	branch?: PrCloseoutBranchInput;
	checks?: PrCloseoutCheckInput[];
	reviewThreads?: PrCloseoutReviewThreadsInput;
	traceability?: PrCloseoutTraceabilityInput;
	dirtyPaths?: PrCloseoutDirtyPathInput[];
	tools?: PrCloseoutToolInput[];
}

/** One blocker that prevents the PR from being safely closed out. */
export interface PrCloseoutBlocker {
	surface:
		| "pr"
		| "branch"
		| "checks"
		| "review"
		| "linear"
		| "traceability"
		| "worktree"
		| "tool";
	classification: PrCloseoutBlockerClassification;
	reason: string;
	fixableByCodex: boolean;
	ref?: string;
}

/** Read-only closeout evidence report for one pull request. */
export interface PrCloseoutReport {
	schemaVersion: typeof PR_CLOSEOUT_SCHEMA_VERSION;
	generatedAt: string;
	pr: number;
	url: string | null;
	status: PrCloseoutStatus;
	mergeable: boolean;
	nextAction: PrCloseoutNextAction;
	blockers: PrCloseoutBlocker[];
	checks: {
		total: number;
		failed: number;
		pending: number;
		passed: number;
		unknown: number;
	};
	reviewThreads: {
		unresolved: number | null;
		needsHuman: number | null;
		autofixable: number | null;
	};
	traceability: {
		sessionIds: string[];
		traceIds: string[];
		aiSessionTraceability: string | null;
		complete: boolean;
	};
	tools: PrCloseoutToolInput[];
	dirtyPathsExcluded: PrCloseoutDirtyPathInput[];
}

function normalizeStatus(value: string | null | undefined): string {
	return (value ?? "").trim().toUpperCase();
}

function isPassingCheck(check: PrCloseoutCheckInput): boolean {
	const status = normalizeStatus(check.conclusion ?? check.state);
	return ["SUCCESS", "PASSED", "PASS", "NEUTRAL", "SKIPPED"].includes(status);
}

function isFailedCheck(check: PrCloseoutCheckInput): boolean {
	const status = normalizeStatus(check.conclusion ?? check.state);
	return [
		"FAILURE",
		"FAILED",
		"FAIL",
		"ERROR",
		"CANCELLED",
		"TIMED_OUT",
	].includes(status);
}

function isPendingCheck(check: PrCloseoutCheckInput): boolean {
	const status = normalizeStatus(check.conclusion ?? check.state);
	return ["PENDING", "QUEUED", "IN_PROGRESS", "EXPECTED", "WAITING"].includes(
		status,
	);
}

function summarizeChecks(checks: readonly PrCloseoutCheckInput[]): {
	total: number;
	failed: number;
	pending: number;
	passed: number;
	unknown: number;
} {
	let failed = 0;
	let pending = 0;
	let passed = 0;
	let unknown = 0;
	for (const check of checks) {
		if (isFailedCheck(check)) failed += 1;
		else if (isPendingCheck(check)) pending += 1;
		else if (isPassingCheck(check)) passed += 1;
		else unknown += 1;
	}
	return { total: checks.length, failed, pending, passed, unknown };
}

function hasLinearReference(body: string | null | undefined): boolean {
	return /\b(?:Refs|Closes)\s+[A-Z][A-Z0-9]+-\d+\b/u.test(body ?? "");
}

function deriveNextAction(blockers: readonly PrCloseoutBlocker[]): {
	status: PrCloseoutStatus;
	nextAction: PrCloseoutNextAction;
	mergeable: boolean;
} {
	if (blockers.length === 0) {
		return { status: "ready", nextAction: "ready_to_merge", mergeable: true };
	}
	if (
		blockers.some(
			(blocker) =>
				(blocker.surface === "worktree" || blocker.surface === "branch") &&
				blocker.reason.toLowerCase().includes("conflict"),
		)
	) {
		return {
			status: "blocked",
			nextAction: "resolve_conflicts",
			mergeable: false,
		};
	}
	if (
		blockers.some(
			(blocker) =>
				blocker.surface === "worktree" || blocker.surface === "branch",
		)
	) {
		return {
			status: "cleanup_required",
			nextAction: "cleanup_before_continue",
			mergeable: false,
		};
	}
	if (
		blockers.some(
			(blocker) =>
				blocker.surface === "pr" &&
				blocker.classification === "needs_jamie_decision",
		)
	) {
		return {
			status: "needs_jamie",
			nextAction: "needs_jamie_decision",
			mergeable: false,
		};
	}
	if (
		blockers.some(
			(blocker) => blocker.surface === "tool" && !blocker.fixableByCodex,
		)
	) {
		return {
			status: "blocked",
			nextAction: "needs_jamie_decision",
			mergeable: false,
		};
	}
	if (blockers.some((blocker) => blocker.fixableByCodex)) {
		return {
			status: "fixable",
			nextAction: "codex_can_fix_now",
			mergeable: false,
		};
	}
	if (
		blockers.some(
			(blocker) => blocker.surface === "checks" && !blocker.fixableByCodex,
		)
	) {
		return {
			status: "waiting",
			nextAction: "wait_for_external_check",
			mergeable: false,
		};
	}
	return {
		status: "blocked",
		nextAction: "needs_jamie_decision",
		mergeable: false,
	};
}

function pushBlocker(
	blockers: PrCloseoutBlocker[],
	blocker: PrCloseoutBlocker,
): void {
	blockers.push(blocker);
}

function collectWorktreeBlockers(
	input: PrCloseoutInput,
	dirtyPathsExcluded: readonly PrCloseoutDirtyPathInput[],
	blockers: PrCloseoutBlocker[],
): void {
	if (dirtyPathsExcluded.length > 0) {
		pushBlocker(blockers, {
			surface: "worktree",
			classification: "unrelated_dirty_worktree",
			reason:
				"Unrelated dirty worktree paths must be excluded before PR closeout.",
			fixableByCodex: false,
			ref: dirtyPathsExcluded.map((path) => path.path).join(","),
		});
	}
	if (input.branch?.clean === false) {
		pushBlocker(blockers, {
			surface: "worktree",
			classification: "unknown",
			reason: "Local worktree is dirty; classify paths before PR closeout.",
			fixableByCodex: true,
		});
	}
	if (input.branch?.pushed === false) {
		pushBlocker(blockers, {
			surface: "branch",
			classification: "introduced",
			reason: "Branch has not been pushed to the remote PR head.",
			fixableByCodex: true,
		});
	}
	if (input.branch?.hasConflicts === true) {
		pushBlocker(blockers, {
			surface: "branch",
			classification: "introduced",
			reason: "Branch has merge conflicts.",
			fixableByCodex: true,
		});
	}
	if (input.branch?.behindBase === true) {
		pushBlocker(blockers, {
			surface: "branch",
			classification: "introduced",
			reason: "Branch is behind its base branch.",
			fixableByCodex: true,
		});
	}
}

function collectPullRequestBlockers(
	pr: PrCloseoutPullRequestInput,
	blockers: PrCloseoutBlocker[],
): void {
	if (
		normalizeStatus(pr.state) !== "" &&
		normalizeStatus(pr.state) !== "OPEN"
	) {
		pushBlocker(blockers, {
			surface: "pr",
			classification: "needs_jamie_decision",
			reason: `Pull request state is ${String(pr.state)}; closeout cannot proceed as an open PR.`,
			fixableByCodex: false,
		});
	}
	if (pr.isDraft === true) {
		pushBlocker(blockers, {
			surface: "pr",
			classification: "needs_jamie_decision",
			reason: "Pull request is still draft.",
			fixableByCodex: false,
		});
	}
	if (normalizeStatus(pr.mergeStateStatus) === "DIRTY") {
		pushBlocker(blockers, {
			surface: "branch",
			classification: "introduced",
			reason: "Pull request merge state reports conflicts.",
			fixableByCodex: true,
		});
	}
	if (!hasLinearReference(pr.body)) {
		pushBlocker(blockers, {
			surface: "linear",
			classification: "introduced",
			reason:
				"Pull request body is missing a Refs/Closes Linear issue reference.",
			fixableByCodex: true,
		});
	}
}

function collectCheckBlockers(
	checks: readonly PrCloseoutCheckInput[],
	blockers: PrCloseoutBlocker[],
): void {
	for (const check of checks) {
		if (isFailedCheck(check)) {
			pushBlocker(blockers, {
				surface: "checks",
				classification: "introduced",
				reason: `Check failed: ${check.name}.`,
				fixableByCodex: true,
				ref: check.url ?? check.name,
			});
		} else if (isPendingCheck(check)) {
			pushBlocker(blockers, {
				surface: "checks",
				classification: "external_service",
				reason: `Check is still pending: ${check.name}.`,
				fixableByCodex: false,
				ref: check.url ?? check.name,
			});
		}
	}
}

function collectReviewBlockers(
	pr: PrCloseoutPullRequestInput,
	reviewThreads: PrCloseoutReviewThreadsInput,
	blockers: PrCloseoutBlocker[],
): void {
	if (reviewThreads.unresolved !== null && reviewThreads.unresolved > 0) {
		const needsHuman = (reviewThreads.needsHuman ?? 0) > 0;
		pushBlocker(blockers, {
			surface: "review",
			classification: needsHuman ? "needs_jamie_decision" : "introduced",
			reason: `${String(reviewThreads.unresolved)} review thread(s) are unresolved.`,
			fixableByCodex: !needsHuman,
		});
	}
	if (normalizeStatus(pr.reviewDecision) === "CHANGES_REQUESTED") {
		pushBlocker(blockers, {
			surface: "review",
			classification: "introduced",
			reason: "Pull request review decision is CHANGES_REQUESTED.",
			fixableByCodex: true,
		});
	}
}

function collectTraceabilityBlocker(
	traceabilityComplete: boolean,
	blockers: PrCloseoutBlocker[],
): void {
	if (traceabilityComplete) return;
	pushBlocker(blockers, {
		surface: "traceability",
		classification: "introduced",
		reason:
			"PR evidence is missing complete AI session / traceability references.",
		fixableByCodex: true,
	});
}

function collectToolBlockers(
	tools: readonly PrCloseoutToolInput[],
	blockers: PrCloseoutBlocker[],
): void {
	for (const tool of tools) {
		if (tool.status !== "blocked") continue;
		pushBlocker(blockers, {
			surface: "tool",
			classification: "external_service",
			reason: `${tool.name} is blocked: ${String(tool.failureClass ?? "unknown")}`,
			fixableByCodex: false,
			ref: tool.ref,
		});
	}
}

/** Build a read-only PR closeout evidence report from normalized PR closeout inputs. */
export function buildPrCloseoutReport(
	input: PrCloseoutInput,
	options: { now?: Date } = {},
): PrCloseoutReport {
	const blockers: PrCloseoutBlocker[] = [];
	const pr = input.pullRequest;
	const checks = input.checks ?? [];
	const reviewThreads = input.reviewThreads ?? { unresolved: null };
	const traceability = input.traceability ?? {};
	const dirtyPaths = input.dirtyPaths ?? [];
	const tools = input.tools ?? [];
	const dirtyPathsExcluded = dirtyPaths.filter(
		(path) => path.classification === "unrelated_local_noise",
	);

	const sessionIds = traceability.sessionIds ?? [];
	const traceIds = traceability.traceIds ?? [];
	const aiSessionTraceability = traceability.aiSessionTraceability ?? null;
	const traceabilityComplete =
		sessionIds.length > 0 &&
		traceIds.length > 0 &&
		Boolean(aiSessionTraceability?.trim());
	collectWorktreeBlockers(input, dirtyPathsExcluded, blockers);
	collectPullRequestBlockers(pr, blockers);
	collectCheckBlockers(checks, blockers);
	collectReviewBlockers(pr, reviewThreads, blockers);
	collectTraceabilityBlocker(traceabilityComplete, blockers);
	collectToolBlockers(tools, blockers);

	const decision = deriveNextAction(blockers);
	return {
		schemaVersion: PR_CLOSEOUT_SCHEMA_VERSION,
		generatedAt: (options.now ?? new Date()).toISOString(),
		pr: pr.number,
		url: pr.url ?? null,
		status: decision.status,
		mergeable: decision.mergeable,
		nextAction: decision.nextAction,
		blockers,
		checks: summarizeChecks(checks),
		reviewThreads: {
			unresolved: reviewThreads.unresolved,
			needsHuman: reviewThreads.needsHuman ?? null,
			autofixable: reviewThreads.autofixable ?? null,
		},
		traceability: {
			sessionIds,
			traceIds,
			aiSessionTraceability,
			complete: traceabilityComplete,
		},
		tools,
		dirtyPathsExcluded,
	};
}
