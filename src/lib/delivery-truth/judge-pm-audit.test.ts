import { describe, expect, it } from "vitest";
import type { EvidenceReceipt } from "../evidence/evidence-receipt.js";
import type { EvidenceReceiptKind } from "../evidence/evidence-receipt.js";
import {
	buildJudgePmAuditPacket,
	buildJudgePmAuditVerdict,
} from "./judge-pm-audit.js";
import type {
	JudgePmAuditIssueAuthorityMap,
	JudgePmAuditReviewerArtifact,
	JudgePmAuditVerdictInput,
} from "./judge-pm-audit.js";
import type {
	DeliveryTruthClaim,
	DeliveryTruthSource,
	DeliveryTruthVerdict,
} from "./types.js";

const HEAD = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER_HEAD = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const VERIFIED_AT = "2026-05-26T15:52:34Z";
const REQUIRED_ROLES = [
	"adversarial-reviewer",
	"agent-native-reviewer",
] as const;

describe("buildJudgePmAuditVerdict", () => {
	it("passes only when required reviewers, issue authority, and supporting verdicts are current", () => {
		const verdict = buildJudgePmAuditVerdict(baseInput());
		const packet = buildJudgePmAuditPacket(baseInput());

		expect(verdict).toMatchObject({
			schemaVersion: "delivery-truth/v1",
			claim: "goal_ready_for_judge_pm",
			status: "pass",
			freshness: "current",
			blockerCode: null,
			evidenceRef: "pr-closeout:judge-pm-audit.json",
			evidenceUse: "claim_support",
		});
		expect(packet).toMatchObject({
			schemaVersion: "judge-pm-audit/v1",
			status: "pass",
			reviewerRoles: {
				required: [...REQUIRED_ROLES],
				missing: [],
			},
			issueAuthority: {
				status: "pass",
				evidenceRef: "linear:JSC-363",
			},
		});
	});

	it("fails closed when a required reviewer artifact role is absent", () => {
		const verdict = buildJudgePmAuditVerdict(
			baseInput({
				reviewerArtifacts: [reviewerArtifact("adversarial-reviewer")],
			}),
		);

		expect(verdict).toMatchObject({
			status: "blocked",
			freshness: "missing",
			blockerCode: "missing_reviewer_artifact",
			blockerRefs: ["review-state:agent-native-reviewer"],
		});
	});

	it("fails closed when reviewer artifact proof is present but not admissible", () => {
		const verdict = buildJudgePmAuditVerdict(
			baseInput({
				reviewerArtifacts: [
					reviewerArtifact("adversarial-reviewer"),
					reviewerArtifact("agent-native-reviewer", {
						receipt: { sizeBytes: 0 },
					}),
				],
			}),
		);

		expect(verdict).toMatchObject({
			status: "blocked",
			freshness: "missing",
			blockerCode: "reviewer_artifact_empty",
			blockerRefs: ["review-state:artifacts/reviews/agent-native-reviewer.md"],
		});
	});

	it("accepts multiple runtime-card receipt refs under the canonical slot", () => {
		const verdict = buildJudgePmAuditVerdict(
			baseInput({
				runtimeCardRefs: [
					auditSurface("runtime-card", "runtime_card", {
						ref: "runtime-card:main",
					}),
					auditSurface("runtime-card", "runtime_card", {
						ref: "runtime-card:fallback",
					}),
				],
			}),
		);

		expect(verdict).toMatchObject({
			status: "pass",
			freshness: "current",
		});
	});

	it("preserves reviewer-specific blockers for stale reviewer artifacts", () => {
		const verdict = buildJudgePmAuditVerdict(
			baseInput({
				reviewerArtifacts: [
					reviewerArtifact("adversarial-reviewer"),
					reviewerArtifact("agent-native-reviewer", {
						receipt: { freshness: "stale" },
					}),
				],
			}),
		);

		expect(verdict).toMatchObject({
			status: "blocked",
			freshness: "stale",
			blockerCode: "reviewer_artifact_stale",
			blockerRefs: ["review-state:artifacts/reviews/agent-native-reviewer.md"],
		});
	});

	it("preserves reviewer-specific blockers for non-claim-supporting reviewer artifacts", () => {
		const verdict = buildJudgePmAuditVerdict(
			baseInput({
				reviewerArtifacts: [
					reviewerArtifact("adversarial-reviewer"),
					reviewerArtifact("agent-native-reviewer", {
						receipt: { evidenceUse: "orientation" },
					}),
				],
			}),
		);

		expect(verdict).toMatchObject({
			status: "blocked",
			freshness: "unknown",
			blockerCode: "reviewer_artifact_not_claim_supporting",
			blockerRefs: ["review-state:artifacts/reviews/agent-native-reviewer.md"],
		});
	});

	it("fails closed when required audit surfaces are missing or stale", () => {
		const missingRuntimeCard = buildJudgePmAuditVerdict(
			baseInput({ runtimeCardRefs: [] }),
		);
		const staleExternalState = buildJudgePmAuditVerdict(
			baseInput({
				externalStateRef: auditSurface("external-state", "external_state", {
					freshness: "stale",
				}),
			}),
		);

		expect(missingRuntimeCard).toMatchObject({
			status: "blocked",
			freshness: "missing",
			blockerCode: "missing_audit_surface",
		});
		expect(staleExternalState).toMatchObject({
			status: "blocked",
			freshness: "stale",
			blockerCode: "stale_audit_surface",
			blockerRefs: ["external-state:external-state"],
		});
	});

	it("fails closed when an audit surface receipt uses the wrong namespace", () => {
		const verdict = buildJudgePmAuditVerdict(
			baseInput({
				rootHygieneRef: auditSurface("root-hygiene", "artifact", {
					ref: "artifact:root-hygiene",
				}),
			}),
		);

		expect(verdict).toMatchObject({
			status: "blocked",
			freshness: "unknown",
			blockerCode: "invalid_audit_surface",
			blockerRefs: ["artifact:root-hygiene"],
		});
	});

	it("fails closed when an audit surface receipt uses the right namespace for the wrong surface", () => {
		const verdict = buildJudgePmAuditVerdict(
			baseInput({
				rootHygieneRef: auditSurface("root-hygiene", "artifact", {
					ref: "root-hygiene:unrelated",
				}),
			}),
		);

		expect(verdict).toMatchObject({
			status: "blocked",
			freshness: "unknown",
			blockerCode: "invalid_audit_surface",
			blockerRefs: ["root-hygiene:unrelated"],
		});
	});

	it("fails closed when an audit surface spoofs the required slot name", () => {
		const input = baseInput({
			rootHygieneRef: auditSurface("tmp", "artifact", {
				ref: "root-hygiene:tmp",
			}),
		});
		const verdict = buildJudgePmAuditVerdict(input);
		const packet = buildJudgePmAuditPacket(input);

		expect(verdict).toMatchObject({
			status: "blocked",
			freshness: "unknown",
			blockerCode: "invalid_audit_surface",
			blockerRefs: ["root-hygiene:tmp"],
		});
		expect(packet.auditSurfaces).toContainEqual(
			expect.objectContaining({ name: "root-hygiene" }),
		);
		expect(packet.auditSurfaces).not.toContainEqual(
			expect.objectContaining({ name: "tmp" }),
		);
	});

	it("fails closed when singleton audit surfaces use slot-scoped variant refs", () => {
		const verdict = buildJudgePmAuditVerdict(
			baseInput({
				reviewStateRef: auditSurface("review-state", "review_artifact", {
					ref: "review-state:alt",
				}),
			}),
		);

		expect(verdict).toMatchObject({
			status: "blocked",
			freshness: "unknown",
			blockerCode: "invalid_audit_surface",
			blockerRefs: ["review-state:alt"],
		});
	});

	it("fails closed when the issue authority map hides an unresolved parent decision", () => {
		const verdict = buildJudgePmAuditVerdict(
			baseInput({
				issueAuthorityMap: {
					...issueAuthorityMap(),
					parentIssueId: null,
					parentNotApplicable: null,
				},
			}),
		);

		expect(verdict).toMatchObject({
			status: "blocked",
			freshness: "missing",
			blockerClass: "needs_jamie_decision",
			blockerCode: "missing_issue_authority",
			blockerRefs: ["linear:JSC-363"],
		});
	});

	it("requires owner-backed not-applicable authority for omitted tracker surfaces", () => {
		const missingLinearDecision = buildJudgePmAuditVerdict(
			baseInput({
				linearStateRef: null,
				linearStateNotApplicable: null,
			}),
		);
		const explicitLinearDecision = buildJudgePmAuditVerdict(
			baseInput({
				linearStateRef: null,
				linearStateNotApplicable: notApplicableDecision("linear:JSC-363"),
			}),
		);

		expect(missingLinearDecision).toMatchObject({
			status: "blocked",
			freshness: "missing",
			blockerClass: "needs_jamie_decision",
			blockerCode: "missing_audit_surface",
		});
		expect(explicitLinearDecision).toMatchObject({
			status: "pass",
			freshness: "current",
		});
	});

	it("fails closed when unresolved risks are not classified for ownership", () => {
		const verdict = buildJudgePmAuditVerdict(
			baseInput({
				unresolvedRiskClassifications: [
					{
						risk: "review-state stale",
						blockerClass: "unknown",
						owner: "",
						nextAction: "refresh review state",
						evidenceRef: "review-state:risk",
					},
				],
			}),
		);

		expect(verdict).toMatchObject({
			status: "blocked",
			freshness: "unknown",
			blockerCode: "unclassified_risk",
			blockerRefs: ["review-state:risk"],
		});
	});

	it("fails closed when a required supporting verdict uses the wrong source", () => {
		const verdict = buildJudgePmAuditVerdict(
			baseInput({
				supportingVerdicts: [
					...supportingVerdicts().filter(
						(verdict) => verdict.claim !== "root_surface_tidy",
					),
					deliveryVerdict("root_surface_tidy", "external_state", {
						evidenceRef: "external-state:root_surface_tidy",
						evidenceRefs: ["external-state:root_surface_tidy"],
					}),
				],
			}),
		);

		expect(verdict).toMatchObject({
			status: "blocked",
			freshness: "missing",
			blockerCode: "missing_required_verdict",
			blockerRefs: ["delivery-truth:root_surface_tidy"],
		});
	});

	it("accepts merge-ready supporting verdicts from composition-compatible sources", () => {
		for (const source of [
			"external_state",
			"review_state",
			"pr_closeout",
		] satisfies DeliveryTruthSource[]) {
			const verdict = buildJudgePmAuditVerdict(
				baseInput({
					supportingVerdicts: [
						...supportingVerdicts().filter(
							(verdict) => verdict.claim !== "merge_ready",
						),
						deliveryVerdict("merge_ready", source),
					],
				}),
			);

			expect(verdict).toMatchObject({
				status: "pass",
				freshness: "current",
			});
		}
	});

	it("accepts a later current merge-ready verdict when an earlier allowed source is stale", () => {
		const verdict = buildJudgePmAuditVerdict(
			baseInput({
				supportingVerdicts: [
					...supportingVerdicts().filter(
						(verdict) => verdict.claim !== "merge_ready",
					),
					deliveryVerdict("merge_ready", "external_state", {
						freshness: "stale",
					}),
					deliveryVerdict("merge_ready", "pr_closeout"),
				],
			}),
		);

		expect(verdict).toMatchObject({
			status: "pass",
			freshness: "current",
		});
	});

	it("accepts a later current merge-ready verdict after mixed invalid allowed candidates", () => {
		const verdict = buildJudgePmAuditVerdict(
			baseInput({
				supportingVerdicts: [
					...supportingVerdicts().filter(
						(verdict) => verdict.claim !== "merge_ready",
					),
					deliveryVerdict("merge_ready", "external_state", {
						evidenceUse: "orientation",
					}),
					deliveryVerdict("merge_ready", "review_state", {
						headSha: "other-head",
						verdictHeadSha: "other-head",
					}),
					deliveryVerdict("merge_ready", "pr_closeout"),
				],
			}),
		);

		expect(verdict).toMatchObject({
			status: "pass",
			freshness: "current",
		});
	});

	it("fails closed when a required supporting verdict is stale or from another head", () => {
		const staleVerdict = buildJudgePmAuditVerdict(
			baseInput({
				supportingVerdicts: [
					...supportingVerdicts().filter(
						(verdict) => verdict.claim !== "remote_checks_current",
					),
					deliveryVerdict("remote_checks_current", "external_state", {
						freshness: "stale",
					}),
				],
			}),
		);
		const mixedHeadVerdict = buildJudgePmAuditVerdict(
			baseInput({
				supportingVerdicts: [
					...supportingVerdicts().filter(
						(verdict) => verdict.claim !== "linear_state_aligned",
					),
					deliveryVerdict("linear_state_aligned", "external_state", {
						headSha: OTHER_HEAD,
						verdictHeadSha: OTHER_HEAD,
					}),
				],
			}),
		);

		expect(staleVerdict).toMatchObject({
			status: "blocked",
			freshness: "stale",
			blockerCode: "audit_verdict_not_current",
			blockerRefs: ["external-state:remote_checks_current"],
		});
		expect(mixedHeadVerdict).toMatchObject({
			status: "blocked",
			freshness: "stale",
			blockerCode: "audit_verdict_not_current",
			blockerRefs: ["external-state:linear_state_aligned"],
		});
	});

	it("fails closed when a current supporting verdict lacks traceable evidence", () => {
		const verdict = buildJudgePmAuditVerdict(
			baseInput({
				supportingVerdicts: [
					...supportingVerdicts().filter(
						(verdict) => verdict.claim !== "merge_ready",
					),
					deliveryVerdict("merge_ready", "pr_closeout", {
						evidenceRef: null,
						evidenceRefs: [],
					}),
				],
			}),
		);

		expect(verdict).toMatchObject({
			status: "blocked",
			freshness: "current",
			blockerCode: "audit_verdict_not_current",
			blockerRefs: [],
		});
	});
});

