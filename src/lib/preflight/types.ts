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
	/** Optional admission declaration used for north-star alignment checks */
	admission?: PreflightAdmissionDeclaration;
}

export interface PreflightAdmissionDeclaration {
	north_star_metric: string;
	primary_bottleneck: string;
	affected_surface_ids: string[];
	affected_surface_classes: string[];
	policy_surface_delta: number;
	manual_glue_delta: number;
	metric_impact_declared: "direct" | "path_strengthening" | "none";
	evidence_links: string[];
	why_this_improves_throughput_or_reliability: string;
}

export interface PreflightNorthStarSummary {
	mission: string;
	primary_metric: string;
	primary_bottleneck: string;
	autonomy_boundary: string;
	safety_floor: string[];
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
	/** Contract-derived north-star summary emitted for preflight consumers */
	northStarSummary?: PreflightNorthStarSummary | undefined;
	/** Admission declaration echoed for downstream gate surfaces */
	admissionDeclaration?: PreflightAdmissionDeclaration | undefined;
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
