import {
	HARNESS_DECISION_SCHEMA_VERSION,
	VALID_HARNESS_DECISION_COCKPIT_LANES,
	VALID_HARNESS_DECISION_DELAY_CLASSES,
	VALID_HARNESS_DECISION_EXECUTION_PROFILES,
	VALID_HARNESS_DECISION_FRICTION_CLASSES,
	VALID_HARNESS_DECISION_PHASES,
	VALID_HARNESS_DECISION_RETRIES,
	VALID_HARNESS_DECISION_RISK_TIERS,
	VALID_HARNESS_DECISION_STARTUP_COSTS,
	VALID_HARNESS_DECISION_STATUSES,
	type HarnessDecisionRetry,
	type HarnessDecisionRiskTier,
	type HarnessDecisionStatus,
	type HarnessDecisionValidationResult,
} from "./harness-decision-types.js";
import {
	getOperationalPermissionPlan,
	validateOperationalMetaConsistency,
	validatePermissionPlan,
	validateRecommendationEffects,
} from "./harness-decision-recommendation-effects-validation.js";
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

function isStringArray(value: unknown): value is string[] {
	return (
		Array.isArray(value) &&
		value.every((entry) => typeof entry === "string" && entry.trim().length > 0)
	);
}

/** Detect the existing operational metadata shape without requiring unrelated additive fields. */
function hasOperationalMetaShape(value: Record<string, unknown>): boolean {
	return (
		"frictionClass" in value || "delayClass" in value || "execution" in value
	);
}

/** Require a failure classification for terminal blocked and failed decisions. */
function validateTerminalFailureClass(
	value: Record<string, unknown>,
	errors: HeValidationError[],
): void {
	if (
		(value.status === "blocked" || value.status === "fail") &&
		typeof value.failureClass !== "string"
	) {
		errors.push(
			toValidationError(
				"failureClass must be set when status is blocked or fail",
				"failureClass",
			),
		);
	}
}

/** Keep command availability aligned with the recommendation safe-to-run flag. */
function validateCommandSafety(
	value: Record<string, unknown>,
	errors: HeValidationError[],
): void {
	if (value.nextCommand === null && value.safeToRun === true) {
		errors.push(
			toValidationError(
				"safeToRun must be false when nextCommand is null",
				"safeToRun",
			),
		);
	}
	if (typeof value.nextCommand === "string" && value.safeToRun !== true) {
		errors.push(
			toValidationError(
				"safeToRun must be true when nextCommand is set",
				"safeToRun",
			),
		);
	}
}

