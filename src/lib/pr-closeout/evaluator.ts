import { Effect } from "effect";
import {
	buildHarnessGateSummary,
	collectCheckBlockers,
	collectCiTelemetryBlockers,
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
	buildPrCloseoutDeliveryTruthSummary,
	collectDeliveryTruthBlockers,
	type PrCloseoutDeliveryTruthDerivationOptions,
} from "./delivery-truth.js";
import { buildLifecycleSnapshot } from "./lifecycle-snapshot.js";
import {
	buildTraceabilitySummary,
	selectDirtyPathsExcluded,
	selectHarnessGateEvidenceSource,
	summarizeChecks,
} from "./report-helpers.js";
import { buildPrCloseoutRecoveryState } from "./recovery.js";
import { buildPrCloseoutSnapshot } from "./snapshot.js";
import { deriveNextAction } from "./status.js";
import { PR_CLOSEOUT_SCHEMA_VERSION } from "./types.js";
import type {
	PrCloseoutBlocker,
	PrCloseoutInput,
	PrCloseoutReport,
} from "./types.js";
/** Options controlling report timestamping and derived verifier evidence. */
export interface PrCloseoutReportOptions {
	now?: Date;
	deriveDeliveryTruthFromStatePackets?: PrCloseoutDeliveryTruthDerivationOptions;
}

function buildPrCloseoutReportValue(
	input: PrCloseoutInput,
	options: PrCloseoutReportOptions = {},
): PrCloseoutReport {
	const blockers: PrCloseoutBlocker[] = [];
	const generatedAt = (options.now ?? new Date()).toISOString();
	const pr = input.pullRequest;
	const checks = input.checks ?? [];
	const reviewThreads = input.reviewThreads ?? { unresolved: null };
	const traceability = buildTraceabilitySummary(input);
	const harnessGateEvidenceSource = selectHarnessGateEvidenceSource(input);
	const harnessGates = buildHarnessGateSummary(
		input.closeoutGates ?? input.phaseExit,
		harnessGateEvidenceSource,
	);
	const tools = input.tools ?? [];
	const dirtyPathsExcluded = selectDirtyPathsExcluded(input);

	const claims = buildCloseoutClaims(input, checks, reviewThreads, generatedAt);
	const deliveryTruth = buildPrCloseoutDeliveryTruthSummary(
		input,
		generatedAt,
		options.deriveDeliveryTruthFromStatePackets,
	);
	collectWorktreeBlockers(input, dirtyPathsExcluded, blockers);
	collectPullRequestBlockers(pr, blockers);
	collectCheckBlockers(checks, blockers);
	collectCiTelemetryBlockers(input, checks, blockers);
	collectReviewBlockers(pr, reviewThreads, blockers);
	collectReviewArtifactBlockers(
		input.reviewArtifacts ?? [],
		input.reviewerArtifactProofs ?? [],
		pr.headSha,
		blockers,
	);
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
		ciTelemetry: input.ciTelemetry ?? [],
		reviewThreads: {
			unresolved: reviewThreads.unresolved,
			needsHuman: reviewThreads.needsHuman ?? null,
			autofixable: reviewThreads.autofixable ?? null,
		},
		traceability,
		harnessGates,
		assurance: buildAssuranceSummary(input),
		runtimeEvidence: buildRuntimeEvidenceSummary(input),
		deliveryTruth,
		lifecycleSnapshot,
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
	options: PrCloseoutReportOptions = {},
): Effect.Effect<PrCloseoutReport> {
	return Effect.sync(() => buildPrCloseoutReportValue(input, options));
}

/** Build a read-only PR closeout evidence report from normalized PR closeout inputs. */
export function buildPrCloseoutReport(
	input: PrCloseoutInput,
	options: PrCloseoutReportOptions = {},
): PrCloseoutReport {
	return Effect.runSync(buildPrCloseoutReportEffect(input, options));
}

export { buildPrCloseoutSnapshot };
