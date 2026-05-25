import { describe, expect, it } from "vitest";
import type { EvidenceReceipt } from "../evidence/evidence-receipt.js";
import { composeDeliveryTruth } from "./composition.js";
import type { DeliveryTruthClaim, DeliveryTruthEvidence } from "./types.js";

const CURRENT_HEAD = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER_HEAD = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const VERIFIED_AT = "2026-05-25T10:15:00Z";

describe("composeDeliveryTruth", () => {
	it("passes root_surface_tidy only with current claim-support evidence", () => {
		const verdict = composeDeliveryTruth({
			claim: "root_surface_tidy",
			source: "root_hygiene",
			verifiedAt: VERIFIED_AT,
			verdictHeadSha: CURRENT_HEAD,
			evidence: [supportingEvidence({ source: "root_hygiene" })],
		});

		expect(verdict).toMatchObject({
			schemaVersion: "delivery-truth/v1",
			claim: "root_surface_tidy",
			status: "pass",
			evidenceRef: "root-hygiene:classification.json",
			freshness: "current",
			blockerCode: null,
			evidenceUse: "claim_support",
		});
	});

	for (const claim of [
		"root_surface_tidy",
		"goal_ready_for_judge_pm",
		"merge_ready",
	] satisfies DeliveryTruthClaim[]) {
		it(`builds a separate private verdict fixture for ${claim}`, () => {
			const evidence = evidenceForClaim(claim);
			const verdict = composeDeliveryTruth({
				claim,
				source: evidence.source,
				verifiedAt: VERIFIED_AT,
				verdictHeadSha: CURRENT_HEAD,
				evidence: [evidence],
			});

			expect(verdict.claim).toBe(claim);
			expect(verdict.status).toBe("pass");
			expect(verdict.evidenceRefs).toEqual([evidence.receipt.ref]);
		});
	}

	it("refuses missing evidence instead of passing a claim", () => {
		const verdict = composeDeliveryTruth({
			claim: "goal_ready_for_judge_pm",
			source: "pr_closeout",
			verifiedAt: VERIFIED_AT,
			evidence: [],
		});

		expect(verdict).toMatchObject({
			status: "unknown",
			freshness: "missing",
			blockerCode: "missing_evidence",
			evidenceRef: null,
		});
	});

	it("refuses stale, missing, and unknown receipts", () => {
		for (const [freshness, code] of [
			["stale", "stale_evidence"],
			["missing", "missing_evidence"],
			["unknown", "unknown_evidence"],
		] as const) {
			const verdict = composeDeliveryTruth({
				claim: "goal_ready_for_judge_pm",
				source: "pr_closeout",
				verifiedAt: VERIFIED_AT,
				verdictHeadSha: CURRENT_HEAD,
				evidence: [
					supportingEvidence({
						source: "pr_closeout",
						receipt: { freshness, ref: "pr-closeout:judge-pm.json" },
					}),
				],
			});

			expect(verdict.status).toBe("blocked");
			expect(verdict.blockerCode).toBe(code);
			expect(verdict.freshness).toBe(freshness);
		}
	});

	it("refuses orientation-only or audit-only receipts", () => {
		for (const evidenceUse of ["orientation", "audit_trail"] as const) {
			const verdict = composeDeliveryTruth({
				claim: "goal_ready_for_judge_pm",
				source: "pr_closeout",
				verifiedAt: VERIFIED_AT,
				verdictHeadSha: CURRENT_HEAD,
				evidence: [
					supportingEvidence({
						source: "pr_closeout",
						receipt: { evidenceUse, ref: "pr-closeout:judge-pm.json" },
					}),
				],
			});

			expect(verdict.status).toBe("blocked");
			expect(verdict.blockerCode).toBe("non_claim_support_evidence");
			expect(verdict.evidenceUse).toBe(evidenceUse);
		}
	});

	it("maps failed, blocked, and unknown receipts to non-pass verdicts", () => {
		const failed = rootVerdict({ receipt: { status: "fail" } });
		const blocked = rootVerdict({ receipt: { status: "blocked" } });
		const unknown = rootVerdict({ receipt: { status: "unknown" } });

		expect(failed).toMatchObject({
			status: "fail",
			blockerCode: "receipt_failed",
		});
		expect(blocked).toMatchObject({
			status: "blocked",
			blockerCode: "receipt_blocked",
		});
		expect(unknown).toMatchObject({
			status: "blocked",
			blockerCode: "receipt_unknown",
		});
	});

	it("refuses claim-support evidence from unrelated source families", () => {
		const verdict = composeDeliveryTruth({
			claim: "root_surface_tidy",
			source: "runtime_card",
			verifiedAt: VERIFIED_AT,
			verdictHeadSha: CURRENT_HEAD,
			evidence: [supportingEvidence({ source: "runtime_card" })],
		});

		expect(verdict).toMatchObject({
			status: "blocked",
			blockerCode: "unsupported_claim_source",
		});
	});

	it("refuses claim-support evidence with non-actionable refs", () => {
		const verdict = composeDeliveryTruth({
			claim: "root_surface_tidy",
			source: "root_hygiene",
			verifiedAt: VERIFIED_AT,
			verdictHeadSha: CURRENT_HEAD,
			evidence: [
				supportingEvidence({
					source: "root_hygiene",
					receipt: { ref: "n/a" },
				}),
			],
		});

		expect(verdict).toMatchObject({
			status: "blocked",
			blockerCode: "invalid_evidence_ref",
		});
	});

	it("refuses source labels that do not match receipt kind", () => {
		const verdict = composeDeliveryTruth({
			claim: "merge_ready",
			source: "external_state",
			verifiedAt: VERIFIED_AT,
			verdictHeadSha: CURRENT_HEAD,
			evidence: [
				supportingEvidence({
					source: "external_state",
					receipt: { ref: "external-state:pr.json", kind: "artifact" },
				}),
			],
		});

		expect(verdict).toMatchObject({
			status: "blocked",
			blockerCode: "mismatched_source_receipt",
		});
	});

	it("refuses source labels that do not match receipt ref family", () => {
		const verdict = composeDeliveryTruth({
			claim: "goal_ready_for_judge_pm",
			source: "pr_closeout",
			verifiedAt: VERIFIED_AT,
			verdictHeadSha: CURRENT_HEAD,
			evidence: [
				supportingEvidence({
					source: "pr_closeout",
					receipt: { ref: "artifact:judge-pm.json", kind: "artifact" },
				}),
			],
		});

		expect(verdict).toMatchObject({
			status: "blocked",
			blockerCode: "invalid_evidence_ref",
		});
	});

	it("refuses merge_ready when receipt heads are missing or mixed", () => {
		const missingHead = composeDeliveryTruth({
			claim: "merge_ready",
			source: "external_state",
			verifiedAt: VERIFIED_AT,
			verdictHeadSha: CURRENT_HEAD,
			evidence: [
				supportingEvidence({
					source: "external_state",
					receipt: {
						headSha: null,
						ref: "external-state:pr.json",
						kind: "external_state",
					},
				}),
			],
		});
		const mixedHead = composeDeliveryTruth({
			claim: "merge_ready",
			source: "external_state",
			verifiedAt: VERIFIED_AT,
			verdictHeadSha: CURRENT_HEAD,
			evidence: [
				supportingEvidence({
					source: "external_state",
					receipt: {
						headSha: CURRENT_HEAD,
						ref: "external-state:pr.json",
						kind: "external_state",
					},
				}),
				supportingEvidence({
					source: "external_state",
					receipt: {
						headSha: OTHER_HEAD,
						ref: "external-state:checks.json",
						kind: "external_state",
					},
				}),
			],
		});

		expect(missingHead.blockerCode).toBe("missing_head_sha");
		expect(mixedHead.blockerCode).toBe("mixed_head_evidence");
		expect(mixedHead.status).toBe("blocked");
	});

	it("refuses non-merge claims when receipt heads drift from verdict head", () => {
		const verdict = composeDeliveryTruth({
			claim: "goal_ready_for_judge_pm",
			source: "pr_closeout",
			verifiedAt: VERIFIED_AT,
			verdictHeadSha: CURRENT_HEAD,
			evidence: [
				supportingEvidence({
					source: "pr_closeout",
					receipt: {
						headSha: OTHER_HEAD,
						ref: "pr-closeout:judge-pm.json",
					},
				}),
			],
		});

		expect(verdict).toMatchObject({
			status: "blocked",
			blockerCode: "mixed_head_evidence",
		});
	});
});

