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
		expect(packet.decision).toEqual({
			state: "green-and-ready",
			prClosureStatus: "ready-to-merge",
			requiresHumanDecision: false,
		});
		expect(packet.compaction).toEqual({
			recommended: false,
			reasons: [],
		});
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
		expect(emitTerminalRunRecordMock).toHaveBeenCalledWith(
			expect.objectContaining({
				outcome: "blocked",
				classification: "policy_blocked",
			}),
		);
	});
});
