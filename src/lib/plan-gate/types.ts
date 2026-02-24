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
	/** Require all sections */
	strict?: boolean;
	/** Output as JSON */
	json?: boolean;
}

export interface PlanFrontmatter {
	title: string;
	date: string;
	type: "feature" | "refactor" | "bugfix" | "docs" | "architecture";
	status: "draft" | "approved" | "implemented" | "superseded";
	origin?: string;
	brainstormDate?: string;
	decisions?: string[];
}

export interface PlanArtifact {
	path: string;
	title: string;
	type: string;
	date: string;
	status: string;
	hasOrigin: boolean;
	hasImplementationSteps: boolean;
	hasAcceptanceCriteria: boolean;
	frontmatter: PlanFrontmatter;
}

export interface PlanError {
	code: "MISSING" | "STALE" | "INCOMPLETE" | "ORIGIN_MISSING" | "SYSTEM_ERROR";
	message: string;
	path?: string;
}

export interface PlanGateResult {
	passed: boolean;
	artifacts: PlanArtifact[];
	errors: PlanError[];
	daysSincePlan?: number;
}
