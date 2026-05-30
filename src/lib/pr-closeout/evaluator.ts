import { Effect } from "effect";
import {
	buildHarnessGateSummary,
	collectCheckBlockers,
	collectHarnessGateBlockers,
	collectPullRequestBlockers,
	collectReviewBlockers,
	collectToolBlockers,
	collectTraceabilityBlocker,
	collectWorktreeBlockers,
} from "./blockers.js";
import { buildCloseoutClaims, collectClaimBlockers } from "./claims.js";
import {
	buildAssuranceSummary,
	buildRuntimeEvidenceSummary,
	collectAssuranceBlockers,
	collectRuntimeEvidenceBlockers,
} from "./evidence-summaries.js";
import {
	buildDeliveryTruthSummary,
	collectDeliveryTruthBlockers,
} from "./delivery-truth.js";
import { buildTraceabilitySummary, summarizeChecks } from "./report-helpers.js";
import { buildPrCloseoutRecoveryState } from "./recovery.js";
import { deriveNextAction } from "./status.js";
import {
	PR_CLOSEOUT_SCHEMA_VERSION,
	type PrCloseoutClaim,
	type PrCloseoutBlocker,
	type PrCloseoutConstraintSnapshot,
	type PrCloseoutConstraintSnapshotLane,
	type PrCloseoutEvidenceFreshness,
	type PrCloseoutSnapshotHandoffPointer,
	type PrCloseoutStaleEvidenceClass,
	type PrCloseoutHarnessGateEvidenceSource,
	type PrCloseoutInput,
	type PrCloseoutReport,
} from "./types.js";

function buildPrCloseoutReportValue(
	input: PrCloseoutInput,
	options: { now?: Date } = {},
): PrCloseoutReport {
	const blockers: PrCloseoutBlocker[] = [];
	const generatedAt = (options.now ?? new Date()).toISOString();
	const pr = input.pullRequest;
	const checks = input.checks ?? [];
	const reviewThreads = input.reviewThreads ?? { unresolved: null };
	const traceability = buildTraceabilitySummary(input);
	const harnessGateEvidenceSource: PrCloseoutHarnessGateEvidenceSource =
		input.closeoutGates !== undefined
			? "closeout_gates"
			: input.phaseExit !== undefined
				? "phase_exit"
				: "missing";
	const harnessGates = buildHarnessGateSummary(
		input.closeoutGates ?? input.phaseExit,
		harnessGateEvidenceSource,
	);
	const dirtyPaths = input.dirtyPaths ?? [];
	const tools = input.tools ?? [];
	const dirtyPathsExcluded = dirtyPaths.filter(
		(path) => path.classification === "unrelated_local_noise",
	);

	const claims = buildCloseoutClaims(input, checks, reviewThreads, generatedAt);
	const deliveryTruth = buildDeliveryTruthSummary(input.deliveryTruth);
	collectWorktreeBlockers(input, dirtyPathsExcluded, blockers);
	collectPullRequestBlockers(pr, blockers);
	collectCheckBlockers(checks, blockers);
	collectReviewBlockers(pr, reviewThreads, blockers);
	collectTraceabilityBlocker(traceability.complete, blockers);
	collectHarnessGateBlockers(harnessGates, blockers);
	collectAssuranceBlockers(input, blockers);
	collectRuntimeEvidenceBlockers(input, blockers);
	collectDeliveryTruthBlockers(deliveryTruth, blockers);
	collectToolBlockers(tools, blockers);
	collectClaimBlockers(claims, blockers);

	const decision = deriveNextAction(blockers);
	const { attemptLedger, recoveryEvent } = buildPrCloseoutRecoveryState(
		decision,
		blockers,
		claims,
		pr.number,
		generatedAt,
	);
	const snapshot = buildPrCloseoutSnapshot({
		generatedAt,
		pr: pr.number,
		url: pr.url ?? null,
		status: decision.status,
		nextAction: decision.nextAction,
		claims,
		blockers,
	});
	return {
		schemaVersion: PR_CLOSEOUT_SCHEMA_VERSION,
		generatedAt,
		pr: pr.number,
		url: pr.url ?? null,
		status: decision.status,
		mergeable: decision.mergeable,
		nextAction: decision.nextAction,
		blockers,
		claims,
		checks: summarizeChecks(checks),
		reviewThreads: {
			unresolved: reviewThreads.unresolved,
			needsHuman: reviewThreads.needsHuman ?? null,
			autofixable: reviewThreads.autofixable ?? null,
		},
		traceability: {
			sessionIds: traceability.sessionIds,
			traceIds: traceability.traceIds,
			aiSessionTraceability: traceability.aiSessionTraceability,
			complete: traceability.complete,
		},
		harnessGates,
		assurance: buildAssuranceSummary(input),
		runtimeEvidence: buildRuntimeEvidenceSummary(input),
		deliveryTruth,
		tools,
		dirtyPathsExcluded,
		attemptLedger,
		recoveryEvent,
		snapshot,
	};
}

