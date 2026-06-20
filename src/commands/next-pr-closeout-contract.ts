import {
	PR_CLOSEOUT_SCHEMA_VERSION,
	type PrCloseoutClaim,
	type PrCloseoutReport,
} from "../lib/pr-closeout.js";
import { HARNESS_CLOSEOUT_GATE_IDS } from "../lib/decision/he-phase-exit.js";

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

const PR_CLOSEOUT_BLOCKER_SURFACES = new Set([
	"pr",
	"branch",
	"checks",
	"review",
	"linear",
	"traceability",
	"worktree",
	"harness_gates",
	"assurance",
	"runtime_evidence",
	"delivery_truth",
	"release_readiness",
	"review_artifact",
	"tool",
]);

const PR_CLOSEOUT_BLOCKER_CLASSIFICATIONS = new Set([
	"introduced",
	"pre_existing",
	"unrelated_dirty_worktree",
	"external_service",
	"needs_jamie_decision",
	"unknown",
]);

const READY_PR_CLOSEOUT_CLAIMS = new Set<PrCloseoutClaim["claim"]>([
	"tests_passed",
	"ci_green",
	"review_threads_resolved",
	"pr_metadata_ready",
	"branch_current_with_base",
	"linear_tracker_state_aligned",
	"independent_review_status_known",
	"required_checks_match_current_head",
	"rollback_path_named_or_not_applicable",
]);

const READY_PR_CLOSEOUT_NOT_APPLICABLE_CLAIMS = new Set<
	PrCloseoutClaim["claim"]
>(["rollback_path_named_or_not_applicable"]);

const isNonNegativeInteger = (value: unknown): value is number =>
	typeof value === "number" && Number.isInteger(value) && value >= 0;

const isNullableNonNegativeInteger = (value: unknown): value is number | null =>
	value === null || isNonNegativeInteger(value);

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
		typeof report.generatedAt === "string" &&
		(report.url === null || typeof report.url === "string") &&
		"recoveryEvent" in report
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
		isNonNegativeInteger(checks.total) &&
		isNonNegativeInteger(checks.failed) &&
		isNonNegativeInteger(checks.pending) &&
		isNonNegativeInteger(checks.passed) &&
		isNonNegativeInteger(checks.unknown)
	);
}

