import { describe, expect, it } from "vitest";
import { validateFitnessReport } from "./validation.js";

function lane(
	id: string,
	label: string,
	command: string,
	principle: string,
	enforcement: string,
	overrides: Record<string, unknown> = {},
) {
	return {
		id,
		label,
		command,
		principle,
		enforcement,
		status: "pass",
		evidenceSource: `artifacts/${id}.json`,
		findings: [],
		...overrides,
	};
}

function canonicalLanes(
	overrides: Record<string, Record<string, unknown>> = {},
) {
	return [
		lane(
			"architecture-fitness",
			"Architecture fitness",
			"pnpm architecture:check",
			"protect_deep_module_boundaries",
			"architecture_fitness",
			overrides["architecture-fitness"],
		),
		lane(
			"quality-budget",
			"Quality budget",
			"pnpm run quality:size",
			"reduce_cognitive_load",
			"quality_budget",
			overrides["quality-budget"],
		),
		lane(
			"type-safety",
			"Type safety",
			"pnpm run fitness:typecheck-artifact",
			"prove_type_safety",
			"type_safety",
			overrides["type-safety"],
		),
		lane(
			"static-lint",
			"Static lint",
			"pnpm run fitness:lint-artifact",
			"preserve_static_contracts",
			"static_analysis",
			overrides["static-lint"],
		),
		lane(
			"behavior-proof",
			"Behavior proof",
			"pnpm run quality:behavior-tests",
			"prove_behavior_outcomes",
			"hard_blocker",
			overrides["behavior-proof"],
		),
		lane(
			"feedback-learning",
			"Feedback learning",
			"pnpm run harness:audit-tracking",
			"compound_feedback_to_harness",
			"hard_blocker",
			overrides["feedback-learning"],
		),
	];
}

function fitnessReport(overrides: Record<string, unknown> = {}) {
	return {
		schemaVersion: "harness-fitness/v1",
		status: "pass",
		generatedAt: "2026-06-20T00:00:00.000Z",
		summary: {
			lanes: 6,
			findings: 0,
			failures: 0,
			warnings: 0,
			lanesNeedingEvidence: 0,
		},
		lanes: canonicalLanes(),
		topDeterministicFinding: null,
		claimBoundaries: ["Fitness reports normalize local gate evidence only."],
		...overrides,
	};
}

function warningFinding() {
	return {
		id: "quality-budget:warning",
		title: "Advisory warning",
		severity: "warning",
		lane: "quality-budget",
		principle: "reduce_cognitive_load",
		enforcement: "advisory",
		evidence: { message: "warning" },
		risk: "Low severity advisory.",
		recommendedCommand: "pnpm run quality:size",
		claimBoundary: "Quality size evidence only.",
	};
}

function errorFinding() {
	return {
		...warningFinding(),
		id: "quality-budget:error",
		severity: "error",
		enforcement: "quality_budget",
	};
}

