import { describe, expect, it } from "vitest";
import type { EvidenceReceipt } from "../evidence/evidence-receipt.js";
import { expectBehavior } from "../testing/expect-behavior.js";
import { buildPrCloseoutStatePackets } from "./state-packets.js";
import type { PrCloseoutInput } from "./types.js";

const HEAD_SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const GENERATED_AT = "2026-05-25T12:00:00Z";
const REPOSITORY = "jscraik/coding-harness";

describe("PR closeout state packet bridge", () => {
	it("derives validated external-state and review-state packets from normalized closeout input", () => {
		const result = buildPrCloseoutStatePackets(completeInput(), {
			repository: REPOSITORY,
			generatedAt: GENERATED_AT,
			fetchedAt: GENERATED_AT,
			reviewerArtifactProofs: [reviewerArtifactProof()],
		});

		expectBehavior({
			given:
				"normalized PR closeout input with current checks, review threads, and reviewer proof",
			should:
				"derive packets that validate under the external-state and review-state contracts",
			actual: {
				externalValid: result.externalStateValidation.valid,
				reviewValid: result.reviewStateValidation.valid,
				blockers: result.blockers,
			},
			expected: {
				externalValid: true,
				reviewValid: true,
				blockers: [],
			},
		});
		expect(result.externalStateValidation).toEqual({ valid: true, errors: [] });
		expect(result.reviewStateValidation).toEqual({ valid: true, errors: [] });
		expect(
			result.externalState?.sources.map((source) => source.source),
		).toEqual([
			"github_pr",
			"github_checks",
			"github_reviews",
			"coderabbit",
			"linear",
			"circleci",
		]);
		expect(result.deliveryTruth).toEqual([
			expect.objectContaining({
				claim: "remote_checks_current",
				status: "pass",
				source: "external_state",
				evidenceUse: "claim_support",
				verdictHeadSha: HEAD_SHA,
			}),
			expect.objectContaining({
				claim: "review_threads_resolved",
				status: "pass",
				source: "review_state",
				evidenceUse: "claim_support",
				verdictHeadSha: HEAD_SHA,
			}),
		]);
		expect(result.deliveryTruth.map((verdict) => verdict.claim)).toEqual([
			"remote_checks_current",
			"review_threads_resolved",
		]);
	});

	it("keeps Linear orientation evidence from supporting external-state claims", () => {
		const result = buildPrCloseoutStatePackets(completeInput(), {
			repository: REPOSITORY,
			generatedAt: GENERATED_AT,
			fetchedAt: GENERATED_AT,
		});

		expect(result.externalStateValidation.valid).toBe(true);
		expect(result.externalStateClaimSupport).toEqual({
			canSupportClaim: false,
			blockers: [
				"snapshot_not_claim_support",
				"source_not_claim_support",
				"source_unknown",
				"source_not_current",
				"source_not_passing",
			],
		});
	});

	it("blocks review-state packet derivation without PR head SHA", () => {
		const input = completeInput({
			pullRequest: {
				...completeInput().pullRequest,
				headSha: null,
			},
		});

		const result = buildPrCloseoutStatePackets(input, {
			repository: REPOSITORY,
			generatedAt: GENERATED_AT,
			fetchedAt: GENERATED_AT,
		});

		expect(result.blockers).toContain("missing_pr_head_sha");
		expect(result.reviewState).toBeNull();
		expect(result.reviewStateValidation.valid).toBe(false);
		expect(result.externalStateValidation.valid).toBe(false);
	});

	it("blocks review-state packet derivation when unresolved thread truth is unknown", () => {
		const input = completeInput({
			reviewThreads: { unresolved: null },
		});

		const result = buildPrCloseoutStatePackets(input, {
			repository: REPOSITORY,
			generatedAt: GENERATED_AT,
			fetchedAt: GENERATED_AT,
		});

		expect(result.blockers).toContain("review_threads_unknown");
		expect(result.reviewState).toBeNull();
		expect(result.externalStateValidation.valid).toBe(true);
		expect(result.externalStateClaimSupport.canSupportClaim).toBe(false);
	});

	it("blocks review-state packet derivation when expected reviewer artifacts lack proof", () => {
		const input = completeInput({
			reviewArtifacts: [
				{
					path: "artifacts/reviews/adversarial-reviewer.md",
					producer: "adversarial-reviewer",
					status: "missing",
				},
			],
		});

		const result = buildPrCloseoutStatePackets(input, {
			repository: REPOSITORY,
			generatedAt: GENERATED_AT,
			fetchedAt: GENERATED_AT,
		});

		expect(result.blockers).toContain(
			"reviewer_artifact_missing:artifacts/reviews/adversarial-reviewer.md",
		);
		expect(result.reviewState).toBeNull();
	});

	it("treats pending required checks as orientation evidence, not claim support", () => {
		const input = completeInput({
			checks: [
				{
					name: "ci/circleci: test",
					state: "PENDING",
					required: true,
					headSha: HEAD_SHA,
					source: "circleci",
				},
			],
		});

		const result = buildPrCloseoutStatePackets(input, {
			repository: REPOSITORY,
			generatedAt: GENERATED_AT,
			fetchedAt: GENERATED_AT,
		});

		expect(result.externalStateValidation.valid).toBe(true);
		expect(result.externalStateClaimSupport.canSupportClaim).toBe(false);
		expect(result.externalStateClaimSupport.blockers).toEqual(
			expect.arrayContaining([
				"source_not_claim_support",
				"source_not_passing",
			]),
		);
		expect(result.deliveryTruth).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					claim: "remote_checks_current",
					status: "blocked",
					evidenceUse: "orientation",
					blockerCode: "non_claim_support_evidence",
				}),
			]),
		);
	});

	it("blocks derived review-thread truth when unresolved threads remain", () => {
		const input = completeInput({
			reviewThreads: {
				unresolved: 2,
				needsHuman: 1,
				autofixable: 1,
			},
		});

		const result = buildPrCloseoutStatePackets(input, {
			repository: REPOSITORY,
			generatedAt: GENERATED_AT,
			fetchedAt: GENERATED_AT,
		});

		expect(result.reviewStateValidation.valid).toBe(true);
		expect(result.deliveryTruth).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					claim: "review_threads_resolved",
					status: "blocked",
					freshness: "current",
					blockerCode: "review_threads_unresolved",
				}),
			]),
		);
	});
});

