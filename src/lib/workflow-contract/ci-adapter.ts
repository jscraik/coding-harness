/**
 * CI Provider Policy Adapter (Slice 2)
 *
 * Bridge between workflow contracts and the existing CIProviderPolicy
 * in `src/lib/contract/types.ts`. This adapter:
 *
 * 1. Defines workflow-level CI policy declarations
 * 2. Validates compatibility between workflow CI requirements and
 *    the active harness contract CI policy
 * 3. Checks migration stage compatibility
 * 4. Enforces fail-open/fail-closed per mode
 *
 * The adapter keeps the workflow-contract module **provider-neutral** at its
 * core — provider-specific logic lives here, not in the checker.
 */

// ─── Types ──────────────────────────────────────────────────────────────────────

/** Supported CI providers. */
export type CIProvider = "github-actions" | "circleci";

/** Migration stage from dual-provider to single-provider. */
export type MigrationStage =
	| "dual-provider"
	| "circleci-primary"
	| "circleci-only";

/** How the policy adapter behaves on violations. */
export type FailureBehavior = "fail-closed" | "fail-open";

/**
 * Workflow-level CI provider policy declaration.
 *
 * Workflows embed this to declare which CI provider(s) they require,
 * what checks must pass, and how to handle migration-stage mismatches.
 */
export interface WorkflowCIPolicy {
	/** The provider this workflow is designed for. */
	provider: CIProvider;
	/** Required CI checks that must pass for this workflow. */
	required_checks: string[];
	/** Maximum time (ISO 8601 duration or human-readable) for CI checks. */
	timeout: string;
	/** What to do when CI checks fail. */
	escalation: string;
	/** Which migration stages this workflow supports. */
	compatible_stages: MigrationStage[];
	/** Failure behavior: fail-closed (block) or fail-open (warn). */
	failure_behavior: FailureBehavior;
}

/**
 * The active harness CI provider policy — a simplified projection of
 * `CIProviderPolicy` from `src/lib/contract/types.ts` that the adapter
 * consumes. This avoids a hard import dependency on the full contract module.
 */
export interface ActiveCIPolicy {
	activeProvider: CIProvider;
	mode: "shadow" | "required";
	migrationStage: MigrationStage;
	requiredCheckManifestPath: string;
}

/** Result finding from the adapter. */
export interface CIAdapterFinding {
	code: string;
	severity: "error" | "warning";
	message: string;
}

/** Result of running the CI provider adapter. */
export interface CIAdapterResult {
	/** True if no errors were found. */
	pass: boolean;
	/** Individual findings. */
	findings: CIAdapterFinding[];
	/** Summary counts. */
	summary: {
		errors: number;
		warnings: number;
	};
}

// ─── Default Policy ─────────────────────────────────────────────────────────────

/** Default workflow CI policy (github-actions, dual-provider, fail-open). */
export const DEFAULT_WORKFLOW_CI_POLICY: WorkflowCIPolicy = {
	provider: "github-actions",
	required_checks: [],
	timeout: "15m",
	escalation: "Block and notify workflow owner",
	compatible_stages: ["dual-provider", "circleci-primary", "circleci-only"],
	failure_behavior: "fail-open",
};

// ─── Validation Constants ───────────────────────────────────────────────────────

const VALID_PROVIDERS: readonly CIProvider[] = ["github-actions", "circleci"];

const VALID_MIGRATION_STAGES: readonly MigrationStage[] = [
	"dual-provider",
	"circleci-primary",
	"circleci-only",
];

const VALID_FAILURE_BEHAVIORS: readonly FailureBehavior[] = [
	"fail-closed",
	"fail-open",
];

// ─── Adapter ────────────────────────────────────────────────────────────────────

/**
 * Validate a workflow CI policy declaration in isolation.
 *
 * Checks structural correctness without comparing against an active policy.
 */
