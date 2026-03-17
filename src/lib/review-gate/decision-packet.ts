import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
	emitTerminalRunRecord,
	hashRunRecordValue,
} from "../contract/run-record-emitter.js";
import { resolveRunRecordPaths } from "../contract/run-records.js";
import type {
	ReviewDecisionState,
	ReviewGateErrorCode,
	ReviewGateOptions,
	ReviewGateOutput,
	ReviewPRClosureStatus,
} from "./types.js";

type ReviewGateArtifactInput = {
	options: ReviewGateOptions;
	startedAt: string;
	finishedAt: string;
	exitCode: number;
	result:
		| { ok: true; output: ReviewGateOutput }
		| { ok: false; error: { code: ReviewGateErrorCode; message: string } };
};

interface ReviewDecisionPacket {
	schemaVersion: "review-decision-packet/v1";
	compatibilityMajor: 1;
	producerVersion: string;
	runId: string;
	command: "review-gate";
	generatedAt: string;
	repository: {
		owner: string;
		repo: string;
		prNumber: number;
		headSha: string;
		checkName: string;
	};
	decision: {
		state: ReviewDecisionState;
		prClosureStatus: ReviewPRClosureStatus;
		requiresHumanDecision: boolean;
	};
	compaction: {
		recommended: boolean;
		reasons: string[];
	};
	guardrailPromotion: {
		recommended: boolean;
		candidates: string[];
	};
	reviewGate: {
		verified: boolean;
		policyGateStatus?: ReviewGateOutput["policy_gate_status"];
		planTraceabilityStatus?: ReviewGateOutput["plan_traceability_status"];
		checkStatus?: ReviewGateOutput["checkStatus"];
		checkConclusion?: string;
		blockers: string[];
		actionableCount: number;
		informationalCount: number;
		timedOut: boolean;
		errorCode?: ReviewGateErrorCode;
		errorMessage?: string;
	};
}

type DecisionClassification = {
	state: ReviewDecisionState;
	prClosureStatus: ReviewPRClosureStatus;
	requiresHumanDecision: boolean;
};

function resolveProducerVersion(): string {
	try {
		const packageJson = JSON.parse(
			readFileSync(resolve("package.json"), "utf-8"),
		) as { version?: string };
		return packageJson.version?.trim() || "0.0.0-dev";
	} catch {
		return "0.0.0-dev";
	}
}

