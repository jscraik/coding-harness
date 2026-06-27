import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
	FitnessFinding,
	FitnessLane,
	FitnessLaneStatus,
} from "./types.js";
import {
	artifactStatus,
	emptyDetailsFinding,
	isArtifactRecord,
	requiredRecordArray,
} from "./artifact-evidence.js";
import { firstString, gateArtifactFindings } from "./gate-artifact-findings.js";
import { FITNESS_COMMANDS } from "./commands.js";

/** Public API export. */
export interface FitnessArtifactReportOptions {
	artifactsDir?: string;
	qualitySizeReportPath?: string;
	typecheckReportPath?: string;
	lintReportPath?: string;
	behaviorTestsReportPath?: string;
	auditTrackingReportPath?: string;
	advisoryReviewReportPath?: string;
}

export const QUALITY_LANE_ID = "quality-structure";
export const TYPECHECK_LANE_ID = "type-safety";
export const LINT_LANE_ID = "static-lint";
export const BEHAVIOR_LANE_ID = "behavior-proof";
export const FEEDBACK_LANE_ID = "feedback-learning";

const QUALITY_SIZE_METRIC_KEYS: Record<string, readonly [string, string]> = {
	file_lines: ["moduleLogicalLines", "maxModuleLogicalLines"],
	function_lines: ["functionLogicalLines", "maxFunctionLogicalLines"],
	function_complexity: ["cyclomaticComplexity", "maxCyclomaticComplexity"],
	test_file_lines: ["testLogicalLines", "maxTestLogicalLines"],
};

function readJsonFile(path: string): unknown {
	return JSON.parse(readFileSync(path, "utf8"));
}

function asRecords(value: unknown): Record<string, unknown>[] {
	return Array.isArray(value) ? value.filter(isArtifactRecord) : [];
}

/** Resolve an explicit or conventional fitness artifact path. */
export function conventionalArtifactPath(
	artifactsDir: string | undefined,
	explicitPath: string | undefined,
	filename: string,
): string | undefined {
	if (explicitPath) return explicitPath;
	if (!artifactsDir) return undefined;
	const candidate = join(artifactsDir, filename);
	return existsSync(candidate) ? candidate : undefined;
}

/** Convert quality:size artifact findings into fitness lane findings. */
function qualitySizeFindings(path: string): FitnessFinding[] {
	return gateArtifactFindings({
		path,
		detailsField: "findings",
		lane: QUALITY_LANE_ID,
		command: FITNESS_COMMANDS.QUALITY_SIZE,
		principle: "reduce_cognitive_load",
		enforcement: "quality_structure",
		idPrefix: "quality-size",
		title: "Code size or complexity budget exceeded",
		severity: "error",
		risk: "Structural complexity increases review load and makes generated changes harder to safely reason about.",
		claimBoundary:
			"Quality structure evidence only; this does not prove tests, PR checks, review state, or merge readiness.",
		messageFields: ["message", "reason"],
		fileFields: ["path", "file"],
		lineFields: ["line"],
		decorateFinding: enrichQualitySizeFinding,
	});
}

function enrichQualitySizeFinding(
	finding: FitnessFinding,
	record: Record<string, unknown>,
): FitnessFinding {
	const metrics = qualitySizeMetrics(record);
	return {
		...finding,
		...(metrics ? { metrics } : {}),
		requiredFix: {
			objective:
				"Reduce structural complexity while preserving public behavior.",
			constraints: [
				"Preserve exported function signatures unless the finding explicitly permits an API change.",
				"Keep response shapes, logging behavior, and side effects equivalent unless a test-backed change is intentional.",
				"Prefer extracting validation, pure helper logic, and side-effect orchestration behind named seams.",
				"Add or update related tests when extraction changes behavior boundaries.",
			],
		},
		acceptanceCriteria: [
			"pnpm run quality:size reports no finding for this location.",
			"pnpm run test:related passes for the changed files.",
		],
	};
}

function qualitySizeMetrics(
	record: Record<string, unknown>,
): Record<string, number> | undefined {
	const kind = typeof record.kind === "string" ? record.kind : undefined;
	const actual = typeof record.actual === "number" ? record.actual : undefined;
	const max = typeof record.max === "number" ? record.max : undefined;
	if (actual === undefined || max === undefined) return undefined;
	const [actualKey, maxKey] = QUALITY_SIZE_METRIC_KEYS[kind ?? ""] ?? [
		"actual",
		"max",
	];
	return { [actualKey]: actual, [maxKey]: max };
}

