import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
	FitnessEnforcement,
	FitnessFinding,
	FitnessLane,
	FitnessPrinciple,
} from "./types.js";

/** Public API export. */
export interface FitnessArtifactReportOptions {
	artifactsDir?: string;
	qualitySizeReportPath?: string;
	behaviorTestsReportPath?: string;
	auditTrackingReportPath?: string;
	advisoryReviewReportPath?: string;
}

export const QUALITY_LANE_ID = "quality-budget";
export const BEHAVIOR_LANE_ID = "behavior-proof";
export const FEEDBACK_LANE_ID = "feedback-learning";

function readJsonFile(path: string): unknown {
	return JSON.parse(readFileSync(path, "utf8"));
}

function asRecords(value: unknown): Record<string, unknown>[] {
	return Array.isArray(value)
		? value.filter(
				(item): item is Record<string, unknown> =>
					!!item && typeof item === "object" && !Array.isArray(item),
			)
		: [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function requiredRecordArray(
	report: unknown,
	field: string,
	path: string,
	lane: string,
	command: string,
	principle: FitnessPrinciple,
	enforcement: FitnessEnforcement,
): { records: Record<string, unknown>[] } | { malformed: FitnessFinding[] } {
	if (!isRecord(report)) {
		return {
			malformed: [
				malformedArtifactFinding({
					path,
					lane,
					command,
					principle,
					enforcement,
					message: "Expected artifact JSON to be an object.",
				}),
			],
		};
	}
	const value = report[field];
	if (!Array.isArray(value)) {
		return {
			malformed: [
				malformedArtifactFinding({
					path,
					lane,
					command,
					principle,
					enforcement,
					message: `Expected ${field}[] in artifact JSON.`,
				}),
			],
		};
	}
	return { records: asRecords(value) };
}

function malformedArtifactFinding(args: {
	path: string;
	lane: string;
	command: string;
	principle: FitnessPrinciple;
	enforcement: FitnessEnforcement;
	message: string;
}): FitnessFinding {
	return {
		id: `${args.lane}:artifact:malformed`,
		title: "Fitness artifact is malformed",
		severity: "error",
		lane: args.lane,
		principle: args.principle,
		enforcement: args.enforcement,
		evidence: {
			file: args.path,
			message: args.message,
		},
		risk: "Malformed gate evidence can hide real blockers and produce false-ready fitness reports.",
		recommendedCommand: args.command,
		claimBoundary:
			"Malformed artifact evidence only; regenerate the source gate before using this lane as proof.",
	};
}

function firstString(
	value: Record<string, unknown>,
	fields: readonly string[],
): string | undefined {
	for (const field of fields) {
		const candidate = value[field];
		if (typeof candidate === "string" && candidate.trim().length > 0) {
			return candidate;
		}
	}
	return undefined;
}

function firstNumber(
	value: Record<string, unknown>,
	fields: readonly string[],
): number | undefined {
	for (const field of fields) {
		const candidate = value[field];
		if (typeof candidate === "number" && Number.isFinite(candidate)) {
			return candidate;
		}
	}
	return undefined;
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

function qualitySizeFindings(path: string): FitnessFinding[] {
	const report = readJsonFile(path);
	const result = requiredRecordArray(
		report,
		"findings",
		path,
		QUALITY_LANE_ID,
		"pnpm run quality:size",
		"reduce_cognitive_load",
		"quality_budget",
	);
	if ("malformed" in result) return result.malformed;
	const records = result.records;
	return records.map((finding, index) => {
		const file = firstString(finding, ["path", "file"]);
		const line = firstNumber(finding, ["line"]);
		return {
			id: `quality-size:${file ?? index}`,
			title: "Quality budget finding",
			severity: "error",
			lane: QUALITY_LANE_ID,
			principle: "reduce_cognitive_load",
			enforcement: "quality_budget",
			evidence: {
				...(file ? { file } : {}),
				...(line !== undefined ? { line } : {}),
				message:
					firstString(finding, ["message", "reason"]) ??
					"Quality budget check reported a finding.",
			},
			risk: "Quality budget drift increases review load and makes generated changes harder to safely reason about.",
			recommendedCommand: "pnpm run quality:size",
			claimBoundary:
				"Quality budget evidence only; this does not prove tests, PR checks, review state, or merge readiness.",
		};
	});
}

function behaviorTestFindings(path: string): FitnessFinding[] {
	const report = readJsonFile(path);
	const result = requiredRecordArray(
		report,
		"failures",
		path,
		BEHAVIOR_LANE_ID,
		"pnpm run quality:behavior-tests",
		"prove_behavior_outcomes",
		"hard_blocker",
	);
	if ("malformed" in result) return result.malformed;
	const records = result.records;
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
		recommendedCommand: "pnpm run quality:behavior-tests",
		claimBoundary:
			"Behavior-test evidence only; this does not prove PR checks, review state, tracker state, or merge readiness.",
	}));
}

function auditTrackingFindings(path: string): FitnessFinding[] {
	const report = readJsonFile(path);
	const result = requiredRecordArray(
		report,
		"failures",
		path,
		FEEDBACK_LANE_ID,
		"pnpm run harness:audit-tracking",
		"compound_feedback_to_harness",
		"hard_blocker",
	);
	if ("malformed" in result) return result.malformed;
	const records = result.records;
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
		recommendedCommand: "pnpm run harness:audit-tracking",
		claimBoundary:
			"Feedback-learning evidence only; this does not prove tests, CI, review state, or merge readiness.",
	}));
}

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
		recommendedCommand: "pnpm run autoreview",
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
	lane.status = lane.findings.length > 0 ? "fail" : "pass";
	lane.evidenceSource = path;
}

function maybeAddAdvisoryLane(
	lanes: FitnessLane[],
	path: string | undefined,
): void {
	if (!path) return;
	const findings = advisoryReviewFindings(path);
	const advisoryLane: FitnessLane = {
		id: "ai-review-advisory",
		label: "AI review advisory",
		command: "pnpm run autoreview",
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
