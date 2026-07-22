import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { manifestWithExamplePatch } from "./runtime-packet-schema-test-helpers.js";

const tempRoots: string[] = [];
const require = createRequire(import.meta.url);
const {
	validateContextFailureDecisionCoupling,
	validateContextFailureIdentities,
} = require("../../scripts/validate-harness-decision-semantics.cjs") as {
	validateContextFailureIdentities: (candidate: unknown) => string[];
	validateContextFailureDecisionCoupling: (candidate: unknown) => string[];
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

function createTempRoot(prefix: string): string {
	const baseRoot = join(process.cwd(), ".cache", "runtime-packet-schema-tests");
	mkdirSync(baseRoot, { recursive: true });
	const root = mkdtempSync(join(baseRoot, prefix));
	tempRoots.push(root);
	return root;
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
	const root = createTempRoot("harness-decision-failure-");
	return manifestWithExamplePatch(root, "harness-decision/v1", (example) => {
		const envelope = (example.meta as Record<string, unknown>)
			.synaipseContextFailures as Record<string, unknown>;
		const failures = envelope.failures as Record<string, unknown>[];
		mutate(failures);
		return example;
	});
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

	it("rejects a runnable decision that carries a blocking context failure", () => {
		const failure = {
			code: "missing_required_context",
			requirement: "required",
			contextId: "ch_context_7K4M2P9QX3DR",
			recovery: "supply_required_context",
			owner: "synaipse-context-plane",
			stopCondition: "Stop until missing_required_context is resolved.",
			evidenceRefs: ["context:fixture"],
			freshness: { status: "current", observedAt: "2026-07-20T00:00:00Z" },
		};
		const errors = validateContextFailureDecisionCoupling({
			status: "action_required",
			nextCommand: "harness check --json",
			meta: { synaipseContextFailures: { failures: [failure] } },
		});

		expect(errors).toContain(
			"meta.synaipseContextFailures blocking failures require no runnable next command",
		);
	});
});
