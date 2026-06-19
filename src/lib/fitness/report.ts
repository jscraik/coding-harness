import { readFileSync } from "node:fs";
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
	violations?: unknown;
}

/** Public API export. */
export interface BuildFitnessReportOptions {
	architectureReportPath?: string;
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
			id: "quality-budget",
			label: "Quality budget",
			command: "pnpm run quality:size",
			principle: "reduce_cognitive_load",
			enforcement: "quality_budget",
			status: "not_run",
			evidenceSource: "package.json scripts.quality:size",
			findings: [],
		},
		{
			id: "behavior-proof",
			label: "Behavior proof",
			command: "pnpm run quality:behavior-tests",
			principle: "prove_behavior_outcomes",
			enforcement: "hard_blocker",
			status: "not_run",
			evidenceSource: "package.json scripts.quality:behavior-tests",
			findings: [],
		},
		{
			id: "feedback-learning",
			label: "Feedback learning",
			command: "pnpm run harness:audit-tracking",
			principle: "compound_feedback_to_harness",
			enforcement: "advisory",
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

function normalizeArchitectureReport(path: string): FitnessFinding[] {
	const report = asArchitectureCheckReport(readJsonFile(path));
	if (!Array.isArray(report.violations)) return [];
	return report.violations
		.map((violation) =>
			normalizeArchitectureViolation(violation as ArchitectureCheckViolation),
		)
		.filter((finding): finding is FitnessFinding => finding !== undefined);
}

function reportStatus(lanes: readonly FitnessLane[]): FitnessReport["status"] {
	if (lanes.some((lane) => lane.status === "fail")) return "fail";
	if (lanes.some((lane) => lane.status === "not_run")) return "needs_evidence";
	if (lanes.some((lane) => lane.status === "warn")) return "warn";
	return "pass";
}

/** Build a normalized repository fitness report over existing harness gates. */
export function buildFitnessReport(
	options: BuildFitnessReportOptions = {},
): FitnessReport {
	const lanes = createBaseLanes();
	const architectureLane = lanes.find(
		(lane) => lane.id === ARCHITECTURE_LANE_ID,
	);
	if (options.architectureReportPath && architectureLane) {
		architectureLane.findings = normalizeArchitectureReport(
			options.architectureReportPath,
		);
		architectureLane.status = architectureLaneStatus(architectureLane.findings);
		architectureLane.evidenceSource = options.architectureReportPath;
	}
	const findings = lanes.flatMap((lane) => lane.findings);
	const failures = findings.filter(
		(finding) =>
			finding.severity === "critical" || finding.severity === "error",
	).length;
	const warnings = findings.filter(
		(finding) => finding.severity === "warning",
	).length;
	return {
		schemaVersion: "harness-fitness/v1",
		status: reportStatus(lanes),
		generatedAt: (options.now ?? new Date()).toISOString(),
		summary: {
			lanes: lanes.length,
			findings: findings.length,
			failures,
			warnings,
			lanesNeedingEvidence: lanes.filter((lane) => lane.status === "not_run")
				.length,
		},
		lanes,
		claimBoundaries: [
			"Fitness reports normalize local gate evidence only.",
			"Run the referenced commands before using a lane as proof.",
			"Local fitness evidence does not prove PR, CI, review-thread, tracker, or merge-readiness truth.",
		],
	};
}
