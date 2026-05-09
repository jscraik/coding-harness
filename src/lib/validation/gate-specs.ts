import type {
	VerifyGateExecutionClass,
	VerifyGateFailureClass,
} from "../verify/run-state.js";

/** Public API export. */
export type ValidationGateMode = "fast" | "full";

/** Public API export. */
export type ValidationGateId =
	| "preflight"
	| "ci-check-alignment"
	| "hook-governance-inventory"
	| "hook-governance-rollout-check"
	| "hook-governance-docstring-ratchet"
	| "hook-governance-format-reports"
	| "validate-codestyle-fast"
	| "validate-codestyle";

/** Public API export. */
export interface ValidationGateModeOrder {
	fast?: number;
	full?: number;
}

/** Public API export. */
export type ValidationRetryPolicy = "none" | "transient-infra-only";

/** Public API export. */
export type ValidationFinalNextAction =
	| "fix contract/policy mismatch, then rerun from this gate"
	| "inspect gate output, fix root cause, and rerun"
	| "retry budget exhausted; fix infrastructure blocker and resume";

/** Public API export. */
export type ValidationPassedNextAction = "none";

/** Public API export. */
export type ValidationRetryNextAction = "retry";

/** Public API export. */
export type ValidationArtifactFieldPresence =
	| "required"
	| "resume-only"
	| "terminal-only";

/** Public API export. */
export interface ValidationArtifactFieldSpec {
	name: string;
	presence: ValidationArtifactFieldPresence;
}

/** Public API export. */
export interface ValidationArtifactContract {
	runFile: "run.json";
	gateFile: "gates/<gate-id>.json";
	summaryFile: "summary.json";
	runFields: readonly ValidationArtifactFieldSpec[];
	gateFields: readonly ValidationArtifactFieldSpec[];
	summaryFields: readonly ValidationArtifactFieldSpec[];
	reusedGateFields: readonly ValidationArtifactFieldSpec[];
}

/** Public API export. */
export interface ValidationFailureClassSpec {
	failureClass: VerifyGateFailureClass;
	finalNextAction: ValidationFinalNextAction;
	retryNextAction: ValidationRetryNextAction | null;
	retryEligibleExecutionClass: VerifyGateExecutionClass | null;
}

/** Public API export. */
export interface ValidationFailureTaxonomy {
	status: "non-authoritative typed mirror";
	passedNextAction: ValidationPassedNextAction;
	failureClasses: readonly ValidationFailureClassSpec[];
}

/** Public API export. */
export interface ValidationGateSpec {
	gateId: ValidationGateId;
	modes: readonly ValidationGateMode[];
	order: ValidationGateModeOrder;
	executionClass: VerifyGateExecutionClass;
	failureClassDefault: VerifyGateFailureClass;
	commandSurface: string;
	resumeCheckpoint: boolean;
	retryPolicy: ValidationRetryPolicy;
	artifactContract: ValidationArtifactContract;
	shellSource: {
		path: "scripts/verify-work.sh";
		lines: string;
	};
}

/** Public API export. */
export const VALIDATION_GATE_SPEC_SOURCE = {
	authority: "scripts/verify-work.sh",
	inventory:
		".harness/review/2026-05-09-JSC-290-validation-gate-graph-inventory.md",
	status: "non-authoritative typed mirror",
} as const;

/** Public API export. */
export const VALIDATION_ARTIFACT_CONTRACT = {
	runFile: "run.json",
	gateFile: "gates/<gate-id>.json",
	summaryFile: "summary.json",
	runFields: [
		{ name: "runId", presence: "required" },
		{ name: "mode", presence: "required" },
		{ name: "sourceRunId", presence: "required" },
		{ name: "status", presence: "required" },
		{ name: "startedAt", presence: "required" },
		{ name: "resumeFromGateId", presence: "required" },
		{ name: "repoRoot", presence: "required" },
		{ name: "providerClass", presence: "required" },
		{ name: "schemaVersion", presence: "required" },
		{ name: "contractVersion", presence: "required" },
		{ name: "contractFingerprint", presence: "required" },
		{ name: "lane", presence: "required" },
		{ name: "finishedAt", presence: "terminal-only" },
	],
	gateFields: [
		{ name: "gateId", presence: "required" },
		{ name: "executionClass", presence: "required" },
		{ name: "attempt", presence: "required" },
		{ name: "status", presence: "required" },
		{ name: "failureClass", presence: "required" },
		{ name: "startedAt", presence: "required" },
		{ name: "finishedAt", presence: "required" },
		{ name: "nextAction", presence: "required" },
		{ name: "exitCode", presence: "required" },
	],
	summaryFields: [
		{ name: "runId", presence: "required" },
		{ name: "overallStatus", presence: "required" },
		{ name: "failedGateId", presence: "required" },
		{ name: "freshVsResumed", presence: "required" },
		{ name: "durationMs", presence: "required" },
	],
	reusedGateFields: [
		{ name: "reused", presence: "resume-only" },
		{ name: "sourceRunId", presence: "resume-only" },
	],
} as const satisfies ValidationArtifactContract;