describe("validateFitnessReport", () => {
	it("rejects fail status without derived failures", () => {
		const result = validateFitnessReport(fitnessReport({ status: "fail" }));

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "status must be pass for derived lane/finding counts",
				}),
			]),
		);
	});

	it("rejects warn status without derived warnings", () => {
		const result = validateFitnessReport(fitnessReport({ status: "warn" }));

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "status must be pass for derived lane/finding counts",
				}),
			]),
		);
	});

	it("rejects warn status when failures require fail", () => {
		const finding = errorFinding();
		const result = validateFitnessReport(
			fitnessReport({
				status: "warn",
				summary: {
					lanes: 1,
					findings: 1,
					failures: 1,
					warnings: 0,
					lanesNeedingEvidence: 0,
				},
				lanes: [
					{
						id: "quality-budget",
						label: "Quality budget",
						command: "pnpm run quality:size",
						principle: "reduce_cognitive_load",
						enforcement: "quality_budget",
						status: "fail",
						evidenceSource: "artifacts/quality-size.json",
						findings: [finding],
					},
				],
				topDeterministicFinding: finding,
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "status must be fail for derived lane/finding counts",
				}),
			]),
		);
	});

	it("rejects warn status when missing lanes require evidence", () => {
		const result = validateFitnessReport(
			fitnessReport({
				status: "warn",
				summary: {
					lanes: 6,
					findings: 0,
					failures: 0,
					warnings: 0,
					lanesNeedingEvidence: 1,
				},
				lanes: canonicalLanes({
					"quality-budget": { status: "not_run", evidenceSource: "missing" },
				}),
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "status must be needs_evidence for derived lane/finding counts",
				}),
			]),
		);
	});

	it("rejects pass status when a lane status still fails", () => {
		const result = validateFitnessReport(
			fitnessReport({
				lanes: canonicalLanes({ "quality-budget": { status: "fail" } }),
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "status must be fail for derived lane/finding counts",
				}),
			]),
		);
	});

	it("rejects fail lane status without failure finding evidence", () => {
		const result = validateFitnessReport(
			fitnessReport({
				status: "fail",
				lanes: canonicalLanes({ "quality-budget": { status: "fail" } }),
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "lanes[1].status fail requires failure finding evidence",
				}),
			]),
		);
	});

	it("rejects missing top finding metadata when deterministic findings exist", () => {
		const finding = errorFinding();
		const report: Partial<ReturnType<typeof fitnessReport>> = fitnessReport({
			status: "fail",
			summary: {
				lanes: 6,
				findings: 1,
				failures: 1,
				warnings: 0,
				lanesNeedingEvidence: 0,
			},
			lanes: canonicalLanes({
				"quality-budget": { status: "fail", findings: [finding] },
			}),
		});
		delete report.topDeterministicFinding;

		const result = validateFitnessReport(report);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "topDeterministicFinding must be present when deterministic findings exist",
				}),
			]),
		);
	});

	it("accepts warn status when derived warnings exist without failures", () => {
		const finding = warningFinding();
		const result = validateFitnessReport(
			fitnessReport({
				status: "warn",
				summary: {
					lanes: 6,
					findings: 1,
					failures: 0,
					warnings: 1,
					lanesNeedingEvidence: 0,
				},
				lanes: canonicalLanes({
					"quality-budget": { status: "warn", findings: [finding] },
				}),
			}),
		);

		expect(result).toEqual({ valid: true, errors: [] });
	});

	it("rejects reports missing canonical deterministic lanes", () => {
		const result = validateFitnessReport(
			fitnessReport({
				summary: {
					lanes: 1,
					findings: 0,
					failures: 0,
					warnings: 0,
					lanesNeedingEvidence: 0,
				},
				lanes: [canonicalLanes()[1]],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "lanes must include required lane type-safety",
				}),
				expect.objectContaining({
					code: "lanes must include required lane static-lint",
				}),
			]),
		);
	});

	it("rejects duplicate lane ids", () => {
		const result = validateFitnessReport(
			fitnessReport({
				summary: {
					lanes: 7,
					findings: 0,
					failures: 0,
					warnings: 0,
					lanesNeedingEvidence: 0,
				},
				lanes: [
					...canonicalLanes(),
					lane(
						"quality-budget",
						"Quality budget",
						"pnpm run quality:size",
						"reduce_cognitive_load",
						"quality_budget",
					),
				],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "lanes must not contain duplicate lane ids",
				}),
			]),
		);
	});

	it("accepts well-formed trend snapshots", () => {
		const result = validateFitnessReport(
			fitnessReport({
				trendSnapshot: {
					schemaVersion: "harness-fitness-trend-snapshot/v1",
					baselineRef: "artifacts/fitness-baseline.json",
					baselineStatus: "loaded",
					current: {
						status: "pass",
						findings: 0,
						failures: 0,
						warnings: 0,
						lanesNeedingEvidence: 0,
						deterministicFindings: 0,
						advisoryFindings: 0,
					},
					previous: {
						status: "fail",
						findings: 1,
						failures: 1,
						warnings: 0,
						lanesNeedingEvidence: 0,
						deterministicFindings: 1,
						advisoryFindings: 0,
					},
					delta: {
						findings: -1,
						failures: -1,
						warnings: 0,
						lanesNeedingEvidence: 0,
						deterministicFindings: -1,
						advisoryFindings: 0,
					},
					direction: "improved",
					claimBoundary: "Trend snapshots are advisory.",
				},
			}),
		);

		expect(result).toEqual({ valid: true, errors: [] });
	});

	it("rejects malformed trend snapshots", () => {
		const result = validateFitnessReport(
			fitnessReport({
				trendSnapshot: {
					schemaVersion: "harness-fitness-trend-snapshot/v1",
					baselineRef: null,
					baselineStatus: "loaded",
					current: {
						status: "pass",
						findings: 0,
					},
					previous: null,
					delta: null,
					direction: "blocking",
					claimBoundary: "Trend snapshots are advisory.",
				},
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "trendSnapshot.direction must be one of improved, regressed, unchanged, baseline_unavailable",
				}),
				expect.objectContaining({
					code: "trendSnapshot.current.failures must be a non-negative integer",
				}),
				expect.objectContaining({
					code: "trendSnapshot.previous must be non-null when baselineStatus is loaded",
				}),
				expect.objectContaining({
					code: "trendSnapshot.delta must be non-null when baselineStatus is loaded",
				}),
			]),
		);
	});

	it("rejects contradictory unavailable trend snapshots", () => {
		const result = validateFitnessReport(
			fitnessReport({
				trendSnapshot: {
					schemaVersion: "harness-fitness-trend-snapshot/v1",
					baselineRef: null,
					baselineStatus: "unavailable",
					current: {
						status: "pass",
						findings: 0,
						failures: 0,
						warnings: 0,
						lanesNeedingEvidence: 0,
						deterministicFindings: 0,
						advisoryFindings: 0,
					},
					previous: {
						status: "pass",
						findings: 0,
						failures: 0,
						warnings: 0,
						lanesNeedingEvidence: 0,
						deterministicFindings: 0,
						advisoryFindings: 0,
					},
					delta: {
						findings: 0,
						failures: 0,
						warnings: 0,
						lanesNeedingEvidence: 0,
						deterministicFindings: 0,
						advisoryFindings: 0,
					},
					direction: "unchanged",
					claimBoundary: "Trend snapshots are advisory.",
				},
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "trendSnapshot.previous must be null when baselineStatus is unavailable",
				}),
				expect.objectContaining({
					code: "trendSnapshot.delta must be null when baselineStatus is unavailable",
				}),
				expect.objectContaining({
					code: "trendSnapshot.direction must be baseline_unavailable when baselineStatus is unavailable",
				}),
			]),
		);
	});
});
