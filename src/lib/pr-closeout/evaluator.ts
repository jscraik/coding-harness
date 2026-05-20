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
import { isFailedCheck, isPassingCheck, isPendingCheck } from "./evidence.js";
import { buildPrCloseoutRecoveryState } from "./recovery.js";
import { deriveNextAction } from "./status.js";
import {
	PR_CLOSEOUT_SCHEMA_VERSION,
	type PrCloseoutBlocker,
	type PrCloseoutCheckInput,
	type PrCloseoutHarnessGateEvidenceSource,
	type PrCloseoutInput,
	type PrCloseoutReport,
} from "./types.js";

function summarizeChecks(checks: readonly PrCloseoutCheckInput[]): {
	total: number;
	failed: number;
	pending: number;
	passed: number;
	unknown: number;
} {
	let failed = 0;
	let pending = 0;
	let passed = 0;
	let unknown = 0;
	for (const check of checks) {
		if (isFailedCheck(check)) failed += 1;
		else if (isPendingCheck(check)) pending += 1;
		else if (isPassingCheck(check)) passed += 1;
		else unknown += 1;
	}
	return { total: checks.length, failed, pending, passed, unknown };
}

function hasConcreteTraceabilityText(value: string | null): boolean {
	const trimmed = value?.trim() ?? "";
	return (
		trimmed.length > 0 &&
		!/^(?:n\.?a\.?|not applicable|none required)\b/iu.test(trimmed)
	);
}

function buildPrCloseoutReportValue(
	input: PrCloseoutInput,
	options: { now?: Date } = {},
): PrCloseoutReport {
	const blockers: PrCloseoutBlocker[] = [];
	const generatedAt = (options.now ?? new Date()).toISOString();
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
		sessionIds.length > 0 ||
		traceIds.length > 0 ||
		hasConcreteTraceabilityText(aiSessionTraceability);
	const claims = buildCloseoutClaims(input, checks, reviewThreads, generatedAt);
	collectWorktreeBlockers(input, dirtyPathsExcluded, blockers);
	collectPullRequestBlockers(pr, blockers);
	collectCheckBlockers(checks, blockers);
	collectReviewBlockers(pr, reviewThreads, blockers);
	collectTraceabilityBlocker(traceabilityComplete, blockers);
	collectHarnessGateBlockers(harnessGates, blockers);
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
			sessionIds,
			traceIds,
			aiSessionTraceability,
			complete: traceabilityComplete,
		},
		harnessGates,
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
