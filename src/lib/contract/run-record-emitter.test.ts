import { beforeEach, describe, expect, it, vi } from "vitest";

const { appendCanonicalEventMock, writeCanonicalManifestMock } = vi.hoisted(
	() => ({
		appendCanonicalEventMock: vi.fn(),
		writeCanonicalManifestMock: vi.fn(),
	}),
);

vi.mock("./run-records.js", () => ({
	appendCanonicalEvent: appendCanonicalEventMock,
	writeCanonicalManifest: writeCanonicalManifestMock,
}));

import { emitTerminalRunRecord } from "./run-record-emitter.js";

describe("run-record-emitter", () => {
	beforeEach(() => {
		appendCanonicalEventMock.mockReset();
		writeCanonicalManifestMock.mockReset();
		writeCanonicalManifestMock.mockReturnValue({
			path: "/tmp/agent-runs/run-1/manifest.json",
			checksum: "a".repeat(64),
		});
		appendCanonicalEventMock.mockReturnValue({
			path: "/tmp/agent-runs/run-1/events.jsonl",
			eventHash: "b".repeat(64),
		});
	});

	it("writes terminal manifest and terminal event in sequence", () => {
		const result = emitTerminalRunRecord({
			command: "pilot-evaluate",
			startedAt: "2026-03-09T12:00:00.000Z",
			finishedAt: "2026-03-09T12:00:01.000Z",
			outcome: "success",
			classification: "ok",
			exitCode: 0,
			contract: {
				path: "harness.contract.json",
				hash: "c".repeat(64),
			},
			policyContext: {
				effectivePolicySource: "policy/test.json",
				hash: "d".repeat(64),
			},
		});

		expect(writeCanonicalManifestMock).toHaveBeenCalledTimes(1);
		expect(appendCanonicalEventMock).toHaveBeenCalledTimes(1);
		expect(result.manifestPath).toContain("manifest.json");
		expect(result.eventsPath).toContain("events.jsonl");
	});

	it("fails closed when terminal event append fails after manifest write", () => {
		appendCanonicalEventMock.mockImplementation(() => {
			throw new Error("hash chain broken");
		});

		expect(() =>
			emitTerminalRunRecord({
				command: "pilot-evaluate",
				startedAt: "2026-03-09T12:00:00.000Z",
				finishedAt: "2026-03-09T12:00:01.000Z",
				outcome: "hold",
				classification: "manual_intervention_required",
				exitCode: 1,
				contract: {
					path: "harness.contract.json",
					hash: "c".repeat(64),
				},
				policyContext: {
					effectivePolicySource: "policy/test.json",
					hash: "d".repeat(64),
				},
			}),
		).toThrow(/hash chain broken/i);

		expect(writeCanonicalManifestMock).toHaveBeenCalledTimes(1);
		expect(appendCanonicalEventMock).toHaveBeenCalledTimes(1);
	});
});
