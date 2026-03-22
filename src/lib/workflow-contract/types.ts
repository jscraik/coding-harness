/**
 * Workflow Contract Types (v1)
 *
 * Type definitions for Symphony-aligned workflow contracts.
 * Validates deterministic `(S,E)` state machines per `docs/specs/workflow-contract-v1.md`.
 */

// ─── Metadata ──────────────────────────────────────────────────────────────────

/** Classification of the type of change a workflow represents. */
export type ChangeClass = "behavior" | "validation-only" | "docs-only";

/** Workflow contract metadata required at the top level. */
export interface WorkflowMetadata {
	/** Accountable maintainer or team. */
	owner: string;
	/** Maximum execution window (e.g. "30m", "1h", "24h"). */
	max_duration: string;
	/** Explicit escalation path. */
	escalation: string;
	/** Classification of the change this workflow represents. */
	change_class: ChangeClass;
}

// ─── Validation Contract ────────────────────────────────────────────────────────

/** Test mode declarations for behavior-changing workflows. */
export type TestMode = "tdd-required" | "validation-required" | "n/a";

/** Test tier classifies the expected level of testing. */
export type TestTier = "unit" | "integration" | "e2e" | "mixed" | "n/a";

/** Validation contract fields describe the testing strategy for a workflow. */
export interface ValidationContract {
	test_mode: TestMode;
	test_tier: TestTier;
	tracer_bullet_first: "yes" | "no";
	red_evidence_required: "yes" | "no";
	/** Required when change_class = behavior and test_mode != tdd-required. */
	exemption_reason?: string;
	/** Required when exemption_reason is set. */
	reviewed_by?: string;
}

// ─── Error Taxonomy ─────────────────────────────────────────────────────────────

/** Required error codes per the workflow contract v1 spec. */
export const REQUIRED_ERROR_CODES = [
	"VALIDATION_ERROR",
	"BLOCKED_DEPENDENCY",
	"POLICY_FAIL",
	"SYSTEM_ERROR",
] as const;

export type ErrorCode = (typeof REQUIRED_ERROR_CODES)[number];

// ─── Execution Modes ────────────────────────────────────────────────────────────

/** Execution mode determines how strictly policy violations are enforced. */
export type ExecutionMode = "STRICT" | "ADVISORY";

// ─── Transition Table ───────────────────────────────────────────────────────────

/** Terminal states have no outbound transitions. */
export const TERMINAL_STATES = ["DONE", "FAIL", "BLOCKED"] as const;
export type TerminalState = (typeof TERMINAL_STATES)[number];

/** A single row in the S|E|G|A|N transition table. */
export interface TransitionRow {
	/** Current state. */
	S: string;
	/** Event that triggers the transition. */
	E: string;
	/** Guard condition that must be satisfied. */
	G: string;
	/** Action to execute on transition. */
	A: string;
	/** Next state after the transition. */
	N: string;
}

// ─── Observability ──────────────────────────────────────────────────────────────

/** Required fields in observability log entries. */
export const REQUIRED_LOG_FIELDS = [
	"workflow_id",
	"transition_code",
	"from_state",
	"to_state",
	"correlation_id",
	"result",
] as const;

export type LogField = (typeof REQUIRED_LOG_FIELDS)[number];

// ─── Dry-Run ────────────────────────────────────────────────────────────────────

/** Dry-run semantics declaration. */
export interface DryRunSemantics {
	/** Dry-run must have no side effects. */
	no_side_effects: boolean;
	/** Dry-run must emit deterministic transition trace output. */
	deterministic_trace: boolean;
}

// ─── Full Workflow Contract ─────────────────────────────────────────────────────

/**
 * Complete workflow contract as defined in docs/specs/workflow-contract-v1.md.
 *
 * This is the parsed, typed representation of a workflow contract document.
 */
export interface WorkflowContract {
	metadata: WorkflowMetadata;
	validation_contract: ValidationContract;
	transitions: TransitionRow[];
	error_codes: string[];
	execution_modes: string[];
	dry_run: DryRunSemantics;
	log_fields: string[];
}

// ─── Checker Result ─────────────────────────────────────────────────────────────

/** Severity of a check finding. */
export type CheckSeverity = "error" | "warning";

/** A single finding from the workflow contract checker. */
export interface CheckFinding {
	/** Machine-readable code for programmatic handling. */
	code: string;
	/** Severity: error blocks, warning is advisory. */
	severity: CheckSeverity;
	/** Human-readable message describing the finding. */
	message: string;
	/** Path to the problematic element (dot-separated). */
	path: string;
	/** Suggested fix. */
	fix?: string;
}

/** Result of running the workflow contract checker. */
export interface CheckResult {
	/** Whether all checks passed (no errors). */
	pass: boolean;
	/** List of individual findings (errors and warnings). */
	findings: CheckFinding[];
	/** Summary counts. */
	summary: {
		errors: number;
		warnings: number;
		checks_run: number;
	};
}
