import { describe, expect, it, vi } from "vitest";
import {
	buildDecisionRequest,
	runDecisionRequestCLI,
} from "./decision-request.js";

describe("decision-request command", () => {
	it("emits a read-only decision-request/v1 packet with escalation metadata", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		try {
			const exitCode = runDecisionRequestCLI([
				"--json",
				"--generated-at",
				"2026-05-27T13:30:00.000Z",
				"--intent",
				"Choose whether to refresh external state before closeout.",
				"--default-option",
				"refresh_external_state",
				"--boundary",
				"merge_readiness",
				"--freshness",
				"stale",
				"--option",
				"refresh_external_state=Refresh PR, CI, review, and tracker snapshots.",
				"--tradeoff",
				"refresh_external_state=Requires network access.",
				"--tradeoff",
				"refresh_external_state=Prevents stale closeout claims.",
				"--evidence",
				"runtime-card:JSC-363,review-state:JSC-363",
				"--escalation-channel",
				"codex_thread",
			]);

			expect(exitCode).toBe(0);
			const packet = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
			expect(packet).toMatchObject({
				schemaVersion: "decision-request/v1",
				generatedAt: "2026-05-27T13:30:00.000Z",
				producer: "harness:decision-request",
				status: "open",
				authority: "human",
				defaultOptionId: "refresh_external_state",
				freshness: "stale",
				runtimeStatus: "emitted",
				evidenceUse: "governance_request_only",
				claimSupport: "not_closeout_proof",
				hiltBoundary: {
					boundaryType: "merge_readiness",
					riskTier: "high",
					blockerClass: "requires_external_state_refresh",
				},
				escalation: {
					required: true,
					targetRole: "human",
					channel: "codex_thread",
					requestedAt: "2026-05-27T13:30:00.000Z",
				},
			});
			expect(packet.options[0].tradeoffs).toEqual([
				"Requires network access.",
				"Prevents stale closeout claims.",
			]);
			expect(packet.evidenceRefs).toEqual([
				"runtime-card:JSC-363",
				"review-state:JSC-363",
			]);
			expect(packet.staleState).toEqual([
				{
					surface: "decision_request_freshness",
					freshness: "stale",
					reason: "freshness_stale",
				},
			]);
		} finally {
			infoSpy.mockRestore();
		}
	});

	it("normalizes expired current/open input to stale expired state", () => {
		const result = buildDecisionRequest({
			generatedAt: "2026-05-27T13:30:00.000Z",
			expiresAt: "2026-05-27T13:29:59.000Z",
			status: "open",
			freshness: "current",
			intent: "Choose whether stale state can support closeout.",
			defaultOptionId: "refresh",
			boundaryType: "merge_readiness",
			evidenceRefs: ["external-state:JSC-363"],
			options: [
				{ id: "refresh", label: "Refresh external state.", tradeoffs: [] },
			],
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.packet.status).toBe("expired");
		expect(result.packet.freshness).toBe("stale");
		expect(result.packet.staleState).toEqual([
			{
				surface: "decision_request_expiry",
				freshness: "stale",
				reason: "expires_at_not_after_generated_at",
			},
		]);
	});

	it("rejects duplicate option ids", () => {
		const result = buildDecisionRequest({
			generatedAt: "2026-05-27T13:30:00.000Z",
			intent: "Choose a default.",
			defaultOptionId: "refresh",
			boundaryType: "external_mutation",
			options: [
				{ id: "refresh", label: "Refresh now.", tradeoffs: [] },
				{ id: "refresh", label: "Refresh later.", tradeoffs: [] },
			],
		});

		expect(result).toMatchObject({
			ok: false,
			code: "decision-request.option_duplicate",
		});
	});

	it("rejects tradeoffs for unknown option ids", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		try {
			const exitCode = runDecisionRequestCLI([
				"--json",
				"--intent",
				"Choose a default.",
				"--default-option",
				"refresh",
				"--boundary",
				"external_mutation",
				"--option",
				"refresh=Refresh now.",
				"--tradeoff",
				"merge=Would skip refresh.",
			]);

			expect(exitCode).toBe(2);
			const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
			expect(payload).toMatchObject({
				schemaVersion: "decision-request-error/v1",
				error: { code: "decision-request.tradeoff_unknown_option" },
			});
		} finally {
			infoSpy.mockRestore();
		}
	});

	it("rejects missing escalation fields at the builder boundary", () => {
		const result = buildDecisionRequest({
			generatedAt: "2026-05-27T13:30:00.000Z",
			intent: "Choose a default.",
			defaultOptionId: "refresh",
			boundaryType: "external_mutation",
			options: [{ id: "refresh", label: "Refresh now.", tradeoffs: [] }],
			escalation: {
				channel: " ",
				reason: " ",
			},
		});

		expect(result).toMatchObject({
			ok: false,
			code: "decision-request.escalation_required",
		});
	});

	it("rejects duplicate scalar flags instead of relying on parser precedence", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		try {
			const exitCode = runDecisionRequestCLI([
				"--json",
				"--intent",
				"Choose a default.",
				"--intent",
				"Choose another default.",
				"--default-option",
				"refresh",
				"--boundary",
				"external_mutation",
				"--option",
				"refresh=Refresh now.",
			]);

			expect(exitCode).toBe(2);
			const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
			expect(payload).toMatchObject({
				schemaVersion: "decision-request-error/v1",
				error: { code: "decision-request.scalar_flag_duplicate" },
			});
		} finally {
			infoSpy.mockRestore();
		}
	});

	it("rejects default options that do not match emitted option ids", () => {
		const result = buildDecisionRequest({
			generatedAt: "2026-05-27T13:30:00.000Z",
			intent: "Choose a default.",
			defaultOptionId: "merge",
			boundaryType: "external_mutation",
			options: [{ id: "refresh", label: "Refresh now.", tradeoffs: [] }],
		});

		expect(result).toMatchObject({
			ok: false,
			code: "decision-request.default_option_unknown",
		});
	});

	it("rejects date-only values for date-time fields", () => {
		const generatedAt = buildDecisionRequest({
			generatedAt: "2026-05-27",
			intent: "Choose a default.",
			defaultOptionId: "refresh",
			boundaryType: "external_mutation",
			options: [{ id: "refresh", label: "Refresh now.", tradeoffs: [] }],
		});
		expect(generatedAt).toMatchObject({
			ok: false,
			code: "decision-request.invalid_datetime",
		});

		const expiresAt = buildDecisionRequest({
			generatedAt: "2026-05-27T13:30:00.000Z",
			expiresAt: "2026-05-28",
			intent: "Choose a default.",
			defaultOptionId: "refresh",
			boundaryType: "external_mutation",
			options: [{ id: "refresh", label: "Refresh now.", tradeoffs: [] }],
		});
		expect(expiresAt).toMatchObject({
			ok: false,
			code: "decision-request.invalid_datetime",
		});

		const requestedAt = buildDecisionRequest({
			generatedAt: "2026-05-27T13:30:00.000Z",
			intent: "Choose a default.",
			defaultOptionId: "refresh",
			boundaryType: "external_mutation",
			options: [{ id: "refresh", label: "Refresh now.", tradeoffs: [] }],
			escalation: {
				requestedAt: "2026-05-27",
			},
		});
		expect(requestedAt).toMatchObject({
			ok: false,
			code: "decision-request.escalation_required",
		});
	});

	it("rejects routine uncertainty as a decision-request boundary", () => {
		const result = buildDecisionRequest({
			generatedAt: "2026-05-27T13:30:00.000Z",
			intent: "Choose whether to keep investigating an ordinary test failure.",
			defaultOptionId: "investigate",
			boundaryType: "routine_uncertainty",
			options: [
				{
					id: "investigate",
					label: "Continue local investigation.",
					tradeoffs: [],
				},
			],
		});

		expect(result).toMatchObject({
			ok: false,
			code: "decision-request.invalid_boundary",
		});
	});

	it("returns a usage error when the CLI receives a routine uncertainty boundary", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		try {
			const exitCode = runDecisionRequestCLI([
				"--json",
				"--intent",
				"Choose whether to keep investigating an ordinary test failure.",
				"--default-option",
				"investigate",
				"--boundary",
				"routine_uncertainty",
				"--option",
				"investigate=Continue local investigation.",
			]);

			expect(exitCode).toBe(2);
			const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
			expect(payload).toMatchObject({
				schemaVersion: "decision-request-error/v1",
				error: { code: "decision-request.invalid_boundary" },
			});
		} finally {
			infoSpy.mockRestore();
		}
	});

	it("requires evidence refs and non-current state for claim-sensitive boundaries", () => {
		const missingEvidence = buildDecisionRequest({
			generatedAt: "2026-05-27T13:30:00.000Z",
			intent: "Choose whether merge readiness can be claimed.",
			defaultOptionId: "refresh",
			boundaryType: "merge_readiness",
			freshness: "stale",
			options: [{ id: "refresh", label: "Refresh state.", tradeoffs: [] }],
		});
		expect(missingEvidence).toMatchObject({
			ok: false,
			code: "decision-request.boundary_evidence_required",
		});

		const currentStaleClaim = buildDecisionRequest({
			generatedAt: "2026-05-27T13:30:00.000Z",
			intent: "Choose whether stale evidence can support closeout.",
			defaultOptionId: "refresh",
			boundaryType: "stale_claim_support",
			evidenceRefs: ["external-state:JSC-363"],
			options: [{ id: "refresh", label: "Refresh state.", tradeoffs: [] }],
		});
		expect(currentStaleClaim).toMatchObject({
			ok: false,
			code: "decision-request.boundary_evidence_required",
		});
	});

	it("rejects blank evidence refs for claim-sensitive boundaries", () => {
		const result = buildDecisionRequest({
			generatedAt: "2026-05-27T13:30:00.000Z",
			intent: "Choose whether merge readiness can be claimed.",
			defaultOptionId: "refresh",
			boundaryType: "merge_readiness",
			freshness: "stale",
			evidenceRefs: ["", "   "],
			options: [{ id: "refresh", label: "Refresh state.", tradeoffs: [] }],
		});

		expect(result).toMatchObject({
			ok: false,
			code: "decision-request.boundary_evidence_required",
		});
	});

	it("normalizes non-empty evidence refs before emitting packets", () => {
		const result = buildDecisionRequest({
			generatedAt: "2026-05-27T13:30:00.000Z",
			intent: "Choose whether to mutate external state.",
			defaultOptionId: "mutate",
			boundaryType: "external_mutation",
			evidenceRefs: [" runtime-card:JSC-363 ", ""],
			options: [
				{ id: "mutate", label: "Mutate external state.", tradeoffs: [] },
			],
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.packet.evidenceRefs).toEqual(["runtime-card:JSC-363"]);
	});
});
