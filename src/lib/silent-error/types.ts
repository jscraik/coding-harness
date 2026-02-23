/**
 * Silent error detection types
 *
 * Defines patterns that indicate silent error handling anti-patterns.
 */

/**
 * Semantic exit codes for silent-error command
 */
export const EXIT_CODES = {
	/** No silent error patterns detected */
	SUCCESS: 0,
	/** Silent error patterns found */
	SILENT_ERRORS_FOUND: 1,
	/** Invalid input or configuration */
	VALIDATION_ERROR: 2,
	/** System error during analysis */
	SYSTEM_ERROR: 10,
} as const;

/**
 * Types of silent error patterns
 */
export type SilentErrorPatternType =
	| "empty-catch"
	| "swallowed-error"
	| "console-only"
	| "silent-fallback"
	| "unused-error-variable";

/**
 * Severity of the detected pattern
 */
export type PatternSeverity = "error" | "warning";

/**
 * Individual silent error detection
 */
export interface SilentErrorDetection {
	/** Pattern type */
	type: SilentErrorPatternType;
	/** Human-readable description */
	description: string;
	/** Severity level */
	severity: PatternSeverity;
	/** File path */
	file: string;
	/** Line number (1-based) */
	line: number;
	/** Column number (1-based) */
	column: number;
	/** Snippet of code */
	snippet: string;
	/** Suggested fix */
	suggestion?: string;
}

/**
 * Silent error detector options
 */
export interface SilentErrorDetectorOptions {
	/** Files to analyze */
	files?: string[];
	/** Directories to scan */
	dirs?: string[];
	/** File patterns to include (glob) */
	include?: string[];
	/** File patterns to exclude (glob) */
	exclude?: string[];
	/** Output JSON instead of text */
	json?: boolean;
	/** Treat warnings as errors */
	strict?: boolean;
	/** Show suggestions */
	suggestions?: boolean;
}

/**
 * Silent error detector result
 */
export interface SilentErrorDetectorResult {
	/** Overall pass/fail */
	passed: boolean;
	/** Detections found */
	detections: SilentErrorDetection[];
	/** Files analyzed */
	filesAnalyzed: number;
	/** Summary by type */
	summary: {
		total: number;
		errors: number;
		warnings: number;
		byType: Record<SilentErrorPatternType, number>;
	};
}

/**
 * Pattern definition for detection
 */
export interface PatternDefinition {
	/** Pattern ID */
	id: SilentErrorPatternType;
	/** Human name */
	name: string;
	/** Description of the pattern */
	description: string;
	/** Severity */
	severity: PatternSeverity;
	/** Regex patterns to detect (TypeScript/JavaScript) */
	regexes: RegExp[];
	/** Suggested fix template */
	suggestion?: string;
}
