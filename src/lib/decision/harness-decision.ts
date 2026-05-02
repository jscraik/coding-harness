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

	return { valid: errors.length === 0, errors };
}

/**
 * Type guard for values that satisfy the `harness-decision/v1` contract.
 */
export function isHarnessDecision(value: unknown): value is HarnessDecision {
	return validateHarnessDecision(value).valid;
}
