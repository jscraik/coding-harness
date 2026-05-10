/**
 * Plan gate types
 *
 * Types for plan artifact validation.
 */

export const EXIT_CODES = {
	SUCCESS: 0,
	PLAN_MISSING: 1,
	PLAN_STALE: 2,
	VALIDATION_ERROR: 3,
	ORIGIN_MISSING: 4,
	PLAN_ID_ERROR: 5,
	ACCEPTANCE_EVIDENCE_ERROR: 6,
	TRACEABILITY_ERROR: 7,
	SYSTEM_ERROR: 10,
} as const;

export const DEFAULTS = {
	PLANS_PATH: "docs/plans",
	HARNESS_PLANS_PATH: ".harness/plan",
	MAX_AGE_DAYS: 30,
} as const;

export const REQUIRED_PLAN_SECTIONS = [
	"Implementation Steps",
	"Acceptance Criteria",
] as const;

/** Options that control plan artifact discovery and validation. */
export interface PlanGateOptions {
	/** Path to plans directory */
	plansPath?: string;
	/** Filter by plan type */
	type?: string;
	/** Maximum age in days */
	maxAge?: number;
	/** Require origin reference to brainstorm */
	requireOrigin?: boolean;
	/** Require each validated plan to declare a plan_id in frontmatter */
	requirePlanId?: boolean;
	/** Require completed acceptance items to include evidence refs */
	requireAcceptanceEvidence?: boolean;
	/** Explicit plan IDs to validate */
	planIds?: string[];
	/** Pull request title used to extract plan IDs */
	prTitle?: string;
	/** Pull request body used to extract plan IDs */
	prBody?: string;
	/** Changed files used for traceability checks */
	changedFiles?: string[];
	/** Require changed work to map to plan IDs */
	requireTraceability?: boolean;
	/** Require all sections */
	strict?: boolean;
	/** Output as JSON */
	json?: boolean;
}

/** Parsed frontmatter fields from a plan Markdown artifact. */
export interface PlanFrontmatter {
	title: string;
	date: string;
	type: string;
	status:
		| "draft"
		| "future"
		| "active"
		| "approved"
		| "completed"
		| "implemented"
		| "superseded";
	planId?: string;
	origin?: string;
	brainstormDate?: string;
	decisions?: string[];
}

/** Acceptance checklist item extracted from a plan artifact body. */
export interface AcceptanceItem {
	text: string;
	completed: boolean;
	hasEvidence: boolean;
	line: number;
}

/** Normalized plan artifact metadata used by plan-gate checks. */
export interface PlanArtifact {
	path: string;
	title: string;
	type: string;
	date: string;
	status: string;
	planId?: string;
	hasOrigin: boolean;
	hasImplementationSteps: boolean;
	hasAcceptanceCriteria: boolean;
	acceptanceItems: AcceptanceItem[];
	frontmatter: PlanFrontmatter;
}

/** Structured plan-gate validation error. */
export interface PlanError {
	code:
		| "MISSING"
		| "STALE"
		| "INCOMPLETE"
		| "ORIGIN_MISSING"
		| "PLAN_ID_MISSING"
		| "PLAN_ID_NOT_FOUND"
		| "ACCEPTANCE_EVIDENCE_MISSING"
		| "TRACEABILITY_MISSING"
		| "SYSTEM_ERROR";
	message: string;
	path?: string;
}

/** Summary of requested and matched plan IDs for changed work. */
export interface PlanTraceabilitySummary {
	planIds: string[];
	matchedPlanIds: string[];
	changedFiles: string[];
}

/** Complete plan-gate result for CLI and library consumers. */
export interface PlanGateResult {
	passed: boolean;
	artifacts: PlanArtifact[];
	errors: PlanError[];
	daysSincePlan?: number;
	traceability?: PlanTraceabilitySummary;
}
