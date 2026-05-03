/** Schema version for the first agent-native decision envelope. */
export const HARNESS_DECISION_SCHEMA_VERSION = "harness-decision/v1" as const;

/** Producers that emit a {@link HarnessDecision}. */
export type HarnessDecisionProducer = string;

/** Top-level decision status used by agent orchestration. */
export type HarnessDecisionStatus =
	| "pass"
	| "fail"
	| "blocked"
	| "action_required";

/** Retry posture for the recommended next action. */
export type HarnessDecisionRetry = "safe" | "conditional" | "manual";

/** Coarse risk tier for the current change or recommendation. */
export type HarnessDecisionRiskTier =
	| "low"
	| "medium"
	| "high"
	| "critical"
	| "unknown";

/** Stable friction classes for reporting why an agent loop slowed or stopped. */
export type HarnessDecisionFrictionClass =
	| "none"
	| "tool_friction"
	| "permission_sandbox"
	| "repo_state"
	| "unclear_instruction"
	| "validation_failure"
	| "implementation_complexity"
	| "external_service";

/** Stable delay classes for reporting the current waiting posture. */
export type HarnessDecisionDelayClass =
	| "normal"
	| "waiting_on_command"
	| "waiting_on_agent"
	| "repeated_failure"
	| "human_needed";

/** Cheapest sufficient runtime profile for the recommended next action. */
export type HarnessDecisionExecutionProfile =
	| "read_only"
	| "local"
	| "virtual"
	| "container"
	| "remote";

/** Coarse startup cost for the recommended next action. */
export type HarnessDecisionStartupCost = "none" | "low" | "medium" | "high";

/** Permission and execution grants needed by a recommended next action. */
export interface HarnessDecisionPermissionPlan {
	/** Whether human approval or judgment is required before proceeding. */
	requiresHuman: boolean;
	/** Whether network access is required. */
	requiresNetwork: boolean;
	/** Whether the action writes files. */
	writesFiles: boolean;
	/** Whether the action writes git state, such as commits, tags, or branches. */
	requiresGitWrite: boolean;
	/** Filesystem write targets, empty when no writes are expected. */
	filesystemWrite: string[];
	/** Commands the recommendation expects the agent to run. */
	commands: string[];
	/** Secret or credential names needed by the action. */
	secrets: string[];
}

/** Performance and permission metadata for a recommended next action. */
export interface HarnessDecisionExecutionMetadata {
	/** Cheapest sufficient execution profile. */
	profile: HarnessDecisionExecutionProfile;
	/** Expected startup cost before useful work begins. */
	startupCost: HarnessDecisionStartupCost;
	/** Required permissions and grants. */
	permissionPlan: HarnessDecisionPermissionPlan;
}

/** Optional operational metadata carried in `HarnessDecision.meta`. */
export interface HarnessDecisionOperationalMeta
	extends Record<string, unknown> {
	/** Primary friction class observed or predicted by the decision. */
	frictionClass: HarnessDecisionFrictionClass;
	/** Current delay class observed or predicted by the decision. */
	delayClass: HarnessDecisionDelayClass;
	/** Execution profile and permission requirements for the next action. */
	execution: HarnessDecisionExecutionMetadata;
}

/**
 * Agent-readable command decision envelope.
 *
 * This is an orchestration contract for commands such as `harness next`; it does
 * not replace gate-specific `GateResult` payloads.
 */
export interface HarnessDecision {
	/** Schema version for the envelope. */
	schemaVersion: typeof HARNESS_DECISION_SCHEMA_VERSION;
	/** Command or orchestrator that produced the decision. */
	producer: HarnessDecisionProducer;
	/** Decision status. */
	status: HarnessDecisionStatus;
	/** Concise human-readable decision summary. */
	summary: string;
	/** Next action for the caller. */
	nextAction: string;
	/** Exact command to run next, when available. */
	nextCommand: string | null;
	/** Whether the recommended command is safe to run without extra approval. */
	safeToRun: boolean;
	/** Whether the next action requires human judgment or approval. */
	requiresHuman: boolean;
	/** Whether the next action requires network access. */
	requiresNetwork: boolean;
	/** Whether the next action writes files. */
	writesFiles: boolean;
	/** Evidence references used to justify the decision. */
	evidenceRef: string[];
	/** Failure taxonomy for blocked or failed states. */
	failureClass: string | null;
	/** Retry posture for the next action. */
	retry: HarnessDecisionRetry;
	/** Coarse risk tier. */
	riskTier: HarnessDecisionRiskTier;
	/** Optional producer-specific metadata. */
	meta?: Record<string, unknown>;
}

