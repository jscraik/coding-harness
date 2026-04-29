/**
 * Workflow Contract Checker
 *
 * Validates workflow contract documents against the spec in
 * `docs/specs/workflow-contract-v1.md`.
 *
 * This is a pure, deterministic validator with no I/O side effects.
 * It is the Slice 1 tracer bullet for Symphony adoption.
 */

import {
	type ChangeClass,
	type CheckFinding,
	type CheckResult,
	type CheckSeverity,
	type ExecutionMode,
	REQUIRED_ERROR_CODES,
	REQUIRED_LOG_FIELDS,
	TERMINAL_STATES,
	type TestMode,
	type TestTier,
	type TransitionRow,
	type WorkflowContract,
} from "./types.js";

// ─── Constants ──────────────────────────────────────────────────────────────────

const VALID_CHANGE_CLASSES: ChangeClass[] = [
	"behavior",
	"validation-only",
	"docs-only",
];
const VALID_TEST_MODES: TestMode[] = [
	"tdd-required",
	"validation-required",
	"n/a",
];
const VALID_TEST_TIERS: TestTier[] = [
	"unit",
	"integration",
	"e2e",
	"mixed",
	"n/a",
];
const VALID_YES_NO = ["yes", "no"] as const;
const VALID_EXECUTION_MODES: ExecutionMode[] = ["STRICT", "ADVISORY"];

// ─── Finding helpers ────────────────────────────────────────────────────────────

function finding(
	code: string,
	severity: CheckSeverity,
	message: string,
	path: string,
	fix?: string,
): CheckFinding {
	const f: CheckFinding = { code, severity, message, path };
	if (fix !== undefined) {
		f.fix = fix;
	}
	return f;
}

function error(
	code: string,
	message: string,
	path: string,
	fix?: string,
): CheckFinding {
	return finding(code, "error", message, path, fix);
}

function warning(
	code: string,
	message: string,
	path: string,
	fix?: string,
): CheckFinding {
	return finding(code, "warning", message, path, fix);
}

// ─── Individual check functions ─────────────────────────────────────────────────

/** Check that metadata section is present and valid. */
function checkMetadata(
	contract: WorkflowContract,
	findings: CheckFinding[],
): void {
	const meta = contract.metadata;

	if (!meta) {
		findings.push(
			error(
				"MISSING_METADATA",
				"Workflow contract must include a metadata section",
				"metadata",
				"Add an owner, max_duration, escalation, and change_class to metadata",
			),
		);
		return;
	}

	if (!meta.owner || typeof meta.owner !== "string") {
		findings.push(
			error(
				"MISSING_OWNER",
				"Metadata must include an owner field",
				"metadata.owner",
				"Set owner to the accountable maintainer or team",
			),
		);
	}

	if (!meta.max_duration || typeof meta.max_duration !== "string") {
		findings.push(
			error(
				"MISSING_MAX_DURATION",
				"Metadata must include a max_duration field",
				"metadata.max_duration",
				'Set max_duration to a duration string (e.g. "30m", "1h")',
			),
		);
	}

	if (!meta.escalation || typeof meta.escalation !== "string") {
		findings.push(
			error(
				"MISSING_ESCALATION",
				"Metadata must include an escalation path",
				"metadata.escalation",
				"Set escalation to the escalation path for this workflow",
			),
		);
	}

	if (!meta.change_class || !VALID_CHANGE_CLASSES.includes(meta.change_class)) {
		findings.push(
			error(
				"INVALID_CHANGE_CLASS",
				`change_class must be one of: ${VALID_CHANGE_CLASSES.join(", ")}`,
				"metadata.change_class",
				`Set change_class to one of: ${VALID_CHANGE_CLASSES.join(", ")}`,
			),
		);
	}
}

