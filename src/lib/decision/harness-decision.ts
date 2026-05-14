/** Schema version for the first agent-native decision envelope. */
import {
	type HeValidationError,
	isRecord,
	toValidationError,
	validateBoolean,
	validateEnum,
	validateNullableString,
	validateString,
	validateStringArray,
} from "./validators.js";

export const HARNESS_DECISION_SCHEMA_VERSION = "harness-decision/v1" as const;

/** Producers that emit a {@link HarnessDecision}. */
export type HarnessDecisionProducer = string;

/** Top-level decision status used by agent orchestration. */
export type HarnessDecisionStatus =
	| "pass"
	| "fail"
	| "blocked"
	| "action_required";

/** Agent work phase represented by a decision packet. */
export type HarnessDecisionPhase =
	| "orient"
	| "verify"
	| "review"
	| "repair"
	| "handoff";

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
	/** Agent work phase for the recommendation. */
	phase: HarnessDecisionPhase;
	/** Plain-language outcome the agent is trying to complete. */
	objective: string;
	/** Evidence artifacts, checks, or refs needed before closeout. */
	requiredEvidence: string[];
	/** Conditions that require stopping instead of improvising. */
	stopConditions: string[];
	/** Approval, credential, network, or policy blocker when present. */
	humanEscalation: string | null;
	/** Ordered later commands to consider after the next step succeeds. */
	followUpCommands: string[];
	/** Command engines used or considered but hidden from the public choice surface. */
	hiddenPlumbing: string[];
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

/** Producer input for constructing a complete agent-readable decision envelope. */
export interface HarnessDecisionInput {
	/** Decision state. */
	status: HarnessDecisionStatus;
	/** Human-readable summary. */
	summary: string;
	/** Short next action recommendation. */
	nextAction: string;
	/** Command to run next, if one exists. */
	nextCommand: string | null;
	/** Agent work phase for the recommendation. */
	phase?: HarnessDecisionPhase;
	/** Plain-language outcome the agent is trying to complete. */
	objective?: string;
	/** Evidence artifacts, checks, or refs needed before closeout. */
	requiredEvidence?: string[];
	/** Conditions that require stopping instead of improvising. */
	stopConditions?: string[];
	/** Approval, credential, network, or policy blocker when present. */
	humanEscalation?: string | null;
	/** Ordered later commands to consider after the next step succeeds. */
	followUpCommands?: string[];
	/** Command engines used or considered but hidden from the public choice surface. */
	hiddenPlumbing?: string[];
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
	errors: HeValidationError[];
}

const VALID_STATUSES: readonly HarnessDecisionStatus[] = [
	"pass",
	"fail",
	"blocked",
	"action_required",
];

