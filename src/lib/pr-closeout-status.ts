import type {
	PrCloseoutBlocker,
	PrCloseoutCheckInput,
	PrCloseoutNextAction,
	PrCloseoutStatus,
} from "./pr-closeout-types.js";

/** Normalize check and pull request statuses for closeout comparisons. */
export function normalizeStatus(value: string | null | undefined): string {
	return (value ?? "").trim().toUpperCase();
}

/** Determine whether a check status should count as passing closeout evidence. */
export function isPassingCheck(check: PrCloseoutCheckInput): boolean {
	const status = normalizeStatus(check.conclusion ?? check.state);
	return ["SUCCESS", "PASSED", "PASS", "NEUTRAL", "SKIPPED"].includes(status);
}

/** Determine whether a check status should count as failed closeout evidence. */
export function isFailedCheck(check: PrCloseoutCheckInput): boolean {
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

/** Determine whether a check status should count as pending closeout evidence. */
export function isPendingCheck(check: PrCloseoutCheckInput): boolean {
	const status = normalizeStatus(check.conclusion ?? check.state);
	return ["PENDING", "QUEUED", "IN_PROGRESS", "EXPECTED", "WAITING"].includes(
		status,
	);
}

/** Summarize normalized check evidence into passed, failed, pending, and unknown counts. */
export function summarizeChecks(checks: readonly PrCloseoutCheckInput[]): {
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

/** Detect whether a PR body contains a Refs/Closes Linear issue reference. */
export function hasLinearReference(body: string | null | undefined): boolean {
	return /\b(?:Refs|Closes)\s+[A-Z][A-Z0-9]+-\d+\b/u.test(body ?? "");
}

/** Derive the closeout report status and next action from the collected blockers. */
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