/** Validation result for a candidate {@link HarnessDecision}. */
export interface HarnessDecisionValidationResult {
	/** Whether the candidate satisfies the v1 decision contract. */
	valid: boolean;
	/** Validation errors, empty when valid. */
	errors: string[];
}

const VALID_STATUSES: readonly HarnessDecisionStatus[] = [
	"pass",
	"fail",
	"blocked",
	"action_required",
];

const VALID_RETRIES: readonly HarnessDecisionRetry[] = [
	"safe",
	"conditional",
	"manual",
];

const VALID_RISK_TIERS: readonly HarnessDecisionRiskTier[] = [
	"low",
	"medium",
	"high",
	"critical",
	"unknown",
];

const VALID_FRICTION_CLASSES: readonly HarnessDecisionFrictionClass[] = [
	"none",
	"tool_friction",
	"permission_sandbox",
	"repo_state",
	"unclear_instruction",
	"validation_failure",
	"implementation_complexity",
	"external_service",
];

const VALID_DELAY_CLASSES: readonly HarnessDecisionDelayClass[] = [
	"normal",
	"waiting_on_command",
	"waiting_on_agent",
	"repeated_failure",
	"human_needed",
];

const VALID_EXECUTION_PROFILES: readonly HarnessDecisionExecutionProfile[] = [
	"read_only",
	"local",
	"virtual",
	"container",
	"remote",
];

const VALID_STARTUP_COSTS: readonly HarnessDecisionStartupCost[] = [
	"none",
	"low",
	"medium",
	"high",
];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
	return (
		Array.isArray(value) &&
		value.every((entry) => typeof entry === "string" && entry.trim().length > 0)
	);
}

function validateString(value: unknown, field: string, errors: string[]): void {
	if (typeof value !== "string" || value.trim().length === 0) {
		errors.push(`${field} must be a non-empty string`);
	}
}

function validateNullableString(
	value: unknown,
	field: string,
	errors: string[],
): void {
	if (
		value !== null &&
		(typeof value !== "string" || value.trim().length === 0)
	) {
		errors.push(`${field} must be a non-empty string or null`);
	}
}

function validateBoolean(
	value: unknown,
	field: string,
	errors: string[],
): void {
	if (typeof value !== "boolean") {
		errors.push(`${field} must be a boolean`);
	}
}

function validateEnum<T extends string>(
	value: unknown,
	field: string,
	validValues: readonly T[],
	errors: string[],
): void {
	if (!validValues.includes(value as T)) {
		errors.push(`${field} must be one of ${validValues.join(", ")}`);
	}
}

function validateStringArray(
	value: unknown,
	field: string,
	errors: string[],
): void {
	if (!Array.isArray(value)) {
		errors.push(`${field} must be a string array`);
		return;
	}
	for (const entry of value) {
		if (typeof entry !== "string" || entry.trim().length === 0) {
			errors.push(`${field} entries must be non-empty strings`);
			return;
		}
	}
}

function validatePermissionPlan(
	value: unknown,
	field: string,
	errors: string[],
): void {
	if (!isRecord(value)) {
		errors.push(`${field} must be an object`);
		return;
	}
	validateBoolean(value.requiresHuman, `${field}.requiresHuman`, errors);
	validateBoolean(value.requiresNetwork, `${field}.requiresNetwork`, errors);
	validateBoolean(value.writesFiles, `${field}.writesFiles`, errors);
	validateBoolean(value.requiresGitWrite, `${field}.requiresGitWrite`, errors);
	validateStringArray(
		value.filesystemWrite,
		`${field}.filesystemWrite`,
		errors,
	);
	validateStringArray(value.commands, `${field}.commands`, errors);
	validateStringArray(value.secrets, `${field}.secrets`, errors);
}

function hasOperationalMetaShape(value: Record<string, unknown>): boolean {
	return (
		"frictionClass" in value || "delayClass" in value || "execution" in value
	);
}

function getOperationalPermissionPlan(
	value: Record<string, unknown>,
): Record<string, unknown> | null {
	const execution = value.execution;
	if (!isRecord(execution)) return null;
	const permissionPlan = execution.permissionPlan;
	return isRecord(permissionPlan) ? permissionPlan : null;
}

