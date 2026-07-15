import { describe, expect, it } from "vitest";
import type { ReviewContextLearning } from "./review-context.js";
import { buildReviewLearningCloseout } from "./review-learning-closeout.js";

function learning(
	promotionStatus: ReviewContextLearning["promotionStatus"],
	enforcedBy?: string[],
): ReviewContextLearning {
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
		match: {
			kind: "exact_file",
			confidence: 1,
			reason: "Exact file match.",
			advisoryOnly: false,
			falsePositiveCandidate: false,
		},
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
});
