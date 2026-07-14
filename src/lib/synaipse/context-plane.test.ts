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
			blockers: [],
		});
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

	it("blocks task-admitted context that is absent from the catalog", () => {
		const unrelated = contextRef({ contextId: "ch_context_Q6PV8R3N5ZWA" });
		expect(resolveSynaipseContext(resolutionInput([unrelated]))).toMatchObject({
			status: "blocked",
			blockers: [{ code: "missing_context", contextId: SPEC_ID }],
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
		const snapshot = createSynaipseTaskContext(taskContext());

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
