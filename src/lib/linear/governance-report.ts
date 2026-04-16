/**
 * Weekly project-governance status report generation (JSC-195).
 *
 * Generates status updates from live issue data with:
 * - Standard update template (throughput, stalled work, blocker risk, next actions)
 * - Auto-collection of state counts
 * - Change deltas vs prior report window
 * - Explicit action recommendations with issue IDs
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StateCount {
	stateName: string;
	count: number;
}

export interface GovernanceReportInput {
	/** Project name. */
	project: string;
	/** Team key. */
	teamKey: string;
	/** Current state counts. */
	stateCounts: StateCount[];
	/** Total issues in the project. */
	totalIssues: number;
	/** Issues that were promoted (moved to In Progress) this week. */
	promotedThisWeek: Array<{
		identifier: string;
		title: string;
	}>;
	/** Issues completed this week. */
	completedThisWeek: Array<{
		identifier: string;
		title: string;
		prUrl?: string;
	}>;
	/** Stalled issues (from aging watchdog). */
	stalledIssues: Array<{
		identifier: string;
		title: string;
		stateName: string;
		daysInState: number;
		recommendedAction: string;
	}>;
	/** Blocked issues. */
	blockedIssues: Array<{
		identifier: string;
		title: string;
		hoursBlocked: number;
		dependency?: string;
	}>;
	/** Prior report for delta calculation (optional). */
	priorReport?: PriorGovernanceReport;
	/** Report generation date. */
	generatedAt?: string;
}

export interface PriorGovernanceReport {
	generatedAt: string;
	stateCounts: StateCount[];
	totalIssues: number;
}

export interface GovernanceReport {
	generatedAt: string;
	project: string;
	teamKey: string;
	summary: {
		totalIssues: number;
		issueDelta: number;
		completedThisWeek: number;
		promotedThisWeek: number;
		stalledCount: number;
		blockedCount: number;
	};
	stateCounts: StateCount[];
	stateDeltas: Array<{
		stateName: string;
		current: number;
		prior: number;
		delta: number;
	}>;
	throughput: {
		completed: Array<{ identifier: string; title: string; prUrl?: string }>;
		promoted: Array<{ identifier: string; title: string }>;
	};
	stalledWork: Array<{
		identifier: string;
		title: string;
		stateName: string;
		daysInState: number;
		recommendedAction: string;
	}>;
	blockerRisk: Array<{
		identifier: string;
		title: string;
		hoursBlocked: number;
		dependency?: string;
	}>;
	topNextActions: Array<{
		priority: number;
		identifier: string;
		title: string;
		action: string;
	}>;
}

// ---------------------------------------------------------------------------
// Delta calculation
// ---------------------------------------------------------------------------

function calculateStateDeltas(
	current: StateCount[],
	prior: StateCount[],
): GovernanceReport["stateDeltas"] {
	const priorMap = new Map(prior.map((s) => [s.stateName, s.count]));
	const allStates = new Set([
		...current.map((s) => s.stateName),
		...prior.map((s) => s.stateName),
	]);

	return Array.from(allStates)
		.map((stateName) => {
			const currentValue =
				current.find((s) => s.stateName === stateName)?.count ?? 0;
			const priorValue = priorMap.get(stateName) ?? 0;
			return {
				stateName,
				current: currentValue,
				prior: priorValue,
				delta: currentValue - priorValue,
			};
		})
		.sort((a, b) => b.current - a.current);
}

// ---------------------------------------------------------------------------
// Top next actions
// ---------------------------------------------------------------------------

