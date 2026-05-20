import type {
	PrCloseoutBlocker,
	PrCloseoutNextAction,
	PrCloseoutStatus,
} from "./types.js";

function isBranchOrWorktreeStateBlocker(blocker: PrCloseoutBlocker): boolean {
	return (
		(blocker.surface === "worktree" || blocker.surface === "branch") &&
		blocker.kind !== "closeout_claim"
	);
}

function hasMergeConflict(blocker: PrCloseoutBlocker): boolean {
	return isBranchOrWorktreeStateBlocker(blocker) && blocker.conflict === true;
}

function needsJamieDecision(blocker: PrCloseoutBlocker): boolean {
	return blocker.classification === "needs_jamie_decision";
}

function isBlockedExternalTool(blocker: PrCloseoutBlocker): boolean {
	return blocker.surface === "tool" && !blocker.fixableByCodex;
}

function isWaitingCheck(blocker: PrCloseoutBlocker): boolean {
	return blocker.surface === "checks" && !blocker.fixableByCodex;
}

/** Derive the operator-facing closeout status from verifier blockers. */
export function deriveNextAction(blockers: readonly PrCloseoutBlocker[]): {
	status: PrCloseoutStatus;
	nextAction: PrCloseoutNextAction;
	mergeable: boolean;
} {
	if (blockers.length === 0) {
		return { status: "ready", nextAction: "ready_to_merge", mergeable: true };
	}
	if (blockers.some(hasMergeConflict)) {
		return {
			status: "blocked",
			nextAction: "resolve_conflicts",
			mergeable: false,
		};
	}
	if (blockers.some(isBranchOrWorktreeStateBlocker)) {
		return {
			status: "cleanup_required",
			nextAction: "cleanup_before_continue",
			mergeable: false,
		};
	}
	if (blockers.some(needsJamieDecision)) {
		return {
			status: "needs_jamie",
			nextAction: "needs_jamie_decision",
			mergeable: false,
		};
	}
	if (blockers.some(isBlockedExternalTool)) {
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
	if (blockers.some(isWaitingCheck)) {
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
