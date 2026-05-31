import type { BrainStaleResult } from "./cli-types.js";

/** Render the human-readable Project Brain staleness report. */
export function renderBrainStaleHuman(result: BrainStaleResult): string {
	const { report } = result;
	const lines: string[] = [];

	lines.push("");
	lines.push("=== Brain Staleness Report ===");
	lines.push(
		`  Domains: ${report.totalDomains} | Files: ${report.totalFiles} | Threshold: ${report.thresholdDays} days`,
	);
	lines.push(
		`  Average staleness: ${report.averageStaleness} | Needs review: ${report.staleFiles.length}`,
	);
	lines.push("");

	if (report.staleFiles.length > 0) {
		lines.push("  Stale / needs review:");
		for (const f of report.staleFiles) {
			const stalenessPercent = `${Math.round(f.stalenessScore * 100)}%`;
			const verified = f.lastVerified ?? "never";
			lines.push(
				`    [${f.domain}] ${stalenessPercent} stale - last verified: ${verified}`,
			);
			lines.push(`      ${f.stalenessReason}`);
		}
		lines.push("");
	}

	if (report.freshFiles.length > 0) {
		lines.push("  Fresh:");
		for (const f of report.freshFiles) {
			const stalenessPercent = `${Math.round(f.stalenessScore * 100)}%`;
			lines.push(
				`    [${f.domain}] ${stalenessPercent} stale - ${f.stalenessReason}`,
			);
		}
		lines.push("");
	}

	return lines.join("\n");
}
