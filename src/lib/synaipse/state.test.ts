import { describe, expect, it } from "vitest";
import { validateSynaipseState } from "./state.js";

describe("validateSynaipseState", () => {
	const validState = {
		schemaVersion: "synaipse-state/v1",
		generatedAt: "2026-07-11T23:00:00Z",
		repository: {
			name: "jscraik/coding-harness",
			branch: "main",
			baseRef: "origin/main",
			headSha: "abc",
			baseSha: "abc",
			clean: true,
		},
		stage: "handoff",
		task: { status: "pass", objective: "Read repository state" },
		authority: { owner: "codex", humanRequired: false },
		truthLaneBlockers: [],
		admittedCapabilities: ["harness next"],
		evidenceRefs: ["git:status"],
		contextRefs: [
			{
				contextId: "ch_context_7K4M2P9QX3DR",
				digest:
					"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			},
		],
		nextAction: "Continue",
		invocationEffects: {
			effectClasses: ["pure_read"],
			targets: ["repository metadata"],
			writesFiles: false,
			mutatesGit: false,
			mutatesExternal: false,
		},
		freshness: {
			status: "current",
			observedAt: "2026-07-11T23:00:00Z",
		},
		claimBoundary: "Local routing only.",
	} as const;

	it.each([
		["stage", { stage: "unknown" }, "stage"],
		[
			"authority owner",
			{ authority: { owner: "agent", humanRequired: false } },
			"authority.owner",
		],
		[
			"missing freshness status",
			{ freshness: { observedAt: "2026-07-11T23:00:00Z" } },
			"freshness.status",
		],
		[
			"empty invocation targets",
			{ invocationEffects: { ...validState.invocationEffects, targets: [] } },
			"invocationEffects.targets",
		],
		[
			"invalid generatedAt date-time",
			{ generatedAt: "not-a-date" },
			"generatedAt",
		],
		[
			"invalid freshness observedAt date-time",
			{ freshness: { ...validState.freshness, observedAt: "2026-07-11" } },
			"freshness.observedAt",
		],
		[
			"February 30 overflow",
			{ generatedAt: "2026-02-30T23:00:00Z" },
			"generatedAt",
		],
		[
			"hour 24 overflow",
			{ generatedAt: "2026-07-11T24:00:00Z" },
			"generatedAt",
		],
		[
			"empty truth-lane blocker",
			{ truthLaneBlockers: [" "] },
			"truthLaneBlockers",
		],
		["empty evidence refs", { evidenceRefs: [] }, "evidenceRefs"],
		[
			"empty admitted capabilities",
			{ admittedCapabilities: [] },
			"admittedCapabilities",
		],
	] as const)("rejects contract-invalid %s", (_label, override, path) => {
		const result = validateSynaipseState({ ...validState, ...override });
		expect(result.valid).toBe(false);
		expect(result.errors.some((error) => error.path === path)).toBe(true);
	});

	it.each([
		["top-level", { unexpected: true }, "state.unexpected"],
		[
			"repository",
			{ repository: { ...validState.repository, unexpected: true } },
			"repository.unexpected",
		],
		[
			"task",
			{ task: { ...validState.task, unexpected: true } },
			"task.unexpected",
		],
		[
			"authority",
			{ authority: { ...validState.authority, unexpected: true } },
			"authority.unexpected",
		],
		[
			"invocation effects",
			{
				invocationEffects: {
					...validState.invocationEffects,
					unexpected: true,
				},
			},
			"invocationEffects.unexpected",
		],
		[
			"freshness",
			{ freshness: { ...validState.freshness, unexpected: true } },
			"freshness.unexpected",
		],
	] as const)("rejects unknown %s properties", (_label, override, path) => {
		const result = validateSynaipseState({ ...validState, ...override });
		expect(result.valid).toBe(false);
		expect(result.errors.some((error) => error.path === path)).toBe(true);
	});

	it("rejects a write-capable invocation effect", () => {
		const result = validateSynaipseState({
			...validState,
			invocationEffects: { ...validState.invocationEffects, writesFiles: true },
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual({
			path: "invocationEffects.writesFiles",
			message: "must be false",
		});
	});

	it("accepts RFC3339 fractional seconds and numeric offsets", () => {
		const result = validateSynaipseState({
			...validState,
			generatedAt: "2026-07-11T23:00:00.123+01:00",
			freshness: {
				...validState.freshness,
				observedAt: "2026-07-11T23:00:00.123+01:00",
			},
		});

		expect(result).toEqual({ valid: true, errors: [] });
	});

	it("rejects context projections without a logical context ID", () => {
		const result = validateSynaipseState({
			...validState,
			contextRefs: [
				{ contextId: "context-without-type-prefix", digest: "sha256:a" },
			],
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ path: "contextRefs[0].contextId" }),
		);
	});

	it("rejects malformed contextUnknowns", () => {
		const result = validateSynaipseState({
			...validState,
			contextUnknowns: [
				{ contextId: "invalid-context-id", reason: "missing_context" },
			],
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ path: "contextUnknowns[0].contextId" }),
		);
	});

	it("rejects contextUnknowns with invalid reason", () => {
		const result = validateSynaipseState({
			...validState,
			contextUnknowns: [
				{
					contextId: "ch_context_7K4M2P9QX3DR",
					reason: "not_a_valid_reason",
				},
			],
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ path: "contextUnknowns[0].reason" }),
		);
	});

	it("rejects duplicate contextId in contextRefs", () => {
		const result = validateSynaipseState({
			...validState,
			contextRefs: [
				{
					contextId: "ch_context_7K4M2P9QX3DR",
					digest:
						"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
				},
				{
					contextId: "ch_context_7K4M2P9QX3DR",
					digest:
						"sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
				},
			],
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				path: "contextRefs[1].contextId",
				message: "must not duplicate an earlier contextId",
			}),
		);
	});

	it("rejects duplicate contextId in contextUnknowns", () => {
		const result = validateSynaipseState({
			...validState,
			contextUnknowns: [
				{
					contextId: "ch_context_7K4M2P9QX3DR",
					reason: "missing_context",
				},
				{
					contextId: "ch_context_7K4M2P9QX3DR",
					reason: "provider_unavailable",
				},
			],
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				path: "contextUnknowns[1].contextId",
				message: "must not duplicate an earlier contextId",
			}),
		);
	});
});
