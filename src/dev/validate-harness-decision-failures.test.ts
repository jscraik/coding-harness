import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const MANIFEST_PATH = "contracts/runtime-packet-schemas.manifest.json";
const tempRoots: string[] = [];
const require = createRequire(import.meta.url);
const { validateContextFailureIdentities } =
	require("../../scripts/validate-harness-decision-semantics.cjs") as {
		validateContextFailureIdentities: (candidate: unknown) => string[];
	};

const FAILURE_MAPPING_FIXTURES = [
	[
		"missing_project_identity",
		"establish_project_identity",
		null,
		"unknown",
		"required",
	],
	[
		"missing_context_catalog",
		"admit_context_catalog",
		null,
		"unknown",
		"required",
	],
	[
		"missing_required_context",
		"supply_required_context",
		"context",
		"current",
		"required",
	],
	[
		"missing_optional_context",
		"supply_optional_context",
		"context",
		"current",
		"optional",
	],
	[
		"context_access_denied",
		"request_authorized_projection",
		"context",
		"current",
		"required",
	],
	[
		"stale_context_digest",
		"refresh_context_digest",
		"context",
		"stale",
		"required",
	],
	[
		"superseded_context",
		"select_current_context",
		"context",
		"current",
		"required",
	],
	[
		"malformed_context_catalog",
		"repair_context_catalog",
		null,
		"unknown",
		"required",
	],
	[
		"provider_unavailable",
		"restore_context_provider",
		"context",
		"current",
		"required",
	],
	[
		"unresolved_host_path",
		"resolve_context_host_path",
		"context",
		"current",
		"required",
	],
] as const;

