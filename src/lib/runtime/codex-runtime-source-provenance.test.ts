import { describe, expect, it } from "vitest";

import type {
	CodexRuntimeEvidence,
	CodexRuntimeSourceKind,
} from "./codex-runtime-evidence.js";
import {
	CODEX_RUNTIME_EVIDENCE_SCHEMA_VERSION,
	classifyCodexRuntimeSourceKind,
	validateCodexRuntimeEvidence,
} from "./codex-runtime-evidence.js";

describe("codex runtime source provenance", () => {
	it.each([
		["sdk/typescript/src/thread.ts", "sdk_typescript"],
		["sdk/python/src/openai_codex/_message_router.py", "sdk_python"],
		["codex-rs/app-server-protocol/src/jsonrpc_lite.rs", "app_server_protocol"],
		["codex-rs/analytics/src/facts.rs", "analytics"],
		["wrappers/codex-runtime-evidence.ts", "wrapper"],
		["README.md", "unknown"],
	] satisfies Array<
		[string, CodexRuntimeSourceKind]
	>)("classifies %s as %s", (ref, expected) => {
		expect(classifyCodexRuntimeSourceKind(ref)).toBe(expected);
	});

	it("admits app-server protocol trace evidence without inferring permissions", () => {
		const packet = sourcePacket({
			sourceKind: "app_server_protocol",
			codexRepoPath: "codex-rs/app-server-protocol/src/jsonrpc_lite.rs",
			checksum:
				"sha256:27c09a1fbf92a02fe427155798a1b5c738d2b1a7a0483941ca6dff9c748052c0",
			traceId: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00",
			traceFailureClass: null,
			permissionFailureClass:
				"app_server_protocol_trace_does_not_prove_active_permission_profile",
		});

		const result = validateCodexRuntimeEvidence(packet);

		expect(result).toEqual({ valid: true, findings: [] });
		expect(packet.permissions.profile).toBe("unknown");
		expect(packet.externalState?.status).toBe("unknown");
	});

	it("admits analytics permission facts only when captured as explicit runtime state", () => {
		const packet = sourcePacket({
			sourceKind: "analytics",
			codexRepoPath: "codex-rs/analytics/src/facts.rs",
			checksum:
				"sha256:0d9c488a50638ffb2f621ac22e12898e994c6240646af599c00646b0f23f7e33",
			traceId: null,
			traceFailureClass: "analytics_fact_does_not_expose_w3c_trace_context",
			permissionProfile: "workspace_write",
			network: "enabled",
			permissionEvidenceRef: "codex://analytics/turn-resolved-config",
			permissionFailureClass: null,
		});

		const result = validateCodexRuntimeEvidence(packet);

		expect(result).toEqual({ valid: true, findings: [] });
		expect(packet.permissions.profile).toBe("workspace_write");
		expect(packet.permissions.evidenceRef).toBe(
			"codex://analytics/turn-resolved-config",
		);
	});

	it("keeps Python SDK turn routing evidence separate from external-state claims", () => {
		const packet = sourcePacket({
			sourceKind: "sdk_python",
			codexRepoPath: "sdk/python/src/openai_codex/_message_router.py",
			checksum:
				"sha256:965031b4abec0e7a9a932390cb3d56324214125ae2bc78226e686546ca9a2540",
			traceId: null,
			traceFailureClass: "python_sdk_router_does_not_expose_trace_context",
			permissionFailureClass:
				"python_sdk_router_does_not_expose_permission_profile",
		});

		const result = validateCodexRuntimeEvidence(packet);

		expect(result).toEqual({ valid: true, findings: [] });
		expect(packet.codex.turnId).toBe("turn-456");
		expect(packet.externalState).toEqual({
			status: "unknown",
			evidenceRef: null,
			failureClass: "source_does_not_expose_external_state",
		});
	});

	it("rejects source-derived fixtures that omit source checksums", () => {
		const packet = sourcePacket({
			sourceKind: "analytics",
			codexRepoPath: "codex-rs/analytics/src/facts.rs",
			checksum: "",
			traceId: null,
			traceFailureClass: "analytics_fact_does_not_expose_w3c_trace_context",
			permissionFailureClass:
				"analytics_fixture_missing_runtime_permission_snapshot",
		});

		const result = validateCodexRuntimeEvidence(packet);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "source_file_checksum_invalid",
				path: "sourceProvenance.sourceFileChecksums",
			}),
		);
	});
});

