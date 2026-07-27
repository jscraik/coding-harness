export { buildHarnessDecision } from "./harness-decision-builder.js";
import type {
	CompactHarnessDecision as CompactHarnessDecisionValue,
	HarnessDecision as HarnessDecisionValue,
	HarnessDecisionStatus,
	HarnessDecisionValidationResult,
} from "./harness-decision-types.js";
import {
	HARNESS_DECISION_SCHEMA_VERSION,
	VALID_HARNESS_DECISION_STATUSES,
} from "./harness-decision-types.js";
import {
	validateFullHarnessDecision,
	validateHarnessDecisionOperationalMeta,
} from "./harness-decision-validation.js";
import {
	type HeValidationError,
	isRecord,
	toValidationError,
	validateBoolean,
	validateNullableString,
	validateString,
	validateStringArray,
} from "./validators.js";

export type {
	HarnessDecision,
	CompactHarnessDecision,
	HarnessDecisionCockpitLane,
	HarnessDecisionDelayClass,
	HarnessDecisionExecutionMetadata,
	HarnessDecisionExecutionProfile,
	HarnessDecisionFrictionClass,
	HarnessDecisionInput,
	HarnessDecisionMeta,
	HarnessDecisionOperationalMeta,
	HarnessDecisionPermissionPlan,
	HarnessDecisionPhase,
	HarnessDecisionProducer,
	HarnessDecisionRecommendationAuthority,
	HarnessDecisionRecommendationEffects,
	HarnessDecisionRetry,
	HarnessDecisionRiskTier,
	HarnessDecisionStartupCost,
	HarnessDecisionStatus,
	HarnessDecisionValidationResult,
} from "./harness-decision-types.js";
export {
	HARNESS_DECISION_RECOMMENDATION_EFFECTS_SCHEMA_VERSION,
	HARNESS_DECISION_SCHEMA_VERSION,
} from "./harness-decision-types.js";
export { validateHarnessDecisionOperationalMeta };

const COMPACT_DECISION_FIELDS = new Set([
	"schemaVersion",
	"status",
	"summary",
	"nextAction",
	"nextCommand",
	"warnings",
	"executionBoundary",
	"claimsBoundary",
]);
const COMPACT_BOUNDARY_FIELDS = [
	"safeToRun",
	"requiresHuman",
	"requiresNetwork",
	"writesFiles",
] as const;

/** Retain only non-blank warning strings from optional metadata. */
function compactStringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter(
				(entry): entry is string =>
					typeof entry === "string" && entry.trim().length > 0,
			)
		: [];
}

/** Render unavailable decision sources into compact, machine-readable warnings. */
function compactSourceErrorWarnings(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((entry) => {
		if (!isRecord(entry) || entry.status === "usable") return [];
		const kind = typeof entry.kind === "string" ? entry.kind : "unknown";
		const status = typeof entry.status === "string" ? entry.status : "unknown";
		const failureClass =
			typeof entry.failureClass === "string"
				? entry.failureClass
				: "unclassified";
		const ref = typeof entry.ref === "string" ? entry.ref : "unreferenced";
		return [`Source ${kind} is ${status}: ${failureClass} (${ref}).`];
	});
}

/** Remove internal orchestration detail from an ordinary `harness next --json` response. */
export function compactHarnessDecision(
	decision: HarnessDecisionValue,
): CompactHarnessDecisionValue {
	const meta = decision.meta ?? {};
	const readiness = meta.agentReadinessContext;
	const readinessWarnings = isRecord(readiness)
		? Array.isArray(readiness.degradedSurfaces)
			? readiness.degradedSurfaces.flatMap((surface) =>
					isRecord(surface)
						? compactStringArray(surface.staleReasons)
						: [],
				)
			: []
		: [];
	const synaipseState = meta.synaipseState;
	const claimsBoundary =
		isRecord(synaipseState) &&
		typeof synaipseState.claimBoundary === "string" &&
		synaipseState.claimBoundary.trim().length > 0
			? synaipseState.claimBoundary
			: "Local task routing only; does not prove PR, CI, review, merge, release, or production readiness.";

	return {
		schemaVersion: decision.schemaVersion,
		status: decision.status,
		summary: decision.summary,
		nextAction: decision.nextAction,
		nextCommand: decision.nextCommand,
		warnings: [
			...new Set([
				...compactStringArray(meta.truthLaneWarnings),
				...readinessWarnings,
				...compactSourceErrorWarnings(meta.sourceErrors),
			]),
		],
		executionBoundary: {
			safeToRun: decision.safeToRun,
			requiresHuman: decision.requiresHuman,
			requiresNetwork: decision.requiresNetwork,
			writesFiles: decision.writesFiles,
		},
		claimsBoundary,
	};
}

