import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { hashRunRecordValue } from "../contract/run-record-emitter.js";
import { resolveRunRecordPaths } from "../contract/run-records.js";
import type {
	PilotEvaluateOptions,
	PilotEvaluationResult,
	PilotOutcome,
} from "./types.js";

export type PilotDecisionState =
	| "green-and-ready"
	| "blocked-with-remediation"
	| "escalated-for-decision";

export type PilotPromotionStatus =
	| "ready-to-promote"
	| "hold"
	| "rollback-required"
	| "evaluation-failed";

type PilotEvaluateDecisionPacketInput = {
	options: PilotEvaluateOptions;
	startedAt: string;
	finishedAt: string;
	exitCode: number;
	runId?: string;
	result:
		| { ok: true; result: PilotEvaluationResult }
		| { ok: false; error: { code: string; message: string } };
};

interface PilotEvaluateDecisionPacket {
	schemaVersion: "pilot-evaluation-decision-packet/v1";
	compatibilityMajor: 1;
	producerVersion: string;
	runId: string;
	command: "pilot-evaluate";
	generatedAt: string;
	artifactsDir: string;
	decision: {
		state: PilotDecisionState;
		promotionStatus: PilotPromotionStatus;
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
	pilotEvaluate: {
		lane?: PilotEvaluationResult["controls"]["lane"];
		outcome?: PilotOutcome;
		manualSafeMode?: boolean;
		legacyRetirementReady?: boolean;
		canonicalCoverageRatio?: number;
		holdReasons: string[];
		warnings: string[];
		sampleSize?: number;
		highRiskAutomationIncidents?: number;
		rollbackReliability?: number;
		thrashRate?: number;
		interventionRate?: number;
		errorCode?: string;
		errorMessage?: string;
	};
}

type PilotDecisionPacketArtifact = {
	runId: string;
	decisionPacketPath: string;
	checksum: string;
	decisionState: PilotDecisionState;
	promotionStatus: PilotPromotionStatus;
	requiresHumanDecision: boolean;
	compactionRecommended: boolean;
	guardrailPromotionRecommended: boolean;
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

function createPilotEvaluateRunId(): string {
	return `pilot-evaluate-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

function classifyDecision(result: PilotEvaluateDecisionPacketInput["result"]): {
	state: PilotDecisionState;
	promotionStatus: PilotPromotionStatus;
	requiresHumanDecision: boolean;
} {
	if (!result.ok) {
		return {
			state:
				result.error.code === "E_RUN_RECORD"
					? "escalated-for-decision"
					: "blocked-with-remediation",
			promotionStatus: "evaluation-failed",
			requiresHumanDecision: result.error.code === "E_RUN_RECORD",
		};
	}

	switch (result.result.outcome) {
		case "promote":
			return {
				state: "green-and-ready",
				promotionStatus: "ready-to-promote",
				requiresHumanDecision: false,
			};
		case "hold":
			return {
				state: "escalated-for-decision",
				promotionStatus: "hold",
				requiresHumanDecision: true,
			};
		case "rollback":
			return {
				state: "escalated-for-decision",
				promotionStatus: "rollback-required",
				requiresHumanDecision: true,
			};
	}
}

function buildCompactionReasons(
	result: PilotEvaluateDecisionPacketInput["result"],
): string[] {
	if (!result.ok) {
		if (result.error.code === "E_SCHEMA_VALIDATION") {
			return [
				"evaluation inputs failed schema validation and need a clean rerun",
			];
		}
		return [];
	}

	const reasons: string[] = [];
	if (result.result.holdReasons.length >= 3) {
		reasons.push(
			"multiple hold reasons suggest compacting context before the next loop",
		);
	}
	if (result.result.warnings.length >= 4) {
		reasons.push(
			"warning volume is high enough to justify a compact operator packet",
		);
	}
	if (result.result.controls.manualSafeMode) {
		reasons.push(
			"manual safe mode is engaged and needs a fresh operator decision",
		);
	}
	return reasons;
}

function buildGuardrailCandidates(
	result: PilotEvaluateDecisionPacketInput["result"],
): string[] {
	if (!result.ok) {
		switch (result.error.code) {
			case "E_ARTIFACTS_NOT_FOUND":
				return ["verify pilot artifact generation before evaluation"];
			case "E_SCHEMA_VALIDATION":
				return [
					"promote artifact schema validation failures into a reusable gate",
				];
			case "E_REGISTRY_VALIDATION":
				return ["promote registry validation failures into a reusable gate"];
			case "E_PATH_TRAVERSAL":
				return ["tighten output path validation for pilot-evaluate artifacts"];
			default:
				return [];
		}
	}

	return [...result.result.holdReasons, ...result.result.warnings].map(
		(value) => value.replace(/\s+/g, " ").trim(),
	);
}

function writeDecisionPacket(
	path: string,
	packet: PilotEvaluateDecisionPacket,
): { checksum: string; path: string } {
	mkdirSync(dirname(path), { recursive: true });
	const content = JSON.stringify(packet, null, 2);
	writeFileSync(path, content, "utf-8");
	return {
		path,
		checksum: hashRunRecordValue(packet),
	};
}

export function writePilotEvaluateDecisionPacket(
	input: PilotEvaluateDecisionPacketInput,
): PilotDecisionPacketArtifact {
	const runId = input.runId ?? createPilotEvaluateRunId();
	const runPaths = resolveRunRecordPaths({
		runId,
		...(input.options.runRecordsDir
			? { baseDir: input.options.runRecordsDir }
			: {}),
	});
	const decision = classifyDecision(input.result);
	const compactionReasons = buildCompactionReasons(input.result);
	const guardrailCandidates = buildGuardrailCandidates(input.result);
	const decisionPacketPath = join(runPaths.runDir, "decision-packet.json");
	const packet: PilotEvaluateDecisionPacket = {
		schemaVersion: "pilot-evaluation-decision-packet/v1",
		compatibilityMajor: 1,
		producerVersion: resolveProducerVersion(),
		runId,
		command: "pilot-evaluate",
		generatedAt: input.finishedAt,
		artifactsDir: input.options.artifactsDir,
		decision,
		compaction: {
			recommended: compactionReasons.length > 0,
			reasons: compactionReasons,
		},
		guardrailPromotion: {
			recommended: guardrailCandidates.length > 0,
			candidates: guardrailCandidates,
		},
		pilotEvaluate: input.result.ok
			? {
					lane: input.result.result.controls.lane,
					outcome: input.result.result.outcome,
					manualSafeMode: input.result.result.controls.manualSafeMode,
					legacyRetirementReady:
						input.result.result.controls.legacyRetirementReady,
					canonicalCoverageRatio:
						input.result.result.controls.canonicalCoverageRatio,
					holdReasons: input.result.result.holdReasons,
					warnings: input.result.result.warnings,
					sampleSize: input.result.result.metrics.sampleSize,
					highRiskAutomationIncidents:
						input.result.result.metrics.highRiskAutomationIncidents,
					rollbackReliability: input.result.result.metrics.rollbackReliability,
					thrashRate: input.result.result.metrics.thrashRate,
					interventionRate: input.result.result.metrics.interventionRate,
				}
			: {
					holdReasons: [],
					warnings: [],
					errorCode: input.result.error.code,
					errorMessage: input.result.error.message,
				},
	};

	const artifact = writeDecisionPacket(decisionPacketPath, packet);
	return {
		runId,
		decisionPacketPath: artifact.path,
		checksum: artifact.checksum,
		decisionState: decision.state,
		promotionStatus: decision.promotionStatus,
		requiresHumanDecision: decision.requiresHumanDecision,
		compactionRecommended: compactionReasons.length > 0,
		guardrailPromotionRecommended: guardrailCandidates.length > 0,
	};
}
