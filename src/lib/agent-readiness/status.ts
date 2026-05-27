import type { AgentReadinessFinding, AgentReadinessStatus } from "./types.js";

/** Summarize readiness findings by severity. */
export function summarize(findings: AgentReadinessFinding[]) {
	return findings.reduce(
		(summary, finding) => {
			summary[finding.status] += 1;
			return summary;
		},
		{ pass: 0, warn: 0, fail: 0 },
	);
}

/** Derive the aggregate readiness status from severity counts. */
export function overallStatus(summary: {
	pass: number;
	warn: number;
	fail: number;
}): AgentReadinessStatus {
	if (summary.fail > 0) return "fail";
	if (summary.warn > 0) return "warn";
	return "pass";
}
