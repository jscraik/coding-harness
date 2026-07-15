import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	CONTEXT_UNKNOWN_REASONS,
	digest,
	harnessId,
	gitSha,
	repositorySlug,
} from "./context-contract.js";
import { resolveSynaipseContext } from "./context-plane.js";

type Schema = {
	properties?: Record<string, { pattern?: string }>;
};

function schemaPattern(path: string, property: string): RegExp {
	const schema = JSON.parse(readFileSync(path, "utf8")) as Schema;
	const pattern = schema.properties?.[property]?.pattern;
	if (!pattern)
		throw new Error(`missing schema pattern for ${path}:${property}`);
	return new RegExp(pattern);
}

function accepts(parser: (value: string) => unknown, value: string): boolean {
	try {
		parser(value);
		return true;
	} catch {
		return false;
	}
}

describe("SynAIpse context format parity", () => {
	it("validates complete documents through the schema gate and public parser", () => {
		const schemaGate = JSON.parse(
			execFileSync(
				process.execPath,
				["scripts/validate-runtime-packet-schemas.cjs", "--all"],
				{ encoding: "utf8" },
			),
		) as { status?: string; errors?: unknown[] };
		expect(schemaGate).toMatchObject({ status: "pass", errors: [] });
		const stateSchema = JSON.parse(
			readFileSync("contracts/synaipse-state.schema.json", "utf8"),
		) as {
			properties?: {
				contextUnknowns?: {
					items?: { properties?: { reason?: { enum?: string[] } } };
				};
			};
		};
		expect(
			stateSchema.properties?.contextUnknowns?.items?.properties?.reason?.enum,
		).toEqual([...CONTEXT_UNKNOWN_REASONS]);

		const contextId = "ch_context_7K4M2P9QX3DR";
		const digestValue = `sha256:${"a".repeat(64)}`;
		const document = {
			catalog: {
				schemaVersion: "synaipse-context-catalog/v1",
				catalogId: "ch_catalog_N8RT5V2K6WQJ",
				projectId: "ch_project_M4X9D7CP2HKT",
				repository: "jscraik/coding-harness",
				refs: [
					{
						schemaVersion: "synaipse-context-ref/v1",
						contextId,
						kind: "specification",
						authority: "repository_authority",
						privacy: {
							classification: "internal",
							allowedConsumers: ["local_agent"],
							prohibitedDestinations: ["public_pr"],
						},
						lifecycle: { status: "current", supersededBy: null },
						stages: ["build"],
						requirement: "required",
						provider: {
							kind: "repository",
							reference: "docs/specs/context.md",
						},
						digest: digestValue,
						freshness: {
							observedAt: "2026-07-13T22:00:00Z",
							expiresAt: "2026-07-14T22:00:00Z",
						},
					},
				],
			},
			taskContext: {
				schemaVersion: "synaipse-task-context/v1",
				taskContextId: "ch_taskctx_2F7K9MT4RXQD",
				projectId: "ch_project_M4X9D7CP2HKT",
				taskId: "JSC-458",
				baseSha: "dbcef1a8d831b9388160d8941437a50e2549d847",
				outcome: "Resolve a bounded context contract.",
				nonGoals: ["Move provider bodies"],
				selectedRefs: [{ contextId, digest: digestValue }],
				proofRefs: ["linear:JSC-458"],
				privacy: "internal",
				vitalDecisions: [],
				refreshTriggers: ["context_digest_changed"],
				admittedAt: "2026-07-13T22:00:00Z",
			},
			acceptedAuthorities: ["repository_authority"],
			stage: "build",
			consumer: "local_agent",
			destination: "local_task",
			observedAt: "2026-07-13T22:00:00Z",
			observations: [{ contextId, status: "available", digest: digestValue }],
		};

		expect(resolveSynaipseContext(document)).toMatchObject({
			status: "resolved",
			selectedContextIds: [contextId],
		});
		const malformed = structuredClone(document);
		malformed.catalog.refs[0]!.contextId = "ch_context_invalid";
		expect(() => resolveSynaipseContext(malformed)).toThrow(
			"must use ch_context_<12-character human-safe token>",
		);
	});

	it.each([
		{
			name: "repository slug",
			pattern: schemaPattern(
				"contracts/synaipse-context-catalog.schema.json",
				"repository",
			),
			parser: (value: string) => repositorySlug(value, "repository"),
			valid: ["jscraik/coding-harness"],
			invalid: [
				"jscraik",
				"jscraik/coding harness",
				"https://github.com/jscraik/coding-harness",
			],
		},
		{
			name: "context ID",
			pattern: schemaPattern(
				"contracts/synaipse-context-ref.schema.json",
				"contextId",
			),
			parser: (value: string) => harnessId(value, "ch_context", "contextId"),
			valid: ["ch_context_7K4M2P9QX3DR"],
			invalid: [
				"ch_context_7K4M2P9QX30",
				"ch_context_7K4M2P9QX3DR0",
				"ch_catalog_7K4M2P9QX3DR",
			],
		},
		{
			name: "digest",
			pattern: schemaPattern(
				"contracts/synaipse-context-ref.schema.json",
				"digest",
			),
			parser: (value: string) => digest(value, "digest"),
			valid: [`sha256:${"a".repeat(64)}`],
			invalid: [
				`sha256:${"A".repeat(64)}`,
				`sha256:${"a".repeat(63)}`,
				"sha256:",
			],
		},
		{
			name: "git SHA",
			pattern: schemaPattern(
				"contracts/synaipse-task-context.schema.json",
				"baseSha",
			),
			parser: (value: string) => gitSha(value, "baseSha"),
			valid: ["a".repeat(40)],
			invalid: ["A".repeat(40), "a".repeat(39), `${"a".repeat(39)}g`],
		},
	] as const)("keeps %s aligned with its JSON Schema pattern", (fixture) => {
		for (const value of fixture.valid) {
			expect(fixture.pattern.test(value)).toBe(true);
			expect(accepts(fixture.parser, value)).toBe(true);
		}
		for (const value of fixture.invalid) {
			expect(fixture.pattern.test(value)).toBe(false);
			expect(accepts(fixture.parser, value)).toBe(false);
		}
	});
});