/** Build a read-only PR closeout evidence report as an Effect boundary. */
export function buildPrCloseoutReportEffect(
	input: PrCloseoutInput,
	options: { now?: Date } = {},
): Effect.Effect<PrCloseoutReport> {
	return Effect.sync(() => buildPrCloseoutReportValue(input, options));
}

/** Build a read-only PR closeout evidence report from normalized PR closeout inputs. */
export function buildPrCloseoutReport(
	input: PrCloseoutInput,
	options: { now?: Date } = {},
): PrCloseoutReport {
	return Effect.runSync(buildPrCloseoutReportEffect(input, options));
}

/** Build a compact snapshot for the delivery-lifecycle constraint view. */
export function buildPrCloseoutSnapshot({
	generatedAt,
	pr,
	url,
	status,
	nextAction,
	claims,
	blockers,
}: {
	generatedAt: string;
	pr: number;
	url: string | null;
	status: PrCloseoutReport["status"];
	nextAction: PrCloseoutReport["nextAction"];
	claims: readonly PrCloseoutClaim[];
	blockers: readonly PrCloseoutBlocker[];
}): PrCloseoutConstraintSnapshot {
	const staleEvidenceClasses = classifyStaleEvidenceClasses(claims, blockers);
	return {
		schemaVersion: "pr-closeout-snapshot/v1",
		generatedAt,
		pr,
		url,
		overallStatus: status,
		nextAction,
		staleEvidenceClasses,
		lanes: {
			pr: summarizeLane("pr", claims, blockers),
			checks: summarizeLane("checks", claims, blockers),
			review: summarizeLane("review", claims, blockers),
			linear: summarizeLane("linear", claims, blockers),
			branch: summarizeLane("branch", claims, blockers),
			deliveryTruth: summarizeLane("delivery_truth", claims, blockers),
		},
		handoffRequirements: buildHandoffRequirements(claims),
	};
}

function summarizeLane(
	name: string,
	claims: readonly PrCloseoutClaim[],
	blockers: readonly PrCloseoutBlocker[],
): PrCloseoutConstraintSnapshotLane {
	const laneClaims = claims.filter((claim) => claim.source === name);
	const laneBlockers = blockers.filter((blocker) => blocker.surface === name);
	const staleEvidence = laneClaims.some((claim) => claim.freshness === "stale");
	const blockerCount = laneBlockers.length;
	const freshness = summarizeFreshness(
		laneClaims.map((claim) => claim.freshness),
	);
	let status: PrCloseoutConstraintSnapshotLane["status"] = "ready";
	if (freshness === "missing" || freshness === "unknown") {
		status = freshness === "missing" ? "missing" : "unknown";
	} else if (staleEvidence) {
		status = "stale";
	} else if (blockerCount > 0) {
		status = "blocked";
	}
	if (status === "ready" && laneClaims.length === 0) {
		status = "unknown";
	}
	return {
		status,
		blockerCount,
		staleEvidence,
		freshness,
		evidenceRefs: laneClaims
			.map((claim) => claim.evidenceRef)
			.filter(
				(value): value is string =>
					typeof value === "string" && value.length > 0,
			),
	};
}

function summarizeFreshness(
	values: readonly PrCloseoutEvidenceFreshness[],
): PrCloseoutEvidenceFreshness {
	if (values.length === 0) return "missing";
	if (values.includes("stale")) return "stale";
	if (values.includes("missing")) return "missing";
	if (values.includes("unknown")) return "unknown";
	if (values.every((value) => value === "current")) return "current";
	if (values.includes("not_applicable")) return "not_applicable";
	return "current";
}

function buildHandoffRequirements(
	claims: readonly PrCloseoutClaim[],
): PrCloseoutSnapshotHandoffPointer[] {
	return claims
		.filter(
			(claim) => claim.status !== "pass" && claim.status !== "not_applicable",
		)
		.map((claim) => ({
			claim: claim.claim,
			surface: claim.source,
			status: claim.status,
			freshness: claim.freshness,
			evidenceRef: claim.evidenceRef,
			blockerClass: claim.blockerClass ?? null,
			verifiedAt: claim.verifiedAt,
		}));
}

function classifyStaleEvidenceClasses(
	claims: readonly PrCloseoutClaim[],
	blockers: readonly PrCloseoutBlocker[],
): PrCloseoutStaleEvidenceClass[] {
	const stale = new Set<PrCloseoutStaleEvidenceClass>();
	for (const claim of claims) {
		if (claim.freshness !== "stale") continue;
		switch (claim.claim) {
			case "pr_metadata_ready":
			case "branch_current_with_base":
				stale.add("stale-pr-metadata");
				break;
			case "ci_green":
			case "tests_passed":
			case "required_checks_match_current_head":
				stale.add("stale-ci");
				break;
			case "review_threads_resolved":
			case "independent_review_status_known":
				stale.add("stale-review");
				break;
			case "linear_tracker_state_aligned":
				stale.add("stale-linear");
				break;
			default:
				break;
		}
	}
	if (
		blockers.some(
			(blocker) =>
				blocker.classification === "external_service" ||
				blocker.surface === "tool",
		)
	) {
		stale.add("stale-external");
	}
	return Array.from(stale);
}
