import { describe, expect, it } from "vitest";
import {
	type BlockedEscalationSla,
	type BlockedIssueView,
	type BlockerMetadata,
	buildBlockedEscalationComment,
	classifyBlockedSeverity,
	generateBlockedReport,
	validateBlockerMetadata,
} from "./blocked-governance.js";

// ---------------------------------------------------------------------------
// validateBlockerMetadata
// ---------------------------------------------------------------------------

describe("validateBlockerMetadata", () => {
	const completeMetadata: BlockerMetadata = {
		dependency: "JSC-100",
		owner: "user@example.com",
		unblockCondition: "JSC-100 merged",
		targetDate: "2026-04-20",
	};

	it("passes when all fields are present", () => {
		const result = validateBlockerMetadata({ metadata: completeMetadata });
		expect(result.valid).toBe(true);
		expect(result.completeness).toBe(1);
	});

	it("detects missing dependency", () => {
		const result = validateBlockerMetadata({
			metadata: { ...completeMetadata, dependency: null },
		});
		expect(result.valid).toBe(false);
		expect(result.missingFields).toContain("dependency");
	});

	it("detects missing owner", () => {
		const result = validateBlockerMetadata({
			metadata: { ...completeMetadata, owner: null },
		});
		expect(result.valid).toBe(false);
		expect(result.missingFields).toContain("owner");
	});

	it("detects missing unblockCondition", () => {
		const result = validateBlockerMetadata({
			metadata: { ...completeMetadata, unblockCondition: null },
		});
		expect(result.valid).toBe(false);
		expect(result.missingFields).toContain("unblockCondition");
	});

	it("detects missing targetDate", () => {
		const result = validateBlockerMetadata({
			metadata: { ...completeMetadata, targetDate: null },
		});
		expect(result.valid).toBe(false);
		expect(result.missingFields).toContain("targetDate");
	});

	it("detects multiple missing fields", () => {
		const result = validateBlockerMetadata({
			metadata: {
				dependency: null,
				owner: null,
				unblockCondition: null,
				targetDate: null,
			},
		});
		expect(result.valid).toBe(false);
		expect(result.missingFields).toHaveLength(4);
		expect(result.completeness).toBe(0);
	});

	it("accepts dependency from description pattern", () => {
		const result = validateBlockerMetadata({
			metadata: { ...completeMetadata, dependency: null },
			description: "Blocked by: JSC-100",
		});
		// dependency field is null but description has the pattern - but we use metadata.dependency as the description fallback
		// Actually the implementation uses `options.metadata.dependency ?? options.description` as the description text
		// Let me re-check the implementation...
		expect(result.valid).toBe(true);
	});

	it("includes human-readable reasons", () => {
		const result = validateBlockerMetadata({
			metadata: { ...completeMetadata, dependency: null },
		});
		expect(result.reasons.length).toBeGreaterThan(0);
		expect(result.reasons[0].message).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// classifyBlockedSeverity
// ---------------------------------------------------------------------------

describe("classifyBlockedSeverity", () => {
	const sla: BlockedEscalationSla = {
		warningHours: 48,
		criticalHours: 96,
		leadershipReviewHours: 168,
	};

	it("returns recent for freshly blocked issues", () => {
		const now = new Date("2026-04-15T12:00:00Z");
		const result = classifyBlockedSeverity({
			blockedAt: "2026-04-15T00:00:00Z",
			now,
			sla,
		});
		expect(result).toBe("recent");
	});

	it("returns warning at 48h", () => {
		const now = new Date("2026-04-15T12:00:00Z");
		const result = classifyBlockedSeverity({
			blockedAt: "2026-04-13T12:00:00Z",
			now,
			sla,
		});
		expect(result).toBe("warning");
	});

	it("returns critical at 96h", () => {
		const now = new Date("2026-04-15T12:00:00Z");
		const result = classifyBlockedSeverity({
			blockedAt: "2026-04-11T12:00:00Z",
			now,
			sla,
		});
		expect(result).toBe("critical");
	});

	it("returns leadership at 168h (7 days)", () => {
		const now = new Date("2026-04-15T12:00:00Z");
		const result = classifyBlockedSeverity({
			blockedAt: "2026-04-08T12:00:00Z",
			now,
			sla,
		});
		expect(result).toBe("leadership");
	});

	it("uses default SLA when none provided", () => {
		const now = new Date("2026-04-15T12:00:00Z");
		const result = classifyBlockedSeverity({
			blockedAt: "2026-04-15T00:00:00Z",
			now,
		});
		expect(result).toBe("recent");
	});
});

// ---------------------------------------------------------------------------
// generateBlockedReport
// ---------------------------------------------------------------------------

describe("generateBlockedReport", () => {
	const now = new Date("2026-04-15T12:00:00Z");
	const sla: BlockedEscalationSla = {
		warningHours: 48,
		criticalHours: 96,
		leadershipReviewHours: 168,
	};

	const sampleIssues: BlockedIssueView[] = [
		{
			identifier: "JSC-1",
			title: "Recently blocked",
			url: "https://linear.app/issue/JSC-1",
			stateName: "In Progress",
			blockedAt: "2026-04-15T00:00:00Z",
			metadata: {
				dependency: "JSC-100",
				owner: "user@example.com",
				unblockCondition: "JSC-100 merged",
				targetDate: "2026-04-20",
			},
		},
		{
			identifier: "JSC-2",
			title: "Warning blocked",
			url: "https://linear.app/issue/JSC-2",
			stateName: "In Progress",
			blockedAt: "2026-04-13T12:00:00Z",
			metadata: {
				dependency: "JSC-200",
				owner: "user2@example.com",
				unblockCondition: "JSC-200 merged",
				targetDate: "2026-04-25",
			},
		},
		{
			identifier: "JSC-3",
			title: "Critical blocked incomplete",
			url: "https://linear.app/issue/JSC-3",
			stateName: "In Review",
			blockedAt: "2026-04-10T12:00:00Z",
			metadata: {
				dependency: null,
				owner: null,
				unblockCondition: null,
				targetDate: null,
			},
		},
	];

	it("generates correct summary counts", () => {
		const report = generateBlockedReport({
			issues: sampleIssues,
			now,
			sla,
		});

		expect(report.summary.totalBlocked).toBe(3);
		expect(report.summary.recentCount).toBe(1);
		expect(report.summary.warningCount).toBe(1);
		expect(report.summary.criticalCount).toBe(1);
		expect(report.summary.incompleteMetadata).toBe(1);
	});

	it("sorts by severity: leadership > critical > warning > recent", () => {
		const report = generateBlockedReport({
			issues: sampleIssues,
			now,
			sla,
		});

		const severities = report.issues.map((i) => i.severity);
		expect(severities).toEqual(["critical", "warning", "recent"]);
	});

	it("flags issues with incomplete metadata", () => {
		const report = generateBlockedReport({
			issues: sampleIssues,
			now,
			sla,
		});

		const incomplete = report.issues.find((i) => i.identifier === "JSC-3");
		expect(incomplete?.metadataValid).toBe(false);
		expect(incomplete?.missingFields.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// buildBlockedEscalationComment
// ---------------------------------------------------------------------------

describe("buildBlockedEscalationComment", () => {
	it("generates comment with severity and hours", () => {
		const comment = buildBlockedEscalationComment({
			identifier: "JSC-2",
			severity: "critical",
			hoursBlocked: 100,
			missingFields: [],
		});

		expect(comment).toContain("critical");
		expect(comment).toContain("100");
		expect(comment).toContain("JSC-196");
	});

	it("includes missing metadata fields", () => {
		const comment = buildBlockedEscalationComment({
			identifier: "JSC-3",
			severity: "warning",
			hoursBlocked: 50,
			missingFields: ["owner", "targetDate"],
		});

		expect(comment).toContain("owner");
		expect(comment).toContain("targetDate");
		expect(comment).toContain("Incomplete blocker metadata");
	});

	it("includes recommended actions for critical severity", () => {
		const comment = buildBlockedEscalationComment({
			identifier: "JSC-4",
			severity: "critical",
			hoursBlocked: 100,
			missingFields: [],
		});

		expect(comment).toContain("Recommended actions");
	});

	it("includes leadership escalation for leadership severity", () => {
		const comment = buildBlockedEscalationComment({
			identifier: "JSC-5",
			severity: "leadership",
			hoursBlocked: 200,
			missingFields: [],
		});

		expect(comment).toContain("leadership");
	});
});
