import type { BrainStatusResult } from "./cli-types.js";

/** Render the human-readable Project Brain status report. */
export function renderBrainStatusHuman(result: BrainStatusResult): string {
	const { validation } = result;
	const lines: string[] = [];

	lines.push("");
	lines.push("=== Project Brain Status ===");
	lines.push(`  Directory: ${result.harnessDir}`);
	lines.push(`  Valid: ${validation.valid ? "Yes" : "No"}`);
	lines.push(`  Files scanned: ${validation.filesScanned}`);
	lines.push("");

	const s = validation.summary;
	lines.push("  Summary:");
	lines.push(`    Errors:    ${s.errors}`);
	lines.push(`    Warnings:  ${s.warnings}`);
	lines.push(`    Info:      ${s.info}`);
	lines.push(`    Missing:   ${s.missingFiles}`);
	lines.push(`    Placeholders: ${s.placeholderCount}`);
	lines.push(`    Missing metadata: ${s.missingMetadata}`);
	if (result.maturity.placeholderDomains.length > 0) {
		lines.push(
			`    Placeholder domains: ${result.maturity.placeholderDomains.join(", ")}`,
		);
	}
	lines.push(`    Maturity: ${result.maturity.level}`);

	if (validation.findings.length > 0) {
		lines.push("");
		lines.push("  Findings:");
		for (const f of validation.findings) {
			const icon =
				f.severity === "error" ? "❌" : f.severity === "warning" ? "⚠️ " : "ℹ️ ";
			lines.push(`    ${icon} [${f.path}] ${f.field}: ${f.message}`);
		}
	}

	lines.push("");
	return lines.join("\n");
}
