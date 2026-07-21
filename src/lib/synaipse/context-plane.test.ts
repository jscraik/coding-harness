import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { expectBehavior } from "../testing/expect-behavior.js";
import {
	createSynaipseTaskContext,
	resolveSynaipseContext,
} from "./context-plane.js";

const NOW = "2026-07-13T22:00:00Z";
const BASE_SHA = "dbcef1a8d831b9388160d8941437a50e2549d847";
const SPEC_ID = "ch_context_7K4M2P9QX3DR";

function contextRef(
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		schemaVersion: "synaipse-context-ref/v1",
		contextId: SPEC_ID,
		kind: "specification",
		authority: "repository_authority",
		privacy: {
			classification: "internal",
			allowedConsumers: ["local_agent", "remote_agent"],
			prohibitedDestinations: ["public_pr"],
		},
		lifecycle: { status: "current", supersededBy: null },
		stages: ["build", "prove"],
		requirement: "required",
		provider: {
			kind: "repository",
			reference:
				"docs/specs/2026-07-11-synaipse-agent-native-delivery-control-plane-v1-spec.md",
		},
		digest:
			"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		freshness: { observedAt: NOW, expiresAt: "2026-07-14T22:00:00Z" },
		...overrides,
	};
}

function catalog(refs = [contextRef()]): Record<string, unknown> {
	return {
		schemaVersion: "synaipse-context-catalog/v1",
		catalogId: "ch_catalog_N8RT5V2K6WQJ",
		projectId: "ch_project_M4X9D7CP2HKT",
		repository: "jscraik/coding-harness",
		refs,
	};
}

