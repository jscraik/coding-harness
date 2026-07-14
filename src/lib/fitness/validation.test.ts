import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateFitnessReport } from "./validation.js";

const REQUIRED_SCHEMA_LANE_DEFS = [
	"requiresArchitectureFitnessLane",
	"requiresQualityStructureLane",
	"requiresTypeSafetyLane",
	"requiresStaticLintLane",
	"requiresBehaviorProofLane",
	"requiresFeedbackLearningLane",
] as const;

const REQUIRED_SCHEMA_LANE_IDS = [
	"architecture-fitness",
	"quality-structure",
	"type-safety",
	"static-lint",
	"behavior-proof",
	"feedback-learning",
] as const;

function harnessFitnessSchema(): Record<string, unknown> {
	return JSON.parse(
		readFileSync("contracts/harness-fitness.schema.json", "utf8"),
	) as Record<string, unknown>;
}

function record(value: unknown): Record<string, unknown> {
	expect(value).toEqual(expect.any(Object));
	expect(Array.isArray(value)).toBe(false);
	return value as Record<string, unknown>;
}

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
			"quality-structure",
			"Quality structure",
			"pnpm run quality:size",
			"reduce_cognitive_load",
			"quality_structure",
			overrides["quality-structure"],
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

function canonicalCoverage() {
	return [
		{
			category: "typescript-type-discipline",
			concern: "TypeScript anti-pattern coverage.",
			laneIds: ["type-safety", "static-lint"],
			commands: [
				"pnpm run fitness:typecheck-artifact",
				"pnpm run fitness:lint-artifact",
			],
			coverage: "Typecheck and lint evidence.",
			claimBoundary: "Local type and lint evidence only.",
		},
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
		coverage: canonicalCoverage(),
		topDeterministicFinding: null,
		claimBoundaries: ["Fitness reports normalize local gate evidence only."],
		...overrides,
	};
}

function warningFinding() {
	return {
		id: "quality-structure:warning",
		title: "Advisory warning",
		severity: "warning",
		lane: "quality-structure",
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
		id: "quality-structure:error",
		severity: "error",
		enforcement: "quality_structure",
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

	it("accepts legacy v1 reports without coverage metadata", () => {
		const report = fitnessReport();
		const { coverage, ...legacyReport } = report;

		expect(coverage).toEqual(canonicalCoverage());
		const result = validateFitnessReport(legacyReport);

		expect(result.valid).toBe(true);
	});

	it("accepts additive capability metadata and ignores not-applicable evidence debt", () => {
		const optionalLane = lane(
			"agent-routing",
			"Agent routing",
			"pnpm run coding-policy:route",
			"preserve_static_contracts",
			"static_analysis",
			{
				capability: "agent_routing",
				applicability: "not_applicable",
				status: "not_run",
			},
		);
		const report = fitnessReport({
			lanes: [...canonicalLanes(), optionalLane],
			status: "pass",
			summary: {
				lanes: 7,
				findings: 0,
				failures: 0,
				warnings: 0,
				lanesNeedingEvidence: 0,
			},
		});

		expect(validateFitnessReport(report)).toEqual({ valid: true, errors: [] });
	});

	it("rejects a not-applicable lane that claims a pass", () => {
		const report = fitnessReport({
			lanes: canonicalLanes({
				"quality-structure": {
					applicability: "not_applicable",
					status: "pass",
				},
			}),
		});

		const result = validateFitnessReport(report);
		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "lanes[1] marked not_applicable must remain not_run with no findings",
				}),
			]),
		);
	});

	it("rejects an unknown applicability value", () => {
		const report = fitnessReport({
			lanes: canonicalLanes({
				"quality-structure": { applicability: "maybe" },
			}),
		});

		const result = validateFitnessReport(report);
		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "lanes[1].applicability must be one of required, admitted, not_applicable, blocked",
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
						id: "quality-structure",
						label: "Quality structure",
						command: "pnpm run quality:size",
						principle: "reduce_cognitive_load",
						enforcement: "quality_structure",
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
					"quality-structure": { status: "not_run", evidenceSource: "missing" },
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
				lanes: canonicalLanes({ "quality-structure": { status: "fail" } }),
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
				lanes: canonicalLanes({ "quality-structure": { status: "fail" } }),
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
				"quality-structure": { status: "fail", findings: [finding] },
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
					"quality-structure": { status: "warn", findings: [finding] },
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
						"quality-structure",
						"Quality structure",
						"pnpm run quality:size",
						"reduce_cognitive_load",
						"quality_structure",
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

	it("rejects empty coverage metadata when present", () => {
		const report = fitnessReport({ coverage: [] });

		const result = validateFitnessReport(report);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "coverage must not be empty",
				}),
			]),
		);
	});

	it("rejects coverage entries without a route target", () => {
		const [entry] = canonicalCoverage();
		const result = validateFitnessReport(
			fitnessReport({
				coverage: [{ ...entry, laneIds: [], commands: [] }],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "coverage[0] must define at least one laneId or command",
				}),
			]),
		);
	});

	it("rejects coverage entries with an empty claim boundary", () => {
		const [entry] = canonicalCoverage();
		const result = validateFitnessReport(
			fitnessReport({
				coverage: [{ ...entry, claimBoundary: "" }],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "coverage[0].claimBoundary must be a non-empty string",
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

	it("mirrors canonical lane requirements in the JSON schema", () => {
		const schema = harnessFitnessSchema();
		const defs = record(schema.$defs);
		const lanes = record(record(schema.properties).lanes);

		expect(lanes.allOf).toEqual(
			REQUIRED_SCHEMA_LANE_DEFS.map((definition) => ({
				$ref: `#/$defs/${definition}`,
			})),
		);

		for (const [index, definition] of REQUIRED_SCHEMA_LANE_DEFS.entries()) {
			const requirement = record(defs[definition]);
			const contains = record(requirement.contains);
			const properties = record(contains.properties);
			const id = record(properties.id);
			expect(requirement.minContains).toBe(1);
			expect(id.const).toBe(REQUIRED_SCHEMA_LANE_IDS[index]);
		}
	});

	it("keeps capability and applicability metadata additive in the lane schema", () => {
		const schema = harnessFitnessSchema();
		const laneSchema = record(record(schema.$defs).lane);
		const properties = record(laneSchema.properties);

		expect(record(properties.capability).type).toBe("string");
		expect(record(properties.applicability).enum).toEqual([
			"required",
			"admitted",
			"not_applicable",
			"blocked",
		]);
	});

	it("keeps unavailable trend snapshots schema-compatible with attempted baseline refs", () => {
		const schema = harnessFitnessSchema();
		const trendSnapshot = record(record(schema.$defs).trendSnapshot);
		const allOf = trendSnapshot.allOf;
		expect(allOf).toEqual(expect.any(Array));
		const trendStatusBranch = record((allOf as unknown[])[0]);
		const elseBranch = record(trendStatusBranch.else);
		const elseProperties = record(elseBranch.properties);

		expect(elseProperties).not.toHaveProperty("baselineRef");
		expect(elseProperties).toEqual(
			expect.objectContaining({
				previous: { type: "null" },
				delta: { type: "null" },
				direction: { const: "baseline_unavailable" },
			}),
		);
	});
});