function baseInput(
	overrides: Partial<JudgePmAuditVerdictInput> = {},
): JudgePmAuditVerdictInput {
	return {
		packetRef: "pr-closeout:judge-pm-audit.json",
		verifiedAt: VERIFIED_AT,
		headSha: HEAD,
		requiredReviewerRoles: [...REQUIRED_ROLES],
		reviewerArtifacts: REQUIRED_ROLES.map((role) => reviewerArtifact(role)),
		runtimeCardRefs: [auditSurface("runtime-card", "runtime_card")],
		reviewStateRef: auditSurface("review-state", "review_artifact"),
		externalStateRef: auditSurface("external-state", "external_state"),
		linearStateRef: auditSurface("linear-state", "external_state"),
		linearStateNotApplicable: null,
		validationReceiptRefs: [auditSurface("validation", "validation")],
		rootHygieneRef: auditSurface("root-hygiene", "artifact"),
		issueAuthorityMap: issueAuthorityMap(),
		unresolvedRiskClassifications: [],
		supportingVerdicts: supportingVerdicts(),
		...overrides,
	};
}

function issueAuthorityMap(): JudgePmAuditIssueAuthorityMap {
	return {
		lifecycleIssueId: "JSC-363",
		parentIssueId: "JSC-300",
		parentNotApplicable: null,
		prNumber: 305,
		prNotApplicable: null,
		externalGoalId: "codex-runtime-evidence-verifier-cockpit",
		externalGoalNotApplicable: null,
		authorityOwner: "jamie",
		decisionSourceRef: "linear:JSC-363",
		decidedAt: VERIFIED_AT,
		rationale: "Judge/PM audit is required before goal closeout.",
	};
}