/** Convert typecheck artifact failures into fitness lane findings. */
function typecheckFindings(path: string): FitnessFinding[] {
	return gateArtifactFindings({
		path,
		detailsField: "failures",
		lane: TYPECHECK_LANE_ID,
		command: FITNESS_COMMANDS.TYPECHECK_ARTIFACT,
		principle: "prove_type_safety",
		enforcement: "type_safety",
		idPrefix: "typecheck",
		title: "Type safety failure",
		severity: "error",
		risk: "Type errors break the repository contract before runtime behavior can be trusted.",
		claimBoundary:
			"Typecheck evidence only; this does not prove tests, PR checks, review state, or merge readiness.",
		messageFields: ["message", "diagnostic", "code"],
		fileFields: ["path", "file"],
		lineFields: ["line"],
	});
}

/** Convert lint artifact findings into fitness lane findings. */
function lintFindings(path: string): FitnessFinding[] {
	return gateArtifactFindings({
		path,
		detailsField: "findings",
		lane: LINT_LANE_ID,
		command: FITNESS_COMMANDS.LINT_ARTIFACT,
		principle: "preserve_static_contracts",
		enforcement: "static_analysis",
		idPrefix: "lint",
		title: "Static lint finding",
		severity: "error",
		risk: "Static-analysis drift weakens shared code contracts and can hide mechanical defects.",
		claimBoundary:
			"Lint evidence only; this does not prove tests, PR checks, review state, or merge readiness.",
		messageFields: ["message", "reason", "rule"],
		fileFields: ["path", "file"],
		lineFields: ["line"],
	});
}

/** Convert behavior-test artifact failures into fitness lane findings. */
function behaviorTestFindings(path: string): FitnessFinding[] {
	const report = readJsonFile(path);
	const result = requiredRecordArray(
		report,
		"failures",
		path,
		BEHAVIOR_LANE_ID,
		FITNESS_COMMANDS.BEHAVIOR_TESTS,
		"prove_behavior_outcomes",
		"hard_blocker",
	);
	if ("malformed" in result) return result.malformed;
	const records = result.records;
	const status = artifactStatus(report);
	if ((status === "fail" || status === "warn") && records.length === 0) {
		return [
			emptyDetailsFinding({
				path,
				lane: BEHAVIOR_LANE_ID,
				command: FITNESS_COMMANDS.BEHAVIOR_TESTS,
				principle: "prove_behavior_outcomes",
				enforcement: "hard_blocker",
				status,
			}),
		];
	}
	return records.map((failure, index) => ({
		id: `behavior-tests:${firstString(failure, ["name", "test"]) ?? index}`,
		title: "Behavior proof failure",
		severity: "error",
		lane: BEHAVIOR_LANE_ID,
		principle: "prove_behavior_outcomes",
		enforcement: "hard_blocker",
		evidence: {
			message:
				firstString(failure, ["message", "name", "test"]) ??
				"Behavior test gate reported a failure.",
		},
		risk: "Behavior proof is failing, so the implementation outcome is not locally proven.",
		recommendedCommand: FITNESS_COMMANDS.BEHAVIOR_TESTS,
		claimBoundary:
			"Behavior-test evidence only; this does not prove PR checks, review state, tracker state, or merge readiness.",
	}));
}

/** Convert audit-tracking artifact failures into feedback lane findings. */
function auditTrackingFindings(path: string): FitnessFinding[] {
	const report = readJsonFile(path);
	const result = requiredRecordArray(
		report,
		"failures",
		path,
		FEEDBACK_LANE_ID,
		FITNESS_COMMANDS.AUDIT_TRACKING,
		"compound_feedback_to_harness",
		"hard_blocker",
	);
	if ("malformed" in result) return result.malformed;
	const records = result.records;
	const status = artifactStatus(report);
	if ((status === "fail" || status === "warn") && records.length === 0) {
		return [
			emptyDetailsFinding({
				path,
				lane: FEEDBACK_LANE_ID,
				command: FITNESS_COMMANDS.AUDIT_TRACKING,
				principle: "compound_feedback_to_harness",
				enforcement: "hard_blocker",
				status,
			}),
		];
	}
	return records.map((failure, index) => ({
		id: `harness-audit-tracking:${firstString(failure, ["name"]) ?? index}`,
		title: "Harness audit tracking contract failure",
		severity: "critical",
		lane: FEEDBACK_LANE_ID,
		principle: "compound_feedback_to_harness",
		enforcement: "hard_blocker",
		evidence: {
			message:
				firstString(failure, ["message", "name"]) ??
				"Harness audit tracking reported a missing contract.",
		},
		risk: "Repeated steering cannot compound if the harness audit trail is not intact.",
		recommendedCommand: FITNESS_COMMANDS.AUDIT_TRACKING,
		claimBoundary:
			"Feedback-learning evidence only; this does not prove tests, CI, review state, or merge readiness.",
	}));
}

