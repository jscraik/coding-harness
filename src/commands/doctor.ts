/**
 * harness doctor — JSC-65
 *
 * Static prerequisite checker. Validates that all files, tools, and
 * configuration the harness gates depend on are present and structurally
 * sound — before running any gate. This surfaces the class of discovery
 * bugs described in JSC-65: requirements that were only found by running
 * a gate, getting a failure, and reverse-engineering the requirement.
 *
 * Exit codes:
 *   0 — all prerequisites satisfied (or only advisory warnings)
 *   1 — one or more prerequisites are missing / misconfigured
 *
 * Usage:
 *   harness doctor [--dir <path>] [--json]
 */

import { resolve } from "node:path";
import { inspectFlagValue } from "../lib/cli/parse-utils.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import {
	type NorthStarSurfaceClassificationArtifactRef,
	createNorthStarSurfaceClassificationArtifactRef,
	getNorthStarSurfaceClassificationArtifactPath,
	writeNorthStarSurfaceClassificationSnapshot,
} from "./doctor-artifacts.js";
import { DOCTOR_CHECKS } from "./doctor-checks.js";
import {
	type RecoveryGuidance,
	attachRecoveryGuidance,
	renderRecoveryGuidance,
} from "./doctor-recovery.js";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Outcome state for an individual doctor prerequisite check. */
export type CheckStatus = "ok" | "warn" | "fail" | "skip";

/** Structured result for one prerequisite or policy check. */
export interface DoctorCheck {
	/** Unique check ID */
	id: string;
	/** Category: 'tool' | 'file' | 'config' | 'ci' */
	category: "tool" | "file" | "config" | "ci";
	/** Human-readable label */
	label: string;
	/** Status after evaluation */
	status: CheckStatus;
	/** Details message explaining the status */
	message: string;
	/**
	 * Actionable fix command or instruction shown when status is fail/warn.
	 * Implements the JSC-68 pattern (fix guidance on findings).
	 */
	fix?: string;
}

/** Complete machine-readable report produced by `harness doctor`. */
export interface DoctorReport {
	version: string;
	dir: string;
	timestamp: string;
	checks: DoctorCheck[];
	counts: { ok: number; warn: number; fail: number; skip: number };
	/** true if any check is 'fail' */
	hasFailures: boolean;
	/** Sidecar artifacts written for downstream guardrails and audits. */
	artifact_refs?: NorthStarSurfaceClassificationArtifactRef[];
	/** Post-init manual step checklist (shown when installing) */
	postInitChecklist?: string[];
	/** Human-readable recovery guidance derived from failed north-star checks */
	recovery_guidance?: RecoveryGuidance[];
}

/** Options accepted by the doctor command runner. */
export interface DoctorOptions {
	dir?: string;
	json?: boolean;
	/** If true, attempt auto-fix where possible (e.g. seeding files) */
	fix?: boolean;
}

// ─── Post-init checklist ──────────────────────────────────────────────────────

const POST_INIT_CHECKLIST = [
	"Set up NPM auth for @brainwav private packages in CI (add NPM_TOKEN to CircleCI env vars)",
	"Add GH_TOKEN / GITHUB_PERSONAL_ACCESS_TOKEN to CircleCI project settings",
	"Seed drift-gate baseline: harness drift-gate --seed-baseline",
	"Update memory.json closeout at the end of each session: set closeout.forjamie_updated = true",
	"Review docs/roadmap/agent-first-status.md and fill in your current agent rollout state",
];

// ─── Reporting ────────────────────────────────────────────────────────────────

const STATUS_ICONS: Record<CheckStatus, string> = {
	ok: "✅",
	warn: "⚠️ ",
	fail: "❌",
	skip: "⏭️ ",
};

function renderReport(report: DoctorReport): string {
	const lines: string[] = [];

	lines.push(`\nHarness Doctor — ${report.dir}`);
	lines.push(`Checked at ${new Date(report.timestamp).toLocaleString()}\n`);

	// Group by category
	const categories: Array<["tool" | "file" | "config" | "ci", string]> = [
		["tool", "Tools"],
		["file", "Required Files"],
		["config", "Contract Configuration"],
		["ci", "CI Setup"],
	];

	for (const [cat, catLabel] of categories) {
		const catChecks = report.checks.filter((c) => c.category === cat);
		if (catChecks.length === 0) continue;

		lines.push(`  ${catLabel}`);
		const labelWidth = Math.max(...catChecks.map((c) => c.label.length)) + 2;
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

/**
 * Produce a tally of checks grouped by their status.
 *
 * @returns An object with numeric counts for each status: `ok`, `warn`, `fail`, and `skip`
 */

function countChecks(checks: DoctorCheck[]): DoctorReport["counts"] {
	const counts = { ok: 0, warn: 0, fail: 0, skip: 0 };
	for (const check of checks) {
		counts[check.status]++;
	}
	return counts;
}

/**
 * Run prerequisite checks for a target directory and produce a DoctorReport.
 *
 * Executes each check from DOCTOR_CHECKS against the resolved directory, aggregates counts and overall failure state,
 * and attempts to write a North Star surface classification artifact; if artifact creation fails the error is captured
 * as an additional failing check and included in the returned report.
 *
 * @param options - Optional settings; `options.dir` overrides the current working directory used for checks.
 * @returns A DoctorReport containing metadata, the full list of checks, aggregated `counts`, `hasFailures`, optional `artifact_refs`, and `postInitChecklist`.
 */
export function runDoctor(options: DoctorOptions = {}): DoctorReport {
	const dir = resolve(options.dir ?? process.cwd());

	const checks = DOCTOR_CHECKS.map((fn) => fn(dir));

	const report: DoctorReport = {
		version: "unknown",
		dir,
		timestamp: new Date().toISOString(),
		checks,
		counts: countChecks(checks),
		hasFailures: false,
		postInitChecklist: POST_INIT_CHECKLIST,
	};
	report.hasFailures = report.counts.fail > 0;

	attachRecoveryGuidance(report);

	try {
		writeNorthStarSurfaceClassificationSnapshot(dir, report);
		report.artifact_refs = [createNorthStarSurfaceClassificationArtifactRef()];
	} catch (error) {
		report.checks.push({
			id: "artifact:north-star-surface-classification",
			category: "config",
			label: "North-star surface classification artifact",
			status: "fail",
			message: `failed to write ${getNorthStarSurfaceClassificationArtifactPath()}: ${sanitizeError(error)}`,
			fix: "Confirm .harness/guardrails/north-star is writable, then rerun harness doctor --json.",
		});
		report.counts = countChecks(report.checks);
		report.hasFailures = true;
	}

	return report;
}

/**
 * CLI entry point for `harness doctor`.
 * Returns exit code: 0 = all ok/warn, 1 = failures present.
 */
export function runDoctorCLI(args: string[], getVersion: () => string): number {
	if (args.includes("--help") || args.includes("-h")) {
		return 0;
	}

	const jsonFlag = args.includes("--json");
	const checklistFlag = args.includes("--checklist");
	const dirFlag = inspectFlagValue(args, "--dir");
	if (dirFlag.missingValue) {
		console.error("Error: --dir requires a path");
		return 2;
	}

	const opts: DoctorOptions = {};
	if (dirFlag.value) opts.dir = dirFlag.value;

	const report = runDoctor(opts);
	report.version = getVersion();

	if (checklistFlag) {
		// checklist display removed; future: render POST_INIT_CHECKLIST here
		return 0;
	}

	if (jsonFlag) {
		console.info(JSON.stringify(report));
	} else {
		process.stdout.write(renderReport(report));
	}

	return report.hasFailures ? 1 : 0;
}
