import { readFileSync } from "node:fs";
import type {
	FitnessFinding,
	FitnessReport,
	FitnessTrendDelta,
	FitnessTrendDirection,
	FitnessTrendPoint,
	FitnessTrendSnapshot,
} from "./types.js";
import { validateFitnessReport } from "./validation.js";

function readJsonFile(path: string): unknown {
	return JSON.parse(readFileSync(path, "utf8"));
}

function flattenFindings(report: FitnessReport): FitnessFinding[] {
	return report.lanes.flatMap((lane) => lane.findings);
}

function trendPoint(report: FitnessReport): FitnessTrendPoint {
	const findings = flattenFindings(report);
	return {
		status: report.status,
		findings: report.summary.findings,
		failures: report.summary.failures,
		warnings: report.summary.warnings,
		lanesNeedingEvidence: report.summary.lanesNeedingEvidence,
		deterministicFindings: findings.filter(
			(finding) => finding.enforcement !== "advisory",
		).length,
		advisoryFindings: findings.filter(
			(finding) => finding.enforcement === "advisory",
		).length,
	};
}

function trendDelta(
	current: FitnessTrendPoint,
	previous: FitnessTrendPoint,
): FitnessTrendDelta {
	return {
		findings: current.findings - previous.findings,
		failures: current.failures - previous.failures,
		warnings: current.warnings - previous.warnings,
		lanesNeedingEvidence:
			current.lanesNeedingEvidence - previous.lanesNeedingEvidence,
		deterministicFindings:
			current.deterministicFindings - previous.deterministicFindings,
		advisoryFindings: current.advisoryFindings - previous.advisoryFindings,
	};
}

function blockingScore(point: FitnessTrendPoint): number {
	return point.failures * 100 + point.lanesNeedingEvidence * 10;
}

function trendDirection(
	current: FitnessTrendPoint,
	previous: FitnessTrendPoint | null,
): FitnessTrendDirection {
	if (!previous) return "baseline_unavailable";
	const currentScore = blockingScore(current);
	const previousScore = blockingScore(previous);
	if (currentScore < previousScore) return "improved";
	if (currentScore > previousScore) return "regressed";
	return "unchanged";
}

function loadBaselineReport(path: string): FitnessReport | null {
	try {
		const value = readJsonFile(path);
		const validation = validateFitnessReport(value);
		return validation.valid ? (value as FitnessReport) : null;
	} catch {
		return null;
	}
}

/** Build an advisory trend snapshot from a current fitness report and optional baseline. */
export function buildFitnessTrendSnapshot(
	currentReport: FitnessReport,
	baselinePath: string | undefined,
): FitnessTrendSnapshot {
	const current = trendPoint(currentReport);
	const baselineReport = baselinePath ? loadBaselineReport(baselinePath) : null;
	const previous = baselineReport ? trendPoint(baselineReport) : null;
	return {
		schemaVersion: "harness-fitness-trend-snapshot/v1",
		baselineRef: baselinePath ?? null,
		baselineStatus: previous ? "loaded" : "unavailable",
		current,
		previous,
		delta: previous ? trendDelta(current, previous) : null,
		direction: trendDirection(current, previous),
		claimBoundary:
			"Fitness trend snapshots are advisory history only; deterministic lanes remain the blocking authority.",
	};
}
