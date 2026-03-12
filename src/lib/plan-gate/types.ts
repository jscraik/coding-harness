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
	MAX_AGE_DAYS: 30,
} as const;

export const REQUIRED_PLAN_SECTIONS = [
	"Implementation Steps",
	"Acceptance Criteria",
] as const;

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

export interface PlanFrontmatter {
	title: string;
	date: string;
	type:
		| "feat"
		| "feature"
		| "fix"
		| "bugfix"
		| "refactor"
		| "docs"
		| "architecture"
		| "chore";
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

export interface AcceptanceItem {
	text: string;
	completed: boolean;
	hasEvidence: boolean;
	line: number;
}

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

export interface PlanTraceabilitySummary {
	planIds: string[];
	matchedPlanIds: string[];
	changedFiles: string[];
}

export interface PlanGateResult {
	passed: boolean;
	artifacts: PlanArtifact[];
	errors: PlanError[];
	daysSincePlan?: number;
	traceability?: PlanTraceabilitySummary;
}
