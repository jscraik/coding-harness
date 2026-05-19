import type {
	PrCloseoutAttemptLedger,
	PrCloseoutBlocker,
	PrCloseoutBlockerClassification,
	PrCloseoutClaim,
	PrCloseoutNextAction,
	PrCloseoutRecoveryEvent,
	PrCloseoutRecoveryOwner,
	PrCloseoutRetryDecision,
	PrCloseoutStatus,
} from "./types.js";

interface PrCloseoutDecision {
	status: PrCloseoutStatus;
	nextAction: PrCloseoutNextAction;
}

interface PrCloseoutRecoveryState {
	attemptLedger: PrCloseoutAttemptLedger;
	recoveryEvent: PrCloseoutRecoveryEvent | null;
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

/** Build the retry and recovery evidence attached to a PR closeout report. */
export function buildPrCloseoutRecoveryState(
	decision: PrCloseoutDecision,
	blockers: readonly PrCloseoutBlocker[],
	claims: readonly PrCloseoutClaim[],
	prNumber: number,
	generatedAt: string,
): PrCloseoutRecoveryState {
	const evidenceRefs = blockerEvidenceRefs(blockers, claims);
	const retryDecision = retryDecisionFor(decision.status);
	const owner = recoveryOwnerFor(decision.status, blockers);
	const stopReason = stopReasonFor(blockers);
	const attemptLedger: PrCloseoutAttemptLedger = {
		schemaVersion: "attempt-ledger/v1",
		command: "pr-closeout",
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
	const recoveryEvent: PrCloseoutRecoveryEvent | null =
		decision.status === "ready" || stopReason === null
			? null
			: {
					schemaVersion: "recovery-event/v1",
					eventId: recoveryEventId(prNumber, generatedAt),
					command: "pr-closeout",
					attempt: 1,
					owner,
					failureClass: failureClassFor(blockers),
					stopReason,
					nextAction: decision.nextAction,
					retryDecision,
					evidenceRefs,
				};
	return { attemptLedger, recoveryEvent };
}
