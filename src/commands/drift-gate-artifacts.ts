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

/**
 * Compute summary counters for drift findings grouped by baseline and severity, and count suppressed findings.
 *
 * @param findings - Active (non-suppressed) drift findings to summarize
 * @param suppressed - Suppressed drift findings; only used to count suppressed entries
 * @returns A DriftSummary containing:
 *  - `finding_count`: total number of active findings
 *  - `new_count`: number of active findings with `baseline_state === "new"`
 *  - `preexisting_count`: number of active findings with `baseline_state === "preexisting"`
 *  - `error_count`: number of active findings with `rule_result === "error"`
 *  - `suppressed_count`: total number of suppressed findings
 */
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

/**
 * Create the canonical north-star drift findings artifact reference.
 *
 * @returns The artifact reference object containing `type: "north-star-drift-findings"`, the canonical `path`, and the canonical `schemaVersion` for north-star drift findings.
 */
export function createNorthStarDriftArtifactRef(): NorthStarDriftArtifactRef {
	return {
		type: "north-star-drift-findings",
		path: getNorthStarDriftFindingsPath(),
		schemaVersion: NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS.driftFindings,
	};
}

/**
 * Get the canonical relative path for the north-star drift findings artifact.
 *
 * @returns The relative artifact path where north-star drift findings are stored
 */
export function getNorthStarDriftArtifactPath(): string {
	return getNorthStarDriftFindingsPath();
}

/**
 * Determines whether a drift finding is associated with the north-star ruleset.
 *
 * @param finding - The drift finding whose `rule_id` will be checked for the `status.north_star.` prefix
 * @returns `true` if `finding.rule_id` starts with `status.north_star.`, `false` otherwise
 */
function isNorthStarDriftFinding(finding: DriftFinding): boolean {
	return finding.rule_id.startsWith("status.north_star.");
}

/**
 * Builds the canonical north-star drift findings artifact from a drift-gate report.
 *
 * The resulting artifact conforms to the north-star drift findings schema and includes
 * metadata derived from the input report, a summary of counts, and the set of findings
 * included in the artifact (only findings with `rule_id` beginning with `status.north_star.`).
 *
 * @param report - The drift-gate report used to build the artifact
 * @returns The north-star drift findings artifact containing `schemaVersion`, `command`,
 *   `generatedAt`, `mode`, `repoRoot`, a `sourceReport` snapshot, a `summary` of counts,
 *   and the filtered `findings`
 */
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

/**
 * Writes the canonical north-star drift findings artifact for a drift-gate report to disk.
 *
 * The function builds the canonical artifact from `report`, resolves and validates the target
 * path relative to `repoRoot`, ensures the target directory exists, and writes a pretty-printed
 * JSON file terminated with a newline.
 *
 * @param repoRoot - Repository root used to resolve the artifact path on disk
 * @param report - Drift-gate report used to build the north-star drift findings artifact
 * @returns The canonical relative artifact path for the written artifact
 */
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