function createReviewGateRunId(): string {
	return `review-gate-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

function classifyDecisionState(
	result: ReviewGateArtifactInput["result"],
): DecisionClassification {
	if (result.ok && result.output.verified) {
		return {
			state: "green-and-ready",
			prClosureStatus: "ready-to-merge",
			requiresHumanDecision: false,
		};
	}

	if (result.ok) {
		return {
			state: "blocked-with-remediation",
			prClosureStatus: "awaiting-remediation",
			requiresHumanDecision: false,
		};
	}

	if (
		result.error.code === "PERMISSION_DENIED" ||
		result.error.code === "SYSTEM_ERROR"
	) {
		return {
			state: "escalated-for-decision",
			prClosureStatus: "awaiting-operator-decision",
			requiresHumanDecision: true,
		};
	}

	return {
		state: "blocked-with-remediation",
		prClosureStatus: "awaiting-remediation",
		requiresHumanDecision: false,
	};
}

function buildCompactionReasons(
	result: ReviewGateArtifactInput["result"],
): string[] {
	if (!result.ok) {
		switch (result.error.code) {
			case "SYSTEM_ERROR":
				return ["review-gate terminated with a system error"];
			case "TIMEOUT":
				return ["review-gate timed out before reaching a terminal pass state"];
			default:
				return [];
		}
	}

	const reasons: string[] = [];
	if (result.output.timedOut) {
		reasons.push("review-gate timed out and needs a fresh follow-up loop");
	}
	if (result.output.actionable_count >= 3) {
		reasons.push("multiple actionable blockers suggest context compaction");
	}
	return reasons;
}

function buildGuardrailCandidates(
	result: ReviewGateArtifactInput["result"],
): string[] {
	if (!result.ok) {
		switch (result.error.code) {
			case "VALIDATION_ERROR":
				return ["tighten invocation validation for review-gate inputs"];
			case "TIMEOUT":
				return [
					"capture timeout remediation as a reusable review-gate guardrail",
				];
			case "PERMISSION_DENIED":
				return [
					"promote authz or token setup failures into an operator guardrail",
				];
			case "SYSTEM_ERROR":
				return ["capture review-gate runtime failures as a reusable guardrail"];
			default:
				return [];
		}
	}

	return result.output.blockers.map((blocker) =>
		blocker.replace(/\s+/g, " ").trim(),
	);
}

function writeDecisionPacket(
	path: string,
	packet: ReviewDecisionPacket,
): { checksum: string; path: string } {
	mkdirSync(dirname(path), { recursive: true });
	const content = JSON.stringify(packet, null, 2);
	writeFileSync(path, content, "utf-8");
	return {
		path,
		checksum: hashRunRecordValue(packet),
	};
}

export function emitReviewGateDecisionArtifacts(
	input: ReviewGateArtifactInput,
): { runId: string; decisionPacketPath: string } {
	const runId = createReviewGateRunId();
	const runPaths = resolveRunRecordPaths({
		runId,
		...(input.options.runRecordsDir
			? { baseDir: input.options.runRecordsDir }
			: {}),
	});
	const decision = classifyDecisionState(input.result);
	const compactionReasons = buildCompactionReasons(input.result);
	const guardrailCandidates = buildGuardrailCandidates(input.result);
	const decisionPacketPath = join(runPaths.runDir, "decision-packet.json");
	const packet: ReviewDecisionPacket = {
		schemaVersion: "review-decision-packet/v1",
		compatibilityMajor: 1,
		producerVersion: resolveProducerVersion(),
		runId,
		command: "review-gate",
		generatedAt: input.finishedAt,
		repository: {
			owner: input.options.owner,
			repo: input.options.repo,
			prNumber: input.options.prNumber,
			headSha: input.options.headSha,
			checkName: input.options.checkName,
		},
		decision,
		compaction: {
			recommended: compactionReasons.length > 0,
			reasons: compactionReasons,
		},
		guardrailPromotion: {
			recommended: guardrailCandidates.length > 0,
			candidates: guardrailCandidates,
		},
		reviewGate: input.result.ok
			? {
					verified: input.result.output.verified,
					policyGateStatus: input.result.output.policy_gate_status,
					planTraceabilityStatus: input.result.output.plan_traceability_status,
					checkStatus: input.result.output.checkStatus,
					...(input.result.output.checkConclusion
						? { checkConclusion: input.result.output.checkConclusion }
						: {}),
					blockers: input.result.output.blockers,
					actionableCount: input.result.output.actionable_count,
					informationalCount: input.result.output.informational_count,
					timedOut: Boolean(input.result.output.timedOut),
				}
			: {
					verified: false,
					blockers: [],
					actionableCount: 0,
					informationalCount: 0,
					timedOut: input.result.error.code === "TIMEOUT",
					errorCode: input.result.error.code,
					errorMessage: input.result.error.message,
				},
	};

	const artifact = writeDecisionPacket(decisionPacketPath, packet);
	const outcome = input.result.ok
		? input.result.output.verified
			? "success"
			: "blocked"
		: input.result.error.code === "VALIDATION_ERROR"
			? "failed"
			: input.result.error.code === "NOT_FOUND"
				? "blocked"
				: input.result.error.code === "TIMEOUT"
					? "hold"
					: input.result.error.code === "PERMISSION_DENIED"
						? "hold"
						: "failed";
	const classification = input.result.ok
		? input.result.output.verified
			? "ok"
			: "policy_blocked"
		: input.result.error.code === "VALIDATION_ERROR"
			? "validation_failed"
			: input.result.error.code === "NOT_FOUND"
				? "precondition_failed"
				: input.result.error.code === "TIMEOUT"
					? "manual_intervention_required"
					: input.result.error.code === "PERMISSION_DENIED"
						? "manual_intervention_required"
						: "runtime_failed";
	const eventStatus = input.result.ok
		? input.result.output.verified
			? "completed"
			: "blocked"
		: input.result.error.code === "NOT_FOUND"
			? "blocked"
			: "failed";
	const eventSeverity = input.result.ok
		? input.result.output.verified
			? "info"
			: "warn"
		: input.result.error.code === "SYSTEM_ERROR"
			? "error"
			: "warn";

	emitTerminalRunRecord({
		command: "review-gate",
		runId,
		startedAt: input.startedAt,
		finishedAt: input.finishedAt,
		outcome,
		classification,
		exitCode: input.exitCode,
		...(input.options.runRecordsDir
			? { baseDir: input.options.runRecordsDir }
			: {}),
		artifacts: [
			{
				type: "decision-packet",
				path: decisionPacketPath,
				checksum: artifact.checksum,
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
			status: eventStatus,
			severity: eventSeverity,
			payload: {
				decisionState: decision.state,
				prClosureStatus: decision.prClosureStatus,
				compactionRecommended: packet.compaction.recommended,
				guardrailPromotionRecommended: packet.guardrailPromotion.recommended,
				decisionPacketPath,
			},
		},
	});

	return { runId, decisionPacketPath };
}