const VALID_PHASES: readonly HarnessDecisionPhase[] = [
	"orient",
	"verify",
	"review",
	"repair",
	"handoff",
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

function isStringArray(value: unknown): value is string[] {
	return (
		Array.isArray(value) &&
		value.every((entry) => typeof entry === "string" && entry.trim().length > 0)
	);
}

function inferDecisionPhase(input: HarnessDecisionInput): HarnessDecisionPhase {
	if (input.phase !== undefined) return input.phase;
	if (input.status === "blocked" || input.status === "fail") return "repair";
	if (input.status === "pass") return "handoff";
	const routingText = [
		input.summary,
		input.nextAction,
		input.nextCommand ?? "",
		input.failureClass ?? "",
	].join(" ");
	if (/\b(review|pr-ready|approval)\b/i.test(routingText)) return "review";
	if (
		/\b(orient|doctor|status|inspect|discover|catalog)\b/i.test(routingText)
	) {
		return "orient";
	}
	return "verify";
}

function defaultStopConditions(input: HarnessDecisionInput): string[] {
	if (input.stopConditions !== undefined) return input.stopConditions;
	if (input.nextCommand !== null) return [];
	if (input.failureClass !== null) {
		return [`Stop until ${input.failureClass} is resolved.`];
	}
	return ["Stop until the blocked decision has an explicit recovery path."];
}

/**
 * Build a complete `harness-decision/v1` envelope from producer-level intent.
 *
 * Producers provide the actionable recommendation; this helper fills the
 * shared agent-routing fields so command implementations do not duplicate
 * schema plumbing or accidentally emit shallow decision packets.
 */
export function buildHarnessDecision(
	producer: HarnessDecisionProducer,
	input: HarnessDecisionInput,
): HarnessDecision {
	return {
		schemaVersion: HARNESS_DECISION_SCHEMA_VERSION,
		producer,
		...input,
		phase: inferDecisionPhase(input),
		objective: input.objective ?? input.nextAction,
		requiredEvidence: input.requiredEvidence ?? input.evidenceRef,
		stopConditions: defaultStopConditions(input),
		humanEscalation:
			input.humanEscalation ?? (input.requiresHuman ? input.nextAction : null),
		followUpCommands: input.followUpCommands ?? [],
		hiddenPlumbing: input.hiddenPlumbing ?? [],
	};
}

function validatePermissionPlan(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): void {
	if (!isRecord(value)) {
		errors.push(toValidationError(`${field} must be an object`, field));
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
	errors: HeValidationError[],
): void {
	const permissionPlan = getOperationalPermissionPlan(meta);
	if (!permissionPlan) return;
	if (
		typeof decision.requiresHuman === "boolean" &&
		typeof permissionPlan.requiresHuman === "boolean" &&
		decision.requiresHuman !== permissionPlan.requiresHuman
	) {
		errors.push(
			toValidationError(
				"requiresHuman must match meta.execution.permissionPlan.requiresHuman",
				"requiresHuman",
			),
		);
	}
	if (
		typeof decision.requiresNetwork === "boolean" &&
		typeof permissionPlan.requiresNetwork === "boolean" &&
		decision.requiresNetwork !== permissionPlan.requiresNetwork
	) {
		errors.push(
			toValidationError(
				"requiresNetwork must match meta.execution.permissionPlan.requiresNetwork",
				"requiresNetwork",
			),
		);
	}
	if (
		typeof decision.writesFiles === "boolean" &&
		typeof permissionPlan.writesFiles === "boolean" &&
		decision.writesFiles !== permissionPlan.writesFiles
	) {
		errors.push(
			toValidationError(
				"writesFiles must match meta.execution.permissionPlan.writesFiles",
				"writesFiles",
			),
		);
	}
}

function validateDecisionRoutingConsistency(
	value: Record<string, unknown>,
	errors: HeValidationError[],
): void {
	const status = value.status;
	const nextCommand = value.nextCommand;
	const safeToRun = value.safeToRun;
	const failureClass = value.failureClass;

	if (
		(status === "blocked" || status === "fail") &&
		typeof failureClass !== "string"
	) {
		errors.push(
			toValidationError(
				"failureClass must be set when status is blocked or fail",
				"failureClass",
			),
		);
	}
	if (nextCommand === null && safeToRun === true) {
		errors.push(
			toValidationError(
				"safeToRun must be false when nextCommand is null",
				"safeToRun",
			),
		);
	}
	if (typeof nextCommand === "string" && safeToRun !== true) {
		errors.push(
			toValidationError(
				"safeToRun must be true when nextCommand is set",
				"safeToRun",
			),
		);
	}
	if (
		nextCommand === null &&
		Array.isArray(value.stopConditions) &&
		value.stopConditions.length === 0 &&
		value.humanEscalation === null
	) {
		errors.push(
			toValidationError(
				"stopConditions or humanEscalation must explain decisions without nextCommand",
				"stopConditions",
			),
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
	const errors: HeValidationError[] = [];
	if (!isRecord(value)) {
		return {
			valid: false,
			errors: [toValidationError("operational meta must be an object")],
		};
	}

	validateEnum(
		value.frictionClass,
		"frictionClass",
		VALID_FRICTION_CLASSES,
		errors,
	);
	validateEnum(value.delayClass, "delayClass", VALID_DELAY_CLASSES, errors);
	if (!isRecord(value.execution)) {
		errors.push(toValidationError("execution must be an object", "execution"));
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
	const errors: HeValidationError[] = [];
	if (!isRecord(value)) {
		return {
			valid: false,
			errors: [toValidationError("decision must be an object")],
		};
	}

	if (value.schemaVersion !== HARNESS_DECISION_SCHEMA_VERSION) {
		errors.push(
			toValidationError(
				`schemaVersion must be ${HARNESS_DECISION_SCHEMA_VERSION}`,
				"schemaVersion",
			),
		);
	}
	validateString(value.producer, "producer", errors);
	if (!VALID_STATUSES.includes(value.status as HarnessDecisionStatus)) {
		errors.push(
			toValidationError(
				"status must be pass, fail, blocked, or action_required",
				"status",
			),
		);
	}
	validateString(value.summary, "summary", errors);
	validateString(value.nextAction, "nextAction", errors);
	validateNullableString(value.nextCommand, "nextCommand", errors);
	validateEnum(value.phase, "phase", VALID_PHASES, errors);
	validateString(value.objective, "objective", errors);
	validateStringArray(value.requiredEvidence, "requiredEvidence", errors);
	validateStringArray(value.stopConditions, "stopConditions", errors);
	validateNullableString(value.humanEscalation, "humanEscalation", errors);
	validateStringArray(value.followUpCommands, "followUpCommands", errors);
	validateStringArray(value.hiddenPlumbing, "hiddenPlumbing", errors);
	validateBoolean(value.safeToRun, "safeToRun", errors);
	validateBoolean(value.requiresHuman, "requiresHuman", errors);
	validateBoolean(value.requiresNetwork, "requiresNetwork", errors);
	validateBoolean(value.writesFiles, "writesFiles", errors);
	if (!isStringArray(value.evidenceRef) || value.evidenceRef.length === 0) {
		errors.push(
			toValidationError(
				"evidenceRef must be a non-empty string array",
				"evidenceRef",
			),
		);
	}
	validateNullableString(value.failureClass, "failureClass", errors);
	if (!VALID_RETRIES.includes(value.retry as HarnessDecisionRetry)) {
		errors.push(
			toValidationError("retry must be safe, conditional, or manual", "retry"),
		);
	}
	if (!VALID_RISK_TIERS.includes(value.riskTier as HarnessDecisionRiskTier)) {
		errors.push(
			toValidationError(
				"riskTier must be low, medium, high, critical, or unknown",
				"riskTier",
			),
		);
	}
	validateDecisionRoutingConsistency(value, errors);
	if (value.meta !== undefined && !isRecord(value.meta)) {
		errors.push(
			toValidationError("meta must be an object when present", "meta"),
		);
	}
	if (isRecord(value.meta) && hasOperationalMetaShape(value.meta)) {
		const metaValidation = validateHarnessDecisionOperationalMeta(value.meta);
		if (!metaValidation.valid) {
			errors.push(
				...metaValidation.errors.map((error) =>
					toValidationError(`meta.${error.code}`, `meta.${error.path ?? ""}`),
				),
			);
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
