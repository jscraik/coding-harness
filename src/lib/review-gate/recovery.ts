import type { ReviewGateArtifactInput } from "./decision-packet-types.js";

/** Owner expected to unblock a stopped review-gate run. */
export type ReviewGateRecoveryOwner = "codex" | "external_service" | "operator";

/** Retry action encoded in review-gate attempt-ledger metadata. */
export type ReviewGateRetryDecision = "none" | "retry" | "stop";

/** Attempt-ledger metadata embedded in review-gate decision packets. */
export interface ReviewGateAttemptLedger {
	schemaVersion: "attempt-ledger/v1";
	command: "review-gate";
	attempt: number;
	maxAttempts: number;
	firstFailure: {
		attempt: number;
		failureClass: string;
		exitCode: number;
		observedAt: string;
	} | null;
	retryDecision: {
		decision: ReviewGateRetryDecision;
		reason: string;
		nextAttempt: number | null;
	};
	owner: ReviewGateRecoveryOwner;
	stopReason: string | null;
	nextAction: string;
	evidenceRefs: string[];
}

/** Recovery event emitted when a review-gate run stops with required action. */
export interface ReviewGateRecoveryEvent {
	schemaVersion: "recovery-event/v1";
	eventId: string;
	command: "review-gate";
	attempt: number;
	owner: ReviewGateRecoveryOwner;
	failureClass: string;
	stopReason: string;
	nextAction: string;
	retryDecision: ReviewGateRetryDecision;
	evidenceRefs: string[];
}

function resolveReviewGateFailureClass(
	result: ReviewGateArtifactInput["result"],
): string {
	if (result.ok) {
		return result.output.verified ? "none" : "policy_blocked";
	}
	return result.error.code.toLowerCase();
}

function resolveReviewGateRecoveryOwner(
	result: ReviewGateArtifactInput["result"],
): ReviewGateRecoveryOwner {
	if (result.ok) return "codex";
	if (result.error.code === "PERMISSION_DENIED") return "operator";
	if (result.error.code === "TIMEOUT" || result.error.code === "SYSTEM_ERROR") {
		return "external_service";
	}
	return "codex";
}

function resolveReviewGateNextAction(
	result: ReviewGateArtifactInput["result"],
): string {
	if (result.ok && result.output.verified) {
		return "Continue PR closeout with the verified review-gate decision packet.";
	}
	if (result.ok) {
		return (
			result.output.blockers[0] ??
			"Resolve review-gate blockers and rerun review-gate."
		);
	}
	if (result.error.code === "PERMISSION_DENIED") {
		return "Refresh review-gate credentials or ask the operator for an authenticated rerun.";
	}
	if (result.error.code === "TIMEOUT") {
		return "Inspect service latency or reduce review-gate scope before rerunning.";
	}
	return result.error.message;
}

/**
 * Build the review-gate attempt ledger for the terminal decision packet.
 */
export function buildReviewGateAttemptLedger(args: {
	input: ReviewGateArtifactInput;
	runId: string;
	decisionPacketPath: string;
}): ReviewGateAttemptLedger {
	const verified = args.input.result.ok && args.input.result.output.verified;
	const stopReason = verified
		? null
		: resolveReviewGateNextAction(args.input.result);
	return {
		schemaVersion: "attempt-ledger/v1",
		command: "review-gate",
		attempt: 1,
		maxAttempts: 1,
		firstFailure: verified
			? null
			: {
					attempt: 1,
					failureClass: resolveReviewGateFailureClass(args.input.result),
					exitCode: args.input.exitCode,
					observedAt: args.input.finishedAt,
				},
		retryDecision: {
			decision: verified ? "none" : "stop",
			reason: verified
				? "review-gate completed successfully"
				: "review-gate has no internal retry loop; rerun only after the recorded next action",
			nextAttempt: null,
		},
		owner: resolveReviewGateRecoveryOwner(args.input.result),
		stopReason,
		nextAction: resolveReviewGateNextAction(args.input.result),
		evidenceRefs: [
			`review-gate:run:${args.runId}`,
			`artifact:${args.decisionPacketPath}`,
		],
	};
}

/**
 * Project the failed review-gate attempt into a recovery event when action is required.
 */
export function buildReviewGateRecoveryEvent(args: {
	runId: string;
	attemptLedger: ReviewGateAttemptLedger;
}): ReviewGateRecoveryEvent | null {
	const firstFailure = args.attemptLedger.firstFailure;
	if (!firstFailure || !args.attemptLedger.stopReason) return null;
	return {
		schemaVersion: "recovery-event/v1",
		eventId: `review-gate:${args.runId}:attempt-1`,
		command: "review-gate",
		attempt: 1,
		owner: args.attemptLedger.owner,
		failureClass: firstFailure.failureClass,
		stopReason: args.attemptLedger.stopReason,
		nextAction: args.attemptLedger.nextAction,
		retryDecision: args.attemptLedger.retryDecision.decision,
		evidenceRefs: args.attemptLedger.evidenceRefs,
	};
}
