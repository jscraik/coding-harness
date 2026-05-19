import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { emitTerminalRunRecordMock } = vi.hoisted(() => ({
	emitTerminalRunRecordMock: vi.fn(),
}));

vi.mock("../contract/run-record-emitter.js", () => ({
	emitTerminalRunRecord: emitTerminalRunRecordMock,
	hashRunRecordValue: (value: unknown) =>
		JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort()),
}));

import { NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS } from "../contract/north-star-artifacts.js";
import { emitReviewGateDecisionArtifacts } from "./decision-packet.js";

describe("emitReviewGateDecisionArtifacts", () => {
	let tempDir: string;

	beforeEach(() => {
		emitTerminalRunRecordMock.mockReset();
		emitTerminalRunRecordMock.mockReturnValue({
			runId: "review-gate-run-1",
			manifestPath: "/tmp/manifest.json",
			eventsPath: "/tmp/events.jsonl",
		});
		tempDir = mkdtempSync(join(resolve("artifacts"), "review-gate-artifacts-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("writes a green decision packet and emits a canonical run record", () => {
		const runRecordsDir = relative(process.cwd(), tempDir);
		const result = emitReviewGateDecisionArtifacts({
			options: {
				contractPath: "harness.contract.json",
				token: "test-token",
				owner: "acme",
				repo: "harness",
				prNumber: 42,
				headSha: "0123456789abcdef0123456789abcdef01234567",
				checkName: "review-check",
				runRecordsDir,
			},
			startedAt: "2026-03-14T12:00:00.000Z",
			finishedAt: "2026-03-14T12:00:05.000Z",
			exitCode: 0,
			result: {
				ok: true,
				output: {
					verified: true,
					headSha: "0123456789abcdef0123456789abcdef01234567",
					checkStatus: "completed",
					checkConclusion: "success",
					needsRerun: false,
					policy_gate_status: "pass",
					plan_traceability_status: "pass",
					plan_ids: ["feat-tighten-review-gate"],
					blockers: [],
					actionable_count: 0,
					informational_count: 3,
					confidence_rubric: {
						score: 5,
						level: "high",
						rationale: ["ready"],
					},
				},
			},
		});

		const packet = JSON.parse(
			readFileSync(result.decisionPacketPath, "utf-8"),
		) as Record<string, unknown>;
		const alignmentPacket = JSON.parse(
			readFileSync(result.alignmentDecisionPath, "utf-8"),
		) as Record<string, unknown>;
		expect(alignmentPacket.schemaVersion).toBe(
			NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS.alignmentDecision,
		);
		expect(alignmentPacket.sourceSchemaVersion).toBe(
			"review-decision-packet/v1",
		);
		expect(packet.decision).toEqual({
			state: "green-and-ready",
			prClosureStatus: "ready-to-merge",
			requiresHumanDecision: false,
		});
		expect(alignmentPacket.decision).toEqual(packet.decision);
		expect(packet.compaction).toEqual({
			recommended: false,
			reasons: [],
		});
		expect(packet.attemptLedger).toMatchObject({
			schemaVersion: "attempt-ledger/v1",
			command: "review-gate",
			attempt: 1,
			maxAttempts: 1,
			firstFailure: null,
			retryDecision: {
				decision: "none",
				nextAttempt: null,
			},
			owner: "codex",
			stopReason: null,
		});
		expect(packet.recoveryEvent).toBeNull();
		expect(emitTerminalRunRecordMock).toHaveBeenCalledWith(
			expect.objectContaining({
				command: "review-gate",
				outcome: "success",
				classification: "ok",
				event: expect.objectContaining({
					payload: expect.objectContaining({
						decisionState: "green-and-ready",
						prClosureStatus: "ready-to-merge",
						compactionRecommended: false,
						guardrailPromotionRecommended: false,
						alignmentDecisionPath: result.alignmentDecisionPath,
						attemptLedger: expect.objectContaining({
							schemaVersion: "attempt-ledger/v1",
						}),
						recoveryEvent: null,
					}),
				}),
			}),
		);
	});

	it("captures blocked and compaction-recommended remediation states", () => {
		const runRecordsDir = relative(process.cwd(), tempDir);
		const result = emitReviewGateDecisionArtifacts({
			options: {
				contractPath: "harness.contract.json",
				token: "test-token",
				owner: "acme",
				repo: "harness",
				prNumber: 42,
				headSha: "0123456789abcdef0123456789abcdef01234567",
				checkName: "review-check",
				runRecordsDir,
			},
			startedAt: "2026-03-14T12:00:00.000Z",
			finishedAt: "2026-03-14T12:00:05.000Z",
			exitCode: 5,
			result: {
				ok: true,
				output: {
					verified: false,
					headSha: "0123456789abcdef0123456789abcdef01234567",
					checkStatus: "not_found",
					needsRerun: true,
					policy_gate_status: "missing",
					plan_traceability_status: "fail",
					plan_ids: ["feat-tighten-review-gate"],
					blockers: [
						"risk-policy-gate check run not found for current HEAD SHA",
						"Plan traceability: missing plan evidence",
						"No APPROVED reviews found for the current HEAD SHA",
					],
					actionable_count: 3,
					informational_count: 1,
					confidence_rubric: {
						score: 1,
						level: "low",
						rationale: ["blocked"],
					},
				},
			},
		});

		const packet = JSON.parse(
			readFileSync(result.decisionPacketPath, "utf-8"),
		) as Record<string, unknown>;
		expect(packet.decision).toEqual({
			state: "blocked-with-remediation",
			prClosureStatus: "awaiting-remediation",
			requiresHumanDecision: false,
		});
		expect(packet.guardrailPromotion).toEqual({
			recommended: true,
			candidates: [
				"risk-policy-gate check run not found for current HEAD SHA",
				"Plan traceability: missing plan evidence",
				"No APPROVED reviews found for the current HEAD SHA",
			],
		});
		expect(packet.compaction).toEqual({
			recommended: true,
			reasons: ["multiple actionable blockers suggest context compaction"],
		});
		expect(packet.attemptLedger).toMatchObject({
			schemaVersion: "attempt-ledger/v1",
			command: "review-gate",
			attempt: 1,
			maxAttempts: 1,
			firstFailure: {
				attempt: 1,
				failureClass: "policy_blocked",
				exitCode: 5,
				observedAt: "2026-03-14T12:00:05.000Z",
			},
			retryDecision: {
				decision: "stop",
				nextAttempt: null,
			},
			owner: "codex",
			stopReason: "risk-policy-gate check run not found for current HEAD SHA",
		});
		expect(packet.recoveryEvent).toMatchObject({
			schemaVersion: "recovery-event/v1",
			command: "review-gate",
			attempt: 1,
			owner: "codex",
			failureClass: "policy_blocked",
			retryDecision: "stop",
		});
		expect(emitTerminalRunRecordMock).toHaveBeenCalledWith(
			expect.objectContaining({
				outcome: "blocked",
				classification: "policy_blocked",
			}),
		);
	});

	it("writes repository.checkName from effective runtime check identity when CLI input omitted --check", () => {
		const runRecordsDir = relative(process.cwd(), tempDir);
		const result = emitReviewGateDecisionArtifacts({
			options: {
				contractPath: "harness.contract.json",
				token: "test-token",
				owner: "acme",
				repo: "harness",
				prNumber: 42,
				headSha: "0123456789abcdef0123456789abcdef01234567",
				checkName: "",
				runRecordsDir,
			},
			effectiveCheckName: "pr-pipeline",
			startedAt: "2026-03-14T12:00:00.000Z",
			finishedAt: "2026-03-14T12:00:05.000Z",
			exitCode: 0,
			result: {
				ok: true,
				output: {
					verified: false,
					headSha: "0123456789abcdef0123456789abcdef01234567",
					checkStatus: "not_found",
					effectiveCheckName: "pr-pipeline",
					needsRerun: true,
					policy_gate_status: "missing",
					plan_traceability_status: "missing",
					plan_ids: [],
					blockers: ["pr-pipeline check run not found for current HEAD SHA"],
					actionable_count: 1,
					informational_count: 1,
					confidence_rubric: {
						score: 2,
						level: "low",
						rationale: ["missing"],
					},
				},
			},
		});

		const packet = JSON.parse(
			readFileSync(result.decisionPacketPath, "utf-8"),
		) as {
			repository: { checkName: string };
		};
		expect(packet.repository.checkName).toBe("pr-pipeline");
	});

	it("classifies escalation and timeout error codes with deterministic decision taxonomy", () => {
		const runRecordsDir = relative(process.cwd(), tempDir);
		const scenarios = [
			{
				code: "PERMISSION_DENIED" as const,
				message: "Token lacks pull_requests:read",
				expectedDecision: {
					state: "escalated-for-decision",
					prClosureStatus: "awaiting-operator-decision",
					requiresHumanDecision: true,
				},
				expectedOutcome: "hold",
				expectedClassification: "manual_intervention_required",
				expectCompaction: false,
				expectTimedOut: false,
			},
			{
				code: "SYSTEM_ERROR" as const,
				message: "GitHub API unavailable",
				expectedDecision: {
					state: "escalated-for-decision",
					prClosureStatus: "awaiting-operator-decision",
					requiresHumanDecision: true,
				},
				expectedOutcome: "failed",
				expectedClassification: "runtime_failed",
				expectCompaction: true,
				expectTimedOut: false,
			},
			{
				code: "TIMEOUT" as const,
				message: "review-gate timed out",
				expectedDecision: {
					state: "blocked-with-remediation",
					prClosureStatus: "awaiting-remediation",
					requiresHumanDecision: false,
				},
				expectedOutcome: "hold",
				expectedClassification: "manual_intervention_required",
				expectCompaction: true,
				expectTimedOut: true,
			},
		];

		for (const scenario of scenarios) {
			emitTerminalRunRecordMock.mockClear();
			const result = emitReviewGateDecisionArtifacts({
				options: {
					contractPath: "harness.contract.json",
					token: "test-token",
					owner: "acme",
					repo: "harness",
					prNumber: 42,
					headSha: "0123456789abcdef0123456789abcdef01234567",
					checkName: "review-check",
					runRecordsDir,
				},
				startedAt: "2026-03-14T12:00:00.000Z",
				finishedAt: "2026-03-14T12:00:05.000Z",
				exitCode: 1,
				result: {
					ok: false,
					error: {
						code: scenario.code,
						message: scenario.message,
					},
				},
			});

			const packet = JSON.parse(
				readFileSync(result.decisionPacketPath, "utf-8"),
			) as {
				decision: {
					state: string;
					prClosureStatus: string;
					requiresHumanDecision: boolean;
				};
				compaction: { recommended: boolean };
				reviewGate: { timedOut: boolean; errorCode?: string };
				attemptLedger: {
					firstFailure: { failureClass: string } | null;
					owner: string;
					retryDecision: { decision: string };
				};
				recoveryEvent: {
					failureClass: string;
					owner: string;
					retryDecision: string;
				} | null;
			};

			expect(packet.decision).toEqual(scenario.expectedDecision);
			expect(packet.compaction.recommended).toBe(scenario.expectCompaction);
			expect(packet.reviewGate.timedOut).toBe(scenario.expectTimedOut);
			expect(packet.reviewGate.errorCode).toBe(scenario.code);
			expect(packet.attemptLedger.firstFailure?.failureClass).toBe(
				scenario.code.toLowerCase(),
			);
			expect(packet.attemptLedger.retryDecision.decision).toBe("stop");
			expect(packet.recoveryEvent).toMatchObject({
				failureClass: scenario.code.toLowerCase(),
				retryDecision: "stop",
			});
			expect(emitTerminalRunRecordMock).toHaveBeenCalledWith(
				expect.objectContaining({
					outcome: scenario.expectedOutcome,
					classification: scenario.expectedClassification,
					event: expect.objectContaining({
						payload: expect.objectContaining({
							decisionState: scenario.expectedDecision.state,
							prClosureStatus: scenario.expectedDecision.prClosureStatus,
							compactionRecommended: scenario.expectCompaction,
						}),
					}),
				}),
			);
		}
	});
});
