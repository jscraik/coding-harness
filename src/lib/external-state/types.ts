import type {
	EvidenceReceipt,
	EvidenceReceiptFreshness,
	EvidenceReceiptStatus,
	EvidenceReceiptUse,
} from "../evidence/evidence-receipt.js";

/** Schema version for live external-state snapshots. */
export const EXTERNAL_STATE_SNAPSHOT_SCHEMA_VERSION =
	"external-state-snapshot/v1" as const;

/** Source families tracked by external-state-snapshot/v1. */
export const EXTERNAL_STATE_SOURCES = [
	"github_pr",
	"github_checks",
	"github_reviews",
	"coderabbit",
	"linear",
	"circleci",
] as const;

/** Availability state for one external source fetch. */
export const EXTERNAL_STATE_SOURCE_STATUSES = [
	"available",
	"unavailable",
	"stale",
	"unknown",
] as const;

/** Stable blocker codes for claim-support decisions. */
export const EXTERNAL_STATE_CLAIM_BLOCKERS = [
	"snapshot_stale",
	"snapshot_not_claim_support",
	"source_unavailable",
	"source_stale",
	"source_unknown",
	"source_not_current",
	"source_not_passing",
	"source_not_claim_support",
	"missing_fetch_proof",
	"fetch_proof_mismatch",
	"blocked_stale_external_context",
	"missing_pr_head_sha",
	"head_sha_mismatch",
] as const;

/** Source family tracked by external-state-snapshot/v1. */
export type ExternalStateSource = (typeof EXTERNAL_STATE_SOURCES)[number];

/** Availability state for one external source fetch. */
export type ExternalStateSourceStatus =
	(typeof EXTERNAL_STATE_SOURCE_STATUSES)[number];

/** Stable blocker code for claim-support decisions. */
export type ExternalStateClaimBlocker =
	(typeof EXTERNAL_STATE_CLAIM_BLOCKERS)[number];

/** One source entry in an external-state snapshot. */
export interface ExternalStateSourceSnapshot {
	source: ExternalStateSource;
	status: ExternalStateSourceStatus;
	fetchedAt: string;
	ttlSeconds: number;
	headSha: string | null;
	prHeadSensitive: boolean;
	evidenceUse: EvidenceReceiptUse;
	evidenceRef: string;
	freshness: EvidenceReceiptFreshness;
	resultStatus: EvidenceReceiptStatus;
	staleReasons: string[];
}

/** Production packet for live external PR, CI, review, and tracker state. */
export interface ExternalStateSnapshot {
	schemaVersion: typeof EXTERNAL_STATE_SNAPSHOT_SCHEMA_VERSION;
	generatedAt: string;
	repository: string;
	prNumber: number;
	fetchedAt: string;
	ttlSeconds: number;
	headSha: string | null;
	fetchReceiptRef: string;
	fetchedArtifactHash: string;
	verifierIdentity: string;
	fetchReceipt: EvidenceReceipt;
	evidenceUse: EvidenceReceiptUse;
	stale: boolean;
	staleReasons: string[];
	sources: ExternalStateSourceSnapshot[];
}

/** Structured validation error emitted for external-state-snapshot/v1. */
export interface ExternalStateValidationError {
	code: string;
	path: string;
	severity: "error";
}

/** Validation result for external-state-snapshot/v1. */
export interface ExternalStateValidationResult {
	valid: boolean;
	errors: ExternalStateValidationError[];
}

/** Claim-support decision for an external-state-snapshot/v1 packet. */
export interface ExternalStateClaimSupportResult {
	canSupportClaim: boolean;
	blockers: ExternalStateClaimBlocker[];
}
