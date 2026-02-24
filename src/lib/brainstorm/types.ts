/**
 * Brainstorm artifact types
 *
 * Defines types for brainstorm artifact validation and enforcement.
 */

/**
 * Semantic exit codes for brainstorm-gate command
 */
export const EXIT_CODES = {
	/** Brainstorm artifact valid and found */
	SUCCESS: 0,
	/** Brainstorm artifact missing or invalid */
	BRAINSTORM_MISSING: 1,
	/** Brainstorm too old (>14 days) */
	BRAINSTORM_STALE: 2,
	/** Validation error in configuration */
	VALIDATION_ERROR: 3,
	/** System error during validation */
	SYSTEM_ERROR: 10,
} as const;

/**
 * Brainstorm artifact metadata
 */
export interface BrainstormArtifact {
	/** Path to the brainstorm document */
	path: string;
	/** Topic/title of the brainstorm */
	topic: string;
	/** Date created (ISO format) */
	date: string;
	/** Whether it has required sections (compound-engineering workflow) */
	hasWhat: boolean;
	hasWhy: boolean;
	hasDecisions: boolean;
	/** Frontmatter metadata */
	frontmatter: BrainstormFrontmatter;
}

/**
 * Brainstorm frontmatter structure
 */
export interface BrainstormFrontmatter {
	/** Topic of the brainstorm */
	topic: string;
	/** Date created */
	date: string;
	/** Optional tags */
	tags?: string[];
}

/**
 * Brainstorm detection options
 */
export interface BrainstormGateOptions {
	/** Path to brainstorms directory */
	brainstormsPath?: string;
	/** Topic to search for */
	topic?: string;
	/** Maximum age in days (default: 14) */
	maxAgeDays?: number;
	/** Output as JSON */
	json?: boolean;
	/** Require all sections */
	strict?: boolean;
}

/**
 * Brainstorm validation error
 */
export interface BrainstormError {
	/** Error code */
	code: "MISSING" | "STALE" | "INCOMPLETE" | "SYSTEM_ERROR";
	/** Error message */
	message: string;
	/** Path that failed validation */
	path?: string;
}

/**
 * Brainstorm gate result
 */
export interface BrainstormGateResult {
	/** Whether validation passed */
	passed: boolean;
	/** Found brainstorm artifacts */
	artifacts: BrainstormArtifact[];
	/** Validation errors */
	errors: BrainstormError[];
	/** Days since most recent brainstorm */
	daysSinceBrainstorm?: number;
}

/**
 * Required sections in a brainstorm document (Compound Engineering workflow)
 */
export const REQUIRED_SECTIONS = [
	"## What We're Building",
	"## Why This Approach",
	"## Why This Matters",
	"## Key Decisions",
] as const;

/**
 * Default configuration
 */
export const DEFAULTS = {
	BRAINSTORMS_PATH: "docs/brainstorms",
	MAX_AGE_DAYS: 14,
} as const;
