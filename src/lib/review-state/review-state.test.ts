import { describe, expect, it } from "vitest";
import type { EvidenceReceipt } from "../evidence/evidence-receipt.js";
import { validateReviewStatePacket } from "./index.js";
import type {
	ReviewStateOwnershipClassification,
	ReviewStatePacket,
} from "./index.js";

const HEAD_SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const GENERATED_AT = "2026-05-25T12:00:00Z";

describe("review-state/v1 validation", () => {
	it("accepts unresolved review truth without blending it with checks or tracker state", () => {
		const result = validateReviewStatePacket(reviewStatePacket());

		expect(result).toEqual({ valid: true, errors: [] });
	});

	it("rejects reviewer artifact claims without a receipt object", () => {
		const packet = {
			...reviewStatePacket(),
			reviewerArtifacts: [
				{
					role: "adversarial-reviewer",
					path: "artifacts/reviews/adversarial-reviewer.md",
					expectedProducer: "adversarial-reviewer",
					ownershipClassification: "introduced_by_current_patch",
				},
			],
		};

		const result = validateReviewStatePacket(packet);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "reviewerArtifacts.0.receipt.receipt",
				}),
			]),
		);
	});

	it("rejects passing reviewer artifact receipts without non-zero size", () => {
		const packet = reviewStatePacket({
			reviewerArtifacts: [
				reviewerArtifact({
					receipt: reviewReceipt({ sizeBytes: 0 }),
				}),
			],
		});

		const result = validateReviewStatePacket(packet);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "reviewerArtifacts.0.receipt.sizeBytes",
				}),
			]),
		);
	});

	it("rejects mismatched reviewer artifact producers", () => {
		const packet = reviewStatePacket({
			reviewerArtifacts: [
				reviewerArtifact({
					expectedProducer: "agent-native-reviewer",
					receipt: reviewReceipt({ producer: "adversarial-reviewer" }),
				}),
			],
		});

		const result = validateReviewStatePacket(packet);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "reviewerArtifacts.0.expectedProducer",
				}),
			]),
		);
	});

	it("rejects reviewer artifact receipts that point at a different file", () => {
		const packet = reviewStatePacket({
			reviewerArtifacts: [
				reviewerArtifact({
					path: "artifacts/reviews/agent-native-reviewer.md",
					receipt: reviewReceipt({
						ref: "review-state:artifacts/reviews/adversarial-reviewer.md",
						producer: "agent-native-reviewer",
					}),
				}),
			],
		});

		const result = validateReviewStatePacket(packet);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "reviewerArtifacts.0.receipt.ref",
				}),
			]),
		);
	});

	it("rejects reviewer artifact receipts from a different PR head", () => {
		const packet = reviewStatePacket({
			reviewerArtifacts: [
				reviewerArtifact({
					receipt: reviewReceipt({
						headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
					}),
				}),
			],
		});

		const result = validateReviewStatePacket(packet);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "reviewerArtifacts.0.receipt.headSha",
				}),
			]),
		);
	});

	it("rejects reviewer artifact receipts without PR head provenance", () => {
		const packet = reviewStatePacket({
			reviewerArtifacts: [
				reviewerArtifact({
					receipt: reviewReceipt({ headSha: null }),
				}),
			],
		});

		const result = validateReviewStatePacket(packet);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "reviewerArtifacts.0.receipt.headSha",
				}),
			]),
		);
	});

	it("accepts every review-state ownership classification used by reviewers", () => {
		const expectedOwnershipClassifications: ReviewStateOwnershipClassification[] =
			[
				"introduced_by_current_patch",
				"pre_existing",
				"unrelated_dirty_worktree",
				"environment_or_tooling_failure",
			];

		for (const ownershipClassification of expectedOwnershipClassifications) {
			const result = validateReviewStatePacket(
				reviewStatePacket({
					reviewerArtifacts: [
						reviewerArtifact({
							ownershipClassification,
						}),
					],
				}),
			);

			expect(result.valid).toBe(true);
		}
	});

	it("rejects ownership classifications outside the explicit enum", () => {
		const packet = {
			...reviewStatePacket(),
			reviewerArtifacts: [
				{
					...reviewerArtifact(),
					ownershipClassification: "maybe_current_patch",
				},
			],
		};

		const result = validateReviewStatePacket(packet);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "reviewerArtifacts.0.ownershipClassification",
				}),
			]),
		);
	});

	it("rejects unresolved thread counts that cannot be true together", () => {
		const result = validateReviewStatePacket(
			reviewStatePacket({
				unresolvedThreads: {
					total: 2,
					needsHuman: 2,
					autofixable: 1,
				},
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "unresolvedThreads.total" }),
			]),
		);
	});
});

function reviewStatePacket(
	overrides: Partial<ReviewStatePacket> = {},
): ReviewStatePacket {
	return {
		schemaVersion: "review-state/v1",
		generatedAt: GENERATED_AT,
		pr: {
			number: 299,
			url: "https://github.com/jscraik/coding-harness/pull/299",
			baseRef: "main",
			headRef: "codex/jsc-363-runtime-evidence-pu009",
			headSha: HEAD_SHA,
		},
		githubReviews: {
			decision: "review_required",
			status: "blocked",
			reviewCount: 0,
		},
		codeRabbit: {
			status: "skipped_draft",
			evidenceStatus: "blocked",
			commentCount: 1,
		},
		unresolvedThreads: {
			total: 1,
			needsHuman: 1,
			autofixable: 0,
		},
		reviewerArtifacts: [reviewerArtifact()],
		...overrides,
	};
}

function reviewerArtifact(
	overrides: Partial<{
		role: string;
		path: string;
		expectedProducer: string;
		ownershipClassification: ReviewStateOwnershipClassification;
		receipt: EvidenceReceipt;
	}> = {},
) {
	const role = overrides.role ?? "adversarial-reviewer";
	return {
		role,
		path: overrides.path ?? "artifacts/reviews/adversarial-reviewer.md",
		expectedProducer: overrides.expectedProducer ?? role,
		ownershipClassification:
			overrides.ownershipClassification ?? "introduced_by_current_patch",
		receipt: overrides.receipt ?? reviewReceipt({ producer: role }),
	};
}

function reviewReceipt(
	overrides: Partial<EvidenceReceipt> = {},
): EvidenceReceipt {
	return {
		schemaVersion: "evidence-receipt/v1",
		kind: "review_artifact",
		ref: "review-state:artifacts/reviews/adversarial-reviewer.md",
		producer: "adversarial-reviewer",
		status: "pass",
		freshness: "current",
		evidenceUse: "claim_support",
		blockerClass: null,
		verifiedAt: GENERATED_AT,
		headSha: HEAD_SHA,
		sizeBytes: 2048,
		...overrides,
	};
}