/** Require stop guidance whenever a decision has no executable next command. */
function validateMissingCommandGuidance(
	value: Record<string, unknown>,
	errors: HeValidationError[],
): void {
	if (
		value.nextCommand === null &&
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

/** Validate decision fields whose meanings depend on status or next-command presence. */
function validateDecisionRoutingConsistency(
	value: Record<string, unknown>,
	errors: HeValidationError[],
): void {
	validateTerminalFailureClass(value, errors);
	validateCommandSafety(value, errors);
	validateMissingCommandGuidance(value, errors);
}

/** Validate optional operational metadata on a HarnessDecision. */
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
		VALID_HARNESS_DECISION_FRICTION_CLASSES,
		errors,
	);
	validateEnum(
		value.delayClass,
		"delayClass",
		VALID_HARNESS_DECISION_DELAY_CLASSES,
		errors,
	);
	if (!isRecord(value.execution)) {
		errors.push(toValidationError("execution must be an object", "execution"));
	} else {
		validateEnum(
			value.execution.profile,
			"execution.profile",
			VALID_HARNESS_DECISION_EXECUTION_PROFILES,
			errors,
		);
		validateEnum(
			value.execution.startupCost,
			"execution.startupCost",
			VALID_HARNESS_DECISION_STARTUP_COSTS,
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

/** Validate the immutable decision-envelope identity fields. */
function validateDecisionIdentity(
	value: Record<string, unknown>,
	errors: HeValidationError[],
): void {
	if (value.schemaVersion !== HARNESS_DECISION_SCHEMA_VERSION) {
		errors.push(
			toValidationError(
				`schemaVersion must be ${HARNESS_DECISION_SCHEMA_VERSION}`,
				"schemaVersion",
			),
		);
	}
	validateString(value.producer, "producer", errors);
	if (
		!VALID_HARNESS_DECISION_STATUSES.includes(
			value.status as HarnessDecisionStatus,
		)
	) {
		errors.push(
			toValidationError(
				"status must be pass, fail, blocked, or action_required",
				"status",
			),
		);
	}
}

/** Validate scalar routing and human-facing decision fields. */
function validateDecisionFields(
	value: Record<string, unknown>,
	errors: HeValidationError[],
): void {
	validateString(value.summary, "summary", errors);
	validateString(value.nextAction, "nextAction", errors);
	validateNullableString(value.nextCommand, "nextCommand", errors);
	validateEnum(value.phase, "phase", VALID_HARNESS_DECISION_PHASES, errors);
	if (value.cockpitLane !== undefined) {
		validateEnum(
			value.cockpitLane,
			"cockpitLane",
			VALID_HARNESS_DECISION_COCKPIT_LANES,
			errors,
		);
	}
	validateString(value.objective, "objective", errors);
	validateNullableString(value.humanEscalation, "humanEscalation", errors);
	validateNullableString(value.failureClass, "failureClass", errors);
}

/** Validate the evidence and command collections carried by a decision. */
function validateDecisionCollections(
	value: Record<string, unknown>,
	errors: HeValidationError[],
): void {
	validateStringArray(value.requiredEvidence, "requiredEvidence", errors);
	validateStringArray(value.stopConditions, "stopConditions", errors);
	validateStringArray(value.followUpCommands, "followUpCommands", errors);
	validateStringArray(value.hiddenPlumbing, "hiddenPlumbing", errors);
	if (!isStringArray(value.evidenceRef) || value.evidenceRef.length === 0) {
		errors.push(
			toValidationError(
				"evidenceRef must be a non-empty string array",
				"evidenceRef",
			),
		);
	}
}

/** Validate top-level effect flags and closed retry/risk vocabularies. */
function validateDecisionFlagsAndEnums(
	value: Record<string, unknown>,
	errors: HeValidationError[],
): void {
	validateBoolean(value.safeToRun, "safeToRun", errors);
	validateBoolean(value.requiresHuman, "requiresHuman", errors);
	validateBoolean(value.requiresNetwork, "requiresNetwork", errors);
	validateBoolean(value.writesFiles, "writesFiles", errors);
	if (
		!VALID_HARNESS_DECISION_RETRIES.includes(
			value.retry as HarnessDecisionRetry,
		)
	) {
		errors.push(
			toValidationError("retry must be safe, conditional, or manual", "retry"),
		);
	}
	if (
		!VALID_HARNESS_DECISION_RISK_TIERS.includes(
			value.riskTier as HarnessDecisionRiskTier,
		)
	) {
		errors.push(
			toValidationError(
				"riskTier must be low, medium, high, critical, or unknown",
				"riskTier",
			),
		);
	}
}

/** Validate known additive metadata projections while preserving unrelated compatibility metadata. */
function validateDecisionMeta(
	value: Record<string, unknown>,
	errors: HeValidationError[],
): void {
	if (value.meta !== undefined && !isRecord(value.meta)) {
		errors.push(
			toValidationError("meta must be an object when present", "meta"),
		);
		return;
	}
	if (!isRecord(value.meta)) return;
	if (hasOperationalMetaShape(value.meta)) {
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
	if ("recommendationEffects" in value.meta) {
		validateRecommendationEffects(
			value.meta.recommendationEffects,
			value,
			getOperationalPermissionPlan(value.meta),
			errors,
		);
	}
}

/** Validate an unknown value against harness-decision/v1. */
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
	validateDecisionIdentity(value, errors);
	validateDecisionFields(value, errors);
	validateDecisionCollections(value, errors);
	validateDecisionFlagsAndEnums(value, errors);
	validateDecisionRoutingConsistency(value, errors);
	validateDecisionMeta(value, errors);
	return { valid: errors.length === 0, errors };
}
