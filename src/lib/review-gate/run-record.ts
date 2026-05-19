import {
	emitTerminalRunRecord,
	hashRunRecordValue,
} from "../contract/run-record-emitter.js";
import type {
	ExitClassification,
	RunEventSeverity,
	RunEventStatus,
	RunOutcome,
} from "../contract/run-records.js";
import type {
	DecisionClassification,
	ReviewGateArtifactInput,
	ReviewGateRunRecordArtifacts,
} from "./decision-packet-types.js";
import type {
	ReviewGateAttemptLedger,
	ReviewGateRecoveryEvent,
} from "./recovery.js";

type ReviewGateRunRecordPacketInput = {
	compaction: { recommended: boolean };
	guardrailPromotion: { recommended: boolean };
	attemptLedger: ReviewGateAttemptLedger;
	recoveryEvent: ReviewGateRecoveryEvent | null;
};

function resolveRunRecordOutcome(
	result: ReviewGateArtifactInput["result"],
): RunOutcome {
	if (result.ok) {
		return result.output.verified ? "success" : "blocked";
	}
	switch (result.error.code) {
		case "VALIDATION_ERROR":
		case "SYSTEM_ERROR":
			return "failed";
		case "NOT_FOUND":
			return "blocked";
		case "TIMEOUT":
		case "PERMISSION_DENIED":
			return "hold";
		default:
			return "failed";
	}
}

function resolveRunRecordClassification(
	result: ReviewGateArtifactInput["result"],
): ExitClassification {
	if (result.ok) {
		return result.output.verified ? "ok" : "policy_blocked";
	}
	switch (result.error.code) {
		case "VALIDATION_ERROR":
			return "validation_failed";
		case "NOT_FOUND":
			return "precondition_failed";
		case "TIMEOUT":
		case "PERMISSION_DENIED":
			return "manual_intervention_required";
		default:
			return "runtime_failed";
	}
}

function resolveRunRecordEventStatus(
	result: ReviewGateArtifactInput["result"],
): RunEventStatus {
	if (result.ok) {
		return result.output.verified ? "completed" : "blocked";
	}
	return result.error.code === "NOT_FOUND" ? "blocked" : "failed";
}

function resolveRunRecordEventSeverity(
	result: ReviewGateArtifactInput["result"],
): RunEventSeverity {
	if (result.ok) {
		return result.output.verified ? "info" : "warn";
	}
	return result.error.code === "SYSTEM_ERROR" ? "error" : "warn";
}

/**
 * Emit the terminal run record for review-gate decision artifacts.
 */
export function emitReviewGateRunRecord(args: {
	input: ReviewGateArtifactInput;
	runId: string;
	decision: DecisionClassification;
	packet: ReviewGateRunRecordPacketInput;
	artifacts: ReviewGateRunRecordArtifacts;
}): void {
	const { input, runId, decision, packet, artifacts } = args;
	emitTerminalRunRecord({
		command: "review-gate",
		runId,
		startedAt: input.startedAt,
		finishedAt: input.finishedAt,
		outcome: resolveRunRecordOutcome(input.result),
		classification: resolveRunRecordClassification(input.result),
		exitCode: input.exitCode,
		...(input.options.runRecordsDir
			? { baseDir: input.options.runRecordsDir }
			: {}),
		artifacts: [
			{
				type: "decision-packet",
				path: artifacts.decisionPacketPath,
				checksum: artifacts.decisionPacketChecksum,
			},
			{
				type: "alignment-decision",
				path: artifacts.alignmentDecisionPath,
				checksum: artifacts.alignmentDecisionChecksum,
			},
		],
		contract: {
			path: input.options.contractPath,
		},
		policyContext: {
			mode: input.options.json ? "json" : "interactive",
			safetyPosture: "strict",
			effectivePolicySource: input.options.contractPath,
			hash: hashRunRecordValue({
				command: "review-gate",
				checkName: input.options.checkName,
				autoResolveBotThreads: Boolean(input.options.autoResolveBotThreads),
			}),
		},
		repo: {
			repository: `${input.options.owner}/${input.options.repo}`,
			branch: "pull-request",
			headSha: input.options.headSha,
		},
		preconditions: {
			prNumber: input.options.prNumber,
			autoResolveBotThreads: Boolean(input.options.autoResolveBotThreads),
			jsonMode: Boolean(input.options.json),
		},
		event: {
			eventType: "decision",
			status: resolveRunRecordEventStatus(input.result),
			severity: resolveRunRecordEventSeverity(input.result),
			payload: {
				decisionState: decision.state,
				prClosureStatus: decision.prClosureStatus,
				compactionRecommended: packet.compaction.recommended,
				guardrailPromotionRecommended: packet.guardrailPromotion.recommended,
				decisionPacketPath: artifacts.decisionPacketPath,
				alignmentDecisionPath: artifacts.alignmentDecisionPath,
				attemptLedger: packet.attemptLedger,
				recoveryEvent: packet.recoveryEvent,
			},
		},
	});
}
