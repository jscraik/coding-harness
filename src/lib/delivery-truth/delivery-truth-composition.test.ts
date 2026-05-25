import { describe, expect, it } from "vitest";
import type { EvidenceReceipt } from "../evidence/evidence-receipt.js";
import { composeDeliveryTruth } from "./composition.js";
import type {
	DeliveryTruthClaim,
	DeliveryTruthEvidence,
	DeliveryTruthVerdict,
} from "./types.js";

const CURRENT_HEAD = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER_HEAD = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const VERIFIED_AT = "2026-05-25T10:15:00Z";
type CloseoutPhrase = "green" | "tidy" | "delivered" | "merged" | "ready";

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
			evidenceRef:
				"root-hygiene:docs/architecture/root-surface-classification.md",
			freshness: "current",
			blockerCode: null,
			evidenceUse: "claim_support",
		});
	});

	it("passes root_surface_tidy with a trusted classifier receipt", () => {
		const verdict = composeDeliveryTruth({
			claim: "root_surface_tidy",
			source: "root_hygiene",
			verifiedAt: VERIFIED_AT,
			verdictHeadSha: CURRENT_HEAD,
			evidence: [
				supportingEvidence({
					source: "root_hygiene",
					receipt: {
						ref: "root-hygiene:root-hygiene-classification/v1",
						producer: "root-hygiene-classifier",
					},
				}),
			],
		});

		expect(verdict).toMatchObject({
			status: "pass",
			evidenceRef: "root-hygiene:root-hygiene-classification/v1",
			blockerCode: null,
		});
	});

	it("keeps the canonical root-surface classification doc as a trusted receipt ref", () => {
		const verdict = composeDeliveryTruth({
			claim: "root_surface_tidy",
			source: "root_hygiene",
			verifiedAt: VERIFIED_AT,
			verdictHeadSha: CURRENT_HEAD,
			evidence: [
				supportingEvidence({
					source: "root_hygiene",
					receipt: {
						ref: "root-hygiene:docs/architecture/root-surface-classification.md",
						producer: "delivery-truth-fixture",
					},
				}),
			],
		});

		expect(verdict).toMatchObject({
			status: "pass",
			evidenceRef:
				"root-hygiene:docs/architecture/root-surface-classification.md",
			blockerCode: null,
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
				source: sourceForClaim(claim),
				verifiedAt: VERIFIED_AT,
				verdictHeadSha: CURRENT_HEAD,
				evidence,
			});

			expect(verdict.claim).toBe(claim);
			expect(verdict.status).toBe("pass");
			expect(verdict.evidenceRefs).toEqual(
				evidence.map((item) => item.receipt.ref),
			);
		});
	}

	it("requires separate current evidence families before passing merge_ready", () => {
		const verdict = composeDeliveryTruth({
			claim: "merge_ready",
			source: "external_state",
			verifiedAt: VERIFIED_AT,
			verdictHeadSha: CURRENT_HEAD,
			evidence: [
				externalStateEvidence("external-state:pr.json"),
				reviewStateEvidence("review-state:threads.json"),
				prCloseoutEvidence("pr-closeout:merge-readiness.json"),
			],
		});

		expect(verdict).toMatchObject({
			status: "pass",
			blockerCode: null,
			freshness: "current",
		});
		expect(verdict.evidenceRefs).toEqual([
			"external-state:pr.json",
			"review-state:threads.json",
			"pr-closeout:merge-readiness.json",
		]);
	});

	it("refuses one blended readiness receipt for merge_ready", () => {
		const verdict = composeDeliveryTruth({
			claim: "merge_ready",
			source: "pr_closeout",
			verifiedAt: VERIFIED_AT,
			verdictHeadSha: CURRENT_HEAD,
			evidence: [prCloseoutEvidence("pr-closeout:blended-ready.json")],
		});

		expect(verdict).toMatchObject({
			status: "blocked",
			statusLabel: "merge_ready blocked: missing_separate_evidence",
			freshness: "missing",
			blockerCode: "missing_separate_evidence",
			blockerRefs: ["pr-closeout:blended-ready.json"],
		});
	});

	it("requires each merge_ready evidence family independently", () => {
		const requiredEvidence = [
			externalStateEvidence("external-state:pr.json"),
			reviewStateEvidence("review-state:threads.json"),
			prCloseoutEvidence("pr-closeout:merge-readiness.json"),
		];

		for (const omittedSource of [
			"external_state",
			"review_state",
			"pr_closeout",
		] satisfies DeliveryTruthEvidence["source"][]) {
			const evidence = requiredEvidence.filter(
				(item) => item.source !== omittedSource,
			);
			const verdict = composeDeliveryTruth({
				claim: "merge_ready",
				source: "external_state",
				verifiedAt: VERIFIED_AT,
				verdictHeadSha: CURRENT_HEAD,
				evidence,
			});

			expect(verdict).toMatchObject({
				status: "blocked",
				freshness: "missing",
				blockerCode: "missing_separate_evidence",
			});
			expect(verdict.evidenceRefs).toEqual(
				evidence.map((item) => item.receipt.ref),
			);
		}
	});

	it("downgrades closeout language when required claim-support verdicts are absent or stale", () => {
		for (const phrase of [
			"green",
			"tidy",
			"delivered",
			"merged",
			"ready",
		] as const) {
			const missing = closeoutLanguageVerdict(phrase, []);
			const stale = closeoutLanguageVerdict(phrase, [
				staleVerdictForCloseoutPhrase(phrase),
			]);
			const mismatchedHeadBacking =
				mismatchedHeadVerdictForCloseoutPhrase(phrase);
			const mismatchedHead = closeoutLanguageVerdict(phrase, [
				mismatchedHeadBacking,
			]);
			const orientationOnly = closeoutLanguageVerdict(phrase, [
				orientationOnlyVerdictForCloseoutPhrase(phrase),
			]);

			expect(missing.status).not.toBe("pass");
			expect(missing.statusLabel).toContain("missing_evidence");
			expect(stale.status).toBe("blocked");
			expect(stale.statusLabel).toContain("stale_evidence");
			expect(mismatchedHeadBacking.statusLabel).toContain(
				"mixed_head_evidence",
			);
			expect(mismatchedHead.status).toBe("blocked");
			expect(mismatchedHead.status).not.toBe("pass");
			expect(orientationOnly.status).toBe("blocked");
			expect(orientationOnly.statusLabel).toContain(
				"non_claim_support_evidence",
			);
		}
	});

	it("refuses missing evidence instead of passing a claim", () => {
		const verdict = composeDeliveryTruth({
			claim: "goal_ready_for_judge_pm",
			source: "pr_closeout",
			verifiedAt: VERIFIED_AT,
			evidence: [],
		});

		expect(verdict).toMatchObject({
			status: "unknown",
			statusLabel: "goal_ready_for_judge_pm unknown: missing_evidence",
			freshness: "missing",
			blockerCode: "missing_evidence",
			evidenceRef: null,
			blockerRefs: [],
		});
	});

	it("emits textual status labels and blocker refs for operator-facing verdicts", () => {
		const verdict = composeDeliveryTruth({
			claim: "goal_ready_for_judge_pm",
			source: "pr_closeout",
			verifiedAt: VERIFIED_AT,
			verdictHeadSha: CURRENT_HEAD,
			evidence: [
				supportingEvidence({
					source: "pr_closeout",
					receipt: {
						freshness: "stale",
						ref: "pr-closeout:judge-pm.json",
					},
				}),
			],
		});

		expect(verdict).toMatchObject({
			status: "blocked",
			statusLabel: "goal_ready_for_judge_pm blocked: stale_evidence",
			blockerCode: "stale_evidence",
			blockerRefs: ["pr-closeout:judge-pm.json"],
		});
		expect(verdict.statusLabel).toMatch(/blocked/);
		expect(verdict.statusLabel).not.toMatch(/[✓✗🟢🔴]/u);
	});

	it("does not echo unsafe raw prompts, secrets, credentials, or bulky payloads through verdict refs", () => {
		const secretRef =
			"runtime-card:raw prompt: token=sk-1234567890abcdef1234567890abcdef";
		const verdict = composeDeliveryTruth({
			claim: "goal_ready_for_judge_pm",
			source: "pr_closeout",
			verifiedAt: VERIFIED_AT,
			verdictHeadSha: CURRENT_HEAD,
			evidence: [
				supportingEvidence({
					source: "pr_closeout",
					receipt: {
						ref: secretRef,
						producer: "credential=top-secret",
					},
				}),
			],
		});
		const serialized = JSON.stringify(verdict);

		expect(verdict).toMatchObject({
			status: "blocked",
			statusLabel: "goal_ready_for_judge_pm blocked: invalid_receipt",
			blockerCode: "invalid_receipt",
			evidenceRef: null,
			evidenceRefs: [],
			blockerRefs: [],
		});
		expect(serialized).not.toContain("sk-1234567890abcdef1234567890abcdef");
		expect(serialized).not.toContain("top-secret");
		expect(serialized).not.toContain("raw prompt");
	});

	it("keeps large mixed evidence arrays deterministic without leaking unsafe refs", () => {
		const staleRef = "pr-closeout:stale-24.json";
		const secretRef =
			"pr-closeout:raw prompt token=sk-1234567890abcdef1234567890abcdef";
		const evidence = [
			...Array.from({ length: 24 }, (_, index) =>
				supportingEvidence({
					source: "pr_closeout",
					receipt: { ref: `pr-closeout:current-${index}.json` },
				}),
			),
			supportingEvidence({
				source: "pr_closeout",
				receipt: { freshness: "stale", ref: staleRef },
			}),
			supportingEvidence({
				source: "pr_closeout",
				receipt: { ref: secretRef, producer: "credential=top-secret" },
			}),
		];

		const verdict = composeDeliveryTruth({
			claim: "goal_ready_for_judge_pm",
			source: "pr_closeout",
			verifiedAt: VERIFIED_AT,
			verdictHeadSha: CURRENT_HEAD,
			evidence,
		});
		const serialized = JSON.stringify(verdict);

		expect(verdict).toMatchObject({
			status: "blocked",
			statusLabel: "goal_ready_for_judge_pm blocked: stale_evidence",
			blockerCode: "stale_evidence",
			evidenceRef: staleRef,
			blockerRefs: [staleRef],
		});
		expect(verdict.evidenceRefs).toHaveLength(25);
		expect(verdict.evidenceRefs.at(-1)).toBe(staleRef);
		expect(serialized).not.toContain("sk-1234567890abcdef1234567890abcdef");
		expect(serialized).not.toContain("top-secret");
		expect(serialized).not.toContain("raw prompt");
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

	it("refuses loose root-hygiene artifact refs for root_surface_tidy", () => {
		const verdict = composeDeliveryTruth({
			claim: "root_surface_tidy",
			source: "root_hygiene",
			verifiedAt: VERIFIED_AT,
			verdictHeadSha: CURRENT_HEAD,
			evidence: [
				supportingEvidence({
					source: "root_hygiene",
					receipt: { ref: "root-hygiene:classification.json" },
				}),
			],
		});

		expect(verdict).toMatchObject({
			status: "blocked",
			blockerCode: "invalid_evidence_ref",
		});
	});

	it("refuses unknown-provenance root-hygiene classifier refs", () => {
		const verdict = composeDeliveryTruth({
			claim: "root_surface_tidy",
			source: "root_hygiene",
			verifiedAt: VERIFIED_AT,
			verdictHeadSha: CURRENT_HEAD,
			evidence: [
				supportingEvidence({
					source: "root_hygiene",
					receipt: {
						ref: "root-hygiene:root-hygiene-classification/v1",
						producer: "delivery-truth-fixture",
					},
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
				reviewStateEvidence("review-state:threads.json"),
				prCloseoutEvidence("pr-closeout:merge-readiness.json"),
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
				reviewStateEvidence("review-state:threads.json"),
				prCloseoutEvidence("pr-closeout:merge-readiness.json"),
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

function evidenceForClaim(
	claim: DeliveryTruthClaim,
): readonly DeliveryTruthEvidence[] {
	switch (claim) {
		case "root_surface_tidy":
			return [supportingEvidence({ source: "root_hygiene" })];
		case "goal_ready_for_judge_pm":
			return [prCloseoutEvidence("pr-closeout:judge-pm.json")];
		case "merge_ready":
			return [
				externalStateEvidence("external-state:pr.json"),
				reviewStateEvidence("review-state:threads.json"),
				prCloseoutEvidence("pr-closeout:merge-readiness.json"),
			];
	}
}

function sourceForClaim(
	claim: DeliveryTruthClaim,
): DeliveryTruthEvidence["source"] {
	switch (claim) {
		case "root_surface_tidy":
			return "root_hygiene";
		case "goal_ready_for_judge_pm":
			return "pr_closeout";
		case "merge_ready":
			return "external_state";
	}
}

function closeoutLanguageVerdict(
	phrase: CloseoutPhrase,
	verdicts: readonly DeliveryTruthVerdict[],
): DeliveryTruthVerdict {
	const claim = claimForCloseoutPhrase(phrase);
	const verdict = verdicts.find((item) => item.claim === claim);
	if (verdict?.status === "pass" && verdict.freshness === "current") {
		return verdict;
	}
	return composeDeliveryTruth({
		claim,
		source: sourceForCloseoutPhrase(phrase),
		verifiedAt: VERIFIED_AT,
		verdictHeadSha: CURRENT_HEAD,
		evidence: verdict ? [evidenceFromVerdict(verdict)] : [],
	});
}

function claimForCloseoutPhrase(phrase: CloseoutPhrase): DeliveryTruthClaim {
	switch (phrase) {
		case "tidy":
			return "root_surface_tidy";
		case "merged":
		case "ready":
			return "merge_ready";
		case "green":
		case "delivered":
			return "goal_ready_for_judge_pm";
	}
}

function sourceForCloseoutPhrase(
	phrase: CloseoutPhrase,
): DeliveryTruthEvidence["source"] {
	switch (phrase) {
		case "tidy":
			return "root_hygiene";
		case "merged":
		case "ready":
			return "external_state";
		case "green":
		case "delivered":
			return "pr_closeout";
	}
}

function staleVerdictForCloseoutPhrase(
	phrase: CloseoutPhrase,
): DeliveryTruthVerdict {
	return closeoutVerdictFromEvidence(
		phrase,
		evidenceForCloseoutPhrase(phrase, { freshness: "stale" }),
	);
}

function mismatchedHeadVerdictForCloseoutPhrase(
	phrase: CloseoutPhrase,
): DeliveryTruthVerdict {
	return closeoutVerdictFromEvidence(
		phrase,
		evidenceForCloseoutPhrase(phrase, { headSha: OTHER_HEAD }),
	);
}

function orientationOnlyVerdictForCloseoutPhrase(
	phrase: CloseoutPhrase,
): DeliveryTruthVerdict {
	return closeoutVerdictFromEvidence(
		phrase,
		evidenceForCloseoutPhrase(phrase, { evidenceUse: "orientation" }),
	);
}

function closeoutVerdictFromEvidence(
	phrase: CloseoutPhrase,
	evidence: readonly DeliveryTruthEvidence[],
): DeliveryTruthVerdict {
	return composeDeliveryTruth({
		claim: claimForCloseoutPhrase(phrase),
		source: sourceForCloseoutPhrase(phrase),
		verifiedAt: VERIFIED_AT,
		verdictHeadSha: CURRENT_HEAD,
		evidence,
	});
}

function evidenceForCloseoutPhrase(
	phrase: CloseoutPhrase,
	receipt: Partial<EvidenceReceipt>,
): readonly DeliveryTruthEvidence[] {
	switch (phrase) {
		case "tidy":
			return [supportingEvidence({ source: "root_hygiene", receipt })];
		case "merged":
		case "ready":
			return [
				externalStateEvidence("external-state:pr.json", receipt),
				reviewStateEvidence("review-state:threads.json"),
				prCloseoutEvidence("pr-closeout:merge-readiness.json"),
			];
		case "green":
		case "delivered":
			return [prCloseoutEvidence("pr-closeout:judge-pm.json", receipt)];
	}
}

function evidenceFromVerdict(
	verdict: DeliveryTruthVerdict,
): DeliveryTruthEvidence {
	return supportingEvidence({
		source: verdict.source,
		receipt: {
			kind: kindForSource(verdict.source),
			ref: verdict.evidenceRef ?? "pr-closeout:missing.json",
			freshness: verdict.freshness,
			evidenceUse: verdict.evidenceUse ?? "claim_support",
			headSha: verdict.headSha,
			status: verdict.status,
		},
	});
}

function kindForSource(
	source: DeliveryTruthEvidence["source"],
): EvidenceReceipt["kind"] {
	switch (source) {
		case "external_state":
			return "external_state";
		case "review_state":
			return "review_artifact";
		case "runtime_card":
			return "runtime_card";
		case "validation":
			return "validation";
		case "root_hygiene":
		case "pr_closeout":
			return "artifact";
	}
}

function externalStateEvidence(
	ref: string,
	receipt: Partial<EvidenceReceipt> = {},
): DeliveryTruthEvidence {
	return supportingEvidence({
		source: "external_state",
		receipt: { ref, kind: "external_state", ...receipt },
	});
}

function reviewStateEvidence(
	ref: string,
	receipt: Partial<EvidenceReceipt> = {},
): DeliveryTruthEvidence {
	return supportingEvidence({
		source: "review_state",
		receipt: { ref, kind: "review_artifact", ...receipt },
	});
}

function prCloseoutEvidence(
	ref: string,
	receipt: Partial<EvidenceReceipt> = {},
): DeliveryTruthEvidence {
	return supportingEvidence({
		source: "pr_closeout",
		receipt: { ref, ...receipt },
	});
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
			ref: "root-hygiene:docs/architecture/root-surface-classification.md",
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
