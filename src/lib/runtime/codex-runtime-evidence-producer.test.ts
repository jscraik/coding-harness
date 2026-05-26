import { describe, expect, it } from "vitest";

import {
	adaptCodexRuntimeEvidenceToRuntimeEvidenceBundle,
	type CodexRuntimeEvidence,
} from "./codex-runtime-evidence.js";
import {
	admitCodexRuntimeEvidencePacket,
	buildCodexRuntimeEvidenceFromProducerInput,
	CodexRuntimeEvidenceProducerError,
} from "./codex-runtime-evidence-producer.js";
import { validateRuntimeEvidenceBundle } from "./runtime-evidence-bundle.js";

describe("codex runtime evidence producer", () => {
	it("builds a validated packet from explicit wrapper facts", () => {
		const packet = buildCodexRuntimeEvidenceFromProducerInput({
			generatedAt: "2026-05-26T08:30:00Z",
			sourceProvenance: wrapperSourceProvenance(),
			sourceSnapshot: matchingSourceSnapshot(),
			codex: {
				threadId: "thread-123",
				turnId: "turn-456",
				traceId: "trace-789",
				goalState: "active",
				model: "gpt-5.5",
			},
			permissions: {
				profile: "workspace_write",
				writableRoots: ["/repo/coding-harness"],
				network: "enabled",
				evidenceRef: "artifact://permission-snapshot.json",
			},
			receipts: [permissionReceipt(), validationReceipt()],
			validationResults: [
				{
					name: "codex-runtime-producer-input",
					status: "pass",
					evidenceRef: "artifact://producer-validation.json",
					verifiedAt: "2026-05-26T08:31:00Z",
				},
			],
		});

		expect(packet).toMatchObject({
			schemaVersion: "codex-runtime-evidence/v1",
			codex: {
				threadId: "thread-123",
				turnId: "turn-456",
				traceId: "trace-789",
				traceFailureClass: null,
				goalState: "active",
			},
			permissions: {
				profile: "workspace_write",
				network: "enabled",
				failureClass: null,
			},
			externalState: {
				status: "unknown",
				failureClass: "producer_input_missing_external_state",
			},
			reviewState: {
				status: "unknown",
				failureClass: "producer_input_missing_review_state",
			},
		});
	});

	it("defaults missing runtime facts to explicit unknown classifications", () => {
		const packet = buildCodexRuntimeEvidenceFromProducerInput({
			generatedAt: "2026-05-26T08:30:00Z",
			sourceProvenance: wrapperSourceProvenance(),
			sourceSnapshot: matchingSourceSnapshot(),
			codex: {
				threadId: null,
				turnId: "turn-456",
			},
		});

		expect(packet.codex.traceId).toBeNull();
		expect(packet.codex.traceFailureClass).toBe(
			"producer_input_missing_trace_context",
		);
		expect(packet.permissions).toEqual({
			profile: "unknown",
			writableRoots: [],
			network: "unknown",
			evidenceRef: null,
			failureClass: "producer_input_missing_permission_profile",
		});
		expect(packet.mcp.servers).toEqual([]);
		expect(packet.receipts).toEqual([]);
		expect(packet.validationResults).toEqual([]);
	});

	it("feeds the existing runtime evidence bundle adapter without shared contract edits", () => {
		const packet = buildCodexRuntimeEvidenceFromProducerInput({
			generatedAt: "2026-05-26T08:30:00Z",
			sourceProvenance: wrapperSourceProvenance(),
			sourceSnapshot: matchingSourceSnapshot(),
			codex: {
				threadId: "thread-123",
				turnId: "turn-456",
			},
		});

		const bundle = adaptCodexRuntimeEvidenceToRuntimeEvidenceBundle(packet, {
			issueKey: "JSC-363",
			provenanceRef: ".harness/runtime/codex-runtime-evidence-turn-456.json",
		});

		expect(validateRuntimeEvidenceBundle(bundle)).toEqual({
			valid: true,
			errors: [],
		});
		expect(bundle.provenance).toEqual({
			kind: "codex_runtime",
			ref: ".harness/runtime/codex-runtime-evidence-turn-456.json",
			collectedAt: "2026-05-26T08:25:00Z",
		});
		expect(bundle.blockers).toEqual(
			expect.arrayContaining([
				"Codex trace unavailable: producer_input_missing_trace_context.",
				"Codex permission profile incomplete: producer_input_missing_permission_profile.",
				"External state unavailable: producer_input_missing_external_state.",
				"Review state unavailable: producer_input_missing_review_state.",
			]),
		);
	});

	it("rejects invalid packets at the producer boundary", () => {
		const packet = buildCodexRuntimeEvidenceFromProducerInput({
			generatedAt: "2026-05-26T08:30:00Z",
			sourceProvenance: wrapperSourceProvenance(),
			sourceSnapshot: matchingSourceSnapshot(),
			codex: {
				turnId: "turn-456",
			},
		}) as CodexRuntimeEvidence;
		packet.codex.turnId = "";

		expect(() => admitCodexRuntimeEvidencePacket(packet)).toThrow(
			CodexRuntimeEvidenceProducerError,
		);
		try {
			admitCodexRuntimeEvidencePacket(packet);
		} catch (error) {
			expect(error).toBeInstanceOf(CodexRuntimeEvidenceProducerError);
			expect(
				(error as CodexRuntimeEvidenceProducerError).findings,
			).toContainEqual(
				expect.objectContaining({
					code: "string_missing",
					path: "codex.turnId",
				}),
			);
		}
	});

	it("rejects producer input when observed Codex source evidence is stale", () => {
		expect(() =>
			buildCodexRuntimeEvidenceFromProducerInput({
				generatedAt: "2026-05-26T08:30:00Z",
				sourceProvenance: wrapperSourceProvenance(),
				sourceSnapshot: {
					expected: expectedSourceSnapshot(),
					observed: {
						repoHeadSha: "0000000000000000000000000000000000000000",
						gitBlobShas: {},
					},
				},
				codex: {
					turnId: "turn-456",
				},
			}),
		).toThrow(CodexRuntimeEvidenceProducerError);
	});

	it("downgrades write-capable permissions without writable-root evidence", () => {
		const packet = buildCodexRuntimeEvidenceFromProducerInput({
			generatedAt: "2026-05-26T08:30:00Z",
			sourceProvenance: wrapperSourceProvenance(),
			sourceSnapshot: matchingSourceSnapshot(),
			codex: {
				turnId: "turn-456",
			},
			permissions: {
				profile: "workspace_write",
				writableRoots: [],
				network: "enabled",
			},
		});

		expect(packet.permissions).toEqual({
			profile: "unknown",
			writableRoots: [],
			network: "enabled",
			evidenceRef: null,
			failureClass: "producer_input_missing_writable_roots",
		});
	});

	it("downgrades escalated permissions without writable-root evidence", () => {
		const packet = buildCodexRuntimeEvidenceFromProducerInput({
			generatedAt: "2026-05-26T08:30:00Z",
			sourceProvenance: wrapperSourceProvenance(),
			sourceSnapshot: matchingSourceSnapshot(),
			codex: {
				turnId: "turn-456",
			},
			permissions: {
				profile: "escalated",
				writableRoots: [],
				network: "enabled",
			},
		});

		expect(packet.permissions.failureClass).toBe(
			"producer_input_missing_writable_roots",
		);
		expect(packet.permissions.profile).toBe("unknown");
	});
});

