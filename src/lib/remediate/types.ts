import type { RemediationOutcome } from "../remediation/types.js";

/**
 * CLI options for `harness remediate`.
 */
export interface RemediateOptions {
	/** Execution subcommand: "run" (plan only) or "apply" (execute) */
	subcommand?: "run" | "apply";
	/** Behavioral mode: "manual" (default) or "autonomous" */
	mode?: "manual" | "autonomous";
	/** Repository owner */
	owner?: string;
	/** Repository name */
	repo?: string;
	/** PR number */
	prNumber?: number;
	/** Provider: "codeql" or "codex" */
	provider?: "codeql" | "codex";
	/** Maximum severity tier for auto-apply */
	maxAutoTier?: "high" | "medium" | "low";
	/** JSON file path for findings, or "-" for stdin */
	findings?: string;
	/** Run in dry-run mode (no actual changes) */
	dryRun?: boolean;
	/** Output as JSON */
	json?: boolean;
	/** Path to contract file */
	contractPath?: string;
	/** HEAD SHA (defaults to current git HEAD) */
	headSha?: string;
	/** Skip interactive prompts */
	noInput?: boolean;
	/** Force execution in apply mode */
	force?: boolean;
	/** Path to completion marker file */
	completionMarkerPath?: string;
	/** Optional override for canonical run-record base dir */
	runRecordsDir?: string;
}

/**
 * Result envelope returned by remediation execution.
 */
export interface RemediateResult {
	outcome: RemediationOutcome;
	exitCode: number;
}