/** Convert advisory review artifacts into non-blocking fitness findings. */
function advisoryReviewFindings(path: string): FitnessFinding[] {
	const report = readJsonFile(path);
	const records =
		report && typeof report === "object"
			? asRecords((report as Record<string, unknown>).findings)
			: [];
	return records.map((finding, index) => ({
		id: `ai-review-advisory:${firstString(finding, ["title"]) ?? index}`,
		title: firstString(finding, ["title"]) ?? "AI review advisory finding",
		severity: "warning",
		lane: "ai-review-advisory",
		principle: "compound_feedback_to_harness",
		enforcement: "advisory",
		evidence: {
			message:
				firstString(finding, ["message", "title"]) ??
				"AI-assisted review reported an advisory finding.",
		},
		risk: "Advisory review feedback may improve the patch but does not independently block deterministic local gates.",
		recommendedCommand: FITNESS_COMMANDS.AUTOREVIEW,
		claimBoundary:
			"AI review is advisory evidence only; deterministic gates remain the blocking authority.",
	}));
}

function applyLaneArtifact(
	lane: FitnessLane | undefined,
	path: string | undefined,
	findingsForPath: (path: string) => FitnessFinding[],
): void {
	if (!lane || !path) return;
	lane.findings = findingsForPath(path);
	lane.status = laneStatus(lane.findings);
	lane.evidenceSource = path;
}

function laneStatus(findings: readonly FitnessFinding[]): FitnessLaneStatus {
	if (
		findings.some(
			(finding) =>
				finding.severity === "critical" || finding.severity === "error",
		)
	) {
		return "fail";
	}
	if (findings.some((finding) => finding.severity === "warning")) return "warn";
	return "pass";
}

/** Add or refresh the optional advisory review lane when a report is supplied. */
function maybeAddAdvisoryLane(
	lanes: FitnessLane[],
	path: string | undefined,
): void {
	if (!path) return;
	const findings = advisoryReviewFindings(path);
	const advisoryLane: FitnessLane = {
		id: "ai-review-advisory",
		label: "AI review advisory",
		command: FITNESS_COMMANDS.AUTOREVIEW,
		principle: "compound_feedback_to_harness",
		enforcement: "advisory",
		status: findings.length > 0 ? "warn" : "pass",
		evidenceSource: path,
		findings,
	};
	const existing = lanes.find((lane) => lane.id === advisoryLane.id);
	if (existing) {
		existing.status = advisoryLane.status;
		existing.evidenceSource = advisoryLane.evidenceSource;
		existing.findings = advisoryLane.findings;
		return;
	}
	lanes.push(advisoryLane);
}

/** Apply local gate artifacts to their matching fitness lanes. */
export function applyFitnessArtifactReports(
	lanes: FitnessLane[],
	options: FitnessArtifactReportOptions,
): void {
	applyLaneArtifact(
		lanes.find((lane) => lane.id === QUALITY_LANE_ID),
		conventionalArtifactPath(
			options.artifactsDir,
			options.qualitySizeReportPath,
			"quality-size.json",
		),
		qualitySizeFindings,
	);
	applyLaneArtifact(
		lanes.find((lane) => lane.id === TYPECHECK_LANE_ID),
		conventionalArtifactPath(
			options.artifactsDir,
			options.typecheckReportPath,
			"typecheck.json",
		),
		typecheckFindings,
	);
	applyLaneArtifact(
		lanes.find((lane) => lane.id === LINT_LANE_ID),
		conventionalArtifactPath(
			options.artifactsDir,
			options.lintReportPath,
			"lint.json",
		),
		lintFindings,
	);
	applyLaneArtifact(
		lanes.find((lane) => lane.id === BEHAVIOR_LANE_ID),
		conventionalArtifactPath(
			options.artifactsDir,
			options.behaviorTestsReportPath,
			"behavior-tests.json",
		),
		behaviorTestFindings,
	);
	applyLaneArtifact(
		lanes.find((lane) => lane.id === FEEDBACK_LANE_ID),
		conventionalArtifactPath(
			options.artifactsDir,
			options.auditTrackingReportPath,
			"harness-audit-tracking.json",
		),
		auditTrackingFindings,
	);
	maybeAddAdvisoryLane(
		lanes,
		conventionalArtifactPath(
			options.artifactsDir,
			options.advisoryReviewReportPath,
			"autoreview.json",
		),
	);
}