/** Reject undeclared fields from the closed compact public response. */
function validateCompactFields(
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
	for (const key of Object.keys(value)) {
		if (!COMPACT_DECISION_FIELDS.has(key)) {
			errors.push(
				toValidationError(`compact decisions must not include ${key}`, key),
			);
		}
	}
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
	validateString(value.summary, "summary", errors);
	validateString(value.nextAction, "nextAction", errors);
	validateNullableString(value.nextCommand, "nextCommand", errors);
	validateStringArray(value.warnings, "warnings", errors);
	validateString(value.claimsBoundary, "claimsBoundary", errors);
}

/** Validate the compact command boundary and its strict permission booleans. */
function validateCompactExecutionBoundary(
	value: Record<string, unknown>,
	errors: HeValidationError[],
): Record<string, unknown> | null {
	if (!isRecord(value.executionBoundary)) {
		errors.push(
			toValidationError(
				"executionBoundary must be an object",
				"executionBoundary",
			),
		);
		return null;
	}
	for (const field of COMPACT_BOUNDARY_FIELDS) {
		validateBoolean(
			value.executionBoundary[field],
			`executionBoundary.${field}`,
			errors,
		);
	}
	for (const field of Object.keys(value.executionBoundary)) {
		if (
			!COMPACT_BOUNDARY_FIELDS.includes(
				field as (typeof COMPACT_BOUNDARY_FIELDS)[number],
			)
		) {
			errors.push(
				toValidationError(
					`executionBoundary must not include ${field}`,
					`executionBoundary.${field}`,
				),
			);
		}
	}
	return value.executionBoundary;
}

/** Keep compact command availability consistent with its advertised safety flag. */
function validateCompactCommandSafety(
	value: Record<string, unknown>,
	boundary: Record<string, unknown> | null,
	errors: HeValidationError[],
): void {
	if (boundary === null) return;
	if (value.nextCommand === null && boundary.safeToRun === true) {
		errors.push(
			toValidationError(
				"executionBoundary.safeToRun must be false when nextCommand is null",
				"executionBoundary.safeToRun",
			),
		);
	}
	if (typeof value.nextCommand === "string" && boundary.safeToRun !== true) {
		errors.push(
			toValidationError(
				"executionBoundary.safeToRun must be true when nextCommand is set",
				"executionBoundary.safeToRun",
			),
		);
	}
}

/** Validate the routine task-first projection of harness-decision/v1. */
function validateCompactHarnessDecision(
	value: Record<string, unknown>,
): HarnessDecisionValidationResult {
	const errors: HeValidationError[] = [];
	validateCompactFields(value, errors);
	validateCompactCommandSafety(
		value,
		validateCompactExecutionBoundary(value, errors),
		errors,
	);
	return { valid: errors.length === 0, errors };
}

/** Validate either the complete producer shape or compact routine CLI projection. */
export function validateHarnessDecision(
	value: unknown,
): HarnessDecisionValidationResult {
	if (!isRecord(value)) {
		return {
			valid: false,
			errors: [toValidationError("decision must be an object")],
		};
	}
	return "producer" in value
		? validateFullHarnessDecision(value)
		: validateCompactHarnessDecision(value);
}

/** Return whether a value satisfies either supported harness-decision/v1 shape. */
export function isHarnessDecision(
	value: unknown,
): value is HarnessDecisionValue | CompactHarnessDecisionValue {
	return validateHarnessDecision(value).valid;
}