function validateOperationalMetaConsistency(
	decision: Record<string, unknown>,
	meta: Record<string, unknown>,
	errors: string[],
): void {
	const permissionPlan = getOperationalPermissionPlan(meta);
	if (!permissionPlan) return;
	if (
		typeof decision.requiresHuman === "boolean" &&
		typeof permissionPlan.requiresHuman === "boolean" &&
		decision.requiresHuman !== permissionPlan.requiresHuman
	) {
		errors.push(
			"requiresHuman must match meta.execution.permissionPlan.requiresHuman",
		);
	}
	if (
		typeof decision.requiresNetwork === "boolean" &&
		typeof permissionPlan.requiresNetwork === "boolean" &&
		decision.requiresNetwork !== permissionPlan.requiresNetwork
	) {
		errors.push(
			"requiresNetwork must match meta.execution.permissionPlan.requiresNetwork",
		);
	}
	if (
		typeof decision.writesFiles === "boolean" &&
		typeof permissionPlan.writesFiles === "boolean" &&
		decision.writesFiles !== permissionPlan.writesFiles
	) {
		errors.push(
			"writesFiles must match meta.execution.permissionPlan.writesFiles",
		);
	}
}

/**
 * Validate an optional operational metadata payload carried in
 * `HarnessDecision.meta`.
 *
 * This helper lets producers opt into the P1/P2 metadata without making those
 * fields required for every historical `harness-decision/v1` consumer.
 */
export function validateHarnessDecisionOperationalMeta(
	value: unknown,
): HarnessDecisionValidationResult {
	const errors: string[] = [];
	if (!isRecord(value)) {
		return { valid: false, errors: ["operational meta must be an object"] };
	}

	validateEnum(
		value.frictionClass,
		"frictionClass",
		VALID_FRICTION_CLASSES,
		errors,
	);
	validateEnum(value.delayClass, "delayClass", VALID_DELAY_CLASSES, errors);
	if (!isRecord(value.execution)) {
		errors.push("execution must be an object");
	} else {
		validateEnum(
			value.execution.profile,
			"execution.profile",
			VALID_EXECUTION_PROFILES,
			errors,
		);
		validateEnum(
			value.execution.startupCost,
			"execution.startupCost",
			VALID_STARTUP_COSTS,
			errors,
		);
		validatePermissionPlan(
			value.execution.permissionPlan,
			"execution.permissionPlan",
			errors,
		);
	}

	return { valid: errors.length === 0, errors };
}

/**
 * Validate an unknown value against the `harness-decision/v1` contract.
 *
 * The validator is intentionally dependency-free so early cockpit commands can
 * fail closed without loading a larger schema runtime.
 */
export function validateHarnessDecision(
	value: unknown,
): HarnessDecisionValidationResult {
	const errors: string[] = [];
	if (!isRecord(value)) {
		return { valid: false, errors: ["decision must be an object"] };
	}

	if (value.schemaVersion !== HARNESS_DECISION_SCHEMA_VERSION) {
		errors.push(`schemaVersion must be ${HARNESS_DECISION_SCHEMA_VERSION}`);
	}
	validateString(value.producer, "producer", errors);
	if (!VALID_STATUSES.includes(value.status as HarnessDecisionStatus)) {
		errors.push("status must be pass, fail, blocked, or action_required");
	}
	validateString(value.summary, "summary", errors);
	validateString(value.nextAction, "nextAction", errors);
	validateNullableString(value.nextCommand, "nextCommand", errors);
	validateBoolean(value.safeToRun, "safeToRun", errors);
	validateBoolean(value.requiresHuman, "requiresHuman", errors);
	validateBoolean(value.requiresNetwork, "requiresNetwork", errors);
	validateBoolean(value.writesFiles, "writesFiles", errors);
	if (!isStringArray(value.evidenceRef) || value.evidenceRef.length === 0) {
		errors.push("evidenceRef must be a non-empty string array");
	}
	validateNullableString(value.failureClass, "failureClass", errors);
	if (!VALID_RETRIES.includes(value.retry as HarnessDecisionRetry)) {
		errors.push("retry must be safe, conditional, or manual");
	}
	if (!VALID_RISK_TIERS.includes(value.riskTier as HarnessDecisionRiskTier)) {
		errors.push("riskTier must be low, medium, high, critical, or unknown");
	}
	if (value.meta !== undefined && !isRecord(value.meta)) {
		errors.push("meta must be an object when present");
	}
	if (isRecord(value.meta) && hasOperationalMetaShape(value.meta)) {
		const metaValidation = validateHarnessDecisionOperationalMeta(value.meta);
		if (!metaValidation.valid) {
			errors.push(...metaValidation.errors.map((error) => `meta.${error}`));
		} else {
			validateOperationalMetaConsistency(value, value.meta, errors);
		}
	}

	return { valid: errors.length === 0, errors };
}

/**
 * Type guard for values that satisfy the `harness-decision/v1` contract.
 */
export function isHarnessDecision(value: unknown): value is HarnessDecision {
	return validateHarnessDecision(value).valid;
}
