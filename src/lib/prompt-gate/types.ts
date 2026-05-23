export const EXIT_CODES = {
	SUCCESS: 0,
	TEMPLATE_MISSING: 1,
	VALIDATION_ERROR: 2,
	SYSTEM_ERROR: 10,
} as const;

export const PROMPT_TYPES = [
	"feature",
	"bugfix",
	"refactor",
	"release",
] as const;

/** Prompt template categories supported by the prompt gate. */
export type PromptType = (typeof PROMPT_TYPES)[number];

/** Options used to validate a prompt document. */
export interface PromptGateOptions {
	/** Type of prompt template to validate against */
	type: PromptType;
	/** Path to the prompt/document file to validate */
	file: string;
	/** Output as JSON */
	json?: boolean;
	/** Base directory for path resolution */
	baseDir?: string;
}

/** Validation details returned for a prompt document. */
export interface PromptValidationResult {
	/** Whether validation passed */
	passed: boolean;
	/** Template type validated against */
	templateType: PromptType;
	/** Checked sections and their status */
	checks: {
		/** Section name */
		section: string;
		/** Whether section was found */
		found: boolean;
		/** Optional: count of checked items found */
		itemsFound?: number;
	}[];
	/** Missing required sections */
	missing: string[];
	/** Validation errors */
	errors: string[];
}

/** Prompt gate command output with either validation results or an error. */
export type PromptGateOutput =
	| { ok: true; result: PromptValidationResult }
	| { ok: false; error: { code: string; message: string } };

/** Return whether a string is a supported prompt template category. */
export function isPromptType(value: string): value is PromptType {
	return PROMPT_TYPES.includes(value as PromptType);
}
