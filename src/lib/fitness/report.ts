import { readFileSync } from "node:fs";
import {
	applyFitnessArtifactReports,
	BEHAVIOR_LANE_ID,
	conventionalArtifactPath,
	FEEDBACK_LANE_ID,
	LINT_LANE_ID,
	type FitnessArtifactReportOptions,
	QUALITY_LANE_ID,
	TYPECHECK_LANE_ID,
} from "./artifact-normalizers.js";
import { buildFitnessTrendSnapshot } from "./trend.js";
import type {
	FitnessEnforcement,
	FitnessFinding,
	FitnessLane,
	FitnessLaneStatus,
	FitnessReport,
	FitnessSeverity,
} from "./types.js";

interface ArchitectureCheckViolation {
	rule?: unknown;
	severity?: unknown;
	file?: unknown;
	message?: unknown;
	baselined?: unknown;
}

interface ArchitectureCheckReport {
	status?: unknown;
	violations?: unknown;
}

/** Public API export. */
export interface BuildFitnessReportOptions
	extends FitnessArtifactReportOptions {
	architectureReportPath?: string;
	trendBaselinePath?: string;
	now?: Date;
}

const ARCHITECTURE_LANE_ID = "architecture-fitness";

function createBaseLanes(): FitnessLane[] {
	return [
		{
			id: ARCHITECTURE_LANE_ID,
			label: "Architecture fitness",
			command: "pnpm architecture:check",
			principle: "protect_deep_module_boundaries",
			enforcement: "architecture_fitness",
			status: "not_run",
			evidenceSource: "package.json scripts.architecture:check",
			findings: [],
		},
		{
			id: QUALITY_LANE_ID,
			label: "Quality budget",
			command: "pnpm run quality:size",
			principle: "reduce_cognitive_load",
			enforcement: "quality_budget",
			status: "not_run",
			evidenceSource: "package.json scripts.quality:size",
			findings: [],
		},
		{
			id: TYPECHECK_LANE_ID,
			label: "Type safety",
			command: "pnpm run fitness:typecheck-artifact",
			principle: "prove_type_safety",
			enforcement: "type_safety",
			status: "not_run",
			evidenceSource: "package.json scripts.fitness:typecheck-artifact",
			findings: [],
		},
		{
			id: LINT_LANE_ID,
			label: "Static lint",
			command: "pnpm run fitness:lint-artifact",
			principle: "preserve_static_contracts",
			enforcement: "static_analysis",
			status: "not_run",
			evidenceSource: "package.json scripts.fitness:lint-artifact",
			findings: [],
		},
		{
			id: BEHAVIOR_LANE_ID,
			label: "Behavior proof",
			command: "pnpm run quality:behavior-tests",
			principle: "prove_behavior_outcomes",
			enforcement: "hard_blocker",
			status: "not_run",
			evidenceSource: "package.json scripts.quality:behavior-tests",
			findings: [],
		},
		{
			id: FEEDBACK_LANE_ID,
			label: "Feedback learning",
			command: "pnpm run harness:audit-tracking",
			principle: "compound_feedback_to_harness",
			enforcement: "hard_blocker",
			status: "not_run",
			evidenceSource: "package.json scripts.harness:audit-tracking",
			findings: [],
		},
	];
}

function readJsonFile(path: string): unknown {
	return JSON.parse(readFileSync(path, "utf8"));
}

function asArchitectureCheckReport(value: unknown): ArchitectureCheckReport {
	if (!value || typeof value !== "object") {
		return {};
	}
	return value as ArchitectureCheckReport;
}

function normalizeArchitectureSeverity(
	severity: unknown,
	baselined: unknown,
): FitnessSeverity {
	if (baselined === true || severity === "baseline") return "info";
	if (severity === "critical") return "critical";
	if (severity === "warning" || severity === "warn") return "warning";
	return "error";
}

function normalizeArchitectureEnforcement(
	severity: FitnessSeverity,
): FitnessEnforcement {
	return severity === "info" ? "advisory" : "architecture_fitness";
}

function architectureLaneStatus(
	findings: readonly FitnessFinding[],
): FitnessLaneStatus {
	if (findings.some((finding) => finding.severity === "critical"))
		return "fail";
	if (findings.some((finding) => finding.severity === "error")) return "fail";
	if (findings.some((finding) => finding.severity === "warning")) return "warn";
	return "pass";
}

function architectureFindingTitle(rule: string): string {
	if (rule === "no-circular-deps")
		return "Circular dependency violates module boundary";
	if (rule === "commands-no-cross-import")
		return "Command facade imports another command facade";
	return `Architecture rule ${rule} reported a finding`;
}

function normalizeArchitectureViolation(
	violation: ArchitectureCheckViolation,
): FitnessFinding | undefined {
	const rule = typeof violation.rule === "string" ? violation.rule : undefined;
	const file = typeof violation.file === "string" ? violation.file : undefined;
	const message =
		typeof violation.message === "string"
			? violation.message
			: "Architecture check reported a finding.";
	if (!rule && !file) return undefined;
	const stableRule = rule ?? "unknown-rule";
	const stableFile = file ?? "unknown-file";
	const severity = normalizeArchitectureSeverity(
		violation.severity,
		violation.baselined,
	);
	return {
		id: `architecture:${stableRule}:${stableFile}`,
		title: architectureFindingTitle(stableRule),
		severity,
		lane: ARCHITECTURE_LANE_ID,
		principle: "protect_deep_module_boundaries",
		enforcement: normalizeArchitectureEnforcement(severity),
		evidence: {
			...(file ? { file } : {}),
			message,
		},
		risk: "Architecture boundary drift increases change amplification and makes agent repairs harder to localize.",
		recommendedCommand: "pnpm architecture:check",
		claimBoundary:
			"Architecture fitness evidence only; this does not prove tests, PR checks, review state, or merge readiness.",
	};
}