/** Check that validation contract is present and internally consistent. */
function checkValidationContract(
	contract: WorkflowContract,
	findings: CheckFinding[],
): void {
	const vc = contract.validation_contract;
	const changeClass = contract.metadata?.change_class;

	if (!vc) {
		// behavior change_class requires a non-n/a validation contract
		if (changeClass === "behavior") {
			findings.push(
				error(
					"MISSING_VALIDATION_CONTRACT",
					"Behavior-changing workflows must declare a validation contract",
					"validation_contract",
					"Add a validation_contract section with test_mode, test_tier, etc.",
				),
			);
		}
		return;
	}

	// test_mode
	if (!VALID_TEST_MODES.includes(vc.test_mode)) {
		findings.push(
			error(
				"INVALID_TEST_MODE",
				`test_mode must be one of: ${VALID_TEST_MODES.join(", ")}`,
				"validation_contract.test_mode",
				`Set test_mode to one of: ${VALID_TEST_MODES.join(", ")}`,
			),
		);
	}

	// test_tier
	if (!VALID_TEST_TIERS.includes(vc.test_tier)) {
		findings.push(
			error(
				"INVALID_TEST_TIER",
				`test_tier must be one of: ${VALID_TEST_TIERS.join(", ")}`,
				"validation_contract.test_tier",
				`Set test_tier to one of: ${VALID_TEST_TIERS.join(", ")}`,
			),
		);
	}

	// tracer_bullet_first
	if (!VALID_YES_NO.includes(vc.tracer_bullet_first as "yes" | "no")) {
		findings.push(
			error(
				"INVALID_TRACER_BULLET_FIRST",
				"tracer_bullet_first must be 'yes' or 'no'",
				"validation_contract.tracer_bullet_first",
			),
		);
	}

	// red_evidence_required
	if (!VALID_YES_NO.includes(vc.red_evidence_required as "yes" | "no")) {
		findings.push(
			error(
				"INVALID_RED_EVIDENCE_REQUIRED",
				"red_evidence_required must be 'yes' or 'no'",
				"validation_contract.red_evidence_required",
			),
		);
	}

	// Invariant: change_class = behavior must declare a non-n/a validation contract
	if (changeClass === "behavior" && vc.test_mode === "n/a") {
		findings.push(
			error(
				"BEHAVIOR_REQUIRES_VALIDATION",
				"change_class 'behavior' must declare a non-n/a validation contract (test_mode cannot be n/a)",
				"validation_contract.test_mode",
				"Set test_mode to 'tdd-required' or 'validation-required'",
			),
		);
	}

	// Invariant: test_mode = tdd-required implies red_evidence_required = yes
	if (vc.test_mode === "tdd-required" && vc.red_evidence_required !== "yes") {
		findings.push(
			error(
				"TDD_REQUIRES_RED_EVIDENCE",
				"test_mode 'tdd-required' implies red_evidence_required must be 'yes'",
				"validation_contract.red_evidence_required",
				"Set red_evidence_required to 'yes' when test_mode is 'tdd-required'",
			),
		);
	}

	// Invariant: change_class = behavior + test_mode != tdd-required requires exemption_reason
	if (
		changeClass === "behavior" &&
		vc.test_mode !== "tdd-required" &&
		vc.test_mode !== "n/a"
	) {
		if (!vc.exemption_reason) {
			findings.push(
				error(
					"MISSING_EXEMPTION_REASON",
					"Behavior-changing workflows with test_mode != tdd-required must include exemption_reason",
					"validation_contract.exemption_reason",
					"Add exemption_reason explaining why TDD is not used",
				),
			);
		}
	}

	// Invariant: exemption_reason requires reviewed_by
	if (vc.exemption_reason && !vc.reviewed_by) {
		findings.push(
			error(
				"MISSING_REVIEWED_BY",
				"exemption_reason requires a reviewed_by field",
				"validation_contract.reviewed_by",
				"Add reviewed_by with the reviewer's identifier",
			),
		);
	}

	// Non-behavior workflows still need deterministic validation strategy
	if (
		(changeClass === "validation-only" || changeClass === "docs-only") &&
		vc.test_mode === "n/a" &&
		vc.test_tier === "n/a"
	) {
		findings.push(
			warning(
				"VALIDATION_ONLY_NEEDS_STRATEGY",
				"validation-only and docs-only workflows should still declare a deterministic validation strategy",
				"validation_contract",
				"Consider setting test_mode to 'validation-required' even for non-behavior changes",
			),
		);
	}
}

