import { describe, expect, it } from "vitest";
import type { EvidenceReceipt } from "../evidence/evidence-receipt.js";
import { composeDeliveryTruth } from "./composition.js";
import type { DeliveryTruthEvidence } from "./types.js";

const HEAD_SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER_HEAD = "cccccccccccccccccccccccccccccccccccccccc";
const VERIFIED_AT = "2026-05-25T10:15:00Z";

describe("delivery-truth verifier freshness policy", () => {
	it("lets the verifier policy override producer TTL claims", () => {
		const verdict = composeDeliveryTruth({
			claim: "merge_ready",
			source: "external_state",
			verifiedAt: VERIFIED_AT,
			verdictHeadSha: HEAD_SHA,
			verifierTtlSeconds: 300,
			evidence: [
				evidence({
					producerTtlSeconds: 3600,
				}),
			],
		});

		expect(verdict).toMatchObject({
			status: "blocked",
			freshness: "stale",
			blockerCode: "producer_ttl_exceeds_verifier_policy",
		});
	});

	it("refuses evidence when fetchedAt is newer than verifiedAt", () => {
		const verdict = composeDeliveryTruth({
			claim: "merge_ready",
			source: "external_state",
			verifiedAt: "2026-05-25T10:20:00Z",
			verdictHeadSha: HEAD_SHA,
			evidence: [
				evidence({
					fetchedAt: "2026-05-25T10:16:00Z",
					receipt: { verifiedAt: "2026-05-25T10:15:00Z" },
				}),
			],
		});

		expect(verdict.status).toBe("blocked");
		expect(verdict.blockerCode).toBe("fetched_at_after_verified_at");
	});

	it("refuses malformed verifier policy timestamps", () => {
		const badVerdictTimestamp = composeDeliveryTruth({
			claim: "merge_ready",
			source: "external_state",
			verifiedAt: "2026/05/25 10:20",
			verdictHeadSha: HEAD_SHA,
			evidence: [evidence()],
		});
		const badFetchedAt = composeDeliveryTruth({
			claim: "merge_ready",
			source: "external_state",
			verifiedAt: VERIFIED_AT,
			verdictHeadSha: HEAD_SHA,
			evidence: [evidence({ fetchedAt: "2026/05/25 10:15" })],
		});

		expect(badVerdictTimestamp.blockerCode).toBe("invalid_policy_timestamp");
		expect(badFetchedAt.blockerCode).toBe("invalid_policy_timestamp");
	});

	it("refuses claim support when recomputed head SHA conflicts with receipt head", () => {
		const verdict = composeDeliveryTruth({
			claim: "merge_ready",
			source: "external_state",
			verifiedAt: VERIFIED_AT,
			verdictHeadSha: HEAD_SHA,
			evidence: [
				evidence({
					recomputedHeadSha: OTHER_HEAD,
				}),
			],
		});

		expect(verdict.status).toBe("blocked");
		expect(verdict.freshness).toBe("stale");
		expect(verdict.blockerCode).toBe("head_sha_recomputed_mismatch");
	});

	it("passes when producer and verifier freshness policy agree", () => {
		const verdict = composeDeliveryTruth({
			claim: "merge_ready",
			source: "external_state",
			verifiedAt: VERIFIED_AT,
			verdictHeadSha: HEAD_SHA,
			verifierTtlSeconds: 300,
			evidence: [
				evidence({
					producerTtlSeconds: 120,
					fetchedAt: "2026-05-25T10:14:00Z",
					recomputedHeadSha: HEAD_SHA,
				}),
			],
		});

		expect(verdict).toMatchObject({
			status: "pass",
			freshness: "current",
			blockerCode: null,
		});
	});
});

function evidence(
	overrides: {
		producerTtlSeconds?: number;
		fetchedAt?: string;
		recomputedHeadSha?: string;
		receipt?: Partial<EvidenceReceipt>;
	} = {},
): DeliveryTruthEvidence {
	return {
		source: "external_state",
		...(overrides.producerTtlSeconds !== undefined
			? { producerTtlSeconds: overrides.producerTtlSeconds }
			: {}),
		...(overrides.fetchedAt ? { fetchedAt: overrides.fetchedAt } : {}),
		...(overrides.recomputedHeadSha
			? { recomputedHeadSha: overrides.recomputedHeadSha }
			: {}),
		receipt: {
			schemaVersion: "evidence-receipt/v1",
			kind: "external_state",
			ref: "external-state:fixture.json",
			producer: "external-state-fixture",
			status: "pass",
			freshness: "current",
			evidenceUse: "claim_support",
			blockerClass: null,
			verifiedAt: VERIFIED_AT,
			headSha: HEAD_SHA,
			...overrides.receipt,
		},
	};
}
