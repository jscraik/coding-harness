import { describe, expect, it } from "vitest";
import type {
	PrCloseoutBlocker,
	PrCloseoutClaim,
	PrCloseoutDeliveryTruthSummary,
	PrCloseoutInput,
} from "./types.js";
import { buildLifecycleSnapshot } from "./lifecycle-snapshot.js";

const GENERATED_AT = "2026-05-31T00:00:00.000Z";
const HEAD_SHA = "abc123";

const BASE_INPUT: PrCloseoutInput = {
	pullRequest: {
		number: 322,
		headSha: HEAD_SHA,
	},
	branch: {
		headSha: HEAD_SHA,
	},
};

const EMPTY_DELIVERY_TRUTH: PrCloseoutDeliveryTruthSummary = {
	present: false,
	verdicts: [],
	blockingVerdicts: [],
	mergeReady: null,
};

function claim(
	partial: Pick<PrCloseoutClaim, "claim" | "status" | "evidenceRef"> &
		Partial<PrCloseoutClaim>,
): PrCloseoutClaim {
	return {
		source: "review",
		headSha: HEAD_SHA,
		freshness: "current",
		blockerClass: null,
		missingContext: null,
		verifiedAt: GENERATED_AT,
		...partial,
	};
}

function blocker(partial: Partial<PrCloseoutBlocker> = {}): PrCloseoutBlocker {
	return {
		surface: "review",
		classification: "introduced",
		reason: "Review lane blocker.",
		fixableByCodex: true,
		ref: "review:blocker",
		...partial,
	};
}

describe("buildLifecycleSnapshot", () => {
	it("uses the worst claim evidence for failed lane handoff references", () => {
		const snapshot = buildLifecycleSnapshot({
			input: BASE_INPUT,
			claims: [
				claim({
					claim: "review_threads_resolved",
					status: "pass",
					evidenceRef: "github:reviewThreads",
				}),
				claim({
					claim: "independent_review_status_known",
					status: "fail",
					evidenceRef: "github:reviewDecision",
				}),
			],
			blockers: [],
			deliveryTruth: EMPTY_DELIVERY_TRUTH,
			generatedAt: GENERATED_AT,
			reportStatus: "fixable",
			nextAction: "codex_can_fix_now",
		});

		const reviewLane = snapshot.lanes.find(
			(lane) => lane.lane === "review_state",
		);

		expect(reviewLane).toMatchObject({
			status: "fail",
			evidenceRef: "github:reviewDecision",
		});
		expect(snapshot.handoffRequiredEvidence).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					lane: "review_state",
					evidenceRef: "github:reviewDecision",
				}),
			]),
		);
	});

	it("uses freshness as the evidence tie-breaker for same-status lane claims", () => {
		const snapshot = buildLifecycleSnapshot({
			input: BASE_INPUT,
			claims: [
				claim({
					claim: "review_threads_resolved",
					status: "unknown",
					freshness: "current",
					evidenceRef: "github:reviewThreads",
				}),
				claim({
					claim: "independent_review_status_known",
					status: "unknown",
					freshness: "stale",
					evidenceRef: "github:reviewDecision",
				}),
			],
			blockers: [],
			deliveryTruth: EMPTY_DELIVERY_TRUTH,
			generatedAt: GENERATED_AT,
			reportStatus: "fixable",
			nextAction: "codex_can_fix_now",
		});

		expect(
			snapshot.lanes.find((lane) => lane.lane === "review_state"),
		).toMatchObject({
			status: "unknown",
			freshness: "stale",
			evidenceRef: "github:reviewDecision",
		});
	});

	it("keeps explicit blocker refs ahead of claim refs for blocked lanes", () => {
		const snapshot = buildLifecycleSnapshot({
			input: BASE_INPUT,
			claims: [
				claim({
					claim: "review_threads_resolved",
					status: "fail",
					evidenceRef: "github:reviewThreads",
				}),
			],
			blockers: [blocker({ ref: "review:blocker" })],
			deliveryTruth: EMPTY_DELIVERY_TRUTH,
			generatedAt: GENERATED_AT,
			reportStatus: "fixable",
			nextAction: "codex_can_fix_now",
		});

		expect(
			snapshot.lanes.find((lane) => lane.lane === "review_state"),
		).toMatchObject({
			status: "fail",
			evidenceRef: "review:blocker",
		});
		expect(snapshot.handoffRequiredEvidence).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					lane: "review_state",
					evidenceRef: "review:blocker",
				}),
			]),
		);
	});
});
