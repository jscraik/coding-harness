import type { BrainValidationResult } from "./brain-validator.js";
import type { DomainMapping } from "./domain-mapper.js";
import type { StalenessReport } from "./metadata-scanner.js";

/** Public API export. */
export const EXIT_CODES = {
	SUCCESS: 0,
	WARNINGS: 1,
	ERRORS: 2,
	NOT_FOUND: 3,
	INVALID_ARGS: 4,
} as const;

/** Public API export. */
export type BrainExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

/** Public API export. */
export interface BrainStatusResult {
	valid: boolean;
	harnessDir: string;
	validation: BrainValidationResult;
	maturity: {
		level: "seeded" | "partial" | "mature";
		placeholderDomains: string[];
		recommendations: string[];
	};
}

/** Public API export. */
export interface BrainQueryMatch {
	path: string;
	lineNumber: number;
	line: string;
	domain?: string | undefined;
}

/** Public API export. */
export interface BrainQueryResult {
	query: string;
	matches: BrainQueryMatch[];
	total: number;
}

/** Public API export. */
export type BrainAddType = "learning" | "rule" | "hypothesis" | "decision";

/** Public API export. */
export interface BrainAddResult {
	type: BrainAddType;
	domain: string;
	path: string;
	content: string;
	appended: boolean;
}

/** Public API export. */
export interface BrainPreflightContext {
	/** Domain that this context relates to */
	domain: string;
	/** Relevance score 0-1 */
	relevance: number;
	/** Active rules for this domain */
	rules: string[];
	/** Recent learnings relevant to this domain */
	learnings: string[];
	/** Relevant quality criteria */
	qualityCriteria: string[];
	/** Relevant confirmed facts */
	facts: string[];
	/** Relevant gotchas */
	gotchas: string[];
}

/** Public API export. */
export interface BrainPreflightResult {
	files: string[];
	domainMappings: DomainMapping[];
	contexts: BrainPreflightContext[];
	totalRules: number;
	totalFacts: number;
}

/** Public API export. */
export interface BrainStaleResult {
	report: StalenessReport;
}

/** Public API export. */
export interface BrainCliResult {
	exitCode: BrainExitCode;
	result?:
		| BrainStatusResult
		| BrainQueryResult
		| BrainAddResult
		| BrainPreflightResult
		| BrainStaleResult;
}
