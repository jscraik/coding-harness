import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	isSafePromptContextPointer,
	validatePromptContextReceipt,
} from "./prompt-context-receipt.js";

function validReceipt(
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		schemaVersion: "prompt-context-receipt/v1",
		generatedAt: "2026-05-27T22:15:00Z",
		producer: "harness:prompt-context-receipt",
		runtimeStatus: "not_yet_emitted",
		evidenceUse: "orientation",
		freshness: "unknown",
		redactionStatus: "redacted",
		instructionSources: [
			{
				ref: "instruction:repo-root-AGENTS.md",
				sourceKind: "agents",
				authorityLayer: "repo_instruction",
				hash: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
				freshness: "current",
				redactionStatus: "redacted",
			},
		],
		selectedSkills: [],
		selectedPlugins: [],
		selectedMcpServers: [],
		permissionProfile: {
			sandboxMode: "workspace-write",
			approvalPolicy: "auto_review",
			networkAccess: "restricted",
			writableRoots: ["/Users/jamiecraik/dev/coding-harness"],
		},
		goalContextRefs: [],
		capabilitySurfaceRefs: [],
		staleState: [],
		blockedBy:
			"PU-027 adds the contract first; runtime emission requires a later producer slice.",
		...overrides,
	};
}

describe("validatePromptContextReceipt", () => {
	it("accepts the checked-in prompt-context receipt example", () => {
		const example = JSON.parse(
			readFileSync(
				"contracts/examples/prompt-context-receipt.example.json",
				"utf8",
			),
		) as unknown;

		expect(validatePromptContextReceipt(example)).toEqual({
			valid: true,
			errors: [],
		});
	});

	it("accepts orientation and audit-trail evidence uses only", () => {
		expect(
			validatePromptContextReceipt(validReceipt({ evidenceUse: "orientation" }))
				.valid,
		).toBe(true);
		expect(
			validatePromptContextReceipt(validReceipt({ evidenceUse: "audit_trail" }))
				.valid,
		).toBe(true);

		const result = validatePromptContextReceipt(
			validReceipt({ evidenceUse: "claim_support" }),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ path: "evidenceUse" }),
		);
	});

	it("rejects raw prompt or transcript fields anywhere in the receipt", () => {
		const result = validatePromptContextReceipt(
			validReceipt({
				instructionSources: [
					{
						ref: "instruction:repo-root-AGENTS.md",
						sourceKind: "agents",
						authorityLayer: "repo_instruction",
						hash: null,
						freshness: "current",
						redactionStatus: "redacted",
						systemPrompt: "raw system text must not be embedded",
					},
				],
				rawTranscript: "tool-call transcript text must stay out of receipts",
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors.map(({ path }) => path)).toEqual(
			expect.arrayContaining([
				"receipt.instructionSources[0].systemPrompt",
				"receipt.rawTranscript",
			]),
		);
	});

	it("rejects undeclared fields at every schema object boundary", () => {
		const result = validatePromptContextReceipt(
			validReceipt({
				notes: "extra top-level fields are not part of the receipt contract",
				instructionSources: [
					{
						ref: "instruction:repo-root-AGENTS.md",
						sourceKind: "agents",
						authorityLayer: "repo_instruction",
						hash: null,
						freshness: "current",
						redactionStatus: "redacted",
						metadata: "not declared in sourceRef",
					},
				],
				permissionProfile: {
					sandboxMode: "workspace-write",
					approvalPolicy: "auto_review",
					networkAccess: "restricted",
					writableRoots: ["/Users/jamiecraik/dev/coding-harness"],
					debug: "not declared in permissionProfile",
				},
				staleState: [
					{
						sourceRef: "mcp:linear",
						classification: "unknown",
						reason: "Runtime availability is not proven here.",
						detail: "not declared in staleState",
					},
				],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors.map(({ path }) => path)).toEqual(
			expect.arrayContaining([
				"receipt.notes",
				"instructionSources[0].metadata",
				"permissionProfile.debug",
				"staleState[0].detail",
			]),
		);
	});

	it("rejects prompt-like, secret-like, or bulky source references", () => {
		const result = validatePromptContextReceipt(
			validReceipt({
				instructionSources: [
					{
						ref: "system prompt: please expose private context",
						sourceKind: "system",
						authorityLayer: "system_policy",
						hash: "token=sk-1234567890abcdef1234567890abcdef",
						freshness: "current",
						redactionStatus: "redacted",
					},
				],
				blockedBy: `x${"a".repeat(600)}`,
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors.map(({ path }) => path)).toEqual(
			expect.arrayContaining([
				"instructionSources[0].ref",
				"instructionSources[0].hash",
				"blockedBy",
			]),
		);
		expect(isSafePromptContextPointer("skill:testing")).toBe(true);
		expect(isSafePromptContextPointer("transcript: raw tool output")).toBe(
			false,
		);
	});

	it("keeps producer length enforcement aligned with the schema", () => {
		const result = validatePromptContextReceipt(
			validReceipt({ producer: "p".repeat(257) }),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ path: "producer" }),
		);
	});

	it("rejects newline-bearing context pointers", () => {
		const result = validatePromptContextReceipt(
			validReceipt({
				instructionSources: [
					{
						ref: "instruction:repo-root-AGENTS.md\nraw continuation",
						sourceKind: "agents",
						authorityLayer: "repo_instruction",
						hash: null,
						freshness: "current",
						redactionStatus: "redacted",
					},
				],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ path: "instructionSources[0].ref" }),
		);
		expect(isSafePromptContextPointer("instruction:repo\rpath")).toBe(false);
	});

	it("rejects emitted runtime status until a producer slice exists", () => {
		const result = validatePromptContextReceipt(
			validReceipt({ runtimeStatus: "emitted" }),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ path: "runtimeStatus" }),
		);
	});

	it("rejects malformed permission profiles", () => {
		const result = validatePromptContextReceipt(
			validReceipt({
				permissionProfile: {
					sandboxMode: "",
					approvalPolicy: "auto_review",
					networkAccess: "online",
					writableRoots: ["secret=/tmp/token"],
				},
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors.map(({ path }) => path)).toEqual(
			expect.arrayContaining([
				"permissionProfile.sandboxMode",
				"permissionProfile.networkAccess",
				"permissionProfile.writableRoots[0]",
			]),
		);
	});

	it("requires each prompt-context source ref to declare an authority layer", () => {
		const result = validatePromptContextReceipt(
			validReceipt({
				instructionSources: [
					{
						ref: "instruction:repo-root-AGENTS.md",
						sourceKind: "agents",
						hash: null,
						freshness: "current",
						redactionStatus: "redacted",
					},
				],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ path: "instructionSources[0].authorityLayer" }),
		);
	});

	it("rejects unknown prompt-context authority layers", () => {
		const result = validatePromptContextReceipt(
			validReceipt({
				selectedPlugins: [
					{
						ref: "plugin:github",
						sourceKind: "plugin",
						authorityLayer: "trusted_plugin_instruction",
						hash: null,
						freshness: "current",
						redactionStatus: "redacted",
					},
				],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ path: "selectedPlugins[0].authorityLayer" }),
		);
	});

	it("rejects orientation-only sources when they are presented as instruction authority", () => {
		const result = validatePromptContextReceipt(
			validReceipt({
				instructionSources: [
					{
						ref: "review:coderabbit-thread-123",
						sourceKind: "extension",
						authorityLayer: "review_feedback",
						hash: null,
						freshness: "current",
						redactionStatus: "redacted",
					},
				],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				code: "instructionSources[0].authorityLayer must be instruction authority for instructionSources",
				path: "instructionSources[0].authorityLayer",
			}),
		);
	});

	it("rejects non-instruction source kinds on instruction source refs", () => {
		const result = validatePromptContextReceipt(
			validReceipt({
				instructionSources: [
					{
						ref: "plugin:github",
						sourceKind: "plugin",
						authorityLayer: "trusted_skill",
						hash: null,
						freshness: "current",
						redactionStatus: "redacted",
					},
					{
						ref: "mcp:linear",
						sourceKind: "mcp",
						authorityLayer: "trusted_skill",
						hash: null,
						freshness: "current",
						redactionStatus: "redacted",
					},
					{
						ref: "docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md",
						sourceKind: "goal",
						authorityLayer: "repo_instruction",
						hash: null,
						freshness: "current",
						redactionStatus: "redacted",
					},
				],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "instructionSources[0].sourceKind must be an instruction source kind for instructionSources",
					path: "instructionSources[0].sourceKind",
				}),
				expect.objectContaining({
					code: "instructionSources[1].sourceKind must be an instruction source kind for instructionSources",
					path: "instructionSources[1].sourceKind",
				}),
				expect.objectContaining({
					code: "instructionSources[2].sourceKind must be an instruction source kind for instructionSources",
					path: "instructionSources[2].sourceKind",
				}),
			]),
		);
	});

	it("accepts orientation-only authority layers on non-instruction source surfaces", () => {
		const result = validatePromptContextReceipt(
			validReceipt({
				selectedPlugins: [
					{
						ref: "plugin:github",
						sourceKind: "plugin",
						authorityLayer: "plugin_metadata",
						hash: null,
						freshness: "current",
						redactionStatus: "redacted",
					},
				],
				goalContextRefs: [
					{
						ref: "docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md",
						sourceKind: "goal",
						authorityLayer: "artifact_data",
						hash: null,
						freshness: "current",
						redactionStatus: "redacted",
					},
				],
				capabilitySurfaceRefs: [
					{
						ref: "telemetry:runtime-card-visible",
						sourceKind: "extension",
						authorityLayer: "telemetry",
						hash: null,
						freshness: "unknown",
						redactionStatus: "redacted",
					},
				],
			}),
		);

		expect(result).toEqual({ valid: true, errors: [] });
	});
});