function readJson(path: string): Record<string, unknown> {
	return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function runValidator(manifestPath: string) {
	return spawnSync(
		process.execPath,
		["scripts/validate-runtime-packet-schemas.cjs", "--manifest", manifestPath],
		{ encoding: "utf8" },
	);
}

function manifestWithFailureMutation(
	mutate: (failures: Record<string, unknown>[]) => void,
): string {
	const baseRoot = join(process.cwd(), ".cache", "runtime-packet-schema-tests");
	mkdirSync(baseRoot, { recursive: true });
	const root = mkdtempSync(join(baseRoot, "harness-decision-failure-"));
	tempRoots.push(root);
	const manifest = readJson(MANIFEST_PATH) as {
		packets: Record<string, unknown>[];
	};
	const entry = manifest.packets.find(
		(packet) => packet.schemaVersion === "harness-decision/v1",
	);
	if (!entry || typeof entry.examplePath !== "string")
		throw new Error("missing harness-decision/v1 manifest entry");
	const example = structuredClone(readJson(entry.examplePath));
	const envelope = (example.meta as Record<string, unknown>)
		.synaipseContextFailures as Record<string, unknown>;
	const failures = envelope.failures as Record<string, unknown>[];
	mutate(failures);
	const examplePath = join(root, "harness-decision.json");
	writeFileSync(examplePath, JSON.stringify(example, null, 2));
	const patchedManifest = {
		...manifest,
		packets: manifest.packets.map((packet) =>
			packet.schemaVersion === "harness-decision/v1"
				? { ...packet, examplePath: relative(process.cwd(), examplePath) }
				: packet,
		),
	};
	const manifestPath = join(root, "runtime-packet-schemas.manifest.json");
	writeFileSync(manifestPath, JSON.stringify(patchedManifest, null, 2));
	return manifestPath;
}

describe("harness-decision context-failure schema boundary", () => {
	afterEach(() => {
		for (const root of tempRoots.splice(0))
			rmSync(root, { force: true, recursive: true });
	});

	it.each(
		FAILURE_MAPPING_FIXTURES,
	)("pins semantic metadata for %s", (code, recovery, identity, freshness, fixtureRequirement) => {
		const requirement = fixtureRequirement;
		const failure = {
			code,
			requirement,
			contextId: identity === null ? null : "ch_context_7K4M2P9QX3DR",
			recovery,
			owner: "synaipse-context-plane",
			stopCondition:
				code === "missing_optional_context"
					? `Continue with explicit context unknown until ${code} is resolved.`
					: `Stop until ${code} is resolved.`,
			evidenceRefs: ["context:fixture"],
			freshness: {
				status: freshness,
				observedAt: "2026-07-20T00:00:00Z",
			},
		};
		const candidate = {
			meta: { synaipseContextFailures: { failures: [failure] } },
		};

		expect(validateContextFailureIdentities(candidate)).toEqual([]);
		expect(
			validateContextFailureIdentities({
				meta: {
					synaipseContextFailures: {
						failures: [
							{
								...failure,
								recovery: "request_operator_approval",
							},
						],
					},
				},
			}),
		).toContain(
			`meta.synaipseContextFailures.failures[0].recovery must equal ${recovery} for ${code}`,
		);
		expect(
			validateContextFailureIdentities({
				meta: {
					synaipseContextFailures: {
						failures: [
							{
								...failure,
								stopCondition: "Stop when approved.",
							},
						],
					},
				},
			}),
		).toContain(
			`meta.synaipseContextFailures.failures[0].stopCondition must equal ${failure.stopCondition}`,
		);
		expect(
			validateContextFailureIdentities({
				meta: {
					synaipseContextFailures: {
						failures: [
							{
								...failure,
								freshness: {
									...failure.freshness,
									status: freshness === "current" ? "stale" : "current",
								},
							},
						],
					},
				},
			}),
		).toContain(
			`meta.synaipseContextFailures.failures[0].freshness.status must equal ${freshness} for ${code}`,
		);
	});

	it.each([
		{
			name: "omitted contextId",
			mutate: (failure: Record<string, unknown>) => delete failure.contextId,
			expected: "contextId is required",
		},
		{
			name: "catalog contextId",
			mutate: (failure: Record<string, unknown>) => {
				failure.code = "missing_context_catalog";
				failure.requirement = "required";
			},
			expected: "contextId must equal schema const",
		},
		{
			name: "arbitrary owner",
			mutate: (failure: Record<string, unknown>) => {
				failure.owner = "project-pm";
			},
			expected: "owner must equal schema const",
		},
		{
			name: "optional missing-required failure",
			mutate: (failure: Record<string, unknown>) => {
				failure.code = "missing_required_context";
				failure.requirement = "optional";
			},
			expected: "requirement must equal schema const",
		},
		{
			name: "required missing-optional failure",
			mutate: (failure: Record<string, unknown>) => {
				failure.code = "missing_optional_context";
				failure.requirement = "required";
				failure.recovery = "supply_optional_context";
				failure.stopCondition =
					"Continue with explicit context unknown until missing_optional_context is resolved.";
			},
			expected: "requirement must equal schema const",
		},
		{
			name: "current stale-digest failure",
			mutate: (failure: Record<string, unknown>) => {
				failure.code = "stale_context_digest";
			},
			expected: "freshness.status must equal schema const",
		},
		{
			name: "stale provider failure",
			mutate: (failure: Record<string, unknown>) => {
				failure.freshness = {
					status: "stale",
					observedAt: "2026-07-20T00:00:00Z",
				};
			},
			expected: "freshness.status must equal schema const",
		},
	])("rejects $name structurally", ({ mutate, expected }) => {
		const result = runValidator(
			manifestWithFailureMutation((failures) =>
				mutate(failures[0] as Record<string, unknown>),
			),
		);

		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout) as { errors: string[] };
		expect(report.errors.join("\n")).toContain(expected);
	});

	it.each([
		{
			name: "a vocabulary-valid recovery assigned to the wrong code",
			mutate: (failure: Record<string, unknown>) => {
				failure.recovery = "request_authorized_projection";
			},
			expected: "recovery must equal restore_context_provider",
		},
		{
			name: "a noncanonical stop condition",
			mutate: (failure: Record<string, unknown>) => {
				failure.stopCondition = "Stop until an operator approves.";
			},
			expected:
				"stopCondition must equal Continue with explicit context unknown until provider_unavailable is resolved.",
		},
	])("rejects $name semantically", ({ mutate, expected }) => {
		const result = runValidator(
			manifestWithFailureMutation((failures) =>
				mutate(failures[0] as Record<string, unknown>),
			),
		);

		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout) as { errors: string[] };
		expect(report.errors.join("\n")).toContain(
			"semanticValidatorPath scripts/validate-harness-decision-semantics.cjs",
		);
		expect(report.errors.join("\n")).toContain(expected);
	});

	it("rejects duplicate logical failure identities semantically", () => {
		const result = runValidator(
			manifestWithFailureMutation((failures) => {
				const first = failures[0] as Record<string, unknown>;
				failures.push({
					...first,
					code: "context_access_denied",
					recovery: "request_authorized_projection",
					stopCondition: "Stop until context_access_denied is resolved.",
				});
			}),
		);

		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout) as { errors: string[] };
		expect(report.errors.join("\n")).toContain(
			"duplicates logical failure identity",
		);
	});
});