/** Check transition table for completeness and determinism. */
function checkTransitions(
	contract: WorkflowContract,
	findings: CheckFinding[],
): void {
	const transitions = contract.transitions;

	if (!transitions || !Array.isArray(transitions)) {
		findings.push(
			error(
				"MISSING_TRANSITIONS",
				"Workflow contract must include a transitions array (canonical S|E|G|A|N table)",
				"transitions",
				"Add a transitions array with at least one transition row",
			),
		);
		return;
	}

	if (transitions.length === 0) {
		findings.push(
			error(
				"EMPTY_TRANSITIONS",
				"Transition table must contain at least one row",
				"transitions",
			),
		);
		return;
	}

	// Check each row has 5 non-empty cells
	for (let i = 0; i < transitions.length; i++) {
		const row = transitions[i] as TransitionRow;
		const fields: (keyof TransitionRow)[] = ["S", "E", "G", "A", "N"];

		for (const field of fields) {
			const value = row[field];
			if (!value || typeof value !== "string" || value.trim() === "") {
				findings.push(
					error(
						"INCOMPLETE_TRANSITION_ROW",
						`Transition row ${i} has empty or missing field '${field}'`,
						`transitions[${i}].${field}`,
						"Each transition row must have 5 non-empty cells: S, E, G, A, N",
					),
				);
			}
		}
	}

	// Collect all states
	const allStates = new Set<string>();
	const nonTerminalStates = new Set<string>();
	const statesWithOutbound = new Set<string>();
	const terminalStates = new Set<string>(
		TERMINAL_STATES as unknown as string[],
	);

	for (const row of transitions) {
		if (row.S) allStates.add(row.S);
		if (row.N) allStates.add(row.N);

		if (row.S && !terminalStates.has(row.S)) {
			nonTerminalStates.add(row.S);
		}

		if (row.S) statesWithOutbound.add(row.S);
	}

	// Invariant: terminal states have no outbound transitions
	for (const state of terminalStates) {
		if (statesWithOutbound.has(state)) {
			findings.push(
				error(
					"TERMINAL_HAS_OUTBOUND",
					`Terminal state '${state}' must not have outbound transitions`,
					"transitions",
					`Remove transitions where S = '${state}'`,
				),
			);
		}
	}

	// Invariant: every non-terminal state must have at least one outbound transition
	for (const state of allStates) {
		if (!terminalStates.has(state) && !statesWithOutbound.has(state)) {
			findings.push(
				error(
					"DEAD_STATE",
					`Non-terminal state '${state}' has no outbound transitions (dead state)`,
					"transitions",
					`Add at least one transition from state '${state}' or mark it as terminal`,
				),
			);
		}
	}

	// Invariant: deterministic (S,E) guard resolution — no overlapping guards
	const seGuardMap = new Map<string, string[]>();
	for (let i = 0; i < transitions.length; i++) {
		const row = transitions[i] as TransitionRow;
		const key = `${row.S}|${row.E}`;
		const existing = seGuardMap.get(key) ?? [];
		existing.push(row.G);
		seGuardMap.set(key, existing);
	}

	for (const [key, guards] of seGuardMap.entries()) {
		if (guards.length > 1) {
			// Multiple transitions for same (S,E) — check guards are distinct
			const uniqueGuards = new Set(guards);
			if (uniqueGuards.size !== guards.length) {
				findings.push(
					error(
						"NON_DETERMINISTIC_TRANSITION",
						`(S,E) pair '${key}' has duplicate guards — transition resolution is ambiguous`,
						"transitions",
						"Ensure each (S,E) pair has unique guards for deterministic resolution",
					),
				);
			}
		}
	}

	// Check that failure paths route to FAIL or BLOCKED
	const hasFailPath = transitions.some(
		(r) => r.N === "FAIL" || r.N === "BLOCKED",
	);
	if (!hasFailPath) {
		findings.push(
			warning(
				"NO_FAILURE_PATH",
				"Transition table has no transitions to FAIL or BLOCKED — consider adding explicit failure paths",
				"transitions",
				"Add transitions that route errors to FAIL or BLOCKED states",
			),
		);
	}
}

