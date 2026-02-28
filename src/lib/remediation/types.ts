/**
 * Canonical types for the remediation loop.
 *
 * These types provide a unified interface for findings from multiple providers
 * (Greptile, Codex) and define discriminated union result types for type-safe
 * error handling.
 */

import type { RiskTier } from "../contract/types.js";

/**
 * Severity tier for remediation auto-approval.
 * Reuses the existing RiskTier from contract types.
 */
export type RemediationAutoTier = RiskTier;

/**
 * Severity level for a finding.
 * Maps directly to RemediationAutoTier for policy enforcement.
 */
export type RemediationSeverity = RemediationAutoTier;

/**
 * Provider source for a finding.
 */
export type RemediationProvider = "greptile" | "codex" | "codeql";

/**
 * Action types for remediation workflow.
 */
export type RemediationActionType =
	| "commit"
	| "push"
	| "comment"
	| "skip"
	| "requires_human";

/**
 * Typed error codes for normalizer failures.
 */
export type NormalizerErrorCode =
	| "E_PARSE_FAILURE"
	| "E_MISSING_FIELD"
	| "E_INVALID_SHA"
	| "E_INVALID_PATH";

/**
 * Typed error codes for remediation failures.
 */
export type RemediationErrorCode =
	| "E_VALIDATION"
	| "E_POLICY"
	| "E_GITHUB"
	| "E_RACE_DETECTED"
	| "E_ROLLBACK_MODE"
	| "E_INTERNAL";

/**
 * Base fields for a canonical finding.
 */
interface FindingBase {
	id: string;
	provider: RemediationProvider;
	severity: RemediationSeverity;
	title: string;
	description: string;
}

/**
 * Location information for a finding.
 */
interface FindingLocation {
	/** Validated path (no traversal attacks) */
	filePath: string;
	lineStart: number;
	lineEnd?: number | undefined;
}

/**
 * Contextual metadata for a finding.
 */
interface FindingContext {
	commitSha: string;
	discoveredAt: string;
	evidence?: string | undefined;
}

/**
 * Canonical representation of a security or quality finding.
 * Unified format from multiple providers (Greptile, Codex).
 */
export interface CanonicalFinding
	extends FindingBase,
		FindingLocation,
		FindingContext {}

/**
 * Action to take for a finding during remediation.
 */
export interface RemediationAction {
	type: RemediationActionType;
	findingId: string;
	reason: string;
	dryRun: boolean;
}

/**
 * Result of normalizing a raw finding to canonical format.
 * Discriminated union for type-safe error handling.
 */
export type NormalizerOutcome =
	| { ok: true; finding: CanonicalFinding }
	| {
			ok: false;
			error: {
				code: NormalizerErrorCode;
				message: string;
				raw?: unknown;
			};
	  };

/**
 * Telemetry data for remediation operations.
 */
export interface RemediationTelemetry {
	apiCalls: number;
	cacheHits: number;
}

/**
 * Output from successful remediation processing.
 */
export interface RemediationOutput {
	findingsProcessed: number;
	actions: RemediationAction[];
	skipped: Array<{ findingId: string; reason: string }>;
	telemetry?: RemediationTelemetry | undefined;
}

/**
 * Result of remediation processing.
 * Discriminated union for type-safe error handling.
 */
export type RemediationOutcome =
	| { ok: true; output: RemediationOutput }
	| {
			ok: false;
			error: {
				code: RemediationErrorCode;
				message: string;
				context?: Record<string, unknown>;
			};
	  };
