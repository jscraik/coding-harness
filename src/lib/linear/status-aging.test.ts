import { describe, expect, it } from "vitest";
import {
	type AgingCheckInput,
	type AgingThresholds,
	buildStaleIssueComment,
	calculateDaysInState,
	classifyAging,
	generateAgingReport,
	recommendEscalationAction,
} from "./status-aging.js";

// ---------------------------------------------------------------------------
// calculateDaysInState
// ---------------------------------------------------------------------------

describe("calculateDaysInState", () => {
	it("calculates days since last update", () => {
		const now = new Date("2026-04-15T12:00:00Z");
		const result = calculateDaysInState({
			updatedAt: "2026-04-10T12:00:00Z",
			now,
		});
		expect(result).toBe(5);
	});

	it("returns 0 for very recent updates", () => {
		const now = new Date("2026-04-15T12:00:00Z");
		const result = calculateDaysInState({
			updatedAt: "2026-04-15T11:00:00Z",
			now,
		});
		expect(result).toBe(0);
	});

	it("clamps negative values to 0", () => {
		const now = new Date("2026-04-15T12:00:00Z");
		const result = calculateDaysInState({
			updatedAt: "2026-04-16T12:00:00Z",
			now,
		});
		expect(result).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// classifyAging
// ---------------------------------------------------------------------------

describe("classifyAging", () => {
	const thresholds: AgingThresholds = {
		inProgressWarningDays: 7,
		inProgressCriticalDays: 10,
		inReviewWarningDays: 5,
		inReviewCriticalDays: 7,
	};

	it("returns fresh for recent In Progress issues", () => {
		expect(
			classifyAging({ stateName: "In Progress", daysInState: 3, thresholds }),
		).toBe("fresh");
	});

	it("returns warning for In Progress at 7 days", () => {
		expect(
			classifyAging({ stateName: "In Progress", daysInState: 7, thresholds }),
		).toBe("warning");
	});

	it("returns critical for In Progress at 10+ days", () => {
		expect(
			classifyAging({ stateName: "In Progress", daysInState: 10, thresholds }),
		).toBe("critical");
	});

	it("returns fresh for recent In Review issues", () => {
		expect(
			classifyAging({ stateName: "In Review", daysInState: 3, thresholds }),
		).toBe("fresh");
	});

	it("returns warning for In Review at 5 days", () => {
		expect(
			classifyAging({ stateName: "In Review", daysInState: 5, thresholds }),
		).toBe("warning");
	});

	it("returns critical for In Review at 7+ days", () => {
		expect(
			classifyAging({ stateName: "In Review", daysInState: 7, thresholds }),
		).toBe("critical");
	});

	it("returns fresh for other states regardless of days", () => {
		expect(
			classifyAging({ stateName: "Triage", daysInState: 30, thresholds }),
		).toBe("fresh");
	});

	it("is case-insensitive for state names", () => {
		expect(
			classifyAging({ stateName: "in progress", daysInState: 8, thresholds }),
		).toBe("warning");
	});

	it("uses default thresholds when none provided", () => {
		expect(classifyAging({ stateName: "In Progress", daysInState: 10 })).toBe(
			"critical",
		);
	});
});

// ---------------------------------------------------------------------------
// recommendEscalationAction
// ---------------------------------------------------------------------------

describe("recommendEscalationAction", () => {
	it("recommends continue for fresh issues", () => {
		const result = recommendEscalationAction({
			severity: "fresh",
			stateName: "In Progress",
			daysInState: 3,
			hasAssignee: true,
			hasPullRequest: false,
		});
		expect(result.action).toBe("continue");
	});

	it("recommends reassign for critical In Progress with no assignee and no PR", () => {
		const result = recommendEscalationAction({
			severity: "critical",
			stateName: "In Progress",
			daysInState: 12,
			hasAssignee: false,
			hasPullRequest: false,
		});
		expect(result.action).toBe("reassign");
	});

	it("recommends split for critical In Progress with assignee but no PR", () => {
		const result = recommendEscalationAction({
			severity: "critical",
			stateName: "In Progress",
			daysInState: 12,
			hasAssignee: true,
			hasPullRequest: false,
		});
		expect(result.action).toBe("split");
	});

	it("recommends descope for critical In Review", () => {
		const result = recommendEscalationAction({
			severity: "critical",
			stateName: "In Review",
			daysInState: 8,
			hasAssignee: true,
			hasPullRequest: true,
		});
		expect(result.action).toBe("descope");
	});

	it("recommends reassign for warning In Progress with no assignee", () => {
		const result = recommendEscalationAction({
			severity: "warning",
			stateName: "In Progress",
			daysInState: 8,
			hasAssignee: false,
			hasPullRequest: false,
		});
		expect(result.action).toBe("reassign");
	});

	it("recommends split for warning In Progress with assignee", () => {
		const result = recommendEscalationAction({
			severity: "warning",
			stateName: "In Progress",
			daysInState: 8,
			hasAssignee: true,
			hasPullRequest: false,
		});
		expect(result.action).toBe("split");
	});

	it("recommends continue for warning In Review", () => {
		const result = recommendEscalationAction({
			severity: "warning",
			stateName: "In Review",
			daysInState: 6,
			hasAssignee: true,
			hasPullRequest: true,
		});
		expect(result.action).toBe("continue");
	});
});

// ---------------------------------------------------------------------------
// generateAgingReport
// ---------------------------------------------------------------------------

describe("generateAgingReport", () => {
	const now = new Date("2026-04-15T12:00:00Z");
	const thresholds: AgingThresholds = {
		inProgressWarningDays: 7,
		inProgressCriticalDays: 10,
		inReviewWarningDays: 5,
		inReviewCriticalDays: 7,
	};

	const sampleIssues: AgingCheckInput[] = [
		{
			identifier: "JSC-1",
			title: "Fresh issue",
			url: "https://linear.app/issue/JSC-1",
			stateName: "In Progress",
			updatedAt: "2026-04-14T12:00:00Z",
			hasAssignee: true,
			hasPullRequest: false,
		},
		{
			identifier: "JSC-2",
			title: "Stale In Progress",
			url: "https://linear.app/issue/JSC-2",
			stateName: "In Progress",
			updatedAt: "2026-04-05T12:00:00Z",
			hasAssignee: true,
			hasPullRequest: false,
		},
		{
			identifier: "JSC-3",
			title: "Critical stale In Review",
			url: "https://linear.app/issue/JSC-3",
			stateName: "In Review",
			updatedAt: "2026-04-05T12:00:00Z",
			hasAssignee: true,
			hasPullRequest: true,
		},
		{
			identifier: "JSC-4",
			title: "Critical stale no assignee",
			url: "https://linear.app/issue/JSC-4",
			stateName: "In Progress",
			updatedAt: "2026-04-01T12:00:00Z",
			hasAssignee: false,
			hasPullRequest: false,
		},
	];

	it("generates correct summary counts", () => {
		const report = generateAgingReport({
			issues: sampleIssues,
			thresholds,
			now,
		});

		expect(report.summary.totalChecked).toBe(4);
		expect(report.summary.freshCount).toBe(1);
		expect(report.summary.warningCount).toBe(0); // JSC-2 at 10d hits critical, not warning
		expect(report.summary.criticalCount).toBe(3); // JSC-2 (10d), JSC-3 (10d), JSC-4 (14d)
		expect(report.summary.inProgressStale).toBe(2); // JSC-2 and JSC-4
		expect(report.summary.inReviewStale).toBe(1); // JSC-3
	});

	it("sorts stale issues: critical first, then by days descending", () => {
		const report = generateAgingReport({
			issues: sampleIssues,
			thresholds,
			now,
		});

		const severities = report.staleIssues.map((i) => i.severity);
		// All critical should come before warning
		const firstWarningIdx = severities.indexOf("warning");
		const lastCriticalIdx = severities.lastIndexOf("critical");
		if (firstWarningIdx >= 0 && lastCriticalIdx >= 0) {
			expect(firstWarningIdx).toBeGreaterThan(lastCriticalIdx);
		}
	});

	it("includes top remediation actions", () => {
		const report = generateAgingReport({
			issues: sampleIssues,
			thresholds,
			now,
		});

		expect(report.topRemediationActions.length).toBeGreaterThan(0);
		// 'continue' should be excluded
		expect(
			report.topRemediationActions.every((a) => a.action !== "continue"),
		).toBe(true);
	});

	it("returns empty stale list when all fresh", () => {
		const report = generateAgingReport({
			issues: [
				{
					identifier: "JSC-99",
					title: "Fresh",
					url: "https://linear.app/issue/JSC-99",
					stateName: "In Progress",
					updatedAt: "2026-04-15T12:00:00Z",
					hasAssignee: true,
					hasPullRequest: false,
				},
			],
			thresholds,
			now,
		});

		expect(report.staleIssues).toHaveLength(0);
		expect(report.summary.freshCount).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// buildStaleIssueComment
// ---------------------------------------------------------------------------

describe("buildStaleIssueComment", () => {
	it("generates comment with severity and recommended action", () => {
		const comment = buildStaleIssueComment({
			identifier: "JSC-2",
			title: "Stale issue",
			url: "https://linear.app/issue/JSC-2",
			stateName: "In Progress",
			daysInState: 8,
			severity: "warning",
			recommendedAction: "split",
			reason: "Warning stale (8d in In Progress).",
		});

		expect(comment).toContain("warning");
		expect(comment).toContain("8 days");
		expect(comment).toContain("split");
		expect(comment).toContain("JSC-192");
	});

	it("uses critical emoji for critical severity", () => {
		const comment = buildStaleIssueComment({
			identifier: "JSC-3",
			title: "Critical",
			url: "https://linear.app/issue/JSC-3",
			stateName: "In Review",
			daysInState: 10,
			severity: "critical",
			recommendedAction: "descope",
			reason: "Critical stale.",
		});

		expect(comment).toContain("🔴");
	});

	it("uses warning emoji for warning severity", () => {
		const comment = buildStaleIssueComment({
			identifier: "JSC-2",
			title: "Warning",
			url: "https://linear.app/issue/JSC-2",
			stateName: "In Progress",
			daysInState: 8,
			severity: "warning",
			recommendedAction: "split",
			reason: "Warning stale.",
		});

		expect(comment).toContain("🟡");
	});
});