/** Check required error taxonomy. */
function checkErrorCodes(
	contract: WorkflowContract,
	findings: CheckFinding[],
): void {
	const errorCodes = contract.error_codes;

	if (!errorCodes || !Array.isArray(errorCodes)) {
		findings.push(
			error(
				"MISSING_ERROR_CODES",
				"Workflow contract must declare error codes",
				"error_codes",
				`Declare error_codes including: ${REQUIRED_ERROR_CODES.join(", ")}`,
			),
		);
		return;
	}

	for (const required of REQUIRED_ERROR_CODES) {
		if (!errorCodes.includes(required)) {
			findings.push(
				error(
					"MISSING_ERROR_CODE",
					`Required error code '${required}' is missing`,
					"error_codes",
					`Add '${required}' to the error_codes list`,
				),
			);
		}
	}
}

/** Check execution mode declarations. */
function checkExecutionModes(
	contract: WorkflowContract,
	findings: CheckFinding[],
): void {
	const modes = contract.execution_modes;

	if (!modes || !Array.isArray(modes)) {
		findings.push(
			error(
				"MISSING_EXECUTION_MODES",
				"Workflow contract must declare execution modes",
				"execution_modes",
				`Declare execution_modes including: ${VALID_EXECUTION_MODES.join(", ")}`,
			),
		);
		return;
	}

	for (const required of VALID_EXECUTION_MODES) {
		if (!modes.includes(required)) {
			findings.push(
				error(
					"MISSING_EXECUTION_MODE",
					`Required execution mode '${required}' is not declared`,
					"execution_modes",
					`Add '${required}' to execution_modes`,
				),
			);
		}
	}
}

/** Check dry-run semantics declaration. */
function checkDryRun(
	contract: WorkflowContract,
	findings: CheckFinding[],
): void {
	const dryRun = contract.dry_run;

	if (!dryRun) {
		findings.push(
			error(
				"MISSING_DRY_RUN",
				"Workflow contract must declare dry-run semantics",
				"dry_run",
				"Add dry_run with no_side_effects and deterministic_trace set to true",
			),
		);
		return;
	}

	if (dryRun.no_side_effects !== true) {
		findings.push(
			error(
				"DRY_RUN_SIDE_EFFECTS",
				"Dry-run must declare no_side_effects = true",
				"dry_run.no_side_effects",
				"Set no_side_effects to true",
			),
		);
	}

	if (dryRun.deterministic_trace !== true) {
		findings.push(
			error(
				"DRY_RUN_NON_DETERMINISTIC",
				"Dry-run must declare deterministic_trace = true",
				"dry_run.deterministic_trace",
				"Set deterministic_trace to true",
			),
		);
	}
}

/** Check required observability log fields. */
function checkLogFields(
	contract: WorkflowContract,
	findings: CheckFinding[],
): void {
	const logFields = contract.log_fields;

	if (!logFields || !Array.isArray(logFields)) {
		findings.push(
			error(
				"MISSING_LOG_FIELDS",
				"Workflow contract must declare observability log fields",
				"log_fields",
				`Declare log_fields including: ${REQUIRED_LOG_FIELDS.join(", ")}`,
			),
		);
		return;
	}

	for (const required of REQUIRED_LOG_FIELDS) {
		if (!logFields.includes(required)) {
			findings.push(
				error(
					"MISSING_LOG_FIELD",
					`Required observability log field '${required}' is missing`,
					"log_fields",
					`Add '${required}' to the log_fields list`,
				),
			);
		}
	}
}

// ─── Main Checker ───────────────────────────────────────────────────────────────

/**
 * Validate a workflow contract against the spec in
 * `docs/specs/workflow-contract-v1.md`.
 *
 * Pure function — no I/O, no side effects. Returns a machine-readable
 * pass/fail report with all findings.
 */
export function checkWorkflowContract(contract: WorkflowContract): CheckResult {
	const findings: CheckFinding[] = [];

	// Run all checks
	checkMetadata(contract, findings);
	checkValidationContract(contract, findings);
	checkTransitions(contract, findings);
	checkErrorCodes(contract, findings);
	checkExecutionModes(contract, findings);
	checkDryRun(contract, findings);
	checkLogFields(contract, findings);

	const errors = findings.filter((f) => f.severity === "error").length;
	const warnings = findings.filter((f) => f.severity === "warning").length;

	return {
		pass: errors === 0,
		findings,
		summary: {
			errors,
			warnings,
			checks_run: 7, // metadata, validation, transitions, errors, modes, dry-run, logs
		},
	};
}
