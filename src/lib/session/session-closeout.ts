import type { HarnessDecisionFrictionClass } from "../decision/harness-decision.js";

/** Schema version for the first session closeout contract. */
export const SESSION_CLOSEOUT_SCHEMA_VERSION = "session-closeout/v1" as const;

/** Terminal outcome labels for a Codex or Harness work session. */
export type SessionCloseoutOutcome =
	| "done"
	| "blocked"
	| "partial"
	| "advisory_only"
	| "abandoned";

/** Validation outcome captured in a closeout artifact. */
export type SessionCloseoutValidationStatus = "pass" | "fail" | "blocked";

/** Evidence for a validation command that ran or was deliberately blocked. */
export interface SessionCloseoutValidationEvidence {
	/** Exact validation command recorded as evidence, not an executable action. */
	command: string;
	/** Validation outcome. */
	status: SessionCloseoutValidationStatus;
	/** Short result summary or blocker reason. */
	summary: string;
	/** Optional artifact or log references for this validation step. */
	evidenceRef?: string[];
}

/** Pull request reference associated with a closeout, when one exists. */
export interface SessionCloseoutPullRequestRef {
	/** Pull request provider. */
	provider: "github" | "other";
	/** Pull request URL, when available. */
	url?: string;
	/** Provider-local pull request number, when available. */
	number?: number;
	/** Branch associated with the pull request, when available. */
	branch?: string;
}

/** Versioned session closeout payload for reporting outcomes and friction. */
export interface SessionCloseout {
	/** Schema version for the closeout payload. */
	schemaVersion: typeof SESSION_CLOSEOUT_SCHEMA_VERSION;
	/** Stable Codex or Harness session identifier. */
	sessionId: string;
	/** Stable task identifier for this work unit. */
	taskId: string;
	/** Optional parent task identifier for delegated or phased work. */
	parentTaskId?: string;
	/** Terminal session outcome. */
	outcome: SessionCloseoutOutcome;
	/** Primary friction class that shaped the session outcome. */
	primaryFriction: HarnessDecisionFrictionClass;
	/** Validation commands and outcomes used as closeout evidence. */
	validationEvidence: SessionCloseoutValidationEvidence[];
	/** Explicit reason when validation evidence is intentionally absent. */
	noValidationReason?: string;
	/** Commit SHAs or refs produced by the session. */
	commits: string[];
	/** Pull request reference produced or updated by the session. */
	pr: SessionCloseoutPullRequestRef | null;
	/** Next action for the next human or agent. */
	nextAction: string;
	/** Candidate durable learning to promote, when the session exposed one. */
	learningCandidate: string | null;
}

/** Validation result for a candidate {@link SessionCloseout}. */
export interface SessionCloseoutValidationResult {
	/** Whether the candidate satisfies the closeout contract. */
	valid: boolean;
	/** Validation errors, empty when valid. */
	errors: string[];
}

const VALID_OUTCOMES: readonly SessionCloseoutOutcome[] = [
	"done",
	"blocked",
	"partial",
	"advisory_only",
	"abandoned",
];

const VALID_VALIDATION_STATUSES: readonly SessionCloseoutValidationStatus[] = [
	"pass",
	"fail",
	"blocked",
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function validateString(value: unknown, field: string, errors: string[]): void {
	if (!isNonEmptyString(value)) {
		errors.push(`${field} must be a non-empty string`);
	}
}

function validateOptionalString(
	value: unknown,
	field: string,
	errors: string[],
): void {
	if (value !== undefined && !isNonEmptyString(value)) {
		errors.push(`${field} must be a non-empty string when present`);
	}
}

function validateNullableString(
	value: unknown,
	field: string,
	errors: string[],
): void {
	if (value !== null && !isNonEmptyString(value)) {
		errors.push(`${field} must be a non-empty string or null`);
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
		if (!isNonEmptyString(entry)) {
			errors.push(`${field} entries must be non-empty strings`);
			return;
		}
	}
}

function validateValidationEvidenceEntry(
	value: unknown,
	field: string,
	errors: string[],
): void {
	if (!isRecord(value)) {
		errors.push(`${field} must be an object`);
		return;
	}
	validateString(value.command, `${field}.command`, errors);
	validateEnum(
		value.status,
		`${field}.status`,
		VALID_VALIDATION_STATUSES,
		errors,
	);
	validateString(value.summary, `${field}.summary`, errors);
	if (value.evidenceRef !== undefined) {
		validateStringArray(value.evidenceRef, `${field}.evidenceRef`, errors);
	}
}

function validateValidationEvidence(value: unknown, errors: string[]): void {
	if (!Array.isArray(value)) {
		errors.push("validationEvidence must be an array");
		return;
	}
	value.forEach((entry, index) => {
		validateValidationEvidenceEntry(
			entry,
			`validationEvidence[${index}]`,
			errors,
		);
	});
}

function validatePullRequestRef(
	value: unknown,
	field: string,
	errors: string[],
): void {
	if (value === null) return;
	if (!isRecord(value)) {
		errors.push(`${field} must be an object or null`);
		return;
	}
	validateEnum(
		value.provider,
		`${field}.provider`,
		["github", "other"],
		errors,
	);
	validateOptionalString(value.url, `${field}.url`, errors);
	validateOptionalString(value.branch, `${field}.branch`, errors);
	const numberValue = value.number;
	if (
		numberValue !== undefined &&
		(typeof numberValue !== "number" ||
			!Number.isInteger(numberValue) ||
			numberValue <= 0)
	) {
		errors.push(`${field}.number must be a positive integer when present`);
	}
}

/**
 * Validate an unknown value against the `session-closeout/v1` contract.
 */
export function validateSessionCloseout(
	value: unknown,
): SessionCloseoutValidationResult {
	const errors: string[] = [];
	if (!isRecord(value)) {
		return { valid: false, errors: ["closeout must be an object"] };
	}

	if (value.schemaVersion !== SESSION_CLOSEOUT_SCHEMA_VERSION) {
		errors.push(`schemaVersion must be ${SESSION_CLOSEOUT_SCHEMA_VERSION}`);
	}
	validateString(value.sessionId, "sessionId", errors);
	validateString(value.taskId, "taskId", errors);
	validateOptionalString(value.parentTaskId, "parentTaskId", errors);
	validateEnum(value.outcome, "outcome", VALID_OUTCOMES, errors);
	validateEnum(
		value.primaryFriction,
		"primaryFriction",
		VALID_FRICTION_CLASSES,
		errors,
	);
	validateValidationEvidence(value.validationEvidence, errors);
	validateOptionalString(
		value.noValidationReason,
		"noValidationReason",
		errors,
	);
	validateStringArray(value.commits, "commits", errors);
	validatePullRequestRef(value.pr, "pr", errors);
	validateString(value.nextAction, "nextAction", errors);
	validateNullableString(value.learningCandidate, "learningCandidate", errors);

	if (
		value.outcome === "done" &&
		Array.isArray(value.validationEvidence) &&
		value.validationEvidence.length === 0 &&
		!isNonEmptyString(value.noValidationReason)
	) {
		errors.push(
			"done closeouts require validation evidence or noValidationReason",
		);
	}

	return { valid: errors.length === 0, errors };
}

/** Type guard for values that satisfy the `session-closeout/v1` contract. */
export function isSessionCloseout(value: unknown): value is SessionCloseout {
	return validateSessionCloseout(value).valid;
}
