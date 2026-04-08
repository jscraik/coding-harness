import { describe, expect, it } from "vitest";
import {
	extractCurrentTypeLabels,
	inferTypeLabel,
	resolveTypeLabelPlan,
} from "./triage-type-labels.js";

describe("extractCurrentTypeLabels", () => {
	it("returns canonical type labels from existing labels", () => {
		expect(extractCurrentTypeLabels(["Bug", "blocked", "Policy"])).toEqual([
			"Bug",
			"Policy",
		]);
	});
});

describe("inferTypeLabel", () => {
	it("prefers security classification from title and description", () => {
		expect(
			inferTypeLabel({
				title: "Enforce GitHub Actions least privilege",
				description: "Add OSPS baseline and SLSA checks",
				lane: "lane_d_security_trust",
			}),
		).toBe("Security");
	});

	it("falls back to lane defaults when no heuristic matches", () => {
		expect(
			inferTypeLabel({
				title: "Update docs index ordering",
				lane: "lane_e_docs_efficiency",
			}),
		).toBe("Improvement");
	});
});

describe("resolveTypeLabelPlan", () => {
	it("reuses existing type labels without forcing a replacement", () => {
		const plan = resolveTypeLabelPlan({
			title: "Anything",
			labels: ["Feature", "Blocked"],
			lane: "lane_b_adoption_path",
		});

		expect(plan.needsLabel).toBe(false);
		expect(plan.needsNormalization).toBe(false);
		expect(plan.expected).toBe("Feature");
		expect(plan.reason).toBe("existing_type_label_present");
	});

	it("normalizes issues with multiple type labels to one inferred label", () => {
		const plan = resolveTypeLabelPlan({
			title: "Fix regression in init output",
			labels: ["Feature", "Bug", "Blocked"],
			lane: "lane_b_adoption_path",
		});

		expect(plan.expected).toBe("Bug");
		expect(plan.needsLabel).toBe(false);
		expect(plan.needsNormalization).toBe(true);
		expect(plan.reason).toBe("multiple_type_labels_present");
	});

	it("requests an inferred type label when none exists", () => {
		const plan = resolveTypeLabelPlan({
			title: "Fix regression in init output",
			description: "Users see an error after bootstrap.",
			labels: ["Lane A - Active Stabilization"],
			lane: "lane_a_active_stabilization",
		});

		expect(plan.needsLabel).toBe(true);
		expect(plan.needsNormalization).toBe(false);
		expect(plan.expected).toBe("Bug");
		expect(plan.reason).toBe("missing_type_label");
	});
});
