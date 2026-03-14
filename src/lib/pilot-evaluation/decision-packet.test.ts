import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writePilotEvaluateDecisionPacket } from "./decision-packet.js";

describe("writePilotEvaluateDecisionPacket", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(
			join(resolve("artifacts"), "pilot-evaluate-decision-artifacts-"),
		);
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("writes a green promotion packet", () => {
		const artifact = writePilotEvaluateDecisionPacket({
			options: {
				artifactsDir: "artifacts/pilot",
				runRecordsDir: tempDir,
			},
			startedAt: "2026-03-14T12:00:00.000Z",
			finishedAt: "2026-03-14T12:00:05.000Z",
			exitCode: 0,
			result: {
				ok: true,
				result: {
					schemaVersion: "pilot-evaluation/v1",
					generatedAt: "2026-03-14T12:00:05.000Z",
					outcome: "promote",
					holdReasons: [],
					warnings: [],
					metrics: {
						windowStart: "2026-03-01T00:00:00.000Z",
						windowEnd: "2026-03-14T00:00:00.000Z",
						sampleSize: 30,
						leadTimeP50Improvement: -0.4,
						leadTimeP75Improvement: -0.2,
						leadTimeP50CiHalfWidth: 0.05,
						leadTimeP75CiHalfWidth: 0.07,
						rollbackReliability: 1,
						rollbackTriggerCount: 2,
						interventionRate: 0.1,
						highRiskAutomationIncidents: 0,
						unresolvedCriticalIncidents: 0,
						incidentClassificationP95Hours: 1,
						evidenceCompletenessRatio: 1,
						thrashRate: 0.02,
						sensitiveFieldLeakCount: 0,
						runIdCollisionCount: 0,
						repoSampleSizes: {
							"jamie/repo": 30,
						},
					},
					ingestion: {
						remediationEvents: {
							source: "canonical",
							adapterVersion: "none",
							runIds: [],
							mappedArtifactPaths: [],
							driftWarnings: [],
						},
						rollbackEvents: {
							source: "canonical",
							adapterVersion: "none",
							runIds: [],
							mappedArtifactPaths: [],
							driftWarnings: [],
						},
					},
					controls: {
						lane: "health",
						killSwitchEngaged: false,
						manualSafeMode: false,
						canonicalCoverageRatio: 1,
						legacyRetirementReady: true,
					},
				},
			},
		});

		const packet = JSON.parse(
			readFileSync(artifact.decisionPacketPath, "utf-8"),
		) as Record<string, unknown>;
		expect(packet.decision).toEqual({
			state: "green-and-ready",
			promotionStatus: "ready-to-promote",
			requiresHumanDecision: false,
		});
		expect(packet.compaction).toEqual({
			recommended: false,
			reasons: [],
		});
	});

	it("writes an escalated hold packet with compaction and guardrail candidates", () => {
		const artifact = writePilotEvaluateDecisionPacket({
			options: {
				artifactsDir: "artifacts/pilot",
				runRecordsDir: tempDir,
			},
			startedAt: "2026-03-14T12:00:00.000Z",
			finishedAt: "2026-03-14T12:00:05.000Z",
			exitCode: 4,
			result: {
				ok: true,
				result: {
					schemaVersion: "pilot-evaluation/v1",
					generatedAt: "2026-03-14T12:00:05.000Z",
					outcome: "hold",
					holdReasons: [
						"Sample size below minimum",
						"Evidence completeness below minimum",
						"Sensitive field leak count must be zero",
					],
					warnings: [
						"Lead time improvement approaching threshold",
						"Evidence completeness below 98%",
						"Intervention rate exceeds advisory threshold",
						"Thrash rate exceeds advisory threshold",
					],
					metrics: {
						windowStart: "2026-03-01T00:00:00.000Z",
						windowEnd: "2026-03-14T00:00:00.000Z",
						sampleSize: 12,
						leadTimeP50Improvement: -0.2,
						leadTimeP75Improvement: -0.1,
						leadTimeP50CiHalfWidth: 0.3,
						leadTimeP75CiHalfWidth: 0.4,
						rollbackReliability: 1,
						rollbackTriggerCount: 1,
						interventionRate: 0.4,
						highRiskAutomationIncidents: 0,
						unresolvedCriticalIncidents: 0,
						incidentClassificationP95Hours: 2,
						evidenceCompletenessRatio: 0.9,
						thrashRate: 0.3,
						sensitiveFieldLeakCount: 1,
						runIdCollisionCount: 0,
						repoSampleSizes: {
							"jamie/repo": 12,
						},
					},
					ingestion: {
						remediationEvents: {
							source: "legacy_adapter",
							adapterVersion: "legacy-jsonl-v1",
							runIds: [],
							mappedArtifactPaths: [],
							driftWarnings: [],
						},
						rollbackEvents: {
							source: "legacy_adapter",
							adapterVersion: "legacy-jsonl-v1",
							runIds: [],
							mappedArtifactPaths: [],
							driftWarnings: [],
						},
					},
					controls: {
						lane: "health",
						killSwitchEngaged: false,
						manualSafeMode: true,
						canonicalCoverageRatio: 0.5,
						legacyRetirementReady: false,
					},
				},
			},
		});

		const packet = JSON.parse(
			readFileSync(artifact.decisionPacketPath, "utf-8"),
		) as Record<string, unknown>;
		expect(packet.decision).toEqual({
			state: "escalated-for-decision",
			promotionStatus: "hold",
			requiresHumanDecision: true,
		});
		expect(packet.compaction).toEqual({
			recommended: true,
			reasons: [
				"multiple hold reasons suggest compacting context before the next loop",
				"warning volume is high enough to justify a compact operator packet",
				"manual safe mode is engaged and needs a fresh operator decision",
			],
		});
		expect(packet.guardrailPromotion).toEqual({
			recommended: true,
			candidates: [
				"Sample size below minimum",
				"Evidence completeness below minimum",
				"Sensitive field leak count must be zero",
				"Lead time improvement approaching threshold",
				"Evidence completeness below 98%",
				"Intervention rate exceeds advisory threshold",
				"Thrash rate exceeds advisory threshold",
			],
		});
	});
});
