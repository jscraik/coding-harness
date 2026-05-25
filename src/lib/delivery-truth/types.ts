import type {
	EvidenceReceipt,
	EvidenceReceiptUse,
} from "../evidence/evidence-receipt.js";
import type {
	PrCloseoutBlockerClassification,
	PrCloseoutClaimStatus,
	PrCloseoutEvidenceFreshness,
} from "../pr-closeout/types.js";
import type { RootHygieneReport } from "../root-hygiene/types.js";
import type { RootHygieneRepositoryIdentity } from "../root-hygiene/repository-identity.js";

/** Schema version for private delivery-truth verdict fixtures. */
export const DELIVERY_TRUTH_SCHEMA_VERSION = "delivery-truth/v1" as const;

/** Delivery claims covered by the private PU-005 foundation verifier. */
export type DeliveryTruthClaim =
	| "root_surface_tidy"
	| "goal_ready_for_judge_pm"
	| "merge_ready";

/** Evidence source families that can support private delivery-truth claims. */
export type DeliveryTruthSource =
	| "validation"
	| "runtime_card"
	| "review_state"
	| "external_state"
	| "root_hygiene"
	| "pr_closeout";

/** Stable blocker codes emitted when evidence cannot support a delivery claim. */
export type DeliveryTruthBlockerCode =
	| "missing_evidence"
	| "invalid_receipt"
	| "invalid_evidence_ref"
	| "mismatched_source_receipt"
	| "non_claim_support_evidence"
	| "unsupported_claim_source"
	| "stale_evidence"
	| "unknown_evidence"
	| "receipt_failed"
	| "receipt_blocked"
	| "receipt_unknown"
	| "missing_separate_evidence"
	| "missing_verdict_head_sha"
	| "missing_head_sha"
	| "mixed_head_evidence"
	| "producer_ttl_exceeds_verifier_policy"
	| "head_sha_recomputed_mismatch"
	| "fetched_at_after_verified_at"
	| "missing_repository_identity"
	| "repository_identity_mismatch"
	| "invalid_policy_timestamp";

/** Receipt plus verifier-owned policy context for one delivery-truth proof input. */
export interface DeliveryTruthEvidence {
	receipt: EvidenceReceipt;
	source: DeliveryTruthSource;
	producerTtlSeconds?: number;
	verifierTtlSeconds?: number;
	fetchedAt?: string;
	recomputedHeadSha?: string | null;
	rootHygieneReport?: RootHygieneReport;
}

/** Input accepted by the private delivery-truth composition helper. */
export interface DeliveryTruthCompositionInput {
	claim: DeliveryTruthClaim;
	source: DeliveryTruthSource;
	evidence: readonly DeliveryTruthEvidence[];
	verifiedAt: string;
	verdictHeadSha?: string | null;
	repositoryIdentity?: RootHygieneRepositoryIdentity | null;
	verifierTtlSeconds?: number;
}

/** Private fixture-level verdict used before production closeout integration. */
export interface DeliveryTruthVerdict {
	schemaVersion: typeof DELIVERY_TRUTH_SCHEMA_VERSION;
	claim: DeliveryTruthClaim;
	status: PrCloseoutClaimStatus;
	statusLabel: string;
	source: DeliveryTruthSource;
	evidenceRef: string | null;
	evidenceRefs: string[];
	blockerRefs: string[];
	headSha: string | null;
	verdictHeadSha: string | null;
	freshness: PrCloseoutEvidenceFreshness;
	blockerClass: PrCloseoutBlockerClassification | null;
	blockerCode: DeliveryTruthBlockerCode | null;
	verifiedAt: string;
	evidenceUse: EvidenceReceiptUse | null;
}