function wrapperSourceProvenance(): CodexRuntimeEvidence["sourceProvenance"] {
	return {
		sourceKind: "wrapper",
		codexRepoPath: "wrappers/codex-runtime-evidence-producer.ts",
		commitSha: "951efd3392882064961e1621344178723d4887c4",
		dirtyState: "clean",
		sourceFileChecksums: {
			"wrappers/codex-runtime-evidence-producer.ts":
				"sha256:0e9b1f8cf5f3c9c57a9a243a55975f1f8d9a7af933f74e23f5f996f78775e78c",
		},
		capturedAt: "2026-05-26T08:25:00Z",
	};
}

function matchingSourceSnapshot() {
	return {
		expected: expectedSourceSnapshot(),
		observed: {
			repoHeadSha: "951efd3392882064961e1621344178723d4887c4",
			gitBlobShas: {
				"wrappers/codex-runtime-evidence-producer.ts": "wrapper-blob-sha",
			},
		},
	};
}

function expectedSourceSnapshot() {
	return {
		repoPath: "/repo/codex",
		repoHeadSha: "951efd3392882064961e1621344178723d4887c4",
		files: [
			{
				path: "wrappers/codex-runtime-evidence-producer.ts",
				repoHeadSha: "951efd3392882064961e1621344178723d4887c4",
				gitBlobSha: "wrapper-blob-sha",
			},
		],
	};
}

function permissionReceipt() {
	return {
		schemaVersion: "evidence-receipt/v1" as const,
		kind: "run_record" as const,
		ref: "artifact://permission-snapshot.json",
		producer: "codex-runtime-evidence-producer-test",
		status: "pass" as const,
		freshness: "current" as const,
		evidenceUse: "orientation" as const,
		blockerClass: null,
		producedAt: "2026-05-26T08:29:00Z",
	};
}

function validationReceipt() {
	return {
		schemaVersion: "evidence-receipt/v1" as const,
		kind: "validation" as const,
		ref: "artifact://producer-validation.json",
		producer: "codex-runtime-evidence-producer-test",
		status: "pass" as const,
		freshness: "current" as const,
		evidenceUse: "orientation" as const,
		blockerClass: null,
		producedAt: "2026-05-26T08:31:00Z",
	};
}
