import { describe, expect, it } from "vitest";
import {
	type NorthStarSurfaceInput,
	evaluateNorthStarSurfaceParity,
	evaluateProductSurfaceCadence,
	findMatchingProductSurfaces,
} from "./north-star-alignment.js";
import type { HarnessContract, ProductSurfaceRegistry } from "./types.js";

describe("evaluateNorthStarSurfaceParity", () => {
	const baseContract: HarnessContract = {
		version: "1.0.0",
		riskTierRules: {},
		northStar: {
			mission:
				"Coding Harness exists to let a solo developer with limited cognitive bandwidth orchestrate agentic software work to professional standards through compact orientation, executable guardrails, durable memory, and evidence-based handoff.",
			primaryMetric: "pr_lead_time",
			primaryBottleneck: "review_rework_loop",
			autonomyBoundary:
				"Low and medium-risk autonomy should be automated where evidence is deterministic and rollback is clear; high-risk changes remain human-mediated.",
			safetyFloor: [
				"deterministic evidence over intuition",
				"strict current-head SHA discipline",
				"bounded auto-remediation instead of open-ended write access",
				"explicit rollback paths for higher-risk automation",
				"independent review surfaces that do not collapse back into self-approval",
			],
			nonGoals: [
				"governance surface area as a proxy for progress",
				"feature count without measurable throughput or reliability benefit",
			],
			decisionQuestions: [
				{
					id: "lead_time_path",
					prompt:
						"Does this reduce PR lead time directly, or strengthen the path to lower PR lead time by reducing review or rework cost?",
				},
				{
					id: "manual_glue",
					prompt:
						"Does this remove repeated manual glue work rather than normalizing it?",
				},
				{
					id: "agent_reliability",
					prompt:
						"Does this make acceptable output easier for agents to produce reliably?",
				},
				{
					id: "safety_floor",
					prompt:
						"Does this preserve strict evidence, SHA discipline, and rollback safety?",
				},
			],
		},
	} as unknown as HarnessContract;

	it("emits drift_blocking for missing mission clause in north_star_doc", () => {
		const surfaces: NorthStarSurfaceInput[] = [
			{
				key: "north_star_doc",
				path: "docs/roadmap/north-star.md",
				content:
					"PR lead time is the primary metric. Review rework loop is the bottleneck.",
			},
		];
		const issues = evaluateNorthStarSurfaceParity(baseContract, surfaces);
		expect(issues).toHaveLength(1);
		expect(issues[0]?.failureClass).toBe("drift_blocking");
		expect(issues[0]?.severity).toBe("error");
	});

	it("emits drift_blocking for missing metric in readme", () => {
		const surfaces: NorthStarSurfaceInput[] = [
			{
				key: "readme",
				path: "README.md",
				content: "This is a coding harness.",
			},
		];
		const issues = evaluateNorthStarSurfaceParity(baseContract, surfaces);
		expect(issues).toHaveLength(1);
		expect(issues[0]?.failureClass).toBe("drift_blocking");
		expect(issues[0]?.severity).toBe("warning");
	});

	it("emits drift_blocking for missing bottleneck in agent_first_status", () => {
		const surfaces: NorthStarSurfaceInput[] = [
			{
				key: "agent_first_status",
				path: "docs/roadmap/agent-first-status.md",
				content: "Tracking PR lead time metrics.",
			},
		];
		const issues = evaluateNorthStarSurfaceParity(baseContract, surfaces);
		expect(issues).toHaveLength(1);
		expect(issues[0]?.failureClass).toBe("drift_blocking");
		expect(issues[0]?.severity).toBe("warning");
	});

	it("returns empty when all clauses are present", () => {
		const surfaces: NorthStarSurfaceInput[] = [
			{
				key: "north_star_doc",
				path: "docs/roadmap/north-star.md",
				content: `Coding Harness exists to let a solo developer with limited cognitive bandwidth orchestrate agentic software work to professional standards through compact orientation, executable guardrails, durable memory, and evidence-based handoff.
	PR lead time is the primary north-star metric.
	The primary bottleneck is the review and rework loop.
	Low and medium-risk autonomy should be automated.
High-risk changes remain human-mediated.
deterministic evidence, current-head sha discipline, bounded auto-remediation, explicit rollback paths, independent review`,
			},
		];
		const issues = evaluateNorthStarSurfaceParity(baseContract, surfaces);
		expect(issues).toHaveLength(0);
	});
});

