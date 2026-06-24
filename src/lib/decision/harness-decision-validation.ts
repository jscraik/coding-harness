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

function validateFlagConsistency(
	args: {
		field: "requiresHuman" | "requiresNetwork" | "writesFiles";
		message: string;
	},
	decision: Record<string, unknown>,
	permissionPlan: Record<string, unknown>,
	errors: HeValidationError[],
): void {
	const decisionValue = decision[args.field];
	const permissionValue = permissionPlan[args.field];
	if (
		typeof decisionValue === "boolean" &&
		typeof permissionValue === "boolean" &&
		decisionValue !== permissionValue
	) {
		errors.push(toValidationError(args.message, args.field));
	}
}

function validateOperationalMetaConsistency(
	decision: Record<string, unknown>,
	meta: Record<string, unknown>,
	errors: HeValidationError[],
): void {
	const permissionPlan = getOperationalPermissionPlan(meta);
	if (!permissionPlan) return;
	validateFlagConsistency(
		{
			field: "requiresHuman",
			message:
				"requiresHuman must match meta.execution.permissionPlan.requiresHuman",
		},
		decision,
		permissionPlan,
		errors,
	);
	validateFlagConsistency(
		{
			field: "requiresNetwork",
			message:
				"requiresNetwork must match meta.execution.permissionPlan.requiresNetwork",
		},
		decision,
		permissionPlan,
		errors,
	);
	validateFlagConsistency(
		{
			field: "writesFiles",
			message:
				"writesFiles must match meta.execution.permissionPlan.writesFiles",
		},
		decision,
		permissionPlan,
		errors,
	);
}

function validateFailureClassForStatus(
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

function validateSafeToRunForCommand(
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

function validateStopGuidanceForMissingCommand(
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

function validateDecisionRoutingConsistency(
	value: Record<string, unknown>,
	errors: HeValidationError[],
): void {
	validateFailureClassForStatus(value, errors);
	validateSafeToRunForCommand(value, errors);
	validateStopGuidanceForMissingCommand(value, errors);
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
	validateExecutionMetadata(value.execution, errors);
	return { valid: errors.length === 0, errors };
}

function validateExecutionMetadata(
	value: unknown,
	errors: HeValidationError[],
): void {
	if (!isRecord(value)) {
		errors.push(toValidationError("execution must be an object", "execution"));
		return;
	}
	validateEnum(
		value.profile,
		"execution.profile",
		VALID_HARNESS_DECISION_EXECUTION_PROFILES,
		errors,
	);
	validateEnum(
		value.startupCost,
		"execution.startupCost",
		VALID_HARNESS_DECISION_STARTUP_COSTS,
		errors,
	);
	validatePermissionPlan(
		value.permissionPlan,
		"execution.permissionPlan",
		errors,
	);
}

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

function validateDecisionFlags(
	value: Record<string, unknown>,
	errors: HeValidationError[],
): void {
	validateBoolean(value.safeToRun, "safeToRun", errors);
	validateBoolean(value.requiresHuman, "requiresHuman", errors);
	validateBoolean(value.requiresNetwork, "requiresNetwork", errors);
	validateBoolean(value.writesFiles, "writesFiles", errors);
}

function validateDecisionEnums(
	value: Record<string, unknown>,
	errors: HeValidationError[],
): void {
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
	if (!isRecord(value.meta) || !hasOperationalMetaShape(value.meta)) return;
	const metaValidation = validateHarnessDecisionOperationalMeta(value.meta);
	if (!metaValidation.valid) {
		errors.push(
			...metaValidation.errors.map((error) =>
				toValidationError(`meta.${error.code}`, `meta.${error.path ?? ""}`),
			),
		);
		return;
	}
	validateOperationalMetaConsistency(value, value.meta, errors);
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
	validateDecisionFlags(value, errors);
	validateDecisionEnums(value, errors);
	validateDecisionRoutingConsistency(value, errors);
	validateDecisionMeta(value, errors);
	return { valid: errors.length === 0, errors };
}
