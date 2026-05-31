import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Schema version emitted by feedback-loop audit reports. */
export const FEEDBACK_LOOP_AUDIT_SCHEMA_VERSION = "feedback-loop-audit/v1";

/** Schema version expected for the tracked feedback-loop index. */
export const FEEDBACK_LOOP_INDEX_SCHEMA_VERSION = "feedback-loop-index/v1";

/** Lifecycle states accepted for audit findings and feedback-loop closures. */
export type FeedbackLoopClosureState =
	| "accepted"
	| "rejected"
	| "implemented"
	| "superseded"
	| "linked";

/** A tracked feedback loop from the local feedback-loop index. */
export type FeedbackLoopEntry = {
	rank: number;
	id: string;
	name: string;
	leverage: string;
	owner: string;
	sources: string[];
	recipients: string[];
	expectedDelay: string;
	failureClass: string;
	action: string;
	closureState: FeedbackLoopClosureState;
	evidenceRefs: string[];
};

/** A tracked cross-loop gap from the local feedback-loop index. */
export type FeedbackLoopGap = {
	id: string;
	description: string;
	closureState: FeedbackLoopClosureState;
	evidenceRefs: string[];
};

/** A tracked audit recommendation from the local feedback-loop index. */
export type FeedbackLoopRecommendation = FeedbackLoopGap;

/** Machine-readable feedback-loop index stored under .harness/feedback-loops. */
export type FeedbackLoopIndex = {
	schemaVersion: string;
	generatedAt: string;
	sourceAudit: string;
	status: FeedbackLoopClosureState;
	owner: string;
	summary: {
		loopCount: number;
		crossLoopGapCount: number;
		recommendationCount: number;
		openFindingCount: number;
	};
	loops: FeedbackLoopEntry[];
	crossLoopGaps: FeedbackLoopGap[];
	recommendations: FeedbackLoopRecommendation[];
};

/** Build options for a feedback-loop audit report. */
export type FeedbackLoopAuditOptions = {
	repoRoot?: string;
	indexPath?: string;
};

/** Validation finding emitted by feedback-loop-audit. */
export type FeedbackLoopAuditFinding = {
	code: string;
	status: "pass" | "fail";
	message: string;
	evidenceRefs: string[];
};

/** Full feedback-loop audit report. */
export type FeedbackLoopAuditReport = {
	schemaVersion: typeof FEEDBACK_LOOP_AUDIT_SCHEMA_VERSION;
	status: "pass" | "fail";
	generatedAt: string;
	repoRoot: string;
	indexPath: string;
	sourceAudit: string | null;
	summary: {
		loopCount: number;
		crossLoopGapCount: number;
		recommendationCount: number;
		openFindingCount: number;
		implementedLoopCount: number;
		implementedGapCount: number;
		implementedRecommendationCount: number;
	};
	findings: FeedbackLoopAuditFinding[];
	loops: FeedbackLoopEntry[];
	crossLoopGaps: FeedbackLoopGap[];
	recommendations: FeedbackLoopRecommendation[];
};

const EXPECTED_LOOP_COUNT = 19;
const EXPECTED_RECOMMENDATION_COUNT = 7;
const EXPECTED_GAP_COUNT = 5;

function defaultIndexPath(repoRoot: string): string {
	return resolve(repoRoot, ".harness", "feedback-loops", "index.json");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];
}

function asClosureState(value: unknown): FeedbackLoopClosureState {
	if (
		value === "accepted" ||
		value === "rejected" ||
		value === "implemented" ||
		value === "superseded" ||
		value === "linked"
	) {
		return value;
	}
	return "accepted";
}

function parseLoopEntry(value: unknown): FeedbackLoopEntry {
	const entry = isRecord(value) ? value : {};
	return {
		rank: typeof entry.rank === "number" ? entry.rank : 0,
		id: typeof entry.id === "string" ? entry.id : "",
		name: typeof entry.name === "string" ? entry.name : "",
		leverage: typeof entry.leverage === "string" ? entry.leverage : "",
		owner: typeof entry.owner === "string" ? entry.owner : "",
		sources: asStringArray(entry.sources),
		recipients: asStringArray(entry.recipients),
		expectedDelay:
			typeof entry.expectedDelay === "string" ? entry.expectedDelay : "",
		failureClass:
			typeof entry.failureClass === "string" ? entry.failureClass : "",
		action: typeof entry.action === "string" ? entry.action : "",
		closureState: asClosureState(entry.closureState),
		evidenceRefs: asStringArray(entry.evidenceRefs),
	};
}

function parseStatusEntry<
	T extends FeedbackLoopGap | FeedbackLoopRecommendation,
>(value: unknown): T {
	const entry = isRecord(value) ? value : {};
	return {
		id: typeof entry.id === "string" ? entry.id : "",
		description: typeof entry.description === "string" ? entry.description : "",
		closureState: asClosureState(entry.closureState),
		evidenceRefs: asStringArray(entry.evidenceRefs),
	} as T;
}

