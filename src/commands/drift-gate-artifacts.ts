import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
	NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS,
	getNorthStarDriftFindingsPath,
} from "../lib/contract/north-star-artifacts.js";
import { validatePath } from "../lib/input/validator.js";
import type {
	DriftFinding,
	DriftGateMode,
	DriftOutcome,
	DriftStatus,
} from "./drift-gate.js";

/** Summary counters shared by drift-gate reports and follow-on artifacts. */
export interface DriftSummary {
	finding_count: number;
	new_count: number;
	preexisting_count: number;
	error_count: number;
	suppressed_count: number;
}

/** Reference to the canonical north-star drift findings artifact. */
export interface NorthStarDriftArtifactRef {
	type: "north-star-drift-findings";
	path: string;
	schemaVersion: typeof NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS.driftFindings;
}

interface DriftReportForArtifact {
	schemaVersion: "1.0.0";
	command: "drift-gate";
	mode: DriftGateMode;
	status: DriftStatus;
	outcome: DriftOutcome;
	generated_at: string;
	repo_root: string;
	summary: DriftSummary;
	findings: DriftFinding[];
}

interface NorthStarDriftFindingsArtifact {
	schemaVersion: typeof NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS.driftFindings;
	command: "drift-gate";
	generatedAt: string;
	mode: DriftGateMode;
	repoRoot: string;
	sourceReport: {
		schemaVersion: DriftReportForArtifact["schemaVersion"];
		generatedAt: string;
		status: DriftStatus;
		outcome: DriftOutcome;
	};
	summary: {
		findingCount: number;
		newCount: number;
		preexistingCount: number;
		errorCount: number;
		warningCount: number;
	};
	findings: DriftFinding[];
}

/** Build drift-gate summary counters from active and suppressed findings. */
export function summarizeDriftFindings(
	findings: DriftFinding[],
	suppressed: DriftFinding[],
): DriftSummary {
	return {
		finding_count: findings.length,
		new_count: findings.filter((f) => f.baseline_state === "new").length,
		preexisting_count: findings.filter(
			(f) => f.baseline_state === "preexisting",
		).length,
		error_count: findings.filter((f) => f.rule_result === "error").length,
		suppressed_count: suppressed.length,
	};
}

/** Return the canonical north-star drift artifact reference for reports. */
export function createNorthStarDriftArtifactRef(): NorthStarDriftArtifactRef {
	return {
		type: "north-star-drift-findings",
		path: getNorthStarDriftFindingsPath(),
		schemaVersion: NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS.driftFindings,
	};
}

/** Return the canonical relative path for north-star drift findings. */
export function getNorthStarDriftArtifactPath(): string {
	return getNorthStarDriftFindingsPath();
}

function isNorthStarDriftFinding(finding: DriftFinding): boolean {
	return finding.rule_id.startsWith("status.north_star.");
}

function buildNorthStarDriftFindingsArtifact(
	report: DriftReportForArtifact,
): NorthStarDriftFindingsArtifact {
	const findings = report.findings.filter(isNorthStarDriftFinding);
	return {
		schemaVersion: NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS.driftFindings,
		command: "drift-gate",
		generatedAt: report.generated_at,
		mode: report.mode,
		repoRoot: report.repo_root,
		sourceReport: {
			schemaVersion: report.schemaVersion,
			generatedAt: report.generated_at,
			status: report.status,
			outcome: report.outcome,
		},
		summary: {
			findingCount: findings.length,
			newCount: findings.filter((f) => f.baseline_state === "new").length,
			preexistingCount: findings.filter(
				(f) => f.baseline_state === "preexisting",
			).length,
			errorCount: findings.filter((f) => f.severity === "error").length,
			warningCount: findings.filter((f) => f.severity === "warning").length,
		},
		findings,
	};
}

/** Write the canonical north-star drift findings artifact and return its path. */
export function writeNorthStarDriftFindingsArtifact(
	repoRoot: string,
	report: DriftReportForArtifact,
): string {
	const artifactPath = getNorthStarDriftFindingsPath();
	const resolvedArtifactPath = validatePath(repoRoot, artifactPath);
	mkdirSync(dirname(resolvedArtifactPath), { recursive: true });
	writeFileSync(
		resolvedArtifactPath,
		`${JSON.stringify(buildNorthStarDriftFindingsArtifact(report), null, 2)}\n`,
		"utf-8",
	);
	return artifactPath;
}
