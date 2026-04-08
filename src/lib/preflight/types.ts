/**
 * Preflight policy gate types
 *
 * Fast, lightweight checks designed to run before expensive operations.
 */

import type { GateExtensionHookId, RiskTier } from "../contract/types.js";

/**
 * Semantic exit codes for preflight gate
 */
export const EXIT_CODES = {
	/** All preflight checks passed */
	SUCCESS: 0,
	/** Policy violation detected */
	POLICY_VIOLATION: 1,
	/** Validation error (invalid input) */
	VALIDATION_ERROR: 2,
	/** Contract not found or invalid */
	CONTRACT_ERROR: 3,
	/** System error during check */
	SYSTEM_ERROR: 10,
} as const;

/**
 * Preflight check severity
 */
export type PreflightSeverity = "error" | "warning" | "info";

/**
 * Individual preflight check result
 */
export interface PreflightCheck {
	/** Check identifier */
	id: string;
	/** Human-readable description */
	description: string;
	/** Severity level */
	severity: PreflightSeverity;
	/** Whether the check passed */
	passed: boolean;
	/** Details on failure */
	message?: string | undefined;
	/** Files affected (if any) */
	files?: string[] | undefined;
	/** Execution time in ms */
	durationMs: number;
}

/**
 * Preflight gate options
 */
export interface PreflightGateOptions {
	/** Path to contract file */
	contractPath?: string;
	/** Files to check (if empty, checks all staged/modified) */
	files?: string[];
	/** Output format */
	json?: boolean;
	/** Fail on warnings too */
	strict?: boolean;
	/** Skip specific check IDs */
	skip?: string[];
	/** Maximum tier allowed (blocks higher) */
	maxTier?: RiskTier;
	/** Head SHA for determinism checks (optional) */
	headSha?: string;
}

/**
 * Preflight gate result
 */
export interface PreflightGateResult {
	/** Overall pass/fail */
	passed: boolean;
	/** Individual check results */
	checks: PreflightCheck[];
	/** Summary statistics */
	summary: {
		total: number;
		passed: number;
		failed: number;
		warnings: number;
		durationMs: number;
	};
	/** Risk tier if determined */
	riskTier?: RiskTier | undefined;
	/** Decisions emitted by pre/post gate extension hooks */
	hookDecisions?: PreflightHookDecision[] | undefined;
}

export type PreflightHookPhase = "pre" | "post";

export type PreflightHookAction =
	| "continue"
	| "short-circuit"
	| "override"
	| "block";

export interface PreflightHookDecision {
	phase: PreflightHookPhase;
	hookId: GateExtensionHookId;
	action: PreflightHookAction;
	message: string;
}

/**
 * Preflight check function type
 */
export type PreflightCheckFn = (
	options: PreflightGateOptions,
) => Promise<PreflightCheck> | PreflightCheck;

/**
 * Registry of available preflight checks
 */
export interface PreflightCheckRegistry {
	[id: string]: {
		name: string;
		description: string;
		severity: PreflightSeverity;
		fn: PreflightCheckFn;
	};
}
