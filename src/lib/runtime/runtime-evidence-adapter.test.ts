import { describe, expect, it } from "vitest";

import type { CodexRuntimeEvidence } from "./codex-runtime-evidence.js";
import {
	adaptCodexRuntimeEvidenceToRuntimeEvidenceBundle,
	CODEX_RUNTIME_EVIDENCE_SCHEMA_VERSION,
} from "./codex-runtime-evidence.js";
import { validateRuntimeEvidenceBundle } from "./runtime-evidence-bundle.js";
import { inspectRuntimeEvidenceBundle } from "./runtime-evidence-adapter.js";

describe("codex runtime evidence adapter", () => {
	it("adapts a validated Codex packet into runtime-evidence-bundle/v1", () => {
		const bundle = adaptCodexRuntimeEvidenceToRuntimeEvidenceBundle(
			validPacket(),
			{
				issueKey: "JSC-363",
				provenanceRef: ".harness/runtime/codex-runtime-evidence-turn-456.json",
			},
		);

		expect(validateRuntimeEvidenceBundle(bundle)).toEqual({
			valid: true,
			errors: [],
		});
		expect(bundle).toMatchObject({
			schemaVersion: "runtime-evidence-bundle/v1",
			generatedAt: "2026-05-24T22:45:00Z",
			issueKey: "JSC-363",
			provenance: {
				kind: "codex_runtime",
				ref: ".harness/runtime/codex-runtime-evidence-turn-456.json",
				collectedAt: "2026-05-24T22:40:00Z",
			},
		});
		expect(bundle.sources).toContainEqual(
			expect.objectContaining({
				kind: "artifact",
				ref: "codex://sdk/typescript/src/events.ts",
				status: "usable",
			}),
		);
		expect(bundle.sources).toContainEqual(
			expect.objectContaining({
				kind: "session",
				ref: "codex-runtime://turn-456/permissions",
				status: "blocked",
				failureClass: "sdk_event_does_not_expose_permission_profile",
			}),
		);
		expect(bundle.blockers).toContain(
			"Codex permission profile incomplete: sdk_event_does_not_expose_permission_profile.",
		);
	});

	it("feeds the existing runtime evidence bundle inspector as the deep-module seam", () => {
		const bundle = adaptCodexRuntimeEvidenceToRuntimeEvidenceBundle(
			validPacket(),
		);

		const snapshot = inspectRuntimeEvidenceBundle(bundle, unexpectedPhaseExit);

		expect(snapshot.issueKey).toBeNull();
		expect(snapshot.sources).toContainEqual(
			expect.objectContaining({
				kind: "session",
				ref: "codex-runtime://turn-456",
				status: "usable",
			}),
		);
		expect(snapshot.sources).toContainEqual(
			expect.objectContaining({
				kind: "review",
				ref: "codex-review_state://unknown",
				status: "blocked",
				failureClass: "sdk_event_does_not_expose_review_state",
			}),
		);
		expect(snapshot.blockers).toContain(
			"Review state unavailable: sdk_event_does_not_expose_review_state.",
		);
		expect(snapshot.codexRuntime).toMatchObject({
			provenanceRef: "codex-runtime://turn-456",
			sessionRefs: expect.arrayContaining([
				"codex-runtime://turn-456/permissions",
			]),
			reviewRefs: expect.arrayContaining(["codex-review_state://unknown"]),
		});
		expect(snapshot.codexRuntime?.receiptRefs).not.toContain(
			CODEX_RUNTIME_EVIDENCE_SCHEMA_VERSION,
		);
	});

	it("emits no synthetic blockers for a healthy Codex runtime packet", () => {
		const bundle = adaptCodexRuntimeEvidenceToRuntimeEvidenceBundle(
			healthyPacket(),
		);

		expect(validateRuntimeEvidenceBundle(bundle)).toEqual({
			valid: true,
			errors: [],
		});
		expect(bundle.blockers).toEqual([]);
		expect(bundle.sources).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "session",
					ref: "codex-runtime://turn-456/permissions",
					status: "usable",
					freshness: "current",
				}),
				expect.objectContaining({
					kind: "session",
					ref: "codex-mcp://codex_repo",
					status: "usable",
					freshness: "current",
				}),
				expect.objectContaining({
					kind: "artifact",
					ref: "artifact://external-state.json",
					status: "usable",
					freshness: "current",
				}),
				expect.objectContaining({
					kind: "review",
					ref: "artifact://review-state.json",
					status: "usable",
					freshness: "current",
				}),
			]),
		);
		expect(bundle.sources).not.toContainEqual(
			expect.objectContaining({ status: "blocked" }),
		);
	});

	it("retains the highest-risk source when provenance collides with packet evidence", () => {
		const packet = healthyPacket();
		packet.receipts.push({
			schemaVersion: "evidence-receipt/v1",
			kind: "run_record",
			ref: "codex-runtime://turn-456",
			producer: "codex-runtime-fixture",
			status: "fail",
			freshness: "stale",
			evidenceUse: "orientation",
			blockerClass: "run_record_stale",
			producedAt: "2026-05-24T22:40:00Z",
		});
		const bundle = adaptCodexRuntimeEvidenceToRuntimeEvidenceBundle(packet, {
			provenanceRef: "codex-runtime://turn-456",
		});

		const snapshot = inspectRuntimeEvidenceBundle(bundle, unexpectedPhaseExit);

		expect(
			snapshot.sources.filter(
				(source) =>
					source.kind === "session" &&
					source.ref === "codex-runtime://turn-456",
			),
		).toEqual([
			expect.objectContaining({
				kind: "session",
				ref: "codex-runtime://turn-456",
				status: "invalid",
				freshness: "stale",
				failureClass: "run_record_stale",
			}),
		]);
		expect(snapshot.codexRuntime?.sourceCount).toBe(
			snapshot.codexRuntime?.receiptRefs.length,
		);
		expect(snapshot.codexRuntime?.blockedSourceCount).toBeGreaterThan(0);
		expect(snapshot.codexRuntime?.receiptRefs).toContain(
			"codex-runtime://turn-456",
		);
	});

	it("keeps unique provenance outside Codex receipt subset counts", () => {
		const bundle = adaptCodexRuntimeEvidenceToRuntimeEvidenceBundle(
			healthyPacket(),
			{ provenanceRef: "codex-runtime://unique-provenance" },
		);

		const snapshot = inspectRuntimeEvidenceBundle(bundle, unexpectedPhaseExit);

		expect(snapshot.sources).toContainEqual(
			expect.objectContaining({ ref: "codex-runtime://unique-provenance" }),
		);
		expect(snapshot.codexRuntime?.receiptRefs).not.toContain(
			"codex-runtime://unique-provenance",
		);
		expect(snapshot.codexRuntime?.sourceCount).toBe(
			snapshot.codexRuntime?.receiptRefs.length,
		);
		expect(snapshot.codexRuntime?.sourceCount).toBeLessThan(
			snapshot.sources.length,
		);
	});

	it("downgrades unknown Codex source cleanliness instead of treating it as healthy", () => {
		const packet = healthyPacket();
		packet.sourceProvenance.dirtyState = "unknown";
		packet.sourceProvenance.commitSha = null;

		const bundle = adaptCodexRuntimeEvidenceToRuntimeEvidenceBundle(packet);

		expect(bundle.sources).toContainEqual(
			expect.objectContaining({
				kind: "artifact",
				ref: "codex-source://sdk_typescript/sdk/typescript/src/events.ts@unknown",
				status: "blocked",
				freshness: "unknown",
				failureClass: "codex_source_cleanliness_unknown",
			}),
		);
		expect(bundle.blockers).toContain(
			"Codex source provenance is unknown: codex_source_cleanliness_unknown.",
		);
	});

	it("normalizes a blank provenanceRef option before emitting a bundle", () => {
		const packet = healthyPacket();
		const bundle = adaptCodexRuntimeEvidenceToRuntimeEvidenceBundle(packet, {
			provenanceRef: "   ",
		});

		expect(validateRuntimeEvidenceBundle(bundle)).toEqual({
			valid: true,
			errors: [],
		});
		expect(bundle.provenance.ref).toBe("codex-runtime://turn-456");
	});

	it("rejects invalid Codex packets before emitting bundle evidence", () => {
		const packet = validPacket();
		packet.codex.turnId = "";

		expect(() =>
			adaptCodexRuntimeEvidenceToRuntimeEvidenceBundle(packet),
		).toThrow("string_missing");
	});

	it("does not persist raw packet bodies or bulky event payloads into the bundle", () => {
		const packet = validPacket();
		(packet as unknown as Record<string, unknown>).rawEvents = [
			{ payload: "large raw transcript body" },
		];

		const bundle = adaptCodexRuntimeEvidenceToRuntimeEvidenceBundle(packet);
		const serialized = JSON.stringify(bundle);

		expect(serialized).not.toContain(CODEX_RUNTIME_EVIDENCE_SCHEMA_VERSION);
		expect(serialized).not.toContain("rawEvents");
		expect(serialized).not.toContain("large raw transcript body");
		expect(serialized).toContain("runtime-evidence-bundle/v1");
	});
});

