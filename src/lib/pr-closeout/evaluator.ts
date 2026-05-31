import { Effect } from "effect";
import {
	buildHarnessGateSummary,
	collectCheckBlockers,
	collectHarnessGateBlockers,
	collectPullRequestBlockers,
	collectReviewArtifactBlockers,
	collectReviewBlockers,
	collectReleaseReadinessBlockers,
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
import { buildLifecycleSnapshot } from "./lifecycle-snapshot.js";
import { buildTraceabilitySummary, summarizeChecks } from "./report-helpers.js";
import { buildPrCloseoutRecoveryState } from "./recovery.js";
import { deriveNextAction } from "./status.js";
import {
	PR_CLOSEOUT_SCHEMA_VERSION,
	type PrCloseoutBlocker,
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
	collectReviewArtifactBlockers(input.reviewArtifacts ?? [], blockers);
	collectTraceabilityBlocker(traceability.complete, blockers);
	collectHarnessGateBlockers(harnessGates, blockers);
	collectAssuranceBlockers(input, blockers);
	collectRuntimeEvidenceBlockers(input, blockers);
	collectDeliveryTruthBlockers(deliveryTruth, blockers);
	collectReleaseReadinessBlockers(input, blockers);
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
	const lifecycleSnapshot = buildLifecycleSnapshot({
		input,
		claims,
		blockers,
		deliveryTruth,
		generatedAt,
		reportStatus: decision.status,
		nextAction: decision.nextAction,
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
		lifecycleSnapshot,
		tools,
		dirtyPathsExcluded,
		attemptLedger,
		recoveryEvent,
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
