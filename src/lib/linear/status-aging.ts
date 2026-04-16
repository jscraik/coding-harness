/**
 * Status-aging watchdog for In Progress and In Review lanes (JSC-192).
 *
 * Surfaces stale work and triggers escalation recommendations.
 * Provides:
 * - Aging thresholds for execution states
 * - Stale issue detection and grouping
 * - Escalation rubric (reassign, split, de-scope, close as duplicate/canceled)
 * - Auto-comment template for stalled items
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface AgingThresholds {
	/** Days before an In Progress issue is considered stale. */
	inProgressWarningDays: number;
	/** Days before an In Progress issue is considered critically stale. */
	inProgressCriticalDays: number;
	/** Days before an In Review issue is considered stale. */
	inReviewWarningDays: number;
	/** Days before an In Review issue is considered critically stale. */
	inReviewCriticalDays: number;
}

export const DEFAULT_AGING_THRESHOLDS: AgingThresholds = {
	inProgressWarningDays: 7,
	inProgressCriticalDays: 10,
	inReviewWarningDays: 5,
	inReviewCriticalDays: 7,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgingSeverity = "fresh" | "warning" | "critical";

export type EscalationAction =
	| "reassign"
	| "split"
	| "descope"
	| "close_duplicate"
	| "close_canceled"
	| "continue";

export interface AgedIssue {
	identifier: string;
	title: string;
	url: string;
	stateName: string;
	daysInState: number;
	severity: AgingSeverity;
	recommendedAction: EscalationAction;
	reason: string;
}

export interface AgingReport {
	generatedAt: string;
	summary: {
		totalChecked: number;
		freshCount: number;
		warningCount: number;
		criticalCount: number;
		inProgressStale: number;
		inReviewStale: number;
	};
	staleIssues: AgedIssue[];
	topRemediationActions: Array<{
		action: EscalationAction;
		count: number;
		issues: string[];
	}>;
}

// ---------------------------------------------------------------------------
// Severity detection
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86_400_000;

/**
 * Calculate the number of days an issue has been in its current state.
 */
export function calculateDaysInState(options: {
	updatedAt: string;
	now?: Date;
}): number {
	const now = options.now ?? new Date();
	const updated = new Date(options.updatedAt);
	const elapsedMs = now.getTime() - updated.getTime();
	return Math.max(0, Math.round(elapsedMs / MS_PER_DAY));
}

/**
 * Determine the aging severity for an issue.
 */
export function classifyAging(options: {
	stateName: string;
	daysInState: number;
	thresholds?: AgingThresholds;
}): AgingSeverity {
	const thresholds = options.thresholds ?? DEFAULT_AGING_THRESHOLDS;
	const normalized = options.stateName.trim().toLowerCase();
	const days = options.daysInState;

	if (normalized === "in progress") {
		if (days >= thresholds.inProgressCriticalDays) return "critical";
		if (days >= thresholds.inProgressWarningDays) return "warning";
		return "fresh";
	}

	if (normalized === "in review") {
		if (days >= thresholds.inReviewCriticalDays) return "critical";
		if (days >= thresholds.inReviewWarningDays) return "warning";
		return "fresh";
	}

	// Other states don't have aging thresholds
	return "fresh";
}

// ---------------------------------------------------------------------------
// Escalation rubric
// ---------------------------------------------------------------------------

/**
 * Recommend an escalation action based on aging severity and context.
 */
export function recommendEscalationAction(options: {
	severity: AgingSeverity;
	stateName: string;
	daysInState: number;
	hasAssignee: boolean;
	hasPullRequest: boolean;
}): { action: EscalationAction; reason: string } {
	if (options.severity === "fresh") {
		return {
			action: "continue",
			reason: "Issue is within normal time-in-state thresholds.",
		};
	}

	const state = options.stateName.trim().toLowerCase();

	// Critical In Progress without PR
	if (
		state === "in progress" &&
		options.severity === "critical" &&
		!options.hasPullRequest
	) {
		if (!options.hasAssignee) {
			return {
				action: "reassign",
				reason: `Critical stale (${options.daysInState}d in In Progress) with no assignee and no PR. Reassign or close.`,
			};
		}
		return {
			action: "split",
			reason: `Critical stale (${options.daysInState}d in In Progress) with no PR. Consider splitting into smaller issues.`,
		};
	}

	// Critical In Review
	if (state === "in review" && options.severity === "critical") {
		return {
			action: "descope",
			reason: `Critical stale (${options.daysInState}d in In Review). Consider descoping or requesting fresh review.`,
		};
	}

	// Warning In Progress
	if (state === "in progress" && options.severity === "warning") {
		if (!options.hasAssignee) {
			return {
				action: "reassign",
				reason: `Warning stale (${options.daysInState}d in In Progress) with no assignee.`,
			};
		}
		return {
			action: "split",
			reason: `Warning stale (${options.daysInState}d in In Progress). Check if work can be parallelized.`,
		};
	}

	// Warning In Review
	if (state === "in review" && options.severity === "warning") {
		return {
			action: "continue",
			reason: `Warning stale (${options.daysInState}d in In Review). Nudge reviewer.`,
		};
	}

	return {
		action: "continue",
		reason: "No specific escalation recommended.",
	};
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

export interface AgingCheckInput {
	identifier: string;
	title: string;
	url: string;
	stateName: string;
	updatedAt: string;
	hasAssignee: boolean;
	hasPullRequest: boolean;
}

/**
 * Generate an aging report from a list of issues in execution states.
 */
export function generateAgingReport(options: {
	issues: AgingCheckInput[];
	thresholds?: AgingThresholds;
	now?: Date;
}): AgingReport {
	const now = options.now ?? new Date();
	const thresholds = options.thresholds ?? DEFAULT_AGING_THRESHOLDS;
	const staleIssues: AgedIssue[] = [];
	let freshCount = 0;
	let warningCount = 0;
	let criticalCount = 0;
	let inProgressStale = 0;
	let inReviewStale = 0;

	const actionCounts = new Map<EscalationAction, string[]>();

	for (const issue of options.issues) {
		const daysInState = calculateDaysInState({
			updatedAt: issue.updatedAt,
			now,
		});

		const severity = classifyAging({
			stateName: issue.stateName,
			daysInState,
			thresholds,
		});

		const escalation = recommendEscalationAction({
			severity,
			stateName: issue.stateName,
			daysInState,
			hasAssignee: issue.hasAssignee,
			hasPullRequest: issue.hasPullRequest,
		});

		if (severity === "fresh") {
			freshCount++;
			continue;
		}

		if (severity === "warning") warningCount++;
		if (severity === "critical") criticalCount++;

		const normalizedState = issue.stateName.trim().toLowerCase();
		if (normalizedState === "in progress") inProgressStale++;
		if (normalizedState === "in review") inReviewStale++;

		staleIssues.push({
			identifier: issue.identifier,
			title: issue.title,
			url: issue.url,
			stateName: issue.stateName,
			daysInState,
			severity,
			recommendedAction: escalation.action,
			reason: escalation.reason,
		});

		const existing = actionCounts.get(escalation.action) ?? [];
		existing.push(issue.identifier);
		actionCounts.set(escalation.action, existing);
	}

	// Sort: critical first, then by days in state descending
	staleIssues.sort(
		(a, b) =>
			(a.severity === "critical" ? 0 : 1) -
				(b.severity === "critical" ? 0 : 1) || b.daysInState - a.daysInState,
	);

	const topRemediationActions: AgingReport["topRemediationActions"] =
		Array.from(actionCounts.entries())
			.filter(([action]) => action !== "continue")
			.map(([action, issues]) => ({ action, count: issues.length, issues }))
			.sort((a, b) => b.count - a.count);

	return {
		generatedAt: now.toISOString(),
		summary: {
			totalChecked: options.issues.length,
			freshCount,
			warningCount,
			criticalCount,
			inProgressStale,
			inReviewStale,
		},
		staleIssues,
		topRemediationActions,
	};
}

// ---------------------------------------------------------------------------
// Auto-comment template
// ---------------------------------------------------------------------------

/**
 * Generate an auto-comment for a stalled issue.
 */
export function buildStaleIssueComment(issue: AgedIssue): string {
	const emoji = issue.severity === "critical" ? "🔴" : "🟡";
	const lines = [
		`${emoji} **Status aging alert: ${issue.severity} (${issue.daysInState}d in ${issue.stateName})**`,
		"",
		`This issue has been in **${issue.stateName}** for **${issue.daysInState} days**.`,
		"",
		`**Recommended action:** ${issue.recommendedAction}`,
		`**Reason:** ${issue.reason}`,
		"",
		"Please take one of the following actions:",
		"- Update the issue with a progress comment and revised timeline",
		"- Split the work into smaller, trackable pieces",
		"- De-scope non-essential portions",
		"- Close as duplicate or canceled if no longer relevant",
		"",
		"_This alert was generated by the status-aging watchdog (JSC-192)._",
	];
	return lines.join("\n");
}