function unexpectedPhaseExit(): never {
	throw new Error("test fixture does not include phase-exit evidence");
}

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
			clientUserMessageId: null,
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

function healthyPacket(): CodexRuntimeEvidence {
	const packet = validPacket();
	packet.sourceProvenance.dirtyState = "clean";
	packet.codex.traceId = "trace-789";
	packet.codex.traceFailureClass = null;
	packet.codex.goalState = "active";
	packet.permissions.profile = "workspace_write";
	packet.permissions.network = "enabled";
	packet.permissions.failureClass = null;
	packet.mcp.servers = [
		{
			name: "codex_repo",
			status: "available",
			failureClass: null,
		},
	];
	packet.externalState = {
		status: "provided",
		evidenceRef: "artifact://external-state.json",
		failureClass: null,
	};
	packet.reviewState = {
		status: "provided",
		evidenceRef: "artifact://review-state.json",
		failureClass: null,
	};
	packet.staleState = [
		{
			subject: "external_state",
			classification: "current",
			reason: null,
			evidenceRef: "artifact://external-state.json",
		},
	];
	packet.receipts.push(
		{
			schemaVersion: "evidence-receipt/v1",
			kind: "external_state",
			ref: "artifact://external-state.json",
			producer: "external-state-fixture",
			status: "pass",
			freshness: "current",
			evidenceUse: "claim_support",
			blockerClass: null,
			producedAt: "2026-05-24T22:40:00Z",
		},
		{
			schemaVersion: "evidence-receipt/v1",
			kind: "review_artifact",
			ref: "artifact://review-state.json",
			producer: "review-state-fixture",
			status: "pass",
			freshness: "current",
			evidenceUse: "claim_support",
			blockerClass: null,
			producedAt: "2026-05-24T22:40:00Z",
		},
	);
	return packet;
}
