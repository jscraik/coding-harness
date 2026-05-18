export { PR_CLOSEOUT_SCHEMA_VERSION } from "./pr-closeout-types.js";
export type {
	PrCloseoutBlocker,
	PrCloseoutBlockerClassification,
	PrCloseoutBranchInput,
	PrCloseoutCheckInput,
	PrCloseoutDirtyPathInput,
	PrCloseoutHarnessGateEvidence,
	PrCloseoutHarnessGateEvidenceSource,
	PrCloseoutHarnessGateSummary,
	PrCloseoutInput,
	PrCloseoutNextAction,
	PrCloseoutPullRequestInput,
	PrCloseoutReport,
	PrCloseoutReviewThreadsInput,
	PrCloseoutStatus,
	PrCloseoutToolInput,
	PrCloseoutTraceabilityInput,
} from "./pr-closeout-types.js";
import {
	PR_CLOSEOUT_SCHEMA_VERSION,
	type PrCloseoutBlocker,
	type PrCloseoutHarnessGateEvidenceSource,
	type PrCloseoutInput,
	type PrCloseoutReport,
} from "./pr-closeout-types.js";

import {
	collectCheckBlockers,
	collectPullRequestBlockers,
	collectReviewBlockers,
	collectToolBlockers,
	collectTraceabilityBlocker,
	collectWorktreeBlockers,
} from "./pr-closeout-blockers.js";
import {
	buildHarnessGateSummary,
	collectHarnessGateBlockers,
} from "./pr-closeout-harness-gates.js";
import { deriveNextAction, summarizeChecks } from "./pr-closeout-status.js";

/** Build a read-only PR closeout evidence report from normalized PR closeout inputs. */
export function buildPrCloseoutReport(
	input: PrCloseoutInput,
	options: { now?: Date } = {},
): PrCloseoutReport {
	const blockers: PrCloseoutBlocker[] = [];
	const pr = input.pullRequest;
	const checks = input.checks ?? [];
	const reviewThreads = input.reviewThreads ?? { unresolved: null };
	const traceability = input.traceability ?? {};
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

	const sessionIds = traceability.sessionIds ?? [];
	const traceIds = traceability.traceIds ?? [];
	const aiSessionTraceability = traceability.aiSessionTraceability ?? null;
	const traceabilityComplete =
		sessionIds.length > 0 &&
		traceIds.length > 0 &&
		Boolean(aiSessionTraceability?.trim());
	collectWorktreeBlockers(input, dirtyPathsExcluded, blockers);
	collectPullRequestBlockers(pr, blockers);
	collectCheckBlockers(checks, blockers);
	collectReviewBlockers(pr, reviewThreads, blockers);
	collectTraceabilityBlocker(traceabilityComplete, blockers);
	collectHarnessGateBlockers(harnessGates, blockers);
	collectToolBlockers(tools, blockers);

	const decision = deriveNextAction(blockers);
	return {
		schemaVersion: PR_CLOSEOUT_SCHEMA_VERSION,
		generatedAt: (options.now ?? new Date()).toISOString(),
		pr: pr.number,
		url: pr.url ?? null,
		status: decision.status,
		mergeable: decision.mergeable,
		nextAction: decision.nextAction,
		blockers,
		checks: summarizeChecks(checks),
		reviewThreads: {
			unresolved: reviewThreads.unresolved,
			needsHuman: reviewThreads.needsHuman ?? null,
			autofixable: reviewThreads.autofixable ?? null,
		},
		traceability: {
			sessionIds,
			traceIds,
			aiSessionTraceability,
			complete: traceabilityComplete,
		},
		harnessGates,
		tools,
		dirtyPathsExcluded,
	};
}
