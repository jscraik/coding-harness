import { describe, expect, it } from "vitest";
import { evaluateNorthStarDecisionQuestions } from "./north-star-questions.js";

describe("evaluateNorthStarDecisionQuestions", () => {
	const decisionQuestions = [
		{
			id: "safety_floor",
			prompt: "Does this keep deterministic evidence over intuition?",
		},
	] as const;

	it("returns contract invalid blocker when questions are required but absent", () => {
		const blockers = evaluateNorthStarDecisionQuestions({
			prBody: "",
			decisionQuestions: [],
			requireQuestions: true,
		});

		expect(blockers).toEqual([
			"contract_invalid:contract-missing-questions: Canonical north-star contracts must declare at least one decision question.",
		]);
	});

	it("returns missing question blocker when question is not present", () => {
		const blockers = evaluateNorthStarDecisionQuestions({
			prBody: "PR body without question references",
			decisionQuestions: [...decisionQuestions],
			requireQuestions: true,
		});

		expect(blockers).toHaveLength(1);
		expect(blockers[0]).toContain(
			"North-star decision questions missing from PR context: safety_floor",
		);
	});

	it("requires evidence references in question response blocks", () => {
		const blockers = evaluateNorthStarDecisionQuestions({
			prBody: "- safety_floor: yes, we should do this",
			decisionQuestions: [...decisionQuestions],
			requireQuestions: true,
		});

		expect(blockers).toHaveLength(1);
		expect(blockers[0]).toContain(
			"North-star decision responses must include evidence references",
		);
	});

	it("permits explicit no-impact negative responses with non-positive policy delta", () => {
		const blockers = evaluateNorthStarDecisionQuestions({
			prBody:
				"- safety_floor: no; metric_impact_declared: none; policy_surface_delta: 0 [evidence](/tmp/evidence.md:12)",
			decisionQuestions: [...decisionQuestions],
			requireQuestions: true,
		});

		expect(blockers).toEqual([]);
	});
});
