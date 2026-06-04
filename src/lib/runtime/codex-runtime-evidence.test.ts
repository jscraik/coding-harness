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

	it("allows client user-message id to be absent without adjacent-field inference", () => {
		const packet = validPacket();
		packet.codex.clientUserMessageId = null;

		const result = validateCodexRuntimeEvidence(packet);

		expect(result).toEqual({ valid: true, findings: [] });
	});

	it("rejects malformed client user-message id values", () => {
		const packet = validPacket();
		packet.codex.clientUserMessageId = "";

		const result = validateCodexRuntimeEvidence(packet);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				path: "codex.clientUserMessageId",
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

	it("validates environment-scoped permission evidence across execution environments", () => {
		const desktopPacket = validPacket();
		desktopPacket.environment = {
			environmentId: "codex-desktop:thread-123",
			cwd: "/repo/coding-harness",
			expectedCwd: "/repo/coding-harness",
			executorKind: "codex_desktop",
			approvalScope: "auto_review",
			expectedApprovalScope: "auto_review",
			sandboxPolicyRef: "codex://runtime/sandbox-policy.json",
			state: "current",
			failureClass: null,
		};

		expect(validateCodexRuntimeEvidence(desktopPacket)).toEqual({
			valid: true,
			findings: [],
		});

		const subagentPacket = validPacket();
		subagentPacket.environment.environmentId = "subagent:reviewer-1";
		subagentPacket.environment.executorKind = "subagent";

		expect(validateCodexRuntimeEvidence(subagentPacket)).toEqual({
			valid: true,
			findings: [],
		});
	});

	it("requires stale cwd classification when the environment cwd changed", () => {
		const packet = validPacket();
		packet.environment.cwd = "/repo/old-worktree";
		packet.environment.expectedCwd = "/repo/coding-harness";

		const result = validateCodexRuntimeEvidence(packet);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "environment_stale_cwd_missing",
				path: "environment.state",
			}),
		);
	});

	it("requires approval-scope mismatch classification when approval scope differs from policy", () => {
		const packet = validPacket();
		packet.environment.approvalScope = "escalated";
		packet.environment.expectedApprovalScope = "auto_review";

		const result = validateCodexRuntimeEvidence(packet);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "approval_scope_mismatch_missing",
				path: "environment.state",
			}),
		);
	});

	it("requires sandbox policy references for known permission claims", () => {
		const packet = validPacket();
		packet.environment.sandboxPolicyRef = null;

		const result = validateCodexRuntimeEvidence(packet);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "sandbox_policy_ref_missing",
				path: "environment.sandboxPolicyRef",
			}),
		);
	});

	it("rejects current environment claims without any explicit scope evidence", () => {
		const packet = validPacket();
		packet.permissions.profile = "read_only";
		packet.permissions.writableRoots = [];
		packet.environment = {
			environmentId: null,
			cwd: null,
			expectedCwd: null,
			executorKind: "unknown",
			approvalScope: "unknown",
			expectedApprovalScope: null,
			sandboxPolicyRef: null,
			state: "current",
			failureClass: null,
		};

		const result = validateCodexRuntimeEvidence(packet);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "environment_current_scope_missing",
				path: "environment.state",
			}),
		);
	});

	it("rejects sandbox policy refs that are not backed by receipts", () => {
		const packet = validPacket();
		packet.environment.sandboxPolicyRef = "codex://runtime/missing-policy.json";

		const result = validateCodexRuntimeEvidence(packet);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "evidence_ref_missing",
				path: "environment.sandboxPolicyRef",
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
				path: "receipts[3].ref",
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
			clientUserMessageId: "client-user-message-789",
			traceId: null,
			traceFailureClass: "sdk_event_does_not_expose_trace_id",
			goalState: "unknown",
			model: "gpt-5.5",
		},
		permissions: {
			profile: "workspace_write",
			writableRoots: ["/repo/coding-harness"],
			network: "enabled",
			evidenceRef: "codex://runtime/permissions.json",
			failureClass: null,
		},
		environment: {
			environmentId: "codex-desktop:thread-123",
			cwd: "/repo/coding-harness",
			expectedCwd: "/repo/coding-harness",
			executorKind: "codex_desktop",
			approvalScope: "auto_review",
			expectedApprovalScope: "auto_review",
			sandboxPolicyRef: "codex://runtime/sandbox-policy.json",
			state: "current",
			failureClass: null,
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
			{
				schemaVersion: "evidence-receipt/v1",
				kind: "artifact",
				ref: "codex://runtime/permissions.json",
				producer: "codex-source-fixture",
				status: "pass",
				freshness: "current",
				evidenceUse: "claim_support",
				blockerClass: null,
				producedAt: "2026-05-24T22:40:00Z",
			},
			{
				schemaVersion: "evidence-receipt/v1",
				kind: "artifact",
				ref: "codex://runtime/sandbox-policy.json",
				producer: "codex-source-fixture",
				status: "pass",
				freshness: "current",
				evidenceUse: "claim_support",
				blockerClass: null,
				producedAt: "2026-05-24T22:40:00Z",
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