function auditSurface(
	name: string,
	expectedKind: EvidenceReceiptKind,
	overrides: Partial<EvidenceReceipt> = {},
): JudgePmAuditVerdictInput["reviewStateRef"] {
	return {
		name,
		expectedKind,
		receipt: receipt({
			kind: expectedKind,
			ref: `${sourceRefPrefixForKind(expectedKind)}:${name}`,
			producer: "judge-pm-fixture",
			...overrides,
		}),
	};
}

function notApplicableDecision(decisionSourceRef: string) {
	return {
		owner: "jamie",
		rationale:
			"Tracker surface is intentionally not applicable for this closeout.",
		decidedAt: VERIFIED_AT,
		decisionSourceRef,
	};
}

function reviewerArtifact(
	role: string,
	overrides: { receipt?: Partial<EvidenceReceipt> } = {},
): JudgePmAuditReviewerArtifact {
	const path = `artifacts/reviews/${role}.md`;
	const expectedProducer = role;
	return {
		role,
		path,
		expectedProducer,
		receipt: receipt({
			kind: "review_artifact",
			ref: `review-state:${path}`,
			producer: expectedProducer,
			...overrides.receipt,
		}),
	};
}

function sourceRefPrefixForKind(kind: EvidenceReceiptKind): string {
	switch (kind) {
		case "runtime_card":
			return "runtime-card";
		case "review_artifact":
			return "review-state";
		case "external_state":
			return "external-state";
		case "validation":
			return "validation";
		case "artifact":
			return "root-hygiene";
		case "run_record":
			return "run-record";
	}
}

