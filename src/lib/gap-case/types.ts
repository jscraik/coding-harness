/**
 * Gap-case data types for minimal incident tracking workflow.
 *
 * v1 scope: open/resolve lifecycle only, single-file local store.
 */

import type { RiskTier } from "../contract/types.js";

/**
 * Gap case status lifecycle (v1: open → resolved only)
 */
export type GapCaseStatus = "open" | "resolved";

/**
 * Provider source for the gap-case (where the incident originated)
 */
export type GapCaseProvider = "greptile" | "codex" | "manual";

/**
 * Causality classification for automation incidents
 */
export type GapCaseCausality =
	| "automation_confirmed"
	| "automation_possible"
	| "human_or_external"
	| "unknown";

/**
 * Confidence level for causality classification
 */
export type GapCaseConfidence = "confirmed" | "probable" | "provisional";

/**
 * Resolution details for a resolved gap-case
 */
export interface GapCaseResolution {
	/** URL to evidence of resolution (required when policy.requireClosureEvidence=true) */
	evidenceUrl: string;
	/** Optional PR number that fixed the issue */
	fixPr?: number | undefined;
	/** Optional free-form resolution note */
	note?: string | undefined;
	/** Actor who resolved the case */
	resolvedBy?: string | undefined;
}

/**
 * Gap-case record for tracking incidents through resolution.
 *
 * Identity and state fields are required; timing, refs, and resolution are
 * populated based on lifecycle stage.
 */
export interface GapCaseRecord {
	// Identity/state
	/** Unique gap-case identifier (generated on open) */
	id: string;
	/** External incident identifier (passed on open) */
	incidentId: string;
	/** Current status in lifecycle */
	status: GapCaseStatus;
	/** Severity classification */
	severity: RiskTier;
	/** Human-readable summary of the incident */
	summary: string;
	/** Owner responsible for resolution */
	owner: string;

	// Timing
	/** ISO timestamp when case was opened */
	openedAt: string;
	/** ISO timestamp when SLA is due */
	slaDueAt: string;
	/** ISO timestamp when case was resolved (if resolved) */
	resolvedAt?: string | undefined;

	// Optional refs (provider context)
	/** Provider that originated the finding */
	provider?: GapCaseProvider | undefined;
	/** Provider-specific finding identifier */
	findingId?: string | undefined;
	/** PR number where finding was detected */
	prNumber?: number | undefined;
	/** HEAD SHA at time of finding */
	headSha?: string | undefined;

	// Resolution (populated on resolve)
	/** Resolution details */
	resolution?: GapCaseResolution | undefined;

	// Incident classification (for automation incidents)
	/** Causality classification */
	causality?: GapCaseCausality | undefined;
	/** Confidence level of causality classification */
	confidence?: GapCaseConfidence | undefined;
	/** Who classified the causality */
	causalityClassifiedBy?: string | undefined;
	/** When causality was classified */
	causalityClassifiedAt?: string | undefined;
}

/**
 * Gap-case store schema v1.
 *
 * Single-file local store with version field for future migrations.
 */
export interface GapCaseStoreV1 {
	/** Schema version identifier */
	version: "1";
	/** Array of gap-case records */
	cases: GapCaseRecord[];
}

/**
 * Options for opening a new gap-case
 */
export interface GapCaseOpenOptions {
	/** External incident identifier */
	incidentId: string;
	/** Human-readable summary */
	summary: string;
	/** Severity classification (validated if provided) */
	severity?: RiskTier | undefined;
	/** Owner responsible for resolution */
	owner: string;
	/** Optional provider source */
	provider?: GapCaseProvider | undefined;
	/** Optional provider finding ID */
	findingId?: string | undefined;
	/** Optional PR number */
	prNumber?: number | undefined;
	/** Optional HEAD SHA */
	headSha?: string | undefined;
	/** Optional SLA override (hours) */
	slaHours?: number | undefined;
	/** Contract path for policy lookup */
	contractPath?: string | undefined;
	/** Store path override */
	storePath?: string | undefined;
	/** JSON output mode */
	json?: boolean | undefined;
}

/**
 * Options for resolving an existing gap-case
 */
export interface GapCaseResolveOptions {
	/** Gap-case ID to resolve */
	caseId: string;
	/** Evidence URL for resolution */
	evidenceUrl: string;
	/** Optional fix PR number */
	fixPr?: number | undefined;
	/** Optional resolution note */
	note?: string | undefined;
	/** Optional resolver identity */
	resolvedBy?: string | undefined;
	/** Contract path for policy lookup */
	contractPath?: string | undefined;
	/** Store path override */
	storePath?: string | undefined;
	/** JSON output mode */
	json?: boolean | undefined;
}

/**
 * Result type for gap-case operations
 */
export type GapCaseResult =
	| { ok: true; output: GapCaseRecord }
	| { ok: false; error: { code: string; message: string; context?: unknown } };

// Exit codes for gap-case CLI
export const GAP_CASE_EXIT_CODES = {
	SUCCESS: 0,
	VALIDATION_ERROR: 1,
	NOT_FOUND: 2,
	STORE_ERROR: 3,
	SYSTEM_ERROR: 10,
} as const;
