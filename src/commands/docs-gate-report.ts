import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { sanitizeError } from "../lib/input/sanitize.js";
import { validatePath } from "../lib/input/validator.js";
import { appendContradictionHistory } from "./docs-gate-contradiction-history.js";
import type {
	ContradictionFinding,
	DocsFinding,
	DocsGateExecutionContext,
	DocsGateMode,
	DocsGateOutcome,
	DocsGateReport,
	DocsGateStatus,
} from "./docs-gate-types.js";
import { DEFAULT_OUT_PATH } from "./docs-gate-types.js";

interface ReportContext {
	mode: DocsGateMode;
	repoRoot: string;
	changedFiles: string[];
	executionContext: DocsGateExecutionContext;
}

interface ReportEvaluation {
	categories: DocsGateReport["categories"];
	requiredSurfaces: string[];
	missing: string[];
	unknownFiles: string[];
	contradictionFindings: ContradictionFinding[];
	outcome: DocsGateOutcome;
	findings: DocsFinding[];
	archiveCounts: Partial<DocsGateReport["summary"]>;
}

/** Build a complete docs-gate report with computed status and finding counts. */
export function buildReport(
	context: ReportContext,
	evaluation: ReportEvaluation,
	baseRef?: string,
): DocsGateReport {
	const report = baseReport(context, evaluation, baseRef);
	const errorCount = evaluation.findings.filter(
		(finding) => finding.severity === "error",
	).length;
	const warningCount = evaluation.findings.filter(
		(finding) => finding.severity === "warning",
	).length;
	report.status = statusFor(errorCount, warningCount, context.mode);
	report.summary.error_count = errorCount;
	report.summary.warning_count = warningCount;
	return report;
}

/** Build the base docs-gate report before status-specific counts are applied. */
export function baseReport(
	context: ReportContext,
	evaluation: ReportEvaluation,
	baseRef?: string,
): DocsGateReport {
	return {
		schemaVersion: "1.0.0",
		command: "docs-gate",
		mode: context.mode,
		status: "success",
		outcome: evaluation.outcome,
		error_class: "none",
		generated_at: new Date().toISOString(),
		repo_root: context.repoRoot,
		base_ref: baseRef,
		execution_context: context.executionContext,
		changed_files: context.changedFiles,
		categories: evaluation.categories,
		summary: {
			finding_count: evaluation.findings.length,
			error_count: 0,
			warning_count: 0,
			required_surface_count: evaluation.requiredSurfaces.length,
			missing_surface_count: evaluation.missing.length,
			contradiction_count: evaluation.contradictionFindings.length,
			bootstrap_gap_count: 0,
			unknown_category_count: evaluation.unknownFiles.length,
			...evaluation.archiveCounts,
		},
		findings: evaluation.findings,
	};
}

function statusFor(
	errorCount: number,
	warningCount: number,
	mode: DocsGateMode,
): DocsGateStatus {
	if (errorCount > 0) return mode === "required" ? "blocked" : "partial";
	return warningCount > 0 ? "partial" : "success";
}

/** Persist the docs-gate report and contradiction-history side effects. */
export function writeReportAndHistory(
	report: DocsGateReport,
	repoRoot: string,
	outPath: string | undefined,
	evaluation: ReportEvaluation,
): void {
	try {
		writeReport(report, repoRoot, outPath ?? DEFAULT_OUT_PATH);
		appendContradictionHistory(repoRoot, evaluation.contradictionFindings);
	} catch (error) {
		report.outcome = "runtime_error";
		report.error_class = "io";
		report.status = "blocked";
		report.findings.push(writeErrorFinding(error, outPath ?? DEFAULT_OUT_PATH));
		report.summary.finding_count = report.findings.length;
		report.summary.error_count = report.findings.filter(
			(finding) => finding.severity === "error",
		).length;
	}
}

/** Best-effort fallback report writer for runtime-error closeout paths. */
export function writeFallbackReport(
	report: DocsGateReport,
	repoRoot: string,
): void {
	try {
		writeReport(report, repoRoot, DEFAULT_OUT_PATH);
	} catch (error) {
		console.warn(
			"[docs-gate] Warning: failed to write fallback report to '" +
				DEFAULT_OUT_PATH +
				"': " +
				(error instanceof Error ? error.message : String(error)),
		);
	}
}

function writeReport(
	report: DocsGateReport,
	repoRoot: string,
	outPath: string,
): void {
	const resolvedOutPath = validatePath(repoRoot, outPath);
	mkdirSync(dirname(resolvedOutPath), { recursive: true });
	writeFileSync(
		resolvedOutPath,
		`${JSON.stringify(report, null, 2)}\n`,
		"utf-8",
	);
}

function writeErrorFinding(error: unknown, outPath: string): DocsFinding {
	return {
		rule_id: "report.output.write_error",
		category: "system",
		surface: "report",
		rule_result: "error",
		result: "error",
		severity: "error",
		message: `Failed to write report output: ${sanitizeError(error)}`,
		path: outPath,
	};
}

/** Resolve the process exit code for a docs-gate outcome and mode. */
export function exitCodeFor(
	outcome: DocsGateOutcome,
	mode: DocsGateMode,
): number {
	if (outcome === "drift_detected") return mode === "required" ? 10 : 0;
	if (outcome === "bootstrap_gap") return 11;
	if (outcome === "trust_mismatch") return 12;
	if (outcome === "policy_error") return 13;
	return outcome === "runtime_error" ? 14 : 0;
}