function malformedArchitectureArtifactFinding(
	path: string,
	message: string,
	severity: FitnessSeverity = "error",
): FitnessFinding {
	return {
		id: "architecture:artifact:malformed",
		title: "Architecture artifact is malformed",
		severity,
		lane: ARCHITECTURE_LANE_ID,
		principle: "protect_deep_module_boundaries",
		enforcement: "architecture_fitness",
		evidence: {
			file: path,
			message,
		},
		risk: "Malformed architecture evidence can mask real boundary regressions.",
		recommendedCommand: "pnpm architecture:check",
		claimBoundary:
			"Architecture artifact evidence only; regenerate the source gate before using this lane as proof.",
	};
}

function normalizeArchitectureViolations(
	path: string,
	violations: unknown[],
): FitnessFinding[] {
	const findings: FitnessFinding[] = [];
	for (const violation of violations) {
		if (
			!violation ||
			typeof violation !== "object" ||
			Array.isArray(violation)
		) {
			return [
				malformedArchitectureArtifactFinding(
					path,
					"Expected each violations[] entry to be an object.",
				),
			];
		}
		const finding = normalizeArchitectureViolation(
			violation as ArchitectureCheckViolation,
		);
		if (!finding) {
			return [
				malformedArchitectureArtifactFinding(
					path,
					"Expected each violations[] entry to include rule or file evidence.",
				),
			];
		}
		findings.push(finding);
	}
	return findings;
}

function normalizeArchitectureReport(path: string): FitnessFinding[] {
	const report = asArchitectureCheckReport(readJsonFile(path));
	if (!Array.isArray(report.violations)) {
		return [
			malformedArchitectureArtifactFinding(
				path,
				"Expected violations[] in architecture artifact JSON.",
			),
		];
	}
	const findings = normalizeArchitectureViolations(path, report.violations);
	if (
		(report.status === "fail" || report.status === "warn") &&
		findings.length === 0
	) {
		return [
			malformedArchitectureArtifactFinding(
				path,
				`Artifact status is ${report.status} but violations[] is empty.`,
				report.status === "warn" ? "warning" : "error",
			),
		];
	}
	return findings;
}

function reportStatus(lanes: readonly FitnessLane[]): FitnessReport["status"] {
	if (lanes.some((lane) => lane.status === "fail")) return "fail";
	if (lanes.some((lane) => lane.status === "not_run")) return "needs_evidence";
	if (lanes.some((lane) => lane.status === "warn")) return "warn";
	return "pass";
}

function applyArchitectureArtifact(
	lanes: FitnessLane[],
	options: BuildFitnessReportOptions,
): void {
	const path = conventionalArtifactPath(
		options.artifactsDir,
		options.architectureReportPath,
		"architecture.json",
	);
	const architectureLane = lanes.find(
		(lane) => lane.id === ARCHITECTURE_LANE_ID,
	);
	if (!path || !architectureLane) return;
	architectureLane.findings = normalizeArchitectureReport(path);
	architectureLane.status = architectureLaneStatus(architectureLane.findings);
	architectureLane.evidenceSource = path;
}

function fitnessSummary(
	lanes: readonly FitnessLane[],
	findings: readonly FitnessFinding[],
): FitnessReport["summary"] {
	return {
		lanes: lanes.length,
		findings: findings.length,
		failures: findings.filter(
			(finding) =>
				finding.severity === "critical" || finding.severity === "error",
		).length,
		warnings: findings.filter((finding) => finding.severity === "warning")
			.length,
		lanesNeedingEvidence: lanes.filter((lane) => lane.status === "not_run")
			.length,
	};
}

const FITNESS_SEVERITY_RANK: Record<FitnessFinding["severity"], number> = {
	critical: 0,
	error: 1,
	warning: 2,
	info: 3,
};

/** Select the highest-priority non-advisory fitness finding. */
export function selectTopDeterministicFitnessFinding(
	findings: readonly FitnessFinding[],
): FitnessFinding | null {
	const deterministicFindings = findings.filter(
		(finding) => finding.enforcement !== "advisory",
	);
	return (
		[...deterministicFindings].sort(
			(left, right) =>
				FITNESS_SEVERITY_RANK[left.severity] -
				FITNESS_SEVERITY_RANK[right.severity],
		)[0] ?? null
	);
}

/** Build a normalized repository fitness report over existing harness gates. */
export function buildFitnessReport(
	options: BuildFitnessReportOptions = {},
): FitnessReport {
	const lanes = createBaseLanes();
	applyArchitectureArtifact(lanes, options);
	applyFitnessArtifactReports(lanes, options);
	const findings = lanes.flatMap((lane) => lane.findings);
	const report: FitnessReport = {
		schemaVersion: "harness-fitness/v1",
		status: reportStatus(lanes),
		generatedAt: (options.now ?? new Date()).toISOString(),
		summary: fitnessSummary(lanes, findings),
		lanes,
		topDeterministicFinding: selectTopDeterministicFitnessFinding(findings),
		claimBoundaries: [
			"Fitness reports normalize local gate evidence only.",
			"Run the referenced commands before using a lane as proof.",
			"Local fitness evidence does not prove PR, CI, review-thread, tracker, or merge-readiness truth.",
		],
	};
	if (options.trendBaselinePath !== undefined) {
		report.trendSnapshot = buildFitnessTrendSnapshot(
			report,
			options.trendBaselinePath,
		);
	}
	return report;
}
