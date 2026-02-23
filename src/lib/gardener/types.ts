/**
 * Gardener Types and Interfaces
 *
 * Types for the recurring gardening workflow
 */

/** Exit codes for programmatic consumption */
export const EXIT_CODES = {
	SUCCESS: 0,
	ISSUES_FOUND: 1,
	FILE_NOT_FOUND: 2,
	SYSTEM_ERROR: 10, // higher priority system errors
} as const;

/** Options for running the gardener command */
export interface GardenerOptions {
	/** Path to docs directory */
	docsPath?: string;
	/** Preview changes without writing */
	dryRun?: boolean;
	/** Output results as JSON for agent consumption */
	json?: boolean;
	/** Number of days before doc is considered stale */
	staleDays?: number;
	/** Base branch for PR */
	baseBranch?: string;
}

/** Represents a stale document that needs validation */
export interface StaleDoc {
	/** Relative path from docs root */
	path: string;
	/** ISO date string of last validation, or null = never validated */
	lastValidated: string | null;
	/** Days since last validation (Infinity if never validated) */
	daysSinceValidation: number;
}

/** Represents a broken link */
export interface BrokenLink {
	/** File containing the broken link */
	file: string;
	/** The broken link URL */
	link: string;
	/** HTTP status code if available */
	statusCode: number | null;
	/** Error message if link check failed */
	error?: string;
}

/** Quality score breakdown */
export interface QualityScore {
	/** Overall quality score (0-100) */
	score: number;
	/** ISO date string of calculation */
	calculatedAt: string;
	/** Number of stale documents */
	staleDocCount: number;
	/** Number of broken links */
	brokenLinkCount: number;
	/** Deduction for stale docs (count * 5) */
	staleDeduction: number;
	/** Deduction for broken links (count * 10) */
	brokenLinkDeduction: number;
}

/** Output from the gardener analysis */
export interface GardenerOutput {
	/** Documents that need validation */
	staleDocs: StaleDoc[];
	/** Broken links found */
	brokenLinks: BrokenLink[];
	/** Current quality score (null if not calculated) */
	qualityScore: QualityScore | null;
	/** Whether a maintenance PR should be created */
	needsPR: boolean;
}

/** Error output from gardener */
export interface GardenerErrorOutput {
	/** Machine-readable error code */
	code: string;
	/** Human-readable error message */
	message: string;
	/** Additional error details */
	details?: unknown;
}

/** Discriminated union result type for type-safe error handling */
export type GardenerResult =
	| { ok: true; output: GardenerOutput }
	| { ok: false; error: GardenerErrorOutput };

/** Default number of days before doc is considered stale */
export const DEFAULT_STALE_DAYS = 30;

/** Deduction per stale document */
export const STALE_DOC_DEDUCTION = 5;

/** Deduction per broken link */
export const BROKEN_LINK_DEDUCTION = 10;

/** Maximum quality score */
export const MAX_QUALITY_SCORE = 100;