/** Public API export. */
export const VALIDATION_FAILURE_TAXONOMY = {
	status: "non-authoritative typed mirror",
	passedNextAction: "none",
	failureClasses: [
		{
			failureClass: "contract_policy",
			finalNextAction:
				"fix contract/policy mismatch, then rerun from this gate",
			retryNextAction: null,
			retryEligibleExecutionClass: null,
		},
		{
			failureClass: "transient_infra",
			finalNextAction:
				"retry budget exhausted; fix infrastructure blocker and resume",
			retryNextAction: "retry",
			retryEligibleExecutionClass: "read_only_parallel",
		},
		{
			failureClass: "internal_unknown",
			finalNextAction: "inspect gate output, fix root cause, and rerun",
			retryNextAction: null,
			retryEligibleExecutionClass: null,
		},
	],
} as const satisfies ValidationFailureTaxonomy;

/** Public API export. */
export const VALIDATION_GATE_SPECS = [
	{
		gateId: "preflight",
		modes: ["fast", "full"],
		order: { fast: 1, full: 1 },
		executionClass: "serial_guarded",
		failureClassDefault: "contract_policy",
		commandSurface:
			'bash scripts/codex-preflight.sh --stack "$stack" --mode required --bins "$bins_csv" --paths "$paths_csv"',
		resumeCheckpoint: true,
		retryPolicy: "none",
		artifactContract: VALIDATION_ARTIFACT_CONTRACT,
		shellSource: {
			path: "scripts/verify-work.sh",
			lines: "593 and 615-623",
		},
	},
	{
		gateId: "ci-check-alignment",
		modes: ["fast"],
		order: { fast: 2 },
		executionClass: "read_only_parallel",
		failureClassDefault: "contract_policy",
		commandSurface: "run_ci_check_alignment_gate",
		resumeCheckpoint: true,
		retryPolicy: "none",
		artifactContract: VALIDATION_ARTIFACT_CONTRACT,
		shellSource: {
			path: "scripts/verify-work.sh",
			lines: "596 and 624-628",
		},
	},
	{
		gateId: "hook-governance-inventory",
		modes: ["fast", "full"],
		order: { fast: 3, full: 2 },
		executionClass: "serial_guarded",
		failureClassDefault: "contract_policy",
		commandSurface:
			'python3 "$hook_inventory_builder" --manifest "$hook_scope_manifest" --out "$hook_inventory_output"',
		resumeCheckpoint: true,
		retryPolicy: "none",
		artifactContract: VALIDATION_ARTIFACT_CONTRACT,
		shellSource: {
			path: "scripts/verify-work.sh",
			lines: "597, 603, and 629-643",
		},
	},
	{
		gateId: "hook-governance-rollout-check",
		modes: ["fast", "full"],
		order: { fast: 4, full: 3 },
		executionClass: "read_only_parallel",
		failureClassDefault: "contract_policy",
		commandSurface:
			'python3 "$hook_rollout_checker" --inventory "$hook_inventory_output" --recovery-slo-hours 24 --out "$hook_rollout_output"',
		resumeCheckpoint: true,
		retryPolicy: "none",
		artifactContract: VALIDATION_ARTIFACT_CONTRACT,
		shellSource: {
			path: "scripts/verify-work.sh",
			lines: "598, 604, and 644-663",
		},
	},
	{
		gateId: "hook-governance-docstring-ratchet",
		modes: ["fast", "full"],
		order: { fast: 5, full: 4 },
		executionClass: "read_only_parallel",
		failureClassDefault: "contract_policy",
		commandSurface:
			'python3 "$hook_docstring_ratchet_evaluator" --classification "$hook_classification_input" --metrics "$hook_metrics_input" --window-days 14 --out "$hook_docstring_output"',
		resumeCheckpoint: true,
		retryPolicy: "none",
		artifactContract: VALIDATION_ARTIFACT_CONTRACT,
		shellSource: {
			path: "scripts/verify-work.sh",
			lines: "599, 605, and 664-684",
		},
	},
	{
		gateId: "hook-governance-format-reports",
		modes: ["fast", "full"],
		order: { fast: 6, full: 5 },
		executionClass: "serial_guarded",
		failureClassDefault: "contract_policy",
		commandSurface: "format_hook_governance_reports",
		resumeCheckpoint: true,
		retryPolicy: "none",
		artifactContract: VALIDATION_ARTIFACT_CONTRACT,
		shellSource: {
			path: "scripts/verify-work.sh",
			lines: "600, 606, and 685-689",
		},
	},
	{
		gateId: "validate-codestyle-fast",
		modes: ["fast"],
		order: { fast: 7 },
		executionClass: "read_only_parallel",
		failureClassDefault: "transient_infra",
		commandSurface:
			'bash scripts/validate-codestyle.sh --repo-root "$repo_root" --fast',
		resumeCheckpoint: true,
		retryPolicy: "transient-infra-only",
		artifactContract: VALIDATION_ARTIFACT_CONTRACT,
		shellSource: {
			path: "scripts/verify-work.sh",
			lines: "601 and 695-707",
		},
	},
	{
		gateId: "validate-codestyle",
		modes: ["full"],
		order: { full: 6 },
		executionClass: "serial_guarded",
		failureClassDefault: "internal_unknown",
		commandSurface:
			'bash scripts/validate-codestyle.sh --repo-root "$repo_root"',
		resumeCheckpoint: true,
		retryPolicy: "none",
		artifactContract: VALIDATION_ARTIFACT_CONTRACT,
		shellSource: {
			path: "scripts/verify-work.sh",
			lines: "607 and 690-694",
		},
	},
] as const satisfies readonly ValidationGateSpec[];

