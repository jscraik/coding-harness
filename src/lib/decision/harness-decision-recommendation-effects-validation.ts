import {
	HARNESS_DECISION_RECOMMENDATION_EFFECTS_SCHEMA_VERSION,
	VALID_HARNESS_DECISION_RETRIES,
	type HarnessDecisionRetry,
} from "./harness-decision-types.js";
import {
	type HeValidationError,
	isRecord,
	toValidationError,
	validateBoolean,
	validateStringArray,
} from "./validators.js";

type DecisionRecord = Record<string, unknown>;
type PermissionFlag =
	| "requiresHuman"
	| "requiresNetwork"
	| "writesFiles"
	| "requiresGitWrite";

/** Validate the shared permission-plan shape used by operational and recommendation metadata. */
export function validatePermissionPlan(
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

/** Read the permission plan embedded in known operational metadata. */
export function getOperationalPermissionPlan(
	meta: DecisionRecord,
): DecisionRecord | null {
	if (!isRecord(meta.execution)) return null;
	return isRecord(meta.execution.permissionPlan)
		? meta.execution.permissionPlan
		: null;
}

/** Report a mismatch between a legacy decision flag and a nested permission-plan mirror. */
export function validateFlagConsistency(
	field: PermissionFlag,
	message: string,
	decision: DecisionRecord,
	permissionPlan: DecisionRecord,
	errors: HeValidationError[],
): void {
	if (
		typeof decision[field] === "boolean" &&
		typeof permissionPlan[field] === "boolean" &&
		decision[field] !== permissionPlan[field]
	) {
		errors.push(toValidationError(message, field));
	}
}

/** Keep the legacy decision flags aligned with the established operational recommendation plan. */
export function validateOperationalMetaConsistency(
	decision: DecisionRecord,
	meta: DecisionRecord,
	errors: HeValidationError[],
): void {
	const permissionPlan = getOperationalPermissionPlan(meta);
	if (!permissionPlan) return;
	for (const field of [
		"requiresHuman",
		"requiresNetwork",
		"writesFiles",
	] as const) {
		validateFlagConsistency(
			field,
			`${field} must match meta.execution.permissionPlan.${field}`,
			decision,
			permissionPlan,
			errors,
		);
	}
}

/** Validate authority facts for the planned, later recommendation. */
function validateRecommendationAuthority(
	value: DecisionRecord,
	decision: DecisionRecord,
	errors: HeValidationError[],
): void {
	if (!isRecord(value.authority)) {
		errors.push(
			toValidationError(
				"meta.recommendationEffects.authority must be an object",
				"meta.recommendationEffects.authority",
			),
		);
		return;
	}
	for (const field of [
		"safeToRun",
		"requiresHuman",
		"requiresNetwork",
		"requiresGitWrite",
	] as const) {
		validateBoolean(
			value.authority[field],
			`meta.recommendationEffects.authority.${field}`,
			errors,
		);
	}
	for (const field of ["requiresHuman", "requiresNetwork"] as const) {
		validateFlagConsistency(
			field,
			`${field} must match meta.recommendationEffects.authority.${field}`,
			decision,
			value.authority,
			errors,
		);
	}
	if (decision.safeToRun !== value.authority.safeToRun) {
		errors.push(
			toValidationError(
				"safeToRun must match meta.recommendationEffects.authority.safeToRun",
				"safeToRun",
			),
		);
	}
}

/** Validate version, rollback, evidence, and retry facts for the planned recommendation. */
function validateRecommendationLifecycle(
	value: DecisionRecord,
	decision: DecisionRecord,
	errors: HeValidationError[],
): void {
	if (
		value.schemaVersion !==
		HARNESS_DECISION_RECOMMENDATION_EFFECTS_SCHEMA_VERSION
	) {
		errors.push(
			toValidationError(
				`meta.recommendationEffects.schemaVersion must be ${HARNESS_DECISION_RECOMMENDATION_EFFECTS_SCHEMA_VERSION}`,
				"meta.recommendationEffects.schemaVersion",
			),
		);
	}
	if (value.rollbackPosture !== "not_started") {
		errors.push(
			toValidationError(
				"meta.recommendationEffects.rollbackPosture must be not_started",
				"meta.recommendationEffects.rollbackPosture",
			),
		);
	}
	validateStringArray(
		value.requiredEvidence,
		"meta.recommendationEffects.requiredEvidence",
		errors,
	);
	if (
		Array.isArray(value.requiredEvidence) &&
		Array.isArray(decision.requiredEvidence) &&
		value.requiredEvidence.join("\u0000") !==
			decision.requiredEvidence.join("\u0000")
	) {
		errors.push(
			toValidationError(
				"meta.recommendationEffects.requiredEvidence must match requiredEvidence",
				"meta.recommendationEffects.requiredEvidence",
			),
		);
	}
	if (
		!VALID_HARNESS_DECISION_RETRIES.includes(
			value.retry as HarnessDecisionRetry,
		)
	) {
		errors.push(
			toValidationError(
				"meta.recommendationEffects.retry must be safe, conditional, or manual",
				"meta.recommendationEffects.retry",
			),
		);
	}
	if (value.retry !== decision.retry) {
		errors.push(
			toValidationError(
				"meta.recommendationEffects.retry must match retry",
				"meta.recommendationEffects.retry",
			),
		);
	}
}

/** Compare unknown values as ordered arrays of strings. */
function sameStringArray(left: unknown, right: unknown): boolean {
	return (
		Array.isArray(left) &&
		Array.isArray(right) &&
		left.length === right.length &&
		left.every((entry, index) => entry === right[index])
	);
}

/** Compare all stable fields of two permission plans. */
function permissionPlansMatch(
	left: DecisionRecord,
	right: DecisionRecord,
): boolean {
	return (
		left.requiresHuman === right.requiresHuman &&
		left.requiresNetwork === right.requiresNetwork &&
		left.writesFiles === right.writesFiles &&
		left.requiresGitWrite === right.requiresGitWrite &&
		sameStringArray(left.filesystemWrite, right.filesystemWrite) &&
		sameStringArray(left.commands, right.commands) &&
		sameStringArray(left.secrets, right.secrets)
	);
}

/** Validate the planned permission plan against decision and operational metadata. */
function validateRecommendationPermissionPlan(
	value: DecisionRecord,
	decision: DecisionRecord,
	operationalPermissionPlan: DecisionRecord | null,
	errors: HeValidationError[],
): void {
	validatePermissionPlan(
		value.permissionPlan,
		"meta.recommendationEffects.permissionPlan",
		errors,
	);
	if (!isRecord(value.permissionPlan)) return;
	for (const field of [
		"requiresHuman",
		"requiresNetwork",
		"writesFiles",
	] as const) {
		validateFlagConsistency(
			field,
			`${field} must match meta.recommendationEffects.permissionPlan.${field}`,
			decision,
			value.permissionPlan,
			errors,
		);
	}
	if (
		isRecord(value.authority) &&
		value.authority.requiresGitWrite !== value.permissionPlan.requiresGitWrite
	) {
		errors.push(
			toValidationError(
				"meta.recommendationEffects.authority.requiresGitWrite must match meta.recommendationEffects.permissionPlan.requiresGitWrite",
				"meta.recommendationEffects.authority.requiresGitWrite",
			),
		);
	}
	if (
		operationalPermissionPlan !== null &&
		!permissionPlansMatch(value.permissionPlan, operationalPermissionPlan)
	) {
		errors.push(
			toValidationError(
				"meta.recommendationEffects.permissionPlan must match meta.execution.permissionPlan",
				"meta.recommendationEffects.permissionPlan",
			),
		);
	}
}

/** Validate the additive plan for a later recommendation without treating it as an invocation effect. */
export function validateRecommendationEffects(
	value: unknown,
	decision: DecisionRecord,
	operationalPermissionPlan: DecisionRecord | null,
	errors: HeValidationError[],
): void {
	if (!isRecord(value)) {
		errors.push(
			toValidationError(
				"meta.recommendationEffects must be an object",
				"meta.recommendationEffects",
			),
		);
		return;
	}
	validateRecommendationAuthority(value, decision, errors);
	validateRecommendationLifecycle(value, decision, errors);
	validateRecommendationPermissionPlan(
		value,
		decision,
		operationalPermissionPlan,
		errors,
	);
}