export function validateWorkflowCIPolicy(
	policy: WorkflowCIPolicy,
): CIAdapterFinding[] {
	const findings: CIAdapterFinding[] = [];

	// Provider
	if (!VALID_PROVIDERS.includes(policy.provider)) {
		findings.push({
			code: "CI_INVALID_PROVIDER",
			severity: "error",
			message: `Invalid CI provider '${policy.provider}'. Expected one of: ${VALID_PROVIDERS.join(", ")}`,
		});
	}

	// Required checks
	if (!Array.isArray(policy.required_checks)) {
		findings.push({
			code: "CI_INVALID_CHECKS",
			severity: "error",
			message: "required_checks must be an array",
		});
	} else {
		for (const check of policy.required_checks) {
			if (typeof check !== "string" || check.trim().length === 0) {
				findings.push({
					code: "CI_EMPTY_CHECK_NAME",
					severity: "error",
					message: "required_checks contains an empty or non-string entry",
				});
			}
		}
	}

	// Timeout
	if (!policy.timeout || policy.timeout.trim().length === 0) {
		findings.push({
			code: "CI_MISSING_TIMEOUT",
			severity: "warning",
			message: "CI policy timeout is empty; defaulting to provider default",
		});
	}

	// Escalation
	if (!policy.escalation || policy.escalation.trim().length === 0) {
		findings.push({
			code: "CI_MISSING_ESCALATION",
			severity: "warning",
			message: "CI policy escalation path is empty",
		});
	}

	// Compatible stages
	if (
		!Array.isArray(policy.compatible_stages) ||
		policy.compatible_stages.length === 0
	) {
		findings.push({
			code: "CI_NO_COMPATIBLE_STAGES",
			severity: "error",
			message: "At least one compatible migration stage must be declared",
		});
	} else {
		for (const stage of policy.compatible_stages) {
			if (!VALID_MIGRATION_STAGES.includes(stage)) {
				findings.push({
					code: "CI_INVALID_STAGE",
					severity: "error",
					message: `Invalid migration stage '${stage}'. Expected one of: ${VALID_MIGRATION_STAGES.join(", ")}`,
				});
			}
		}
	}

	// Failure behavior
	if (!VALID_FAILURE_BEHAVIORS.includes(policy.failure_behavior)) {
		findings.push({
			code: "CI_INVALID_FAILURE_BEHAVIOR",
			severity: "error",
			message: `Invalid failure behavior '${policy.failure_behavior}'. Expected one of: ${VALID_FAILURE_BEHAVIORS.join(", ")}`,
		});
	}

	return findings;
}

/**
 * Check compatibility between a workflow CI policy and the active harness
 * CI provider policy.
 *
 * This is the core adapter function. It validates that:
 * 1. The workflow's declared provider matches the active provider
 * 2. The current migration stage is compatible with the workflow
 * 3. In "required" mode, all required checks are declared
 * 4. Fail-closed workflows in required mode raise errors for mismatches
 */
export function checkCICompatibility(
	workflowPolicy: WorkflowCIPolicy,
	activePolicy: ActiveCIPolicy,
): CIAdapterResult {
	const findings: CIAdapterFinding[] = [];

	// ── Step 1: Structural validation ──────────────────────────────────────
	const structuralFindings = validateWorkflowCIPolicy(workflowPolicy);
	findings.push(...structuralFindings);

	// ── Step 2: Provider compatibility ─────────────────────────────────────
	if (workflowPolicy.provider !== activePolicy.activeProvider) {
		// In dual-provider mode, a mismatch is a warning — both are active
		if (activePolicy.migrationStage === "dual-provider") {
			findings.push({
				code: "CI_PROVIDER_MISMATCH_DUAL",
				severity: "warning",
				message: `Workflow declares provider '${workflowPolicy.provider}' but active provider is '${activePolicy.activeProvider}'. Dual-provider mode allows both.`,
			});
		} else {
			// In single-provider modes, mismatch is an error
			const severity =
				workflowPolicy.failure_behavior === "fail-closed" ? "error" : "warning";
			findings.push({
				code: "CI_PROVIDER_MISMATCH",
				severity,
				message: `Workflow declares provider '${workflowPolicy.provider}' but active provider is '${activePolicy.activeProvider}' (stage: ${activePolicy.migrationStage})`,
			});
		}
	}

	// ── Step 3: Migration stage compatibility ──────────────────────────────
	if (!workflowPolicy.compatible_stages.includes(activePolicy.migrationStage)) {
		const severity =
			workflowPolicy.failure_behavior === "fail-closed" ? "error" : "warning";
		findings.push({
			code: "CI_STAGE_INCOMPATIBLE",
			severity,
			message: `Current migration stage '${activePolicy.migrationStage}' is not in the workflow's compatible stages [${workflowPolicy.compatible_stages.join(", ")}]`,
		});
	}

	// ── Step 4: Required-mode enforcement ──────────────────────────────────
	if (activePolicy.mode === "required") {
		if (workflowPolicy.required_checks.length === 0) {
			findings.push({
				code: "CI_NO_CHECKS_IN_REQUIRED_MODE",
				severity:
					workflowPolicy.failure_behavior === "fail-closed"
						? "error"
						: "warning",
				message:
					"Active CI policy mode is 'required' but workflow declares no required_checks",
			});
		}
	}

	// ── Step 5: Fail-closed/fail-open behavior note ───────────────────────
	if (
		workflowPolicy.failure_behavior === "fail-open" &&
		activePolicy.mode === "required"
	) {
		findings.push({
			code: "CI_FAIL_OPEN_IN_REQUIRED_MODE",
			severity: "warning",
			message:
				"Workflow uses 'fail-open' behavior but active CI policy mode is 'required'. Consider switching to 'fail-closed' for enforcement.",
		});
	}

	// ── Build result ──────────────────────────────────────────────────────
	const errors = findings.filter((f) => f.severity === "error").length;
	const warnings = findings.filter((f) => f.severity === "warning").length;

	return {
		pass: errors === 0,
		findings,
		summary: { errors, warnings },
	};
}
