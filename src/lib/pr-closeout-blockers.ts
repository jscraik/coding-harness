import type {
	PrCloseoutBlocker,
	PrCloseoutCheckInput,
	PrCloseoutDirtyPathInput,
	PrCloseoutInput,
	PrCloseoutPullRequestInput,
	PrCloseoutReviewThreadsInput,
	PrCloseoutToolInput,
} from "./pr-closeout-types.js";
import {
	hasLinearReference,
	isFailedCheck,
	isPendingCheck,
	normalizeStatus,
} from "./pr-closeout-status.js";

/** Append a blocker to the PR closeout blocker list. */
export function pushBlocker(
	blockers: PrCloseoutBlocker[],
	blocker: PrCloseoutBlocker,
): void {
	blockers.push(blocker);
}

/**
 * Collects PR closeout blockers related to local worktree and branch state.
 *
 * Adds blockers to `blockers` for:
 * - excluded dirty paths,
 * - a dirty local worktree,
 * - an unpushed branch,
 * - merge conflicts on the branch,
 * - the branch being behind its base.
 *
 * @param input - PR closeout input containing optional branch state flags (`clean`, `pushed`, `hasConflicts`, `behindBase`)
 * @param dirtyPathsExcluded - list of dirty paths that were explicitly excluded; when non-empty a worktree blocker is added and `ref` is set to the joined path list
 * @param blockers - destination array that will be appended with any constructed `PrCloseoutBlocker` entries
 */
export function collectWorktreeBlockers(
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
			ref: "branch.hasConflicts",
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

/**
 * Add blockers for pull request state, draft status, merge conflicts, and missing Linear references.
 *
 * @param pr - Pull request metadata used to evaluate state, draft flag, merge state, and body content
 * @param blockers - Array to append any detected `PrCloseoutBlocker` entries to
 */
export function collectPullRequestBlockers(
	pr: PrCloseoutPullRequestInput,
	blockers: PrCloseoutBlocker[],
): void {
	const normalizedState = normalizeStatus(pr.state);
	if (normalizedState === "") {
		pushBlocker(blockers, {
			surface: "pr",
			classification: "unknown",
			reason:
				"Pull request state is missing; closeout cannot prove the PR is open.",
			fixableByCodex: false,
		});
	} else if (normalizedState !== "OPEN") {
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
			ref: "mergeStateStatus:DIRTY",
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

/**
 * Collects blockers for failed or pending required check evidence.
 *
 * Appends a blocker for each failed check (classification `introduced`, `fixableByCodex: true`) and for each pending check (classification `external_service`, `fixableByCodex: false`). Each blocker `ref` is set to `check.url` when available, otherwise `check.name`.
 *
 * @param checks - Array of check evidence to evaluate
 * @param blockers - Array to which discovered blockers will be appended
 */
export function collectCheckBlockers(
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

/**
 * Add review-related blockers to `blockers` based on review-thread observability, unresolved thread count, and the PR's review decision.
 *
 * If `reviewThreads.unresolved` is `null`, adds an "unknown" review blocker and returns. If `reviewThreads.unresolved` is greater than zero,
 * adds a blocker describing the unresolved thread count; the blocker classification is `needs_jamie_decision` when `reviewThreads.needsHuman` is greater than zero,
 * otherwise `introduced`. Additionally, if the PR's `reviewDecision` normalizes to `CHANGES_REQUESTED`, adds an `introduced` review blocker.
 *
 * @param pr - Pull request input whose `reviewDecision` is inspected
 * @param reviewThreads - Observed review-thread evidence; `unresolved` may be `null` or a number, and `needsHuman` indicates threads requiring human attention
 * @param blockers - Array to append generated `PrCloseoutBlocker` entries to
 */
export function collectReviewBlockers(
	pr: PrCloseoutPullRequestInput,
	reviewThreads: PrCloseoutReviewThreadsInput,
	blockers: PrCloseoutBlocker[],
): void {
	if (reviewThreads.unresolved === null) {
		pushBlocker(blockers, {
			surface: "review",
			classification: "unknown",
			reason:
				"Review thread state is unobserved; live GitHub reviewThreads evidence is required before PR closeout.",
			fixableByCodex: true,
			ref: "github:reviewThreads",
		});
		return;
	}
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

/**
 * Adds a traceability blocker when AI session or traceability evidence is incomplete.
 *
 * @param traceabilityComplete - Whether traceability evidence (AI session references) is complete.
 * @param blockers - Array to which the blocker will be appended.
 */
export function collectTraceabilityBlocker(
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

/**
 * Add blockers for tools whose status is "blocked".
 *
 * For each tool with `status === "blocked"`, appends a `PrCloseoutBlocker` to `blockers`
 * with `surface: "tool"`, `classification: "external_service"`, `reason` formatted as
 * "`<name> is blocked: <failureClass or \"unknown\">`", `fixableByCodex: false`, and `ref` set
 * to the tool's `ref`.
 *
 * @param tools - Tool entries to evaluate; only entries with `status === "blocked"` produce blockers
 * @param blockers - Array to which generated blockers will be appended
 */
export function collectToolBlockers(
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
