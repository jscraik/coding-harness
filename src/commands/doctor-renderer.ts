import { renderRecoveryGuidance } from "./doctor-recovery.js";
import type { CheckStatus, DoctorReport } from "./doctor.js";

const STATUS_ICONS: Record<CheckStatus, string> = {
	ok: "✅",
	warn: "⚠️ ",
	fail: "❌",
	skip: "⏭️ ",
};

const CATEGORIES: Array<["tool" | "file" | "config" | "ci", string]> = [
	["tool", "Tools"],
	["file", "Required Files"],
	["config", "Contract Configuration"],
	["ci", "CI Setup"],
];

function renderCategory(
	report: DoctorReport,
	category: string,
	label: string,
): string[] {
	const checks = report.checks.filter((check) => check.category === category);
	if (checks.length === 0) {
		return [];
	}
	const labelWidth = Math.max(...checks.map((check) => check.label.length)) + 2;
	const lines = [`  ${label}`];
	for (const check of checks) {
		const icon = STATUS_ICONS[check.status];
		lines.push(
			`    ${icon}  ${check.label.padEnd(labelWidth)}${check.message}`,
		);
		if (check.fix && check.status !== "ok" && check.status !== "skip") {
			lines.push(`         Fix: ${check.fix}`);
		}
	}
	return [...lines, ""];
}

function renderSummary(report: DoctorReport): string {
	const { ok, warn, fail, skip } = report.counts;
	const total = ok + warn + fail;
	const skippedNote = skip > 0 ? `, ${skip} skipped` : "";
	return `  Results: ${ok}/${total} ok, ${warn} warning${warn !== 1 ? "s" : ""}, ${fail} failure${fail !== 1 ? "s" : ""}${skippedNote}`;
}

function renderFinalStatus(report: DoctorReport): string {
	if (report.hasFailures) {
		return "  ❌ Prerequisites not satisfied — fix failures above before running gates\n";
	}
	if (report.counts.warn > 0) {
		return "  ⚠️  Some prerequisites need attention — gates may produce warnings\n";
	}
	return "  ✅ All prerequisites satisfied\n";
}

/** Renders a human-readable DoctorReport for terminal output. */
export function renderDoctorReport(report: DoctorReport): string {
	const lines: string[] = [];

	lines.push(`\nHarness Doctor — ${report.dir}`);
	lines.push(`Checked at ${new Date(report.timestamp).toISOString()}\n`);

	for (const [category, label] of CATEGORIES) {
		lines.push(...renderCategory(report, category, label));
	}

	lines.push(renderSummary(report));
	lines.push(...renderRecoveryGuidance(report.recovery_guidance ?? []));
	lines.push(renderFinalStatus(report));

	return lines.join("\n");
}
