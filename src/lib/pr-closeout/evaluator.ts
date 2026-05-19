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
import { deriveNextAction } from "./status.js";
import {
	PR_CLOSEOUT_SCHEMA_VERSION,
	type PrCloseoutBlocker,
	type PrCloseoutBlockerClassification,
	type PrCloseoutCheckInput,
	type PrCloseoutClaim,
	type PrCloseoutHarnessGateEvidenceSource,
	type PrCloseoutInput,
	type PrCloseoutReport,
	type PrCloseoutStatus,
	type PrCloseoutRecoveryOwner,
	type PrCloseoutRetryDecision,
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

function blockerEvidenceRefs(
	blockers: readonly PrCloseoutBlocker[],
	claims: readonly PrCloseoutClaim[],
): string[] {
	const refs = new Set<string>();
	for (const blocker of blockers) {
		if (blocker.ref) refs.add(blocker.ref);
	}
	for (const claim of claims) {
		if (claim.evidenceRef) refs.add(claim.evidenceRef);
	}
	return [...refs].sort();
}

function recoveryOwnerFor(
	status: PrCloseoutStatus,
	blockers: readonly PrCloseoutBlocker[],
): PrCloseoutRecoveryOwner {
	if (
		status === "waiting" ||
		blockers.some((blocker) => blocker.classification === "external_service")
	) {
		return "external_service";
	}
	if (
		status === "needs_jamie" ||
		blockers.some(
			(blocker) => blocker.classification === "needs_jamie_decision",
		)
	) {
		return "operator";
	}
	return "codex";
}

function retryDecisionFor(status: PrCloseoutStatus): PrCloseoutRetryDecision {
	if (status === "ready") return "none";
	if (status === "waiting") return "wait";
	return "stop";
}

function failureClassFor(
	blockers: readonly PrCloseoutBlocker[],
): PrCloseoutBlockerClassification {
	return blockers[0]?.classification ?? "unknown";
}

function stopReasonFor(blockers: readonly PrCloseoutBlocker[]): string | null {
	return blockers[0]?.reason ?? null;
}

function recoveryEventId(prNumber: number, generatedAt: string): string {
	return `pr-closeout:${String(prNumber)}:${generatedAt}`;
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
		(sessionIds.length > 0 || traceIds.length > 0) &&
		Boolean(aiSessionTraceability?.trim());
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
	const evidenceRefs = blockerEvidenceRefs(blockers, claims);
	const retryDecision = retryDecisionFor(decision.status);
	const owner = recoveryOwnerFor(decision.status, blockers);
	const stopReason = stopReasonFor(blockers);
	const attemptLedger = {
		schemaVersion: "attempt-ledger/v1" as const,
		command: "pr-closeout" as const,
		attempt: 1,
		maxAttempts: 1,
		firstFailure:
			decision.status === "ready"
				? null
				: {
						attempt: 1,
						status: decision.status,
						nextAction: decision.nextAction,
					},
		retryDecision,
		owner,
		stopReason,
		nextAction: decision.nextAction,
		evidenceRefs,
	};
	const recoveryEvent =
		decision.status === "ready" || stopReason === null
			? null
			: {
					schemaVersion: "recovery-event/v1" as const,
					eventId: recoveryEventId(pr.number, generatedAt),
					command: "pr-closeout" as const,
					attempt: 1,
					owner,
					failureClass: failureClassFor(blockers),
					stopReason,
					nextAction: decision.nextAction,
					retryDecision,
					evidenceRefs,
				};
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
	return Effect.succeed(buildPrCloseoutReportValue(input, options));
}

/** Build a read-only PR closeout evidence report from normalized PR closeout inputs. */
export function buildPrCloseoutReport(
	input: PrCloseoutInput,
	options: { now?: Date } = {},
): PrCloseoutReport {
	return Effect.runSync(buildPrCloseoutReportEffect(input, options));
}