function deriveTopNextActions(
	report: GovernanceReport,
): GovernanceReport["topNextActions"] {
	const actions: GovernanceReport["topNextActions"] = [];
	let priority = 1;

	// Blocked issues first
	for (const blocked of report.blockerRisk) {
		actions.push({
			priority: priority++,
			identifier: blocked.identifier,
			title: blocked.title,
			action: blocked.dependency
				? `Unblock dependency: ${blocked.dependency}`
				: "Resolve blocker and update metadata",
		});
	}

	// Stalled issues
	for (const stalled of report.stalledWork) {
		actions.push({
			priority: priority++,
			identifier: stalled.identifier,
			title: stalled.title,
			action: stalled.recommendedAction,
		});
	}

	// Top 3 stalled + blocked combined max
	return actions.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

/**
 * Generate a weekly governance status report from live issue data.
 */
export function generateGovernanceReport(
	input: GovernanceReportInput,
): GovernanceReport {
	const generatedAt = input.generatedAt ?? new Date().toISOString();
	const totalIssueDelta = input.priorReport
		? input.totalIssues - input.priorReport.totalIssues
		: 0;

	const report: GovernanceReport = {
		generatedAt,
		project: input.project,
		teamKey: input.teamKey,
		summary: {
			totalIssues: input.totalIssues,
			issueDelta: totalIssueDelta,
			completedThisWeek: input.completedThisWeek.length,
			promotedThisWeek: input.promotedThisWeek.length,
			stalledCount: input.stalledIssues.length,
			blockedCount: input.blockedIssues.length,
		},
		stateCounts: input.stateCounts.sort((a, b) => b.count - a.count),
		stateDeltas: input.priorReport
			? calculateStateDeltas(input.stateCounts, input.priorReport.stateCounts)
			: input.stateCounts.map((s) => ({
					stateName: s.stateName,
					current: s.count,
					prior: 0,
					delta: s.count,
				})),
		throughput: {
			completed: input.completedThisWeek,
			promoted: input.promotedThisWeek,
		},
		stalledWork: input.stalledIssues,
		blockerRisk: input.blockedIssues,
		topNextActions: [],
	};

	report.topNextActions = deriveTopNextActions(report);

	return report;
}

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------

/**
 * Render a governance report as a Markdown document suitable for
 * Linear status updates or team documentation.
 */
export function renderGovernanceMarkdown(report: GovernanceReport): string {
	const lines: string[] = [];

	lines.push(`# Weekly Governance Report: ${report.project}`);
	lines.push("");
	lines.push(`**Generated:** ${report.generatedAt}`);
	lines.push(`**Team:** ${report.teamKey}`);
	lines.push("");

	// Summary
	lines.push("## Summary");
	lines.push("");
	lines.push("| Metric | Value |");
	lines.push("| --- | --- |");
	lines.push(
		`| Total issues | ${report.summary.totalIssues}${report.summary.issueDelta !== 0 ? ` (${report.summary.issueDelta > 0 ? "+" : ""}${report.summary.issueDelta})` : ""} |`,
	);
	lines.push(`| Completed this week | ${report.summary.completedThisWeek} |`);
	lines.push(`| Promoted this week | ${report.summary.promotedThisWeek} |`);
	lines.push(`| Stalled work | ${report.summary.stalledCount} |`);
	lines.push(`| Blocked issues | ${report.summary.blockedCount} |`);
	lines.push("");

	// State counts
	lines.push("## State Distribution");
	lines.push("");
	if (report.stateDeltas.length > 0) {
		lines.push("| State | Current | Prior | Delta |");
		lines.push("| --- | --- | --- | --- |");
		for (const state of report.stateDeltas) {
			const deltaStr =
				state.delta > 0
					? `+${state.delta}`
					: state.delta < 0
						? `${state.delta}`
						: "—";
			lines.push(
				`| ${state.stateName} | ${state.current} | ${state.prior} | ${deltaStr} |`,
			);
		}
	} else {
		lines.push("_No state data available._");
	}
	lines.push("");

	// Throughput
	if (report.throughput.completed.length > 0) {
		lines.push("## Completed This Week");
		lines.push("");
		for (const item of report.throughput.completed) {
			const prLink = item.prUrl ? ` ([PR](${item.prUrl}))` : "";
			lines.push(`- ${item.identifier}: ${item.title}${prLink}`);
		}
		lines.push("");
	}

	if (report.throughput.promoted.length > 0) {
		lines.push("## Promoted This Week");
		lines.push("");
		for (const item of report.throughput.promoted) {
			lines.push(`- ${item.identifier}: ${item.title}`);
		}
		lines.push("");
	}

	// Stalled work
	if (report.stalledWork.length > 0) {
		lines.push("## Stalled Work");
		lines.push("");
		for (const item of report.stalledWork) {
			lines.push(
				`- **${item.identifier}** (${item.stateName}, ${item.daysInState}d): ${item.title}`,
			);
			lines.push(`  - _Action: ${item.recommendedAction}_`);
		}
		lines.push("");
	}

	// Blocker risk
	if (report.blockerRisk.length > 0) {
		lines.push("## Blocker Risk");
		lines.push("");
		for (const item of report.blockerRisk) {
			const dep = item.dependency ? ` (blocked by ${item.dependency})` : "";
			lines.push(
				`- **${item.identifier}** (${Math.round(item.hoursBlocked)}h blocked${dep}): ${item.title}`,
			);
		}
		lines.push("");
	}

	// Top next actions
	if (report.topNextActions.length > 0) {
		lines.push("## Top Next Actions");
		lines.push("");
		for (const action of report.topNextActions) {
			lines.push(
				`${action.priority}. **${action.identifier}**: ${action.action}`,
			);
		}
		lines.push("");
	}

	return lines.join("\n");
}
