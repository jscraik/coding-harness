import type { RootHygieneReport } from "./types.js";

/** Freeze verifier-owned reports so claim-support evidence cannot mutate later. */
export function freezeRootHygieneReport(report: RootHygieneReport): void {
	for (const entry of report.entries) Object.freeze(entry);
	Object.freeze(report.entries);
	Object.freeze(report.summary);
	Object.freeze(report.coverage);
	if (report.repository !== null) Object.freeze(report.repository);
	for (const blocker of report.blockers) Object.freeze(blocker);
	Object.freeze(report.blockers);
	for (const entry of report.deferredEntries) Object.freeze(entry);
	Object.freeze(report.deferredEntries);
	Object.freeze(report.receipt);
	Object.freeze(report);
}
