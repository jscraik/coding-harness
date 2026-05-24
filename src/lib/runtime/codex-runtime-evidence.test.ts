import { describe, expect, it } from "vitest";

import type { CodexRuntimeEvidence } from "./codex-runtime-evidence.js";
import {
	CODEX_RUNTIME_EVIDENCE_SCHEMA_VERSION,
	validateCodexRuntimeEvidence,
} from "./codex-runtime-evidence.js";

describe("codex-runtime-evidence/v1", () => {
	it("validates a source-provenance-backed packet with explicit unknowns", () => {
		const packet = validPacket();

		const result = validateCodexRuntimeEvidence(packet);

		expect(result).toEqual({ valid: true, findings: [] });
	});

	it("requires a turn id because claim support is turn scoped", () => {
		const packet = validPacket();
		packet.codex.turnId = "";

		const result = validateCodexRuntimeEvidence(packet);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "string_missing",
				path: "codex.turnId",
			}),
		);
	});

	it("requires a failure class when trace id is unavailable", () => {
		const packet = validPacket();
		packet.codex.traceId = null;
		packet.codex.traceFailureClass = null;

		const result = validateCodexRuntimeEvidence(packet);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "trace_failure_class_missing",
				path: "codex.traceFailureClass",
			}),
		);
	});

	it("requires unknown permission state to carry a failure class", () => {
		const packet = validPacket();
		packet.permissions.profile = "unknown";
		packet.permissions.failureClass = null;

		const result = validateCodexRuntimeEvidence(packet);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "permission_failure_class_missing",
				path: "permissions.failureClass",
			}),
		);
	});

	it("rejects adjacent-field inference for external state without evidence", () => {
		const packet = validPacket();
		packet.externalState = {
			status: "provided",
			evidenceRef: null,
			failureClass: null,
		};

		const result = validateCodexRuntimeEvidence(packet);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "optional_state_evidence_missing",
				path: "externalState.evidenceRef",
			}),
		);
	});

	it("rejects provided external state when the evidence ref is missing from receipts", () => {
		const packet = validPacket();
		packet.externalState = {
			status: "provided",
			evidenceRef: "github://pr/123",
			failureClass: null,
		};

		const result = validateCodexRuntimeEvidence(packet);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "evidence_ref_missing",
				path: "externalState.evidenceRef",
			}),
		);
	});

	it("rejects malformed embedded evidence receipts", () => {
		const packet = validPacket();
		const receipt = packet.receipts[0];
		if (receipt === undefined) throw new Error("fixture receipt missing");
		packet.receipts[0] = {
			...receipt,
			freshness: "warm" as never,
		};

		const result = validateCodexRuntimeEvidence(packet);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "receipt_invalid",
				path: "receipts[0].freshness",
			}),
		);
	});

	it("rejects duplicate receipt refs because downstream resolution must be deterministic", () => {
		const packet = validPacket();
		const receipt = packet.receipts[0];
		if (receipt === undefined) throw new Error("fixture receipt missing");
		packet.receipts.push({
			...receipt,
			status: "fail",
			freshness: "stale",
		});

		const result = validateCodexRuntimeEvidence(packet);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "duplicate_receipt_ref",
				path: "receipts[1].ref",
			}),
		);
	});

	it("requires source provenance with commit or checksum-backed capture metadata", () => {
		const packet = validPacket();
		packet.sourceProvenance.sourceFileChecksums = {};

		const result = validateCodexRuntimeEvidence(packet);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "source_file_checksums_missing",
				path: "sourceProvenance.sourceFileChecksums",
			}),
		);
	});

	it("rejects impossible source capture dates", () => {
		const packet = validPacket();
		packet.sourceProvenance.capturedAt = "2026-02-31T00:00:00Z";

		const result = validateCodexRuntimeEvidence(packet);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "timestamp_invalid",
				path: "sourceProvenance.capturedAt",
			}),
		);
	});

	it("rejects recognized source paths with mismatched source-kind metadata", () => {
		const packet = validPacket();
		packet.sourceProvenance.sourceKind = "sdk_python";

		const result = validateCodexRuntimeEvidence(packet);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "source_kind_mismatch",
				path: "sourceProvenance.sourceKind",
			}),
		);
	});
});

function validPacket(): CodexRuntimeEvidence {
	return {
		schemaVersion: CODEX_RUNTIME_EVIDENCE_SCHEMA_VERSION,
		generatedAt: "2026-05-24T22:45:00Z",
		sourceProvenance: {
			sourceKind: "sdk_typescript",
			codexRepoPath: "sdk/typescript/src/events.ts",
			commitSha: "951efd3392882064961e1621344178723d4887c4",
			dirtyState: "dirty",
			sourceFileChecksums: {
				"sdk/typescript/src/events.ts":
					"sha256:aaa850bf1da2867ad3d1994dd9023b5693471491b33993562af916f727c49a44",
			},
			capturedAt: "2026-05-24T22:40:00Z",
		},
		codex: {
			threadId: "thread-123",
			turnId: "turn-456",
			traceId: null,
			traceFailureClass: "sdk_event_does_not_expose_trace_id",
			goalState: "unknown",
			model: "gpt-5.5",
		},
		permissions: {
			profile: "unknown",
			writableRoots: [],
			network: "unknown",
			evidenceRef: null,
			failureClass: "sdk_event_does_not_expose_permission_profile",
		},
		mcp: {
			servers: [
				{
					name: "codex_repo",
					status: "unknown",
					failureClass: "sdk_event_does_not_expose_mcp_environment",
				},
			],
		},
		receipts: [
			{
				schemaVersion: "evidence-receipt/v1",
				kind: "artifact",
				ref: "codex://sdk/typescript/src/events.ts",
				producer: "codex-source-fixture",
				status: "pass",
				freshness: "current",
				evidenceUse: "orientation",
				blockerClass: null,
				producedAt: "2026-05-24T22:40:00Z",
				checksum:
					"sha256:aaa850bf1da2867ad3d1994dd9023b5693471491b33993562af916f727c49a44",
			},
		],
		validationResults: [
			{
				name: "codex-runtime-source-provenance",
				status: "pass",
				evidenceRef: "codex://sdk/typescript/src/events.ts",
				verifiedAt: "2026-05-24T22:45:00Z",
			},
		],
		externalState: {
			status: "unknown",
			evidenceRef: null,
			failureClass: "sdk_event_does_not_expose_external_state",
		},
		reviewState: {
			status: "unknown",
			evidenceRef: null,
			failureClass: "sdk_event_does_not_expose_review_state",
		},
		staleState: [
			{
				subject: "external_state",
				classification: "unknown",
				reason: "SDK event cannot prove PR, CI, review, or Linear state.",
				evidenceRef: null,
			},
		],
	};
}
