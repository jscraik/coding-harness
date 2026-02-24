/**
 * Memory policy types and schema validation
 *
 * Defines the contract for local-memory artifacts following
 * the read-first/write-discipline/closeout pattern.
 */

/**
 * Semantic exit codes for memory-gate command
 */
export const EXIT_CODES = {
	/** Memory artifacts valid and compliant */
	SUCCESS: 0,
	/** Schema validation failed */
	SCHEMA_VIOLATION: 1,
	/** Read-first preamble missing */
	MISSING_PREAMBLE: 2,
	/** Write-discipline violation */
	WRITE_DISCIPLINE_ERROR: 3,
	/** Closeout incomplete */
	CLOSEOUT_INCOMPLETE: 4,
	/** System error during validation */
	SYSTEM_ERROR: 10,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

/**
 * Memory entry levels per local-memory workflow
 */
export type MemoryLevel = "observation" | "learning";

/**
 * Valid memory levels
 */
export const VALID_MEMORY_LEVELS: MemoryLevel[] = ["observation", "learning"];

/**
 * Memory entry structure
 */
export interface MemoryEntry {
	/** Entry type: observation (raw) or learning (interpreted) */
	level: MemoryLevel;
	/** Factual sentence with direct evidence path */
	content: string;
	/** Stable taxonomy tags */
	tags: string[];
	/** Session identifier for provenance */
	session_id: string;
	/** Optional source reference */
	source?: string;
	/** ISO timestamp of observation */
	observed_at?: string;
}

/**
 * Memory summary file structure (memory.json)
 */
export interface MemorySummary {
	/** Repository identifier */
	repo: string;
	/** Session/task identifier */
	session_id: string;
	/** Required preamble check */
	preamble: {
		bootstrap: boolean;
		search: boolean;
	};
	/** Memory entries */
	entries: MemoryEntry[];
	/** Closeout validation */
	closeout: {
		forjamie_updated: boolean;
		date: string;
	};
	/** Metadata */
	meta: {
		created_at: string;
		version: "1.0";
	};
}

/**
 * Reliability metrics tracking
 */
export interface ReliabilityMetrics {
	/** Consecutive successful operations (pass^k) */
	pass_k: number;
	/** Total operations attempted */
	total_ops: number;
	/** Successful operations */
	successful_ops: number;
	/** Tool error count by command */
	tool_errors: Record<string, number>;
	/** Duplicate memory detection count */
	duplicate_memory_count: number;
	/** Unresolved questions with timestamps */
	unresolved_questions: Array<{
		question: string;
		asked_at: string;
		sla_hours: number;
	}>;
}

/**
 * Memory gate validation result
 */
export interface MemoryGateResult {
	/** Validation passed */
	ok: boolean;
	/** Exit code (semantic) */
	code: number;
	/** Human-readable message */
	message: string;
	/** Detailed violations */
	violations: Array<{
		type: "schema" | "preamble" | "discipline" | "closeout";
		message: string;
		path?: string;
	}>;
	/** Extracted metrics */
	metrics?: ReliabilityMetrics;
}

/**
 * Memory gate options
 */
export interface MemoryGateOptions {
	/** Path to memory.json file */
	memoryPath?: string;
	/** Path to FORJAMIE.md for closeout validation */
	forjamiePath?: string;
	/** Branch name for codex/* enforcement */
	branch?: string;
	/** Output JSON instead of text */
	json?: boolean;
	/** Path to metrics storage file */
	metricsPath?: string;
}

/**
 * Validation error for schema checks
 */
export interface ValidationError {
	path: string;
	message: string;
}

/**
 * Schema validation result
 */
export interface SchemaValidationResult<T> {
	valid: boolean;
	data?: T;
	errors: ValidationError[];
}

/**
 * Simple validation result with string errors
 */
export interface EntriesValidationResult {
	valid: boolean;
	errors: string[];
}

/**
 * Validation result with violations list
 */
export interface ViolationsResult {
	valid: boolean;
	violations: string[];
}

/**
 * Validate if value is a valid MemoryLevel
 */
export function isValidMemoryLevel(value: unknown): value is MemoryLevel {
	return (
		typeof value === "string" &&
		VALID_MEMORY_LEVELS.includes(value as MemoryLevel)
	);
}

/**
 * Validate if value is a valid MemoryEntry
 */
export function isValidMemoryEntry(value: unknown): value is MemoryEntry {
	if (typeof value !== "object" || value === null) return false;
	const entry = value as Record<string, unknown>;

	if (!isValidMemoryLevel(entry.level)) return false;
	if (typeof entry.content !== "string" || entry.content.length === 0)
		return false;
	if (!Array.isArray(entry.tags) || entry.tags.length === 0) return false;
	if (entry.tags.some((t) => typeof t !== "string" || t.length === 0))
		return false;
	if (typeof entry.session_id !== "string" || entry.session_id.length === 0)
		return false;
	if (entry.source !== undefined && typeof entry.source !== "string")
		return false;
	if (entry.observed_at !== undefined && typeof entry.observed_at !== "string")
		return false;

	return true;
}

/**
 * Validate MemorySummary structure
 */
export function validateMemorySummary(
	value: unknown,
): SchemaValidationResult<MemorySummary> {
	const errors: ValidationError[] = [];

	if (typeof value !== "object" || value === null) {
		return {
			valid: false,
			errors: [{ path: "", message: "Must be an object" }],
		};
	}

	const summary = value as Record<string, unknown>;

	// Check repo
	if (typeof summary.repo !== "string" || summary.repo.length === 0) {
		errors.push({ path: "repo", message: "Must be a non-empty string" });
	}

	// Check session_id
	if (
		typeof summary.session_id !== "string" ||
		summary.session_id.length === 0
	) {
		errors.push({ path: "session_id", message: "Must be a non-empty string" });
	}

	// Check preamble
	if (
		typeof summary.preamble !== "object" ||
		summary.preamble === null ||
		typeof (summary.preamble as Record<string, unknown>).bootstrap !==
			"boolean" ||
		typeof (summary.preamble as Record<string, unknown>).search !== "boolean"
	) {
		errors.push({
			path: "preamble",
			message: "Must have bootstrap and search boolean fields",
		});
	}

	// Check entries
	if (!Array.isArray(summary.entries)) {
		errors.push({ path: "entries", message: "Must be an array" });
	} else {
		for (let i = 0; i < summary.entries.length; i++) {
			if (!isValidMemoryEntry(summary.entries[i])) {
				errors.push({ path: `entries[${i}]`, message: "Invalid memory entry" });
			}
		}
	}

	// Check closeout
	if (
		typeof summary.closeout !== "object" ||
		summary.closeout === null ||
		typeof (summary.closeout as Record<string, unknown>).forjamie_updated !==
			"boolean" ||
		typeof (summary.closeout as Record<string, unknown>).date !== "string"
	) {
		errors.push({
			path: "closeout",
			message: "Must have forjamie_updated (boolean) and date (string) fields",
		});
	}

	// Check meta
	if (
		typeof summary.meta !== "object" ||
		summary.meta === null ||
		typeof (summary.meta as Record<string, unknown>).created_at !== "string" ||
		(summary.meta as Record<string, unknown>).version !== "1.0"
	) {
		errors.push({
			path: "meta",
			message: 'Must have created_at (string) and version ("1.0") fields',
		});
	}

	if (errors.length > 0) {
		return { valid: false, errors };
	}

	return { valid: true, data: summary as unknown as MemorySummary, errors: [] };
}
