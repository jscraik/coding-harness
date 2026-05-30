import type { BrainQueryResult } from "./cli-types.js";

/** Render the human-readable Project Brain query report. */
export function renderBrainQueryHuman(result: BrainQueryResult): string {
	const lines: string[] = [];

	lines.push("");
	lines.push(`=== Brain Query: "${result.query}" ===`);
	lines.push(`  ${result.total} match${result.total !== 1 ? "es" : ""} found`);
	lines.push("");

	for (const m of result.matches) {
		const domainTag = m.domain ? `[${m.domain}] ` : "";
		lines.push(`  ${domainTag}${m.path}:${m.lineNumber}`);
		lines.push(`    ${m.line}`);
	}

	lines.push("");
	return lines.join("\n");
}
