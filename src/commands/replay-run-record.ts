import {
	emitTerminalRunRecord,
	hashRunRecordValue,
} from "../lib/contract/run-record-emitter.js";
import type { ReplayOptions } from "../lib/replay/options.js";

/** Exit codes for replay command programmatic consumption. */
export const EXIT_CODES = {
	SUCCESS: 0,
	TRACE_NOT_FOUND: 1,
	VALIDATION_ERROR: 2,
	REPLAY_ERROR: 3,
	SYSTEM_ERROR: 10,
} as const;

type ReplayRecoveryOwner = "codex" | "operator";
type ReplayRetryDecision = "none" | "stop";

interface ReplayAttemptLedger {
	schemaVersion: "attempt-ledger/v1";
	command: "replay";
	attempt: number;
	maxAttempts: number;
	firstFailure: {
		attempt: number;
		failureClass: string;
		exitCode: number;
		observedAt: string;
	} | null;
	retryDecision: {
		decision: ReplayRetryDecision;
		reason: string;
		nextAttempt: number | null;
	};
	owner: ReplayRecoveryOwner;
	stopReason: string | null;
	nextAction: string;
	evidenceRefs: string[];
}

interface ReplayRecoveryEvent {
	schemaVersion: "recovery-event/v1";
	eventId: string;
	command: "replay";
	attempt: number;
	owner: ReplayRecoveryOwner;
	failureClass: string;
	stopReason: string;
	nextAction: string;
	retryDecision: ReplayRetryDecision;
	evidenceRefs: string[];
}

interface ReplayRunRecordParams {
	outcome: "success" | "failed" | "blocked";
	classification:
		| "ok"
		| "validation_failed"
		| "precondition_failed"
		| "runtime_failed";
	exitCode: number;
	payload: Record<string, unknown>;
	artifacts?: Array<{ type: string; path: string; checksum?: string }>;
}

function replayFailureClass(params: ReplayRunRecordParams): string {
	if (params.classification === "ok") return "none";
	const error = params.payload.error;
	if (typeof error === "string" && error.trim().length > 0) {
		return error;
	}
	return params.classification;
}

function replayRecoveryOwner(failureClass: string): ReplayRecoveryOwner {
	if (
		failureClass === "validation_error" ||
		failureClass === "validation_failed" ||
		failureClass === "trace_not_found" ||
		failureClass === "invalid_trace_directory"
	) {
		return "operator";
	}
	return "codex";
}

function replayNextAction(failureClass: string): string {
	if (failureClass === "none") {
		return "Replay completed; inspect replay output and canonical run record if needed.";
	}
	if (failureClass === "trace_not_found") {
		return "Run harness replay --list or provide an existing trace id before retrying.";
	}
	if (failureClass === "invalid_trace_directory") {
		return "Provide a trace directory inside the current repository before retrying.";
	}
	if (
		failureClass === "validation_error" ||
		failureClass === "validation_failed"
	) {
		return "Fix replay command arguments before retrying.";
	}
	return "Inspect the replay failure, trace artifact, and run record before retrying.";
}

function buildReplayAttemptMetadata(args: {
	startedAt: string;
	params: ReplayRunRecordParams;
}): {
	attemptLedger: ReplayAttemptLedger;
	recoveryEvent: ReplayRecoveryEvent | null;
} {
	const failureClass = replayFailureClass(args.params);
	const nextAction = replayNextAction(failureClass);
	const failed = failureClass !== "none";
	const evidenceRefs = ["run-record:replay"];
	const attemptLedger: ReplayAttemptLedger = {
		schemaVersion: "attempt-ledger/v1",
		command: "replay",
		attempt: 1,
		maxAttempts: 1,
		firstFailure: failed
			? {
					attempt: 1,
					failureClass,
					exitCode: args.params.exitCode,
					observedAt: args.startedAt,
				}
			: null,
		retryDecision: {
			decision: failed ? "stop" : "none",
			reason: failed
				? "replay has no internal retry loop; rerun only after the recorded next action"
				: "replay completed successfully",
			nextAttempt: null,
		},
		owner: failed ? replayRecoveryOwner(failureClass) : "codex",
		stopReason: failed ? nextAction : null,
		nextAction,
		evidenceRefs,
	};
	return {
		attemptLedger,
		recoveryEvent:
			failed && attemptLedger.stopReason
				? {
						schemaVersion: "recovery-event/v1",
						eventId: `replay:${Date.parse(args.startedAt) || Date.now()}:attempt-1`,
						command: "replay",
						attempt: 1,
						owner: attemptLedger.owner,
						failureClass,
						stopReason: attemptLedger.stopReason,
						nextAction,
						retryDecision: attemptLedger.retryDecision.decision,
						evidenceRefs,
					}
				: null,
	};
}

/** Emit a canonical run record for a replay command and return the exit code. */
export function emitReplayRunRecord(
	startedAt: string,
	options: ReplayOptions,
	params: ReplayRunRecordParams,
): number {
	const attemptMetadata = buildReplayAttemptMetadata({ startedAt, params });
	try {
		emitTerminalRunRecord({
			command: "replay",
			startedAt,
			outcome: params.outcome,
			classification: params.classification,
			exitCode: params.exitCode,
			...(options.runRecordsDir ? { baseDir: options.runRecordsDir } : {}),
			policyContext: {
				mode: options.dryRun ? "dry-run" : "default",
				safetyPosture: "strict",
				effectivePolicySource: "replay-trace-policy",
				hash: hashRunRecordValue({
					policy: "replay-trace-policy",
					mode: options.dryRun ? "dry-run" : "default",
					list: Boolean(options.list),
					traceId: options.traceId ?? null,
				}),
			},
			preconditions: {
				traceIdProvided: Boolean(options.traceId),
				listMode: Boolean(options.list),
			},
			...(params.artifacts ? { artifacts: params.artifacts } : {}),
			event: {
				eventType: "decision",
				status:
					params.classification === "ok"
						? "completed"
						: params.classification === "precondition_failed"
							? "blocked"
							: "failed",
				severity: params.classification === "ok" ? "info" : "error",
				payload: {
					...params.payload,
					attemptLedger: attemptMetadata.attemptLedger,
					recoveryEvent: attemptMetadata.recoveryEvent,
				},
			},
		});
	} catch (error) {
		console.error(
			`Failed to emit canonical run record for replay: ${String(error)}`,
		);
		return EXIT_CODES.SYSTEM_ERROR;
	}
	return params.exitCode;
}

/** Emit the run record for a rejected replay trace directory. */
export function emitInvalidTraceDirectoryRunRecord(
	startedAt: string,
	options: ReplayOptions,
	exitCode: number,
): number {
	return emitReplayRunRecord(startedAt, options, {
		outcome: "failed",
		classification: "validation_failed",
		exitCode,
		payload: {
			error: "invalid_trace_directory",
			traceDir: options.traceDir,
		},
	});
}
