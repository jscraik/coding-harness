import type {
	PrCloseoutBlocker,
	PrCloseoutCheckInput,
	PrCloseoutNextAction,
	PrCloseoutStatus,
} from "./pr-closeout-types.js";

/**
 * Normalize a status string for closeout comparisons.
 *
 * @param value - The status value to normalize; may be `null` or `undefined`
 * @returns The status trimmed and converted to uppercase, or the empty string if `value` is `null`, `undefined`, or contains only whitespace
 */
export function normalizeStatus(value: string | null | undefined): string {
	return (value ?? "").trim().toUpperCase();
}

/**
 * Determines whether a check's conclusion or state indicates it counts as passing closeout evidence.
 *
 * @param check - Check input whose `conclusion` or `state` will be normalized and evaluated.
 * @returns `true` if the normalized status is one of `SUCCESS`, `PASSED`, `PASS`, `NEUTRAL`, or `SKIPPED`, `false` otherwise.
 */
export function isPassingCheck(check: PrCloseoutCheckInput): boolean {
	const status = normalizeStatus(check.conclusion ?? check.state);
	return ["SUCCESS", "PASSED", "PASS", "NEUTRAL", "SKIPPED"].includes(status);
}

/**
 * Determines whether a check counts as failed closeout evidence.
 *
 * @param check - The check input to evaluate.
 * @returns `true` if the check's conclusion or state is one of `FAILURE`, `FAILED`, `FAIL`, `ERROR`, `CANCELLED`, or `TIMED_OUT`, `false` otherwise.
 */
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

/**
 * Determines whether a check's conclusion or state indicates a pending status.
 *
 * @param check - The check whose `conclusion` or `state` will be evaluated
 * @returns `true` if the check's status is one of `PENDING`, `QUEUED`, `IN_PROGRESS`, `EXPECTED`, or `WAITING`, `false` otherwise.
 */
export function isPendingCheck(check: PrCloseoutCheckInput): boolean {
	const status = normalizeStatus(check.conclusion ?? check.state);
	return ["PENDING", "QUEUED", "IN_PROGRESS", "EXPECTED", "WAITING"].includes(
		status,
	);
}

/**
 * Aggregate an array of check inputs into counts for total, failed, pending, passed, and unknown checks.
 *
 * @param checks - The list of checks to summarize
 * @returns An object with `total`, `failed`, `pending`, `passed`, and `unknown` numeric counts
 */
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

/**
 * Determines whether a pull request body references a Linear issue using `Refs` or `Closes`.
 *
 * Matches occurrences of `Refs` or `Closes` followed by an uppercase project key and numeric issue
 * identifier (for example, `ABC-123`).
 *
 * @param body - The pull request body to scan; `null` or `undefined` is treated as an empty string.
 * @returns `true` if a Linear reference is found, `false` otherwise.
 */
export function hasLinearReference(body: string | null | undefined): boolean {
	return /\b(?:Refs|Closes)\s+[A-Z][A-Z0-9]+-\d+\b/u.test(body ?? "");
}

/**
 * Derives the PR closeout status, recommended next action, and whether the PR is mergeable from an ordered list of blockers.
 *
 * @param blockers - Blockers evaluated in priority order to determine the closeout outcome.
 * @returns An object with:
 *  - `status` — one of `"ready"`, `"blocked"`, `"cleanup_required"`, `"needs_jamie"`, `"fixable"`, or `"waiting"`.
 *  - `nextAction` — one of `"ready_to_merge"`, `"resolve_conflicts"`, `"cleanup_before_continue"`, `"needs_jamie_decision"`, `"codex_can_fix_now"`, or `"wait_for_external_check"`.
 *  - `mergeable` — `true` when the PR can be merged immediately, `false` otherwise.
 */
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