function parseFeedbackLoopIndex(raw: string): FeedbackLoopIndex {
	const parsed = JSON.parse(raw) as unknown;
	const index = isRecord(parsed) ? parsed : {};
	const summary = isRecord(index.summary) ? index.summary : {};
	return {
		schemaVersion:
			typeof index.schemaVersion === "string" ? index.schemaVersion : "",
		generatedAt: typeof index.generatedAt === "string" ? index.generatedAt : "",
		sourceAudit: typeof index.sourceAudit === "string" ? index.sourceAudit : "",
		status: asClosureState(index.status),
		owner: typeof index.owner === "string" ? index.owner : "",
		summary: {
			loopCount: typeof summary.loopCount === "number" ? summary.loopCount : 0,
			crossLoopGapCount:
				typeof summary.crossLoopGapCount === "number"
					? summary.crossLoopGapCount
					: 0,
			recommendationCount:
				typeof summary.recommendationCount === "number"
					? summary.recommendationCount
					: 0,
			openFindingCount:
				typeof summary.openFindingCount === "number"
					? summary.openFindingCount
					: 0,
		},
		loops: Array.isArray(index.loops) ? index.loops.map(parseLoopEntry) : [],
		crossLoopGaps: Array.isArray(index.crossLoopGaps)
			? index.crossLoopGaps.map(parseStatusEntry<FeedbackLoopGap>)
			: [],
		recommendations: Array.isArray(index.recommendations)
			? index.recommendations.map(parseStatusEntry<FeedbackLoopRecommendation>)
			: [],
	};
}

function countImplemented(
	items: readonly { closureState: FeedbackLoopClosureState }[],
): number {
	return items.filter((item) => item.closureState === "implemented").length;
}

function countImplementedWithEvidence(
	items: readonly {
		closureState: FeedbackLoopClosureState;
		evidenceRefs: readonly string[];
	}[],
): number {
	return items.filter(
		(item) =>
			item.closureState === "implemented" &&
			item.evidenceRefs.some((ref) => ref.trim().length > 0),
	).length;
}

function hasCompleteLoopShape(loop: FeedbackLoopEntry): boolean {
	return (
		loop.rank > 0 &&
		hasText(loop.id) &&
		hasText(loop.name) &&
		hasText(loop.leverage) &&
		hasText(loop.owner) &&
		hasOnlyTextItems(loop.sources) &&
		hasOnlyTextItems(loop.recipients) &&
		hasText(loop.expectedDelay) &&
		hasText(loop.failureClass) &&
		hasText(loop.action) &&
		hasOnlyTextItems(loop.evidenceRefs)
	);
}

function hasText(value: string): boolean {
	return value.trim().length > 0;
}

function hasOnlyTextItems(values: string[]): boolean {
	return values.length > 0 && values.every(hasText);
}

function failedReport(
	repoRoot: string,
	indexPath: string,
	finding: FeedbackLoopAuditFinding,
): FeedbackLoopAuditReport {
	return {
		schemaVersion: FEEDBACK_LOOP_AUDIT_SCHEMA_VERSION,
		status: "fail",
		generatedAt: new Date().toISOString(),
		repoRoot,
		indexPath,
		sourceAudit: null,
		summary: {
			loopCount: 0,
			crossLoopGapCount: 0,
			recommendationCount: 0,
			openFindingCount: 1,
			implementedLoopCount: 0,
			implementedGapCount: 0,
			implementedRecommendationCount: 0,
		},
		findings: [finding],
		loops: [],
		crossLoopGaps: [],
		recommendations: [],
	};
}

