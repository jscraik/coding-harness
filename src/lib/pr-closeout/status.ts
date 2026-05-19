import type {
	PrCloseoutBlocker,
	PrCloseoutNextAction,
	PrCloseoutStatus,
} from "../pr-closeout.js";

/** Derive the operator-facing closeout status from verifier blockers. */
export function deriveNextAction(blockers: readonly PrCloseoutBlocker[]): {
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
				blocker.kind !== "closeout_claim" &&
				blocker.conflict === true,
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
				(blocker.surface === "worktree" || blocker.surface === "branch") &&
				blocker.kind !== "closeout_claim",
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
			(blocker) => blocker.classification === "needs_jamie_decision",
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