/**
 * Return the mode-specific order for a gate, if it participates in that mode.
 *
 * @param gate - Validation gate spec to inspect.
 * @param mode - Validation wrapper mode to inspect.
 * @returns The numeric execution order for the mode, or undefined when the gate is not in that mode.
 */
function getModeOrder(
	gate: ValidationGateSpec,
	mode: ValidationGateMode,
): number | undefined {
	return gate.order[mode];
}

/**
 * Return the non-authoritative typed validation gate specs for one wrapper mode.
 *
 * @param mode - Validation wrapper mode to inspect.
 * @returns Gate specs that participate in the requested mode, sorted by mode-specific order.
 */
export function getValidationGateSpecsForMode(
	mode: ValidationGateMode,
): readonly ValidationGateSpec[] {
	const specs: readonly ValidationGateSpec[] = VALIDATION_GATE_SPECS;
	return specs
		.filter((gate) => getModeOrder(gate, mode) !== undefined)
		.sort(
			(left, right) =>
				(getModeOrder(left, mode) ?? 0) - (getModeOrder(right, mode) ?? 0),
		);
}

/**
 * Return gate IDs for one validation wrapper mode in execution order.
 *
 * @param mode - Validation wrapper mode to inspect.
 * @returns Ordered gate IDs for the requested mode.
 */
export function getValidationGateIdsForMode(
	mode: ValidationGateMode,
): readonly ValidationGateId[] {
	return getValidationGateSpecsForMode(mode).map((gate) => gate.gateId);
}

/**
 * Look up a single non-authoritative validation gate spec by ID.
 *
 * @param gateId - Gate ID to find.
 * @returns The matching gate spec, or undefined when the ID is not mirrored.
 */
export function getValidationGateSpec(
	gateId: ValidationGateId,
): ValidationGateSpec | undefined {
	return VALIDATION_GATE_SPECS.find((gate) => gate.gateId === gateId);
}
