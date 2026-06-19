import {
	PR_CLOSEOUT_SCHEMA_VERSION,
	type PrCloseoutReport,
} from "../lib/pr-closeout.js";

const PR_CLOSEOUT_STATUSES = new Set([
	"ready",
	"fixable",
	"waiting",
	"blocked",
	"needs_jamie",
	"cleanup_required",
]);

const PR_CLOSEOUT_NEXT_ACTIONS = new Set([
	"ready_to_merge",
	"codex_can_fix_now",
	"wait_for_external_check",
	"resolve_conflicts",
	"needs_jamie_decision",
	"cleanup_before_continue",
]);

const isFiniteNumber = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value);

const isNullableFiniteNumber = (value: unknown): value is number | null =>
	value === null || isFiniteNumber(value);

const isStringArray = (value: unknown): value is string[] =>
	Array.isArray(value) && value.every((item) => typeof item === "string");

function isObjectRecord(value: unknown): value is Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	return true;
}

function hasPrCloseoutIdentity(report: Partial<PrCloseoutReport>): boolean {
	return (
		report.schemaVersion === PR_CLOSEOUT_SCHEMA_VERSION &&
		typeof report.pr === "number" &&
		Number.isInteger(report.pr) &&
		report.pr > 0 &&
		typeof report.generatedAt === "string"
	);
}

function hasPrCloseoutStatus(report: Partial<PrCloseoutReport>): boolean {
	return (
		typeof report.status === "string" &&
		PR_CLOSEOUT_STATUSES.has(report.status) &&
		typeof report.mergeable === "boolean" &&
		typeof report.nextAction === "string" &&
		PR_CLOSEOUT_NEXT_ACTIONS.has(report.nextAction)
	);
}

function hasPrCloseoutCheckSummary(report: Partial<PrCloseoutReport>): boolean {
	const checks = report.checks;
	if (!isObjectRecord(checks)) return false;
	return (
		isFiniteNumber(checks.total) &&
		isFiniteNumber(checks.failed) &&
		isFiniteNumber(checks.pending) &&
		isFiniteNumber(checks.passed) &&
		isFiniteNumber(checks.unknown)
	);
}

function hasPrCloseoutReviewThreads(
	report: Partial<PrCloseoutReport>,
): boolean {
	const reviewThreads = report.reviewThreads;
	if (!isObjectRecord(reviewThreads)) return false;
	return (
		isNullableFiniteNumber(reviewThreads.unresolved) &&
		isNullableFiniteNumber(reviewThreads.needsHuman) &&
		isNullableFiniteNumber(reviewThreads.autofixable)
	);
}

function hasPrCloseoutTraceability(report: Partial<PrCloseoutReport>): boolean {
	const traceability = report.traceability;
	return (
		isObjectRecord(traceability) &&
		isStringArray(traceability.sessionIds) &&
		isStringArray(traceability.traceIds) &&
		(traceability.aiSessionTraceability === null ||
			typeof traceability.aiSessionTraceability === "string") &&
		typeof traceability.complete === "boolean"
	);
}

function hasPrCloseoutHarnessGates(report: Partial<PrCloseoutReport>): boolean {
	const harnessGates = report.harnessGates;
	return (
		isObjectRecord(harnessGates) &&
		typeof harnessGates.evidenceSource === "string" &&
		typeof harnessGates.closeoutGatesPresent === "boolean" &&
		typeof harnessGates.phaseExitPresent === "boolean" &&
		typeof harnessGates.recommendation === "string" &&
		typeof harnessGates.commitAllowed === "boolean" &&
		typeof harnessGates.exitAllowed === "boolean" &&
		Array.isArray(harnessGates.gates)
	);
}

function hasPrCloseoutArrayFields(report: Partial<PrCloseoutReport>): boolean {
	return (
		Array.isArray(report.blockers) &&
		Array.isArray(report.claims) &&
		Array.isArray(report.ciTelemetry) &&
		Array.isArray(report.tools) &&
		Array.isArray(report.dirtyPathsExcluded)
	);
}

function hasPrCloseoutObjectFields(report: Partial<PrCloseoutReport>): boolean {
	return (
		isObjectRecord(report.assurance) &&
		isObjectRecord(report.runtimeEvidence) &&
		isObjectRecord(report.deliveryTruth) &&
		isObjectRecord(report.lifecycleSnapshot) &&
		isObjectRecord(report.attemptLedger)
	);
}

function hasPrCloseoutCollections(report: Partial<PrCloseoutReport>): boolean {
	return (
		hasPrCloseoutArrayFields(report) &&
		hasPrCloseoutCheckSummary(report) &&
		hasPrCloseoutReviewThreads(report) &&
		hasPrCloseoutTraceability(report) &&
		hasPrCloseoutHarnessGates(report) &&
		hasPrCloseoutObjectFields(report)
	);
}

function hasReadyPrCloseoutConsistency(
	report: Partial<PrCloseoutReport>,
): boolean {
	if (report.status !== "ready") return true;
	if (!report.mergeable || report.nextAction !== "ready_to_merge") return false;
	if ((report.blockers?.length ?? 0) > 0) return false;
	return (
		report.checks?.failed === 0 &&
		report.checks.pending === 0 &&
		report.checks.unknown === 0 &&
		report.reviewThreads?.unresolved === 0 &&
		report.reviewThreads.needsHuman === 0
	);
}

/** Return whether parsed JSON satisfies the pr-closeout/v1 report contract. */
export function isPrCloseoutReport(value: unknown): value is PrCloseoutReport {
	if (!isObjectRecord(value)) return false;
	const report = value as Partial<PrCloseoutReport>;
	return (
		hasPrCloseoutIdentity(report) &&
		hasPrCloseoutStatus(report) &&
		hasPrCloseoutCollections(report) &&
		hasReadyPrCloseoutConsistency(report)
	);
}