function supportingVerdicts(): DeliveryTruthVerdict[] {
	return [
		deliveryVerdict("merge_ready", "pr_closeout"),
		deliveryVerdict("root_surface_tidy", "root_hygiene"),
		deliveryVerdict("remote_checks_current", "external_state"),
		deliveryVerdict("review_threads_resolved", "review_state"),
		deliveryVerdict("linear_state_aligned", "external_state"),
	];
}

function deliveryVerdict(
	claim: DeliveryTruthClaim,
	source: DeliveryTruthSource,
	overrides: Partial<DeliveryTruthVerdict> = {},
): DeliveryTruthVerdict {
	return {
		schemaVersion: "delivery-truth/v1",
		claim,
		status: "pass",
		statusLabel: `${claim} pass`,
		source,
		evidenceRef: `${sourceRefPrefix(source)}:${claim}`,
		evidenceRefs: [`${sourceRefPrefix(source)}:${claim}`],
		blockerRefs: [],
		headSha: HEAD,
		verdictHeadSha: HEAD,
		freshness: "current",
		blockerClass: null,
		blockerCode: null,
		verifiedAt: VERIFIED_AT,
		evidenceUse: "claim_support",
		...overrides,
	};
}

function sourceRefPrefix(source: DeliveryTruthSource): string {
	switch (source) {
		case "external_state":
			return "external-state";
		case "review_state":
			return "review-state";
		case "root_hygiene":
			return "root-hygiene";
		case "pr_closeout":
			return "pr-closeout";
		case "runtime_card":
			return "runtime-card";
		case "validation":
			return "validation";
	}
}

function receipt(overrides: Partial<EvidenceReceipt>): EvidenceReceipt {
	return {
		schemaVersion: "evidence-receipt/v1",
		kind: "artifact",
		ref: "artifact:receipt",
		producer: "judge-pm-fixture",
		status: "pass",
		freshness: "current",
		evidenceUse: "claim_support",
		blockerClass: null,
		producedAt: VERIFIED_AT,
		verifiedAt: VERIFIED_AT,
		headSha: HEAD,
		sizeBytes: 128,
		...overrides,
	};
}