function taskContext(
	selectedRefs: Array<Record<string, unknown>> = [
		{
			contextId: SPEC_ID,
			digest:
				"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		},
	],
): Record<string, unknown> {
	return {
		schemaVersion: "synaipse-task-context/v1",
		taskContextId: "ch_taskctx_2F7K9MT4RXQD",
		projectId: "ch_project_M4X9D7CP2HKT",
		taskId: "JSC-458",
		baseSha: BASE_SHA,
		outcome: "Provide bounded read-only context resolution.",
		nonGoals: ["Move documents"],
		selectedRefs,
		proofRefs: ["linear:JSC-458", `git:${BASE_SHA}`],
		privacy: "internal",
		vitalDecisions: [],
		refreshTriggers: ["context_digest_changed", "base_sha_changed"],
		admittedAt: NOW,
	};
}

function resolutionInput(
	refs = [contextRef()],
	observations: Array<Record<string, unknown>> = [
		{
			contextId: SPEC_ID,
			status: "available",
			digest:
				"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		},
	],
): Record<string, unknown> {
	return {
		catalog: catalog(refs),
		taskContext: taskContext(),
		acceptedAuthorities: ["repository_authority"],
		stage: "build",
		consumer: "local_agent",
		destination: "local_task",
		observedAt: NOW,
		observations,
	};
}

describe("SynAIpse universal context plane", () => {
	it("publishes each versioned context schema in the package allow-list", () => {
		const packageFiles = JSON.parse(readFileSync("package.json", "utf8")).files;
		const contracts = [
			[
				"contracts/synaipse-context-catalog.schema.json",
				"synaipse-context-catalog/v1",
			],
			["contracts/synaipse-context-ref.schema.json", "synaipse-context-ref/v1"],
			[
				"contracts/synaipse-task-context.schema.json",
				"synaipse-task-context/v1",
			],
		] as const;

		for (const [path, schemaVersion] of contracts) {
			const schema = JSON.parse(readFileSync(path, "utf8"));
			expect(packageFiles).toContain(path);
			expect(schema.properties.schemaVersion.const).toBe(schemaVersion);
			expect(schema.additionalProperties).toBe(false);
		}
	});

	it("resolves current required context without writing or mutating inputs", () => {
		const input = resolutionInput();
		const before = structuredClone(input);
		const result = resolveSynaipseContext(input);

		expectBehavior({
			given: "a current required repository context ref with matching evidence",
			should: "select the logical ref through a pure read operation",
			actual: result,
			expected: {
				status: "resolved",
				catalogRepository: "jscraik/coding-harness",
				selectedContextIds: [SPEC_ID],
				selectedRefs: [
					{
						contextId: SPEC_ID,
						digest:
							"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
					},
				],
				unknownContextIds: [],
				unknowns: [],
				blockers: [],
				effects: {
					writesFiles: false,
					mutatesGit: false,
					mutatesExternal: false,
				},
			},
		});
		expect(input).toEqual(before);
	});

	it("blocks when required context is unavailable", () => {
		const result = resolveSynaipseContext(resolutionInput([contextRef()], []));

		expect(result).toMatchObject({
			status: "blocked",
			blockers: [
				{
					code: "missing_context",
					contextId: SPEC_ID,
					recovery: "refresh_context_provider",
				},
			],
		});
	});

	it("reports optional unavailable context as an explicit unknown", () => {
		const result = resolveSynaipseContext(
			resolutionInput([contextRef({ requirement: "optional" })], []),
		);

		expect(result).toMatchObject({
			status: "resolved",
			selectedContextIds: [],
			unknownContextIds: [SPEC_ID],
			unknowns: [{ contextId: SPEC_ID, reason: "missing_context" }],
			blockers: [],
		});
	});

	it("keeps optional omission legacy-only while requiring a canonical required failure", () => {
		const optional = resolveSynaipseContext(
			resolutionInput([contextRef({ requirement: "optional" })], []),
		);
		expect(optional).toMatchObject({
			status: "resolved",
			unknownContextIds: [SPEC_ID],
			unknowns: [{ contextId: SPEC_ID, reason: "missing_context" }],
			blockers: [],
		});
		expect(optional.contextFailures).toBeUndefined();

		const required = resolveSynaipseContext(
			resolutionInput([contextRef()], []),
		);
		expect(required).toMatchObject({
			status: "blocked",
			unknownContextIds: [],
			unknowns: [],
			blockers: [{ code: "missing_context", contextId: SPEC_ID }],
			contextFailures: {
				schemaVersion: "synaipse-context-failure-envelope/v1",
				failures: [
					{
						code: "missing_required_context",
						requirement: "required",
						contextId: SPEC_ID,
						recovery: "supply_required_context",
					},
				],
			},
		});
	});

	it("blocks optional context when its admitted digest is stale", () => {
		const input = resolutionInput(
			[contextRef({ requirement: "optional" })],
			[],
		);
		input.taskContext = taskContext([
			{
				contextId: SPEC_ID,
				digest:
					"sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
			},
		]);

		expect(resolveSynaipseContext(input)).toMatchObject({
			status: "blocked",
			blockers: [{ code: "stale_digest", contextId: SPEC_ID }],
		});
	});

	it("blocks stale context at or before its expiry boundary", () => {
		for (const expiresAt of [NOW, "2026-07-13T21:59:59Z"]) {
			const input = resolutionInput([
				contextRef({ freshness: { observedAt: NOW, expiresAt } }),
			]);
			expect(resolveSynaipseContext(input)).toMatchObject({
				status: "blocked",
				blockers: [{ code: "stale_digest", contextId: SPEC_ID }],
			});
		}
	});

	it("rejects stale digest evidence", () => {
		const input = resolutionInput();
		(input.observations as Array<Record<string, unknown>>)[0] = {
			contextId: SPEC_ID,
			status: "available",
			digest:
				"sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		};

		expect(resolveSynaipseContext(input)).toMatchObject({
			status: "blocked",
			blockers: [{ code: "stale_digest", contextId: SPEC_ID }],
		});
	});

	it("rejects superseded context", () => {
		const superseded = contextRef({
			lifecycle: {
				status: "superseded",
				supersededBy: "ch_context_Q6PV8R3N5ZWA",
			},
		});

		expect(resolveSynaipseContext(resolutionInput([superseded]))).toMatchObject(
			{
				status: "blocked",
				blockers: [{ code: "superseded_context", contextId: SPEC_ID }],
			},
		);
	});

	it("rejects historical context instead of selecting it as current", () => {
		const historical = contextRef({
			lifecycle: { status: "historical", supersededBy: null },
		});

		expect(resolveSynaipseContext(resolutionInput([historical]))).toMatchObject(
			{
				status: "blocked",
				blockers: [{ code: "historical_context", contextId: SPEC_ID }],
			},
		);
	});

	it("selects only task-admitted refs with an accepted authority", () => {
		const input = resolutionInput();
		input.taskContext = taskContext([
			{
				contextId: "ch_context_Q6PV8R3N5ZWA",
				digest:
					"sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
			},
		]);
		expect(resolveSynaipseContext(input)).toMatchObject({
			status: "blocked",
			selectedContextIds: [],
			blockers: [
				{ code: "missing_context", contextId: SPEC_ID },
				{
					code: "missing_context",
					contextId: "ch_context_Q6PV8R3N5ZWA",
				},
			],
		});

		input.taskContext = taskContext();
		input.acceptedAuthorities = ["accepted_task_contract"];
		expect(resolveSynaipseContext(input)).toMatchObject({
			status: "blocked",
			blockers: [{ code: "access_denied", contextId: SPEC_ID }],
		});
	});

	it("blocks a required catalog ref omitted from task admission", () => {
		const optionalId = "ch_context_Q6PV8R3N5ZWA";
		const optional = contextRef({
			contextId: optionalId,
			requirement: "optional",
		});
		const input = resolutionInput(
			[contextRef(), optional],
			[
				{
					contextId: optionalId,
					status: "available",
					digest:
						"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
				},
			],
		);
		input.taskContext = taskContext([
			{
				contextId: optionalId,
				digest:
					"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			},
		]);

		expect(resolveSynaipseContext(input)).toMatchObject({
			status: "blocked",
			selectedContextIds: [optionalId],
			blockers: [{ code: "missing_context", contextId: SPEC_ID }],
		});
	});

	it("distinguishes unavailable providers and unresolved host paths", () => {
		for (const status of [
			"provider_unavailable",
			"unresolved_host_path",
		] as const) {
			const input = resolutionInput(
				[contextRef()],
				[{ contextId: SPEC_ID, status }],
			);
			expect(resolveSynaipseContext(input)).toMatchObject({
				status: "blocked",
				blockers: [{ code: status, contextId: SPEC_ID }],
			});
		}
	});

	it("reports optional provider failures as reasoned unknowns", () => {
		for (const status of [
			"provider_unavailable",
			"unresolved_host_path",
		] as const) {
			const input = resolutionInput(
				[contextRef({ requirement: "optional" })],
				[{ contextId: SPEC_ID, status }],
			);
			expect(resolveSynaipseContext(input)).toMatchObject({
				status: "resolved",
				unknowns: [{ contextId: SPEC_ID, reason: status }],
				blockers: [],
			});
		}
	});

	it.each([
		{
			name: "missing required context",
			input: () => resolutionInput([contextRef()], []),
			code: "missing_required_context",
		},
		{
			name: "access denial",
			input: () => {
				const input = resolutionInput();
				input.acceptedAuthorities = ["accepted_task_contract"];
				return input;
			},
			code: "context_access_denied",
		},
		{
			name: "stale digest",
			input: () => {
				const input = resolutionInput();
				input.observations = [
					{
						contextId: SPEC_ID,
						status: "available",
						digest: `sha256:${"b".repeat(64)}`,
					},
				];
				return input;
			},
			code: "stale_context_digest",
		},
		{
			name: "superseded context",
			input: () =>
				resolutionInput([
					contextRef({
						lifecycle: {
							status: "superseded",
							supersededBy: "ch_context_Q6PV8R3N5ZWA",
						},
					}),
				]),
			code: "superseded_context",
		},
		{
			name: "provider unavailable",
			input: () =>
				resolutionInput(
					[contextRef()],
					[{ contextId: SPEC_ID, status: "provider_unavailable" }],
				),
			code: "provider_unavailable",
		},
		{
			name: "unresolved host path",
			input: () =>
				resolutionInput(
					[contextRef()],
					[{ contextId: SPEC_ID, status: "unresolved_host_path" }],
				),
			code: "unresolved_host_path",
		},
	] as const)("emits the canonical envelope for $name", ({ input, code }) => {
		const result = resolveSynaipseContext(input());

		expect(result.contextFailures).toMatchObject({
			schemaVersion: "synaipse-context-failure-envelope/v1",
			failures: [
				{
					code,
					contextId: SPEC_ID,
					recovery: expect.any(String),
					owner: "synaipse-context-plane",
					stopCondition: expect.any(String),
					evidenceRefs: [`context:${SPEC_ID}`],
					freshness: {
						status: expect.any(String),
						observedAt: NOW,
					},
				},
			],
		});
	});

	it("blocks task-admitted context that is absent from the catalog", () => {
		const unrelated = contextRef({ contextId: "ch_context_Q6PV8R3N5ZWA" });
		expect(resolveSynaipseContext(resolutionInput([unrelated]))).toMatchObject({
			status: "blocked",
			blockers: [
				{ code: "missing_context", contextId: "ch_context_Q6PV8R3N5ZWA" },
				{ code: "missing_context", contextId: SPEC_ID },
			],
		});
	});

	it("blocks private context from public destinations by default", () => {
		const input = resolutionInput([
			contextRef({
				kind: "private_context",
				privacy: {
					classification: "internal",
					allowedConsumers: ["local_agent"],
					prohibitedDestinations: ["hosted_ci"],
				},
			}),
		]);
		input.destination = "public_pr";
		expect(resolveSynaipseContext(input)).toMatchObject({
			status: "blocked",
			blockers: [{ code: "access_denied", contextId: SPEC_ID }],
		});
	});

	it("blocks private context from hosted CI by default", () => {
		const input = resolutionInput([
			contextRef({
				kind: "private_context",
				privacy: {
					classification: "internal",
					allowedConsumers: ["hosted_ci"],
					prohibitedDestinations: ["public_pr"],
				},
			}),
		]);
		input.consumer = "hosted_ci";
		input.destination = "private_artifact";
		expect(resolveSynaipseContext(input)).toMatchObject({
			status: "blocked",
			blockers: [{ code: "access_denied", contextId: SPEC_ID }],
		});
	});

	it("applies task-snapshot privacy to public destinations", () => {
		const input = resolutionInput([
			contextRef({
				privacy: {
					classification: "public",
					allowedConsumers: ["local_agent"],
					prohibitedDestinations: ["hosted_ci"],
				},
			}),
		]);
		input.destination = "public_pr";
		expect(resolveSynaipseContext(input)).toMatchObject({
			status: "blocked",
			blockers: [{ code: "access_denied", contextId: SPEC_ID }],
		});
	});

	it("rejects context evidence observed after the resolution boundary", () => {
		const future = contextRef({
			freshness: {
				observedAt: "2027-01-01T00:00:00Z",
				expiresAt: "2027-01-02T00:00:00Z",
			},
		});
		expect(resolveSynaipseContext(resolutionInput([future]))).toMatchObject({
			status: "blocked",
			blockers: [{ code: "stale_digest", contextId: SPEC_ID }],
		});
	});

	it("rejects task admission observed after the resolution boundary", () => {
		const input = resolutionInput();
		(input.taskContext as Record<string, unknown>).admittedAt =
			"2027-01-01T00:00:00Z";
		expect(() => resolveSynaipseContext(input)).toThrow(
			"must not be later than resolution.observedAt",
		);
	});

	it("rejects duplicate policy values and non-portable provider paths", () => {
		const duplicateStages = contextRef({ stages: ["build", "build"] });
		expect(() =>
			resolveSynaipseContext(resolutionInput([duplicateStages])),
		).toThrow("must not duplicate");

		for (const reference of [
			"C:\\Users\\jamie\\private.md",
			"\\\\server\\private.md",
			"~/private.md",
			"../../private.md",
			"docs\\..\\private.md",
			"C:private.md",
			"file:/etc/secret",
			"file:///etc/secret",
			"docs/\n../private.md",
		]) {
			const ref = contextRef({ provider: { kind: "filesystem", reference } });
			expect(() => resolveSynaipseContext(resolutionInput([ref]))).toThrow(
				"must not",
			);
		}
		const opaqueTraversal = contextRef({
			provider: { kind: "connector", reference: "../private" },
		});
		expect(() =>
			resolveSynaipseContext(resolutionInput([opaqueTraversal])),
		).toThrow("must not");
	});

	it("rejects duplicate catalog context IDs with differing metadata", () => {
		const duplicate = contextRef({
			kind: "implementation_plan",
			digest:
				"sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		});
		expect(() =>
			resolveSynaipseContext(resolutionInput([contextRef(), duplicate])),
		).toThrow("must not duplicate");
	});

	it("keeps prohibited-destination schema and runtime cardinality aligned", () => {
		const ref = contextRef({
			privacy: {
				classification: "internal",
				allowedConsumers: ["local_agent"],
				prohibitedDestinations: [],
			},
		});
		expect(() => resolveSynaipseContext(resolutionInput([ref]))).toThrow(
			"must be a non-empty array",
		);
		const schema = JSON.parse(
			readFileSync("contracts/synaipse-context-ref.schema.json", "utf8"),
		);
		expect(
			schema.properties.privacy.properties.prohibitedDestinations.minItems,
		).toBe(1);
	});

	it("rejects confidential context for a remote consumer", () => {
		const confidential = contextRef({
			privacy: {
				classification: "confidential",
				allowedConsumers: ["local_agent"],
				prohibitedDestinations: ["hosted_ci", "public_pr"],
			},
		});
		const input = resolutionInput([confidential]);
		input.consumer = "remote_agent";
		input.destination = "hosted_ci";

		expect(resolveSynaipseContext(input)).toMatchObject({
			status: "blocked",
			blockers: [{ code: "access_denied", contextId: SPEC_ID }],
		});
	});

	it("freezes an Admit snapshot bound to selected context digests", () => {
		const input = taskContext();
		const snapshot = createSynaipseTaskContext(input);

		expect(snapshot.schemaVersion).toBe("synaipse-task-context/v1");
		expect(snapshot.selectedRefs).toEqual([
			{
				contextId: SPEC_ID,
				digest:
					"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			},
		]);
		expect(Object.isFrozen(snapshot)).toBe(true);
		expect(Object.isFrozen(snapshot.selectedRefs)).toBe(true);
		expect(Object.isFrozen(snapshot.selectedRefs[0])).toBe(true);
		(input.selectedRefs as Array<Record<string, unknown>>)[0]!.digest =
			"sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
		expect(snapshot.selectedRefs[0]!.digest).toBe(
			"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		);
	});

	it("rejects selected refs that repeat a context ID with a different digest", () => {
		const duplicate = taskContext([
			{
				contextId: SPEC_ID,
				digest:
					"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			},
			{
				contextId: SPEC_ID,
				digest:
					"sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
			},
		]);
		expect(() => createSynaipseTaskContext(duplicate)).toThrow(
			"must not duplicate",
		);
	});

	it("rejects invalid base SHAs and duplicate refresh triggers", () => {
		const invalidSha = taskContext();
		invalidSha.baseSha = "not-a-sha";
		expect(() => createSynaipseTaskContext(invalidSha)).toThrow(
			"must be a 40-character lowercase Git SHA",
		);

		const duplicates = taskContext();
		duplicates.refreshTriggers = ["base_sha_changed", "base_sha_changed"];
		expect(() => createSynaipseTaskContext(duplicates)).toThrow(
			"must not duplicate",
		);
	});
});
