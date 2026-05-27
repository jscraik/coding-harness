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
				freshness: "current",
				runtimeStatus: "emitted",
				evidenceUse: "governance_request_only",
				claimSupport: "not_closeout_proof",
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
});