function completeInput(
	overrides: Partial<PrCloseoutInput> = {},
): PrCloseoutInput {
	return {
		pullRequest: {
			number: 336,
			title: "Codex runtime evidence verifier cockpit",
			state: "OPEN",
			isDraft: false,
			mergeStateStatus: "CLEAN",
			url: "https://github.com/jscraik/coding-harness/pull/336",
			headSha: HEAD_SHA,
			headRefName: "codex/jsc-363-runtime-evidence",
			baseRefName: "main",
			reviewDecision: "APPROVED",
			body: "Refs JSC-363",
		},
		checks: [
			{
				name: "ci/circleci: test",
				state: "SUCCESS",
				required: true,
				headSha: HEAD_SHA,
				source: "circleci",
			},
			{
				name: "CodeRabbit",
				state: "SUCCESS",
				required: true,
				headSha: HEAD_SHA,
				source: "coderabbit",
			},
		],
		reviewThreads: {
			unresolved: 0,
			needsHuman: 0,
			autofixable: 0,
		},
		linearMutation: "blocked",
		...overrides,
	};
}

function reviewerArtifactProof() {
	return {
		role: "adversarial-reviewer",
		path: "artifacts/reviews/adversarial-reviewer.md",
		expectedProducer: "adversarial-reviewer",
		ownershipClassification: "introduced_by_current_patch" as const,
		receipt: reviewReceipt(),
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