function sourcePacket(options: {
	sourceKind: CodexRuntimeSourceKind;
	codexRepoPath: string;
	checksum: string;
	traceId: string | null;
	traceFailureClass: string | null;
	permissionProfile?: "workspace_write" | "unknown";
	network?: "enabled" | "unknown";
	permissionEvidenceRef?: string | null;
	permissionFailureClass: string | null;
}): CodexRuntimeEvidence {
	return {
		schemaVersion: CODEX_RUNTIME_EVIDENCE_SCHEMA_VERSION,
		generatedAt: "2026-05-24T23:15:00Z",
		sourceProvenance: {
			sourceKind: options.sourceKind,
			codexRepoPath: options.codexRepoPath,
			commitSha: "951efd3392882064961e1621344178723d4887c4",
			dirtyState: "dirty",
			sourceFileChecksums: {
				[options.codexRepoPath]: options.checksum,
			},
			capturedAt: "2026-05-24T23:10:00Z",
		},
		codex: {
			threadId: "thread-123",
			turnId: "turn-456",
			traceId: options.traceId,
			traceFailureClass: options.traceFailureClass,
			goalState: "unknown",
			model: "gpt-5.5",
		},
		permissions: {
			profile: options.permissionProfile ?? "unknown",
			writableRoots:
				options.permissionProfile === "workspace_write"
					? ["/Users/jamiecraik/dev/coding-harness"]
					: [],
			network: options.network ?? "unknown",
			evidenceRef: options.permissionEvidenceRef ?? null,
			failureClass: options.permissionFailureClass,
		},
		mcp: {
			servers: [
				{
					name: "codex_repo",
					status: "unknown",
					failureClass: "source_does_not_expose_mcp_startup_status",
				},
			],
		},
		receipts: [
			{
				schemaVersion: "evidence-receipt/v1",
				kind: "artifact",
				ref: `codex://${options.codexRepoPath}`,
				producer: "codex-source-fixture",
				status: "pass",
				freshness: "current",
				evidenceUse: "orientation",
				blockerClass: null,
				producedAt: "2026-05-24T23:10:00Z",
				checksum: options.checksum || "sha256:missing",
			},
			...(options.permissionEvidenceRef === undefined ||
			options.permissionEvidenceRef === null
				? []
				: [
						{
							schemaVersion: "evidence-receipt/v1" as const,
							kind: "run_record" as const,
							ref: options.permissionEvidenceRef,
							producer: "codex-analytics-fixture",
							status: "pass" as const,
							freshness: "current" as const,
							evidenceUse: "orientation" as const,
							blockerClass: null,
							producedAt: "2026-05-24T23:10:00Z",
						},
					]),
		],
		validationResults: [
			{
				name: "codex-runtime-source-provenance",
				status: "pass",
				evidenceRef: `codex://${options.codexRepoPath}`,
				verifiedAt: "2026-05-24T23:15:00Z",
			},
		],
		externalState: {
			status: "unknown",
			evidenceRef: null,
			failureClass: "source_does_not_expose_external_state",
		},
		reviewState: {
			status: "unknown",
			evidenceRef: null,
			failureClass: "source_does_not_expose_review_state",
		},
		staleState: [
			{
				subject: "external_state",
				classification: "unknown",
				reason:
					"Source evidence cannot support external-state closeout claims.",
				evidenceRef: null,
			},
		],
	};
}
