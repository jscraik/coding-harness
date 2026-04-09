import { describe, expect, it } from "vitest";
import {
	DEFAULT_TRIAGE_LANE_CAPACITY,
	type TriageLane,
	buildIssueLookup,
	evaluateCycleThroughputGuard,
	evaluatePromotionGuards,
	parseDependencyKeys,
	resolveIssueLane,
} from "./triage-lanes.js";

describe("resolveIssueLane", () => {
	it("resolves lanes from labels", () => {
		expect(
			resolveIssueLane({ labels: ["Lane A - Active Stabilization"] }),
		).toBe("lane_a_active_stabilization");
		expect(resolveIssueLane({ labels: ["Lane B - Adoption Path"] })).toBe(
			"lane_b_adoption_path",
		);
	});

	it("returns unassigned when no lane marker exists", () => {
		expect(resolveIssueLane({ labels: ["Bug"] })).toBe("unassigned");
	});
});

describe("parseDependencyKeys", () => {
	it("extracts dependency keys from dependency lines", () => {
		const keys = parseDependencyKeys(`
- Dependencies: JSC-131, JSC-135
- blocked by JSC-104
- unrelated line with JSC-999 should not count
`);
		expect(keys).toEqual(["JSC-131", "JSC-135", "JSC-104"]);
	});
});

describe("evaluatePromotionGuards", () => {
	const issueLookup = buildIssueLookup([
		{
			identifier: "JSC-131",
			state: { name: "Done", type: "completed" },
		},
		{
			identifier: "JSC-104",
			state: { name: "In Progress", type: "started" },
		},
	]);

	it("blocks promotion on unresolved dependencies", () => {
		const result = evaluatePromotionGuards({
			issue: {
				identifier: "JSC-200",
				stateName: "Triage",
				stateType: "unstarted",
				labels: ["Lane C"],
			},
			lane: "lane_c_architecture_foundations",
			dependencies: ["JSC-104"],
			issueLookup,
			laneInProgressCounts: new Map(),
			globalInProgressCount: 0,
			capacity: DEFAULT_TRIAGE_LANE_CAPACITY,
			metadataCompleteness: 1,
			metadataThreshold: 0.8,
		});

		expect(result.promotable).toBe(false);
		expect(result.unresolvedDependencies).toEqual(["JSC-104"]);
		expect(result.reasons.join("\n")).toContain("unresolved dependencies");
	});

	it("blocks promotion when lane cap is reached", () => {
		const laneCounts = new Map<TriageLane, number>([
			["lane_f_deferred_enhancements", 0],
		]);
		const result = evaluatePromotionGuards({
			issue: {
				identifier: "JSC-201",
				stateName: "Backlog",
				stateType: "unstarted",
				labels: ["Lane F"],
			},
			lane: "lane_f_deferred_enhancements",
			dependencies: [],
			issueLookup,
			laneInProgressCounts: laneCounts,
			globalInProgressCount: 0,
			capacity: DEFAULT_TRIAGE_LANE_CAPACITY,
			metadataCompleteness: 1,
			metadataThreshold: 0.8,
		});

		expect(result.promotable).toBe(false);
		expect(result.reasons.join("\n")).toContain("lane cap reached");
	});

	it("allows promotion when guards pass", () => {
		const laneCounts = new Map<TriageLane, number>([
			["lane_b_adoption_path", 1],
		]);
		const result = evaluatePromotionGuards({
			issue: {
				identifier: "JSC-202",
				stateName: "Triage",
				stateType: "unstarted",
				labels: ["Lane B"],
			},
			lane: "lane_b_adoption_path",
			dependencies: ["JSC-131"],
			issueLookup,
			laneInProgressCounts: laneCounts,
			globalInProgressCount: 2,
			capacity: DEFAULT_TRIAGE_LANE_CAPACITY,
			metadataCompleteness: 1,
			metadataThreshold: 0.8,
		});

		expect(result.promotable).toBe(true);
		expect(result.reasons).toEqual([]);
	});
});

describe("evaluateCycleThroughputGuard", () => {
	it("allows promotion when no cycle is assigned", () => {
		const result = evaluateCycleThroughputGuard({
			cycle: null,
			projectedPromotionCount: 4,
		});

		expect(result.promotable).toBe(true);
		expect(result.reasons).toEqual([]);
	});

	it("blocks promotion when cycle has already ended", () => {
		const result = evaluateCycleThroughputGuard({
			cycle: {
				id: "cycle-1",
				startsAt: "2026-04-01",
				endsAt: "2026-04-08",
			},
			projectedPromotionCount: 1,
			now: new Date("2026-04-09T09:00:00Z"),
		});

		expect(result.promotable).toBe(false);
		expect(result.reasons.join("\n")).toContain("cycle guard");
		expect(result.reasons.join("\n")).toContain("ended");
	});

	it("blocks promotions that exceed feasible cycle throughput", () => {
		const result = evaluateCycleThroughputGuard({
			cycle: {
				id: "cycle-2",
				startsAt: "2026-04-08",
				endsAt: "2026-04-09",
			},
			projectedPromotionCount: 3,
			now: new Date("2026-04-08T09:00:00Z"),
		});

		expect(result.promotable).toBe(false);
		expect(result.reasons.join("\n")).toContain(
			"exceed feasible cycle throughput",
		);
	});
});
