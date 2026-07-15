import { describe, expect, it } from "vitest";
import type { ReviewContextLearning } from "./review-context.js";
import { buildReviewLearningCloseout } from "./review-learning-closeout.js";

function learning(
	promotionStatus: ReviewContextLearning["promotionStatus"],
	enforcedBy?: string[],
): ReviewContextLearning {
	const exactMatch = {
		kind: "exact_file" as const,
		confidence: 1,
		reason: "Exact file match.",
		advisoryOnly: false,
		falsePositiveCandidate: false,
	};
	return {
		id: "learning.enforced-without-path",
		usage: 42,
		classification: "guardrail",
		enforcement: "error",
		promotionStatus,
		summary: "A repeated review constraint.",
		matchedFiles: ["src/example.ts"],
		fix: "Add the durable guardrail.",
		evidenceRef: ["review:1"],
		match: exactMatch,
		matches: [exactMatch],
		...(enforcedBy ? { enforcedBy } : {}),
	};
}

describe("buildReviewLearningCloseout", () => {
	it("keeps enforced learnings without guardrail paths in skipped promotions", () => {
		const result = buildReviewLearningCloseout({
			source: ".harness/learnings/coderabbit.local.json",
			repo: "coding-harness",
			changedFiles: ["src/example.ts"],
			matchingLearnings: [learning("enforced")],
		});

		expect(result.promotedGuardrails).toEqual([]);
		expect(result.skippedPromotions).toEqual([
			expect.objectContaining({
				promotionStatus: "enforced",
				reason:
					"not_enforced: promotion status enforced has no concrete enforced guardrail.",
			}),
		]);
	});

	it("keeps enforced learnings with concrete paths promoted", () => {
		const result = buildReviewLearningCloseout({
			source: ".harness/learnings/coderabbit.local.json",
			repo: "coding-harness",
			changedFiles: ["src/example.ts"],
			matchingLearnings: [learning("enforced", ["src/guardrail.ts"])],
		});

		expect(result.promotedGuardrails).toEqual([
			expect.objectContaining({
				promotionStatus: "enforced",
				enforcedBy: ["src/guardrail.ts"],
			}),
		]);
		expect(result.skippedPromotions).toEqual([]);
	});

	it("counts advisory matches across every changed file", () => {
		const mixedLearning = learning("candidate");
		mixedLearning.matches = [
			mixedLearning.match,
			{
				kind: "keyword",
				confidence: 0.5,
				reason: "Keyword-only match.",
				advisoryOnly: true,
				falsePositiveCandidate: true,
			},
		];

		const result = buildReviewLearningCloseout({
			source: ".harness/learnings/coderabbit.local.json",
			repo: "coding-harness",
			changedFiles: ["src/example.ts", "src/other.ts"],
			matchingLearnings: [mixedLearning],
		});

		expect(result.summary).toMatchObject({
			exactFileMatches: 1,
			advisoryFuzzyMatches: 1,
		});
	});

	it("counts exact matches across every changed file", () => {
		const exactLearning = learning("candidate");
		exactLearning.matches = [exactLearning.match, { ...exactLearning.match }];

		const result = buildReviewLearningCloseout({
			source: ".harness/learnings/coderabbit.local.json",
			repo: "coding-harness",
			changedFiles: ["src/example.ts", "src/other.ts"],
			matchingLearnings: [exactLearning],
		});

		expect(result.summary.exactFileMatches).toBe(2);
	});

	it("keeps recorded candidate reasons in skipped promotions", () => {
		const candidate = learning("candidate");
		candidate.promotionReason = "Needs a measured false-positive sample.";

		const result = buildReviewLearningCloseout({
			source: ".harness/learnings/coderabbit.local.json",
			repo: "coding-harness",
			changedFiles: ["src/example.ts"],
			matchingLearnings: [candidate],
		});

		expect(result.skippedPromotions[0]?.reason).toBe(
			"candidate_not_enforced: Needs a measured false-positive sample.",
		);
	});

	it("preserves candidate reasons when usage is below the threshold", () => {
		const candidate = learning("candidate");
		candidate.usage = 2;
		candidate.promotionReason = "Awaiting owner review.";

		const result = buildReviewLearningCloseout({
			source: ".harness/learnings/coderabbit.local.json",
			repo: "coding-harness",
			changedFiles: ["src/example.ts"],
			matchingLearnings: [candidate],
		});

		expect(result.skippedPromotions[0]?.reason).toBe(
			"candidate_not_enforced: Awaiting owner review.; below_usage_threshold: 2 uses is below the 25-use promotion threshold.",
		);
	});

	it("does not treat malformed enforcement paths as promoted guardrails", () => {
		const malformed = learning("enforced");
		(malformed as unknown as { enforcedBy: unknown }).enforcedBy =
			"src/guardrail.ts";

		const result = buildReviewLearningCloseout({
			source: ".harness/learnings/coderabbit.local.json",
			repo: "coding-harness",
			changedFiles: ["src/example.ts"],
			matchingLearnings: [malformed],
		});

		expect(result.promotedGuardrails).toEqual([]);
		expect(result.skippedPromotions[0]?.reason).toContain("not_enforced");
	});
});
