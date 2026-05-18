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

/** Collect blockers caused by dirty, unpushed, conflicted, or stale branch state. */
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

/** Collect blockers caused by pull request state, draft status, mergeability, or missing Linear references. */
export function collectPullRequestBlockers(
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

/** Collect blockers from failed or pending required check evidence. */
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

/** Collect blockers from unresolved or unobserved pull request review-thread evidence. */
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

/** Collect blockers for missing AI session or traceability evidence. */
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

/** Collect blockers for required closeout tools that are missing or unusable. */
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
