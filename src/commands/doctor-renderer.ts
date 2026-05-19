import { renderRecoveryGuidance } from "./doctor-recovery.js";
import type { CheckStatus, DoctorReport } from "./doctor.js";

const STATUS_ICONS: Record<CheckStatus, string> = {
	ok: "✅",
	warn: "⚠️ ",
	fail: "❌",
	skip: "⏭️ ",
};

/** Renders a human-readable DoctorReport for terminal output. */
export function renderDoctorReport(report: DoctorReport): string {
	const lines: string[] = [];

	lines.push(`\nHarness Doctor — ${report.dir}`);
	lines.push(`Checked at ${new Date(report.timestamp).toLocaleString()}\n`);

	const categories: Array<["tool" | "file" | "config" | "ci", string]> = [
		["tool", "Tools"],
		["file", "Required Files"],
		["config", "Contract Configuration"],
		["ci", "CI Setup"],
	];

	for (const [cat, catLabel] of categories) {
		const catChecks = report.checks.filter((check) => check.category === cat);
		if (catChecks.length === 0) continue;

		lines.push(`  ${catLabel}`);
		const labelWidth =
			Math.max(...catChecks.map((check) => check.label.length)) + 2;
		for (const check of catChecks) {
			const icon = STATUS_ICONS[check.status];
			const label = check.label.padEnd(labelWidth);
			lines.push(`    ${icon}  ${label}${check.message}`);
			if (check.fix && check.status !== "ok" && check.status !== "skip") {
				lines.push(`         Fix: ${check.fix}`);
			}
		}
		lines.push("");
	}

	const { ok, warn, fail, skip } = report.counts;
	const total = ok + warn + fail;
	const skippedNote = skip > 0 ? `, ${skip} skipped` : "";
	lines.push(
		`  Results: ${ok}/${total} ok, ${warn} warning${warn !== 1 ? "s" : ""}, ${fail} failure${fail !== 1 ? "s" : ""}${skippedNote}`,
	);

	lines.push(...renderRecoveryGuidance(report.recovery_guidance ?? []));

	if (report.hasFailures) {
		lines.push(
			"  ❌ Prerequisites not satisfied — fix failures above before running gates\n",
		);
	} else if (warn > 0) {
		lines.push(
			"  ⚠️  Some prerequisites need attention — gates may produce warnings\n",
		);
	} else {
		lines.push("  ✅ All prerequisites satisfied\n");
	}

	return lines.join("\n");
}
