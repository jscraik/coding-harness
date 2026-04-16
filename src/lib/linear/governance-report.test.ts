import { describe, expect, it } from "vitest";
import {
	type GovernanceReportInput,
	generateGovernanceReport,
	renderGovernanceMarkdown,
} from "./governance-report.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseInput: GovernanceReportInput = {
	project: "coding-harness",
	teamKey: "JSC",
	stateCounts: [
		{ stateName: "In Progress", count: 5 },
		{ stateName: "In Review", count: 3 },
		{ stateName: "Triage", count: 8 },
		{ stateName: "Todo", count: 4 },
		{ stateName: "Backlog", count: 12 },
		{ stateName: "Done", count: 20 },
	],
	totalIssues: 52,
	promotedThisWeek: [
		{
			identifier: "JSC-190",
			title: "Establish agentic linear ops control loop",
		},
		{ identifier: "JSC-191", title: "Define triage inbox SLA" },
	],
	completedThisWeek: [
		{
			identifier: "JSC-177",
			title: "Version coherence guard",
			prUrl: "https://github.com/org/repo/pull/170",
		},
	],
	stalledIssues: [
		{
			identifier: "JSC-120",
			title: "Redesign CLI command taxonomy",
			stateName: "In Progress",
			daysInState: 12,
			recommendedAction: "Split into smaller issues",
		},
	],
	blockedIssues: [
		{
			identifier: "JSC-178",
			title: "Modularize contract validation",
			hoursBlocked: 72,
			dependency: "JSC-120",
		},
	],
};

// ---------------------------------------------------------------------------
// generateGovernanceReport
// ---------------------------------------------------------------------------

describe("generateGovernanceReport", () => {
	it("generates report with correct summary", () => {
		const report = generateGovernanceReport(baseInput);

		expect(report.project).toBe("coding-harness");
		expect(report.teamKey).toBe("JSC");
		expect(report.summary.totalIssues).toBe(52);
		expect(report.summary.completedThisWeek).toBe(1);
		expect(report.summary.promotedThisWeek).toBe(2);
		expect(report.summary.stalledCount).toBe(1);
		expect(report.summary.blockedCount).toBe(1);
	});

	it("calculates state deltas from prior report", () => {
		const report = generateGovernanceReport({
			...baseInput,
			priorReport: {
				generatedAt: "2026-04-08T12:00:00Z",
				stateCounts: [
					{ stateName: "In Progress", count: 4 },
					{ stateName: "Done", count: 18 },
					{ stateName: "Triage", count: 10 },
				],
				totalIssues: 50,
			},
		});

		expect(report.summary.issueDelta).toBe(2);

		const inProgressDelta = report.stateDeltas.find(
			(d) => d.stateName === "In Progress",
		);
		expect(inProgressDelta?.delta).toBe(1);

		const doneDelta = report.stateDeltas.find((d) => d.stateName === "Done");
		expect(doneDelta?.delta).toBe(2);
	});

	it("generates zero-delta state entries when no prior report", () => {
		const report = generateGovernanceReport(baseInput);

		for (const delta of report.stateDeltas) {
			expect(delta.prior).toBe(0);
			expect(delta.delta).toBe(delta.current);
		}
	});

	it("includes throughput data", () => {
		const report = generateGovernanceReport(baseInput);

		expect(report.throughput.completed).toHaveLength(1);
		expect(report.throughput.completed[0].identifier).toBe("JSC-177");
		expect(report.throughput.promoted).toHaveLength(2);
	});

	it("includes stalled work and blocker risk", () => {
		const report = generateGovernanceReport(baseInput);

		expect(report.stalledWork).toHaveLength(1);
		expect(report.blockerRisk).toHaveLength(1);
		expect(report.blockerRisk[0].dependency).toBe("JSC-120");
	});

	it("derives top next actions from blocked and stalled", () => {
		const report = generateGovernanceReport(baseInput);

		expect(report.topNextActions.length).toBeGreaterThan(0);
		expect(report.topNextActions[0].identifier).toBe("JSC-178");
		expect(report.topNextActions[1].identifier).toBe("JSC-120");
	});

	it("limits top next actions to 5", () => {
		const manyStalled = Array.from({ length: 10 }, (_, i) => ({
			identifier: `JSC-${i}`,
			title: `Stalled issue ${i}`,
			stateName: "In Progress",
			daysInState: 10 + i,
			recommendedAction: "Split",
		}));

		const report = generateGovernanceReport({
			...baseInput,
			stalledIssues: manyStalled,
		});

		expect(report.topNextActions.length).toBeLessThanOrEqual(5);
	});
});

// ---------------------------------------------------------------------------
// renderGovernanceMarkdown
// ---------------------------------------------------------------------------

describe("renderGovernanceMarkdown", () => {
	it("renders a complete markdown report", () => {
		const report = generateGovernanceReport(baseInput);
		const md = renderGovernanceMarkdown(report);

		expect(md).toContain("Weekly Governance Report");
		expect(md).toContain("coding-harness");
		expect(md).toContain("Summary");
		expect(md).toContain("52");
		expect(md).toContain("State Distribution");
		expect(md).toContain("In Progress");
		expect(md).toContain("JSC-177");
		expect(md).toContain("Stalled Work");
		expect(md).toContain("JSC-120");
		expect(md).toContain("Blocker Risk");
		expect(md).toContain("JSC-178");
		expect(md).toContain("Top Next Actions");
	});

	it("renders delta column in state distribution", () => {
		const report = generateGovernanceReport({
			...baseInput,
			priorReport: {
				generatedAt: "2026-04-08T12:00:00Z",
				stateCounts: [
					{ stateName: "In Progress", count: 4 },
					{ stateName: "Done", count: 18 },
				],
				totalIssues: 50,
			},
		});

		const md = renderGovernanceMarkdown(report);
		expect(md).toContain("Prior");
		expect(md).toContain("Delta");
		expect(md).toContain("+1");
		expect(md).toContain("+2");
	});

	it("omits empty sections", () => {
		const report = generateGovernanceReport({
			...baseInput,
			stalledIssues: [],
			blockedIssues: [],
		});

		const md = renderGovernanceMarkdown(report);
		expect(md).not.toContain("Stalled Work");
		expect(md).not.toContain("Blocker Risk");
	});

	it("includes PR links for completed items", () => {
		const report = generateGovernanceReport(baseInput);
		const md = renderGovernanceMarkdown(report);

		expect(md).toContain("[PR]");
		expect(md).toContain("https://github.com/org/repo/pull/170");
	});
});