function hasPrCloseoutReviewThreads(
	report: Partial<PrCloseoutReport>,
): boolean {
	const reviewThreads = report.reviewThreads;
	if (!isObjectRecord(reviewThreads)) return false;
	return (
		isNullableNonNegativeInteger(reviewThreads.unresolved) &&
		isNullableNonNegativeInteger(reviewThreads.needsHuman) &&
		isNullableNonNegativeInteger(reviewThreads.autofixable)
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

function hasPrCloseoutBlockerRequiredFields(
	blocker: Record<string, unknown>,
): boolean {
	return (
		typeof blocker.surface === "string" &&
		PR_CLOSEOUT_BLOCKER_SURFACES.has(blocker.surface) &&
		typeof blocker.classification === "string" &&
		PR_CLOSEOUT_BLOCKER_CLASSIFICATIONS.has(blocker.classification) &&
		typeof blocker.reason === "string" &&
		typeof blocker.fixableByCodex === "boolean"
	);
}

function hasPrCloseoutBlockerOptionalFields(
	blocker: Record<string, unknown>,
): boolean {
	const kindValid =
		blocker.kind === undefined ||
		blocker.kind === "state" ||
		blocker.kind === "closeout_claim";
	return (
		kindValid &&
		(blocker.conflict === undefined || typeof blocker.conflict === "boolean") &&
		(blocker.ref === undefined || typeof blocker.ref === "string") &&
		(blocker.missingContext === undefined ||
			blocker.missingContext === null ||
			typeof blocker.missingContext === "string")
	);
}

function hasPrCloseoutBlockerShape(blocker: unknown): boolean {
	if (!isObjectRecord(blocker)) return false;
	return (
		hasPrCloseoutBlockerRequiredFields(blocker) &&
		hasPrCloseoutBlockerOptionalFields(blocker)
	);
}

function hasPrCloseoutArrayFields(report: Partial<PrCloseoutReport>): boolean {
	return (
		Array.isArray(report.blockers) &&
		report.blockers.every(hasPrCloseoutBlockerShape) &&
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
		isObjectRecord(report.attemptLedger) &&
		(report.recoveryEvent === null || isObjectRecord(report.recoveryEvent))
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

function hasReadyPrCloseoutClaims(report: Partial<PrCloseoutReport>): boolean {
	if (!Array.isArray(report.claims)) return false;
	const claims = new Map<string, PrCloseoutClaim>();
	for (const claim of report.claims) {
		if (!isObjectRecord(claim)) return false;
		if (typeof claim.claim !== "string") return false;
		if (
			!READY_PR_CLOSEOUT_CLAIMS.has(claim.claim as PrCloseoutClaim["claim"])
		) {
			return false;
		}
		if (
			claim.status !== "pass" &&
			!(
				claim.status === "not_applicable" &&
				READY_PR_CLOSEOUT_NOT_APPLICABLE_CLAIMS.has(
					claim.claim as PrCloseoutClaim["claim"],
				)
			)
		) {
			return false;
		}
		if (claim.freshness !== "current") return false;
		claims.set(claim.claim, claim as PrCloseoutClaim);
	}
	return READY_PR_CLOSEOUT_CLAIMS.size === claims.size;
}

function hasReadyPrCloseoutGateShape(
	gate: unknown,
): gate is Record<string, unknown> & { gateId: string } {
	if (!isObjectRecord(gate)) return false;
	if (typeof gate.gateId !== "string") return false;
	if (typeof gate.required !== "boolean") return false;
	if (gate.status !== "pass" && gate.status !== "not_applicable") return false;
	if (!Array.isArray(gate.evidenceRefs)) return false;
	if (!gate.evidenceRefs.every((ref) => typeof ref === "string")) return false;
	if (typeof gate.requiresHuman !== "boolean") return false;
	return gate.blocker === null || typeof gate.blocker === "string";
}

function hasExpectedReadyCloseoutGateIds(
	gates: Map<string, Record<string, unknown>>,
): boolean {
	if (gates.size !== HARNESS_CLOSEOUT_GATE_IDS.length) return false;
	return HARNESS_CLOSEOUT_GATE_IDS.every((gateId) => gates.has(gateId));
}

function addReadyCloseoutGate(
	gates: Map<string, Record<string, unknown>>,
	gate: unknown,
): boolean {
	if (!hasReadyPrCloseoutGateShape(gate)) return false;
	if (gates.has(gate.gateId)) return false;
	gates.set(gate.gateId, gate);
	return true;
}

function hasReadyPrCloseoutHarnessGates(
	report: Partial<PrCloseoutReport>,
): boolean {
	const harnessGates = report.harnessGates;
	if (!isObjectRecord(harnessGates)) return false;
	if (
		harnessGates.evidenceSource !== "closeout_gates" ||
		harnessGates.closeoutGatesPresent !== true ||
		harnessGates.commitAllowed !== true ||
		harnessGates.exitAllowed !== true ||
		!Array.isArray(harnessGates.gates) ||
		harnessGates.gates.length === 0
	) {
		return false;
	}
	const gates = new Map<string, Record<string, unknown>>();
	for (const gate of harnessGates.gates) {
		if (!addReadyCloseoutGate(gates, gate)) return false;
	}
	return hasExpectedReadyCloseoutGateIds(gates);
}

function hasReadyPrCloseoutCheckCounts(
	report: Partial<PrCloseoutReport>,
): boolean {
	return (
		report.checks?.failed === 0 &&
		report.checks.pending === 0 &&
		report.checks.unknown === 0
	);
}

function hasReadyPrCloseoutReviewCounts(
	report: Partial<PrCloseoutReport>,
): boolean {
	return (
		report.reviewThreads?.unresolved === 0 &&
		report.reviewThreads.needsHuman === 0
	);
}

function hasReadyPrCloseoutAssurance(
	report: Partial<PrCloseoutReport>,
): boolean {
	const assurance = report.assurance;
	return (
		isObjectRecord(assurance) &&
		assurance.present === true &&
		assurance.valid === true &&
		Array.isArray(assurance.entries) &&
		assurance.entries.length > 0 &&
		Array.isArray(assurance.findings) &&
		assurance.findings.length === 0
	);
}

function hasReadyPrCloseoutConsistency(
	report: Partial<PrCloseoutReport>,
): boolean {
	if (report.status !== "ready") return true;
	if (!report.mergeable || report.nextAction !== "ready_to_merge") return false;
	if ((report.blockers?.length ?? 0) > 0) return false;
	if (!hasReadyPrCloseoutClaims(report)) return false;
	if (report.traceability?.complete !== true) return false;
	if (!hasReadyPrCloseoutHarnessGates(report)) return false;
	if (!hasReadyPrCloseoutAssurance(report)) return false;
	return (
		hasReadyPrCloseoutCheckCounts(report) &&
		hasReadyPrCloseoutReviewCounts(report)
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
