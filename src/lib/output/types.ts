/**
 * Canonical structured output types for harness gate commands.
 *
 * All gate commands with --json output must produce a GateResult.
 * Gate-internal types are adapted to this shape at the CLI boundary via
 * the adapter functions in ./normalise.ts.
 *
 * @see docs/specs/2026-03-24-feature-structured-output-auto-fix-spec.md
 * @see docs/plans/2026-03-24-feature-structured-output-auto-fix-plan.md
 */

/**
 * Canonical finding shape emitted by every gate command under --json.
 * Gate-internal types are adapted to this shape at the CLI boundary.
 */
export interface GateFinding {
	/**
	 * Stable dot-scoped ID: "<gate>.<surface>.<rule>" e.g. "drift.command.missing"
	 * For binary-result gates: "<gate>.result.error.<index>" (e.g. "policy-gate.result.error.0")
	 * For check-list gates:    "<gate>.check.<code>"        (e.g. "linear-gate.check.ISSUE_KEY_PRESENT")
	 * For coded-error gates:   "<gate>.result.error.<CODE>" (e.g. "plan-gate.result.error.MISSING")
	 */
	id: string;
	/** Severity level — agents must treat "error" as blocking */
	severity: "error" | "warning" | "info";
	/** Gate that produced this finding */
	gate: string;
	/** Human-readable description */
	message: string;
	/** Affected file path relative to repo root (when applicable) */
	path?: string;
	/**
	 * Whether this finding was in the pre-existing baseline.
	 * Binary-result gates always emit baseline: false (no baseline concept).
	 */
	baseline: boolean;
	/** Spec-aligned failure class for blocked-state resume routing */
	failureClass?: string;
	/** Actionable fix guidance */
	fix: {
		/** Exact harness CLI command to resolve (when automatable) */
		command?: string;
		/** Human instruction when no CLI fix exists */
		manual?: string;
		/** Whether the finding can be suppressed */
		suppressible: boolean;
	};
}

/**
 * Canonical structured output of a single gate run under --json.
 */
export interface GateResult {
	/** Gate identifier — matches the harness subcommand name */
	gate: string;
	/** Semver of the gate implementation */
	version: string;
	/** ISO 8601 timestamp of when the gate ran */
	timestamp: string;
	/** Aggregate status */
	status: "pass" | "warn" | "fail" | "skipped";
	/** All findings (pass, warn, fail) */
	findings: GateFinding[];
	/** Convenience counts */
	summary: {
		errors: number;
		warnings: number;
		info: number;
		/** errors + warnings + info — all findings including info-level */
		total: number;
	};
	/** Why this status was assigned */
	reason: string;
	/** Actionable next steps to take immediately */
	action_now: string[];
	/** Follow-up actions that can be deferred */
	action_later: string[];
	/** Concrete evidence pointers (file paths, finding ids, gate refs) */
	evidence_ref: string[];
	/** Gate-specific metadata (pass-through, not standardised) */
	meta?: Record<string, unknown>;
}

/**
 * Result of harness health --auto-fix
 */
export interface AutoFixResult {
	/** ISO 8601 timestamp */
	timestamp: string;
	/** Whether this was a dry run */
	dryRun: boolean;
	/** Fixes that were applied (or would be, in dry-run) */
	applied: Array<{
		findingId: string;
		command: string;
		exitCode: number | null;
		/** null in dry-run mode */
		stdout: string | null;
		/** stderr captured from the fix command; null in dry-run mode */
		stderr: string | null;
	}>;
	/** Findings that required manual intervention (no fix.command) */
	manual: GateFinding[];
	/** Counts */
	summary: {
		/** Total findings processed */
		total: number;
		applied: number;
		manual: number;
		failed: number;
	};
}