function buildAuditFindings(
	index: FeedbackLoopIndex,
	indexPath: string,
	implementedLoopCount: number,
	implementedGapCount: number,
	implementedRecommendationCount: number,
): FeedbackLoopAuditFinding[] {
	const implementedGapEvidenceCount = countImplementedWithEvidence(
		index.crossLoopGaps,
	);
	const implementedRecommendationEvidenceCount = countImplementedWithEvidence(
		index.recommendations,
	);
	return [
		{
			code: "feedback_loop_index_present",
			status: "pass",
			message: "Feedback-loop index is present and readable.",
			evidenceRefs: [indexPath],
		},
		{
			code: "feedback_loop_index_schema_version",
			status:
				index.schemaVersion === FEEDBACK_LOOP_INDEX_SCHEMA_VERSION
					? "pass"
					: "fail",
			message:
				"Expected feedback-loop index schema " +
				FEEDBACK_LOOP_INDEX_SCHEMA_VERSION +
				"; found " +
				(index.schemaVersion || "missing") +
				".",
			evidenceRefs: [indexPath],
		},
		{
			code: "feedback_loop_inventory_complete",
			status:
				index.loops.length === EXPECTED_LOOP_COUNT &&
				index.summary.loopCount === EXPECTED_LOOP_COUNT
					? "pass"
					: "fail",
			message:
				"Expected " +
				EXPECTED_LOOP_COUNT.toString() +
				" ranked feedback loops; found " +
				index.loops.length.toString() +
				".",
			evidenceRefs: [indexPath],
		},
		{
			code: "feedback_loop_entries_actionable",
			status: index.loops.every(hasCompleteLoopShape) ? "pass" : "fail",
			message: "Every feedback-loop entry must include actionable metadata.",
			evidenceRefs: [indexPath],
		},
		{
			code: "cross_loop_gaps_closed",
			status:
				index.crossLoopGaps.length === EXPECTED_GAP_COUNT &&
				index.summary.crossLoopGapCount === EXPECTED_GAP_COUNT &&
				implementedGapCount === EXPECTED_GAP_COUNT &&
				implementedGapEvidenceCount === EXPECTED_GAP_COUNT
					? "pass"
					: "fail",
			message:
				"Expected " +
				EXPECTED_GAP_COUNT.toString() +
				" implemented cross-loop gaps with closure evidence; found " +
				implementedGapCount.toString() +
				" implemented and " +
				implementedGapEvidenceCount.toString() +
				" with evidence; summary reports " +
				index.summary.crossLoopGapCount.toString() +
				".",
			evidenceRefs: [indexPath],
		},
		{
			code: "recommended_next_steps_closed",
			status:
				index.recommendations.length === EXPECTED_RECOMMENDATION_COUNT &&
				implementedRecommendationCount === EXPECTED_RECOMMENDATION_COUNT &&
				implementedRecommendationEvidenceCount === EXPECTED_RECOMMENDATION_COUNT
					? "pass"
					: "fail",
			message:
				"Expected " +
				EXPECTED_RECOMMENDATION_COUNT.toString() +
				" implemented recommendations with closure evidence; found " +
				implementedRecommendationCount.toString() +
				" implemented and " +
				implementedRecommendationEvidenceCount.toString() +
				" with evidence.",
			evidenceRefs: [indexPath],
		},
		{
			code: "audit_lifecycle_closed",
			status:
				index.summary.openFindingCount === 0 &&
				implementedLoopCount === EXPECTED_LOOP_COUNT
					? "pass"
					: "fail",
			message:
				"Expected zero open findings and " +
				EXPECTED_LOOP_COUNT.toString() +
				" implemented loops.",
			evidenceRefs: [indexPath, index.sourceAudit],
		},
	];
}

/** Build a read-only feedback-loop audit report from the tracked local index. */
export function buildFeedbackLoopAudit(
	options: FeedbackLoopAuditOptions = {},
): FeedbackLoopAuditReport {
	const repoRoot = resolve(options.repoRoot ?? process.cwd());
	const indexPath = resolve(options.indexPath ?? defaultIndexPath(repoRoot));
	if (!existsSync(indexPath)) {
		return failedReport(repoRoot, indexPath, {
			code: "feedback_loop_index_missing",
			status: "fail",
			message: "Feedback-loop index is missing.",
			evidenceRefs: [indexPath],
		});
	}

	let rawIndex: string;
	try {
		rawIndex = readFileSync(indexPath, "utf8");
	} catch (error) {
		return failedReport(repoRoot, indexPath, {
			code: "feedback_loop_index_unreadable",
			status: "fail",
			message:
				"Feedback-loop index cannot be read: " +
				(error instanceof Error ? error.message : "unknown error") +
				".",
			evidenceRefs: [indexPath],
		});
	}

	let index: FeedbackLoopIndex;
	try {
		index = parseFeedbackLoopIndex(rawIndex);
	} catch (error) {
		return failedReport(repoRoot, indexPath, {
			code: "feedback_loop_index_malformed",
			status: "fail",
			message:
				"Feedback-loop index is not valid JSON: " +
				(error instanceof Error ? error.message : "unknown error") +
				".",
			evidenceRefs: [indexPath],
		});
	}
	const implementedLoopCount = countImplemented(index.loops);
	const implementedGapCount = countImplemented(index.crossLoopGaps);
	const implementedRecommendationCount = countImplemented(
		index.recommendations,
	);
	const findings = buildAuditFindings(
		index,
		indexPath,
		implementedLoopCount,
		implementedGapCount,
		implementedRecommendationCount,
	);
	const status = findings.every((finding) => finding.status === "pass")
		? "pass"
		: "fail";
	return {
		schemaVersion: FEEDBACK_LOOP_AUDIT_SCHEMA_VERSION,
		status,
		generatedAt: new Date().toISOString(),
		repoRoot,
		indexPath,
		sourceAudit: index.sourceAudit,
		summary: {
			loopCount: index.loops.length,
			crossLoopGapCount: index.crossLoopGaps.length,
			recommendationCount: index.recommendations.length,
			openFindingCount: index.summary.openFindingCount,
			implementedLoopCount,
			implementedGapCount,
			implementedRecommendationCount,
		},
		findings,
		loops: index.loops,
		crossLoopGaps: index.crossLoopGaps,
		recommendations: index.recommendations,
	};
}