function rootVerdict(overrides: { receipt?: Partial<EvidenceReceipt> }) {
	return composeDeliveryTruth({
		claim: "root_surface_tidy",
		source: "root_hygiene",
		verifiedAt: VERIFIED_AT,
		verdictHeadSha: CURRENT_HEAD,
		evidence: [supportingEvidence({ source: "root_hygiene", ...overrides })],
	});
}

function evidenceForClaim(claim: DeliveryTruthClaim): DeliveryTruthEvidence {
	switch (claim) {
		case "root_surface_tidy":
			return supportingEvidence({ source: "root_hygiene" });
		case "goal_ready_for_judge_pm":
			return supportingEvidence({
				source: "pr_closeout",
				receipt: { ref: "pr-closeout:judge-pm.json" },
			});
		case "merge_ready":
			return supportingEvidence({
				source: "external_state",
				receipt: { ref: "external-state:pr.json", kind: "external_state" },
			});
	}
}

function supportingEvidence(
	overrides: {
		source?: DeliveryTruthEvidence["source"];
		receipt?: Partial<EvidenceReceipt>;
	} = {},
): DeliveryTruthEvidence {
	return {
		source: overrides.source ?? "root_hygiene",
		receipt: {
			schemaVersion: "evidence-receipt/v1",
			kind: "artifact",
			ref: "root-hygiene:classification.json",
			producer: "delivery-truth-fixture",
			status: "pass",
			freshness: "current",
			evidenceUse: "claim_support",
			blockerClass: null,
			verifiedAt: VERIFIED_AT,
			headSha: CURRENT_HEAD,
			...overrides.receipt,
		},
	};
}
