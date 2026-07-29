import { describe, expect, it } from "vitest";
import { normaliseReviewGateResult } from "./normalise-review-preflight-core.js";

describe("normaliseReviewGateResult", () => {
	it("preserves compact minimal review as skipped without review evidence", () => {
		const result = normaliseReviewGateResult({
			ok: true,
			output: {
				verified: false,
				notApplicable: "compact-minimal-contract",
				headSha: "aabbccddaabbccddaabbccddaabbccddaabbccdd",
				checkStatus: "not_applicable",
				needsRerun: false,
				policy_gate_status: "missing",
				plan_traceability_status: "missing",
				plan_ids: [],
				blockers: [],
				actionable_count: 0,
				informational_count: 1,
				confidence_rubric: {
					score: 1,
					level: "low",
					rationale: ["no review evidence evaluated"],
				},
			},
		});

		expect(result.status).toBe("skipped");
		expect(result.reason).toContain("no review evidence was evaluated");
		expect(result.meta?.notApplicable).toBe("compact-minimal-contract");
		expect(result.evidence_ref).toContain(
			"review:not-applicable:compact-minimal-contract",
		);
	});
});
