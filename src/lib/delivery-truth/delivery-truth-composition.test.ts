import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import type { EvidenceReceipt } from "../evidence/evidence-receipt.js";
import {
	classifyGitTrackedRoot,
	policyRootSurfaceEntries,
	rootHygieneGitEnv,
	rootHygieneReceiptRef,
} from "../root-hygiene/index.js";
import type { RootHygieneReport } from "../root-hygiene/types.js";
import { composeDeliveryTruth as composeDeliveryTruthBase } from "./composition.js";
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
			evidenceRef: rootHygieneReceiptRef(),
			freshness: "current",
			blockerCode: null,
			evidenceUse: "claim_support",
		});
	});

	it("passes root_surface_tidy with a trusted classifier receipt", () => {
		const report = rootHygieneClassifierReport();
		const verdict = composeDeliveryTruth({
			claim: "root_surface_tidy",
			source: "root_hygiene",
			verifiedAt: VERIFIED_AT,
			verdictHeadSha: CURRENT_HEAD,
			evidence: [
				supportingEvidence({
					source: "root_hygiene",
					rootHygieneReport: report,
					receipt: {
						...report.receipt,
					},
				}),
			],
		});

		expect(verdict).toMatchObject({
			status: "pass",
			evidenceRef: rootHygieneReceiptRef(),
			blockerCode: null,
		});
	});

	it("trusts verifier-owned root-hygiene reports with missing policy blockers", () => {
		const repoRoot = makeGitRepo(["README.md"]);
		try {
			const report = classifyGitTrackedRoot({
				repoRoot,
				generatedAt: VERIFIED_AT,
				headSha: CURRENT_HEAD,
			});
			const verdict = composeDeliveryTruth({
				claim: "root_surface_tidy",
				source: "root_hygiene",
				verifiedAt: VERIFIED_AT,
				verdictHeadSha: CURRENT_HEAD,
				evidence: [
					supportingEvidence({
						source: "root_hygiene",
						rootHygieneReport: report,
						receipt: { ...report.receipt },
					}),
				],
			});

			expect(report.blockers.some((entry) => entry.path === "AGENTS.md")).toBe(
				true,
			);
			expect(verdict).toMatchObject({
				status: "fail",
				blockerCode: "receipt_failed",
				evidenceRef: rootHygieneReceiptRef(),
			});
		} finally {
			rmSync(repoRoot, { force: true, recursive: true });
		}
	});

	it("passes root_surface_tidy without a verdict head when evidence is trusted", () => {
		const report = rootHygieneClassifierReport();
		const verdict = composeDeliveryTruth({
			claim: "root_surface_tidy",
			source: "root_hygiene",
			verifiedAt: VERIFIED_AT,
			evidence: [
				supportingEvidence({
					source: "root_hygiene",
					rootHygieneReport: report,
					receipt: {
						...report.receipt,
					},
				}),
			],
		});

		expect(verdict).toMatchObject({
			status: "pass",
			blockerCode: null,
		});
	});

	it("refuses root_surface_tidy without repository identity", () => {
		const report = rootHygieneClassifierReport();
		const verdict = composeDeliveryTruthBase({
			claim: "root_surface_tidy",
			source: "root_hygiene",
			verifiedAt: VERIFIED_AT,
			repositoryIdentity: null,
			evidence: [
				supportingEvidence({
					source: "root_hygiene",
					rootHygieneReport: report,
					receipt: {
						...report.receipt,
					},
				}),
			],
		});

		expect(verdict).toMatchObject({
			status: "blocked",
			blockerCode: "missing_repository_identity",
		});
	});

	it("refuses root_surface_tidy evidence replayed from another repository", () => {
		const repoA = makeGitRepo(trackedPathsForPolicyEntries());
		const repoB = makeGitRepo(trackedPathsForPolicyEntries());
		try {
			const reportA = classifyGitTrackedRoot({
				repoRoot: repoA,
				generatedAt: VERIFIED_AT,
				headSha: CURRENT_HEAD,
			});
			const reportB = classifyGitTrackedRoot({
				repoRoot: repoB,
				generatedAt: VERIFIED_AT,
				headSha: CURRENT_HEAD,
			});
			const verdict = composeDeliveryTruthBase({
				claim: "root_surface_tidy",
				source: "root_hygiene",
				verifiedAt: VERIFIED_AT,
				repositoryIdentity: reportB.repository,
				evidence: [
					supportingEvidence({
						source: "root_hygiene",
						rootHygieneReport: reportA,
						receipt: {
							...reportA.receipt,
						},
					}),
				],
			});

			expect(verdict).toMatchObject({
				status: "blocked",
				blockerCode: "repository_identity_mismatch",
			});
		} finally {
			rmSync(repoA, { force: true, recursive: true });
			rmSync(repoB, { force: true, recursive: true });
		}
	});

	it("does not allow post-classification repository identity mutation to bypass replay checks", () => {
		const repoA = makeGitRepo(trackedPathsForPolicyEntries());
		const repoB = makeGitRepo(trackedPathsForPolicyEntries());
		try {
			const reportA = classifyGitTrackedRoot({
				repoRoot: repoA,
				generatedAt: VERIFIED_AT,
				headSha: CURRENT_HEAD,
			});
			const reportB = classifyGitTrackedRoot({
				repoRoot: repoB,
				generatedAt: VERIFIED_AT,
				headSha: CURRENT_HEAD,
			});

			expect(() => {
				(reportA.repository as { digest: string }).digest =
					reportB.repository?.digest ?? "";
			}).toThrow(TypeError);

			const verdict = composeDeliveryTruthBase({
				claim: "root_surface_tidy",
				source: "root_hygiene",
				verifiedAt: VERIFIED_AT,
				repositoryIdentity: reportB.repository,
				evidence: [
					supportingEvidence({
						source: "root_hygiene",
						rootHygieneReport: reportA,
						receipt: {
							...reportA.receipt,
						},
					}),
				],
			});

			expect(verdict).toMatchObject({
				status: "blocked",
				blockerCode: "repository_identity_mismatch",
			});
		} finally {
			rmSync(repoA, { force: true, recursive: true });
			rmSync(repoB, { force: true, recursive: true });
		}
	});

	it("refuses root-hygiene reports with caller-asserted coverage counts", () => {
		const report = rootHygieneClassifierReport();
		const forgedReport: RootHygieneReport = {
			...report,
			coverage: {
				...report.coverage,
				entryCount: report.entries.length + 1,
				valid: true,
			},
		};
		const verdict = composeDeliveryTruth({
			claim: "root_surface_tidy",
			source: "root_hygiene",
			verifiedAt: VERIFIED_AT,
			verdictHeadSha: CURRENT_HEAD,
			evidence: [
				supportingEvidence({
					source: "root_hygiene",
					rootHygieneReport: forgedReport,
					receipt: report.receipt,
				}),
			],
		});

		expect(verdict).toMatchObject({
			status: "blocked",
			blockerCode: "invalid_evidence_ref",
		});
	});

	it("refuses digest-consistent reports not produced by the verifier seam", () => {
		const report = rootHygieneClassifierReport();
		const syntheticReport: RootHygieneReport = {
			...report,
			coverage: { ...report.coverage },
			receipt: { ...report.receipt },
			entries: [...report.entries],
			blockers: [...report.blockers],
			deferredEntries: [...report.deferredEntries],
			summary: { ...report.summary },
		};
		const verdict = composeDeliveryTruth({
			claim: "root_surface_tidy",
			source: "root_hygiene",
			verifiedAt: VERIFIED_AT,
			verdictHeadSha: CURRENT_HEAD,
			evidence: [
				supportingEvidence({
					source: "root_hygiene",
					rootHygieneReport: syntheticReport,
					receipt: report.receipt,
				}),
			],
		});

		expect(verdict).toMatchObject({
			status: "blocked",
			blockerCode: "invalid_evidence_ref",
		});
	});

	it("refuses shape-valid root-hygiene receipts without classifier report proof", () => {
		const verdict = composeDeliveryTruth({
			claim: "root_surface_tidy",
			source: "root_hygiene",
			verifiedAt: VERIFIED_AT,
			verdictHeadSha: CURRENT_HEAD,
			evidence: [
				supportingEvidence({
					source: "root_hygiene",
					rootHygieneReport: null,
					receipt: {
						ref: rootHygieneReceiptRef(),
						producer: "root-hygiene-classifier",
						checksum: "c".repeat(64),
						headSha: CURRENT_HEAD,
					},
				}),
			],
		});

		expect(verdict).toMatchObject({
			status: "blocked",
			blockerCode: "invalid_evidence_ref",
		});
	});

	it("refuses root-hygiene evidence from a mismatched head", () => {
		const report = rootHygieneClassifierReport({ headSha: OTHER_HEAD });
		const verdict = composeDeliveryTruth({
			claim: "root_surface_tidy",
			source: "root_hygiene",
			verifiedAt: VERIFIED_AT,
			verdictHeadSha: CURRENT_HEAD,
			evidence: [
				supportingEvidence({
					source: "root_hygiene",
					rootHygieneReport: report,
					receipt: report.receipt,
				}),
			],
		});

		expect(verdict).toMatchObject({
			status: "blocked",
			blockerCode: "mixed_head_evidence",
		});
	});

	it("refuses document-only root-surface policy refs as claim support", () => {
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
			status: "blocked",
			blockerCode: "invalid_evidence_ref",
		});
	});

	it("refuses root-hygiene receipts that are not bound to a coverage checksum", () => {
		const verdict = composeDeliveryTruth({
			claim: "root_surface_tidy",
			source: "root_hygiene",
			verifiedAt: VERIFIED_AT,
			verdictHeadSha: CURRENT_HEAD,
			evidence: [
				supportingEvidence({
					source: "root_hygiene",
					receipt: {
						ref: rootHygieneReceiptRef(),
						producer: "root-hygiene-classifier",
						checksum: null,
					},
				}),
			],
		});

		expect(verdict).toMatchObject({
			status: "blocked",
			blockerCode: "invalid_evidence_ref",
		});
	});

	it("refuses root-hygiene receipts from an older policy ref", () => {
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
			status: "blocked",
			blockerCode: "invalid_evidence_ref",
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
		const failed = closeoutVerdict({ receipt: { status: "fail" } });
		const blocked = closeoutVerdict({ receipt: { status: "blocked" } });
		const unknown = closeoutVerdict({ receipt: { status: "unknown" } });

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
						ref: rootHygieneReceiptRef(),
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

function composeDeliveryTruth(
	input: Parameters<typeof composeDeliveryTruthBase>[0],
): DeliveryTruthVerdict {
	const repositoryIdentity =
		input.repositoryIdentity !== undefined
			? input.repositoryIdentity
			: repositoryIdentityFromEvidence(input.evidence);
	if (repositoryIdentity === undefined) {
		return composeDeliveryTruthBase(input);
	}
	return composeDeliveryTruthBase({
		...input,
		repositoryIdentity,
	});
}

function repositoryIdentityFromEvidence(
	evidence: readonly DeliveryTruthEvidence[],
): Parameters<typeof composeDeliveryTruthBase>[0]["repositoryIdentity"] {
	return evidence.find((item) => item.source === "root_hygiene")
		?.rootHygieneReport?.repository;
}

function closeoutVerdict(overrides: { receipt?: Partial<EvidenceReceipt> }) {
	return composeDeliveryTruth({
		claim: "goal_ready_for_judge_pm",
		source: "pr_closeout",
		verifiedAt: VERIFIED_AT,
		verdictHeadSha: CURRENT_HEAD,
		evidence: [supportingEvidence({ source: "pr_closeout", ...overrides })],
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
	const report =
		verdict.source === "root_hygiene"
			? rootHygieneClassifierReport({ headSha: verdict.headSha })
			: undefined;
	return supportingEvidence({
		source: verdict.source,
		...(report ? { rootHygieneReport: report } : {}),
		receipt: {
			...(report?.receipt ?? {}),
			kind: kindForSource(verdict.source),
			ref: verdict.evidenceRef ?? "pr-closeout:missing.json",
			freshness: verdict.freshness,
			evidenceUse: verdict.evidenceUse ?? "claim_support",
			headSha: verdict.headSha,
			status: "pass",
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
		rootHygieneReport?: RootHygieneReport | null;
	} = {},
): DeliveryTruthEvidence {
	const source = overrides.source ?? "root_hygiene";
	if (source === "root_hygiene") {
		const report =
			overrides.rootHygieneReport === undefined
				? rootHygieneClassifierReport({
						headSha: overrides.receipt?.headSha ?? CURRENT_HEAD,
					})
				: overrides.rootHygieneReport;
		const evidence: DeliveryTruthEvidence = {
			source,
			receipt: {
				...(report?.receipt ?? defaultReceiptForSource(source)),
				...overrides.receipt,
			},
		};
		if (report) {
			evidence.rootHygieneReport = report;
		}
		return evidence;
	}
	return {
		source,
		receipt: {
			...defaultReceiptForSource(source),
			...overrides.receipt,
		},
	};
}

function defaultReceiptForSource(
	source: DeliveryTruthEvidence["source"],
): EvidenceReceipt {
	switch (source) {
		case "root_hygiene":
			return rootHygieneClassifierReceipt();
		case "external_state":
			return baseReceipt({
				kind: "external_state",
				ref: "external-state:fixture.json",
				producer: "external-state-fixture",
			});
		case "review_state":
			return baseReceipt({
				kind: "review_artifact",
				ref: "review-state:fixture.json",
				producer: "review-state-fixture",
			});
		case "runtime_card":
			return baseReceipt({
				kind: "runtime_card",
				ref: "runtime-card:fixture.json",
				producer: "runtime-card-fixture",
			});
		case "validation":
			return baseReceipt({
				kind: "validation",
				ref: "validation:fixture.json",
				producer: "validation-fixture",
			});
		case "pr_closeout":
			return baseReceipt({
				kind: "artifact",
				ref: "pr-closeout:fixture.json",
				producer: "pr-closeout-fixture",
			});
	}
}

function rootHygieneClassifierReceipt(
	overrides: Partial<EvidenceReceipt> = {},
): EvidenceReceipt {
	return {
		...rootHygieneClassifierReport().receipt,
		...overrides,
	};
}

function rootHygieneClassifierReport(
	input: { headSha?: string | null } = {},
): RootHygieneReport {
	const repoRoot = makeGitRepo(trackedPathsForPolicyEntries());
	try {
		return classifyGitTrackedRoot({
			repoRoot,
			generatedAt: VERIFIED_AT,
			headSha: input.headSha ?? CURRENT_HEAD,
		});
	} finally {
		rmSync(repoRoot, { force: true, recursive: true });
	}
}

function makeGitRepo(trackedPaths: readonly string[]): string {
	const repoRoot = mkdtempSync(join(tmpdir(), "delivery-truth-root-"));
	execFileSync("git", ["init"], {
		cwd: repoRoot,
		env: rootHygieneGitEnv(),
		stdio: "ignore",
	});
	for (const trackedPath of trackedPaths) {
		const absolutePath = join(repoRoot, trackedPath);
		mkdirSync(dirname(absolutePath), { recursive: true });
		writeFileSync(absolutePath, "tracked\n");
	}
	execFileSync("git", ["add", "-A"], {
		cwd: repoRoot,
		env: rootHygieneGitEnv(),
		stdio: "ignore",
	});
	return repoRoot;
}

function trackedPathsForPolicyEntries(): string[] {
	return policyRootSurfaceEntries().map((entry) =>
		entry.kind === "directory"
			? `${entry.path}/.tracked-root-placeholder`
			: entry.path,
	);
}

function baseReceipt(overrides: Partial<EvidenceReceipt>): EvidenceReceipt {
	return {
		schemaVersion: "evidence-receipt/v1",
		kind: "artifact",
		ref: "artifact:fixture.json",
		producer: "delivery-truth-fixture",
		status: "pass",
		freshness: "current",
		evidenceUse: "claim_support",
		blockerClass: null,
		verifiedAt: VERIFIED_AT,
		headSha: CURRENT_HEAD,
		...overrides,
	};
}