describe("evaluateProductSurfaceCadence", () => {
	const makeRegistry = (
		overrides: Partial<ProductSurfaceRegistry["surfaces"][number]>[],
	): ProductSurfaceRegistry => ({
		surfaces: overrides.map((o, i) => ({
			surfaceId: `surface-${i}`,
			surfaceType: "command",
			class: "adjacent",
			owner: "workflow",
			northStarContribution: "test",
			manualGlueReductionClaim: "test",
			reliabilityContribution: "test",
			evidenceReference: `src/surface-${i}.ts`,
			ownedPaths: [`src/surface-${i}.ts`],
			lastReviewedAt: "2026-04-01",
			...o,
		})),
	});

	it("returns empty for core surfaces regardless of cadence", () => {
		const registry = makeRegistry([
			{ class: "core", reviewCadence: "weekly", lastReviewedAt: "2020-01-01" },
		]);
		const issues = evaluateProductSurfaceCadence(
			registry,
			new Date("2026-04-26T00:00:00Z"),
		);
		expect(issues).toHaveLength(0);
	});

	it("returns empty when no reviewCadence is set", () => {
		const registry = makeRegistry([
			{ class: "adjacent", lastReviewedAt: "2020-01-01" },
		]);
		const issues = evaluateProductSurfaceCadence(
			registry,
			new Date("2026-04-26T00:00:00Z"),
		);
		expect(issues).toHaveLength(0);
	});

	it("emits cadence_breach when weekly surface is stale", () => {
		const registry = makeRegistry([
			{
				class: "adjacent",
				reviewCadence: "weekly",
				lastReviewedAt: "2026-04-10",
			},
		]);
		const issues = evaluateProductSurfaceCadence(
			registry,
			new Date("2026-04-26T00:00:00Z"),
		);
		expect(issues).toHaveLength(1);
		expect(issues[0]?.failureClass).toBe("cadence_breach");
		expect(issues[0]?.severity).toBe("error");
		expect(issues[0]?.message).toContain("surface-0");
		expect(issues[0]?.message).toContain("16 days");
	});

	it("emits cadence_breach when per_release surface is stale", () => {
		const registry = makeRegistry([
			{
				class: "experimental",
				reviewCadence: "per_release",
				lastReviewedAt: "2026-03-01",
			},
		]);
		const issues = evaluateProductSurfaceCadence(
			registry,
			new Date("2026-04-26T00:00:00Z"),
		);
		expect(issues).toHaveLength(1);
		expect(issues[0]?.failureClass).toBe("cadence_breach");
	});

	it("returns empty when surface is within cadence", () => {
		const registry = makeRegistry([
			{
				class: "adjacent",
				reviewCadence: "weekly",
				lastReviewedAt: "2026-04-22",
			},
		]);
		const issues = evaluateProductSurfaceCadence(
			registry,
			new Date("2026-04-26T00:00:00Z"),
		);
		expect(issues).toHaveLength(0);
	});

	it("emits cadence_breach for invalid lastReviewedAt date", () => {
		const registry = makeRegistry([
			{
				class: "adjacent",
				reviewCadence: "weekly",
				lastReviewedAt: "not-a-date",
			},
		]);
		const issues = evaluateProductSurfaceCadence(
			registry,
			new Date("2026-04-26T00:00:00Z"),
		);
		expect(issues).toHaveLength(1);
		expect(issues[0]?.failureClass).toBe("cadence_breach");
		expect(issues[0]?.ruleId).toBe("status.north_star.cadence.invalid_date");
	});

	it("returns empty for empty registry", () => {
		expect(evaluateProductSurfaceCadence(undefined)).toHaveLength(0);
		expect(evaluateProductSurfaceCadence({ surfaces: [] })).toHaveLength(0);
	});
});

describe("findMatchingProductSurfaces", () => {
	const registry: ProductSurfaceRegistry = {
		surfaces: [
			{
				surfaceId: "auth",
				surfaceType: "command",
				class: "core",
				owner: "security",
				northStarContribution: "Auth surface",
				manualGlueReductionClaim: "test",
				reliabilityContribution: "test",
				evidenceReference: "src/auth.ts",
				ownedPaths: ["src/auth.ts"],
				lastReviewedAt: "2026-04-01",
			},
		],
	};

	it("matches changed files under ownedPaths", () => {
		const matches = findMatchingProductSurfaces(registry, ["src/auth.ts"]);
		expect(matches).toHaveLength(1);
		expect(matches[0]?.surfaceId).toBe("auth");
	});

	it("returns empty for non-matching files", () => {
		expect(
			findMatchingProductSurfaces(registry, ["src/other.ts"]),
		).toHaveLength(0);
	});
});
