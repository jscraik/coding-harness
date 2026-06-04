import type {
	HarnessDecision,
	HarnessDecisionStatus,
} from "./harness-decision.js";
import {
	type HeValidationError,
	isRecord,
	validateBoolean,
	validateEnum,
	validateNullableString,
	validateString,
	validateStringArray,
} from "./validators.js";

/** Schema version for the first lifecycle route decision envelope. */
export const ROUTE_DECISION_SCHEMA_VERSION = "route-decision/v1" as const;

/** Route decision status reuses the cockpit decision status vocabulary. */
export type RouteDecisionStatus = HarnessDecisionStatus;

/** Stable advisory lifecycle route identifiers. */
export const ROUTE_DECISION_IDS = [
	"review",
	"fix",
	"tdd",
	"heartbeat",
	"spec",
	"plan",
	"work",
	"human_escalation",
	"none",
] as const;

/** Stable advisory lifecycle route identifier. */
export type RouteDecisionId = (typeof ROUTE_DECISION_IDS)[number];

/** Stable recovery boundary identifiers for lifecycle route blockers. */
export const ROUTE_DECISION_BLOCKER_BOUNDARIES = [
	"none",
	"git_state",
	"network",
	"permission",
	"approval_required",
	"test_failure",
	"lint_failure",
	"missing_file",
	"timeout",
	"route_ambiguous",
	"source_unavailable",
	"contract_invalid",
] as const;

/** Stable recovery boundary identifier for lifecycle route blockers. */
export type RouteDecisionBlockerBoundary =
	(typeof ROUTE_DECISION_BLOCKER_BOUNDARIES)[number];

/** Stable mutation scopes for advisory lifecycle routes. */
export const ROUTE_DECISION_MUTATION_SCOPES = [
	"none",
	"repo_local",
	"destructive",
	"external",
	"tracker",
	"production",
	"release",
	"security",
	"credential",
	"merge",
	"public_contract",
	"goal_completion",
	"verifier_disagreement",
	"ambiguous_governance",
	"unknown",
] as const;

/** Mutation scope for advisory lifecycle routes. */
export type RouteDecisionMutationScope =
	(typeof ROUTE_DECISION_MUTATION_SCOPES)[number];

/** Stable mutation risk tiers for advisory lifecycle routes. */
export const ROUTE_DECISION_MUTATION_RISK_TIERS = [
	"none",
	"low",
	"medium",
	"high",
	"critical",
	"unknown",
] as const;

/** Mutation risk tier for advisory lifecycle routes. */
export type RouteDecisionMutationRiskTier =
	(typeof ROUTE_DECISION_MUTATION_RISK_TIERS)[number];

/** Evidence freshness for mutation authority decisions. */
export const ROUTE_DECISION_MUTATION_EVIDENCE_FRESHNESS = [
	"not_applicable",
	"current",
	"stale",
	"missing",
	"unknown",
] as const;

/** Evidence freshness for mutation authority decisions. */
export type RouteDecisionMutationEvidenceFreshness =
	(typeof ROUTE_DECISION_MUTATION_EVIDENCE_FRESHNESS)[number];

/** Validator ownership status for mutation authority decisions. */
export const ROUTE_DECISION_MUTATION_VALIDATOR_OWNERSHIP = [
	"not_applicable",
	"present",
	"missing",
	"unknown",
] as const;

/** Validator ownership status for mutation authority decisions. */
export type RouteDecisionMutationValidatorOwnership =
	(typeof ROUTE_DECISION_MUTATION_VALIDATOR_OWNERSHIP)[number];

/** Mutation authority result for advisory lifecycle routes. */
export const ROUTE_DECISION_MUTATION_AUTHORITIES = [
	"not_applicable",
	"agent_local",
	"human_required",
] as const;

/** Mutation authority result for advisory lifecycle routes. */
export type RouteDecisionMutationAuthority =
	(typeof ROUTE_DECISION_MUTATION_AUTHORITIES)[number];

/** Machine-readable policy for mutating advisory lifecycle routes. */
export interface RouteDecisionMutationPolicy {
	/** State scope the route would mutate. */
	scope: RouteDecisionMutationScope;
	/** Risk tier for the mutation. */
	riskTier: RouteDecisionMutationRiskTier;
	/** Freshness of evidence supporting the mutation authority decision. */
	evidenceFreshness: RouteDecisionMutationEvidenceFreshness;
	/** Whether a deterministic validator owns the mutation claim. */
	validatorOwnership: RouteDecisionMutationValidatorOwnership;
	/** Authority result for the route. */
	authority: RouteDecisionMutationAuthority;
}

const NOT_APPLICABLE_MUTATION_POLICY: RouteDecisionMutationPolicy = {
	scope: "none",
	riskTier: "none",
	evidenceFreshness: "not_applicable",
	validatorOwnership: "not_applicable",
	authority: "not_applicable",
};

/** Lifecycle route target and optional non-authoritative routing hints. */
export interface RouteDecisionRoute {
	/** Lifecycle route identifier. */
	id: RouteDecisionId;
	/** Human-readable route label. */
	label: string;
	/** Metadata-only command hint; callers must not execute this as authority. */
	targetCommand: string | null;
	/** Metadata-only skill hint for downstream orchestration. */
	targetSkill: string | null;
}

/** Runtime validation result for a candidate {@link RouteDecision}. */
export interface RouteDecisionValidationResult {
	/** Whether the candidate satisfies the `route-decision/v1` contract. */
	valid: boolean;
	/** Validation errors, empty when valid. */
	errors: HeValidationError[];
}

interface RouteDecisionLifecycleFields {
	/** Source file or artifact path that justified the route, if available. */
	sourcePath: string | null;
	/** Whether this advisory route can be consumed automatically. */
	safeToUse: boolean;
	/** Whether human judgment or approval is required before acting. */
	requiresHuman: boolean;
	/** Whether the route depends on network access. */
	requiresNetwork: boolean;
	/** Whether acting on the route would mutate files, git state, or trackers. */
	mutates: boolean;
	/** Risk-tiered mutation policy for advisory route consumption. */
	mutationPolicy: RouteDecisionMutationPolicy;
	/** Detailed failure taxonomy for blocked or failed routes. */
	failureClass: string | null;
	/** Aggregate recovery boundary for blocked or failed routes. */
	blockerBoundary: RouteDecisionBlockerBoundary;
	/** Evidence references used to justify the route. */
	evidenceRef: string[];
	/** Redaction operations applied before emitting this route. */
	redactionsApplied: string[];
	/** Non-fatal validation, provenance, or confidence warnings. */
	warnings: string[];
}

/**
 * Advisory lifecycle classification packet.
 *
 * Route decisions are metadata inputs for cockpit adapters. They do not replace
 * `HarnessDecision` and they never make `targetCommand` executable authority.
 */
export interface RouteDecision extends RouteDecisionLifecycleFields {
	/** Schema version for the route envelope. */
	schemaVersion: typeof ROUTE_DECISION_SCHEMA_VERSION;
	/** Command, skill, or orchestrator that produced the route. */
	producer: string;
	/** Route decision status. */
	status: RouteDecisionStatus;
	/** Recommended lifecycle route and optional metadata-only hints. */
	route: RouteDecisionRoute;
	/** Optional producer-specific metadata that remains advisory only. */
	meta?: Record<string, unknown>;
}

/** Additive lifecycle route metadata stored under `HarnessDecision.meta`. */
export interface HarnessDecisionLifecycleRouteMeta
	extends RouteDecisionLifecycleFields,
		Record<string, unknown> {
	/** Schema version copied from the route envelope. */
	schemaVersion: typeof ROUTE_DECISION_SCHEMA_VERSION;
	/** Marks this metadata as advisory, not cockpit command authority. */
	advisory: true;
	/** Lifecycle route identifier. */
	routeId: RouteDecisionId;
	/** Lifecycle route status. */
	routeStatus: RouteDecisionStatus;
	/** Metadata-only command hint; callers must not execute this as authority. */
	targetCommand: string | null;
	/** Metadata-only skill hint for downstream orchestration. */
	targetSkill: string | null;
}

const VALID_ROUTE_STATUSES: readonly RouteDecisionStatus[] = [
	"pass",
	"fail",
	"blocked",
	"action_required",
];

/**
 * Convert a validation error message string to a structured HeValidationError.
 *
 * @param message - The human-readable validation error message
 * @param path - Optional field path that failed validation
 * @returns A structured validation error with code derived from the message
 */
function toValidationError(message: string, path?: string): HeValidationError {
	const error: HeValidationError = {
		code: message,
		severity: "error",
	};
	if (path !== undefined) {
		error.path = path;
	}
	return error;
}

function validateRouteShape(
	value: unknown,
	errors: HeValidationError[],
): Record<string, unknown> | null {
	if (!isRecord(value)) {
		errors.push(toValidationError("route must be an object", "route"));
		return null;
	}
	validateEnum(value.id, "route.id", ROUTE_DECISION_IDS, errors);
	validateString(value.label, "route.label", errors);
	validateNullableString(value.targetCommand, "route.targetCommand", errors);
	validateNullableString(value.targetSkill, "route.targetSkill", errors);
	return value;
}

function validateMutationPolicyShape(
	value: unknown,
	errors: HeValidationError[],
): Record<string, unknown> | null {
	if (!isRecord(value)) {
		errors.push(
			toValidationError("mutationPolicy must be an object", "mutationPolicy"),
		);
		return null;
	}
	validateEnum(
		value.scope,
		"mutationPolicy.scope",
		ROUTE_DECISION_MUTATION_SCOPES,
		errors,
	);
	validateEnum(
		value.riskTier,
		"mutationPolicy.riskTier",
		ROUTE_DECISION_MUTATION_RISK_TIERS,
		errors,
	);
	validateEnum(
		value.evidenceFreshness,
		"mutationPolicy.evidenceFreshness",
		ROUTE_DECISION_MUTATION_EVIDENCE_FRESHNESS,
		errors,
	);
	validateEnum(
		value.validatorOwnership,
		"mutationPolicy.validatorOwnership",
		ROUTE_DECISION_MUTATION_VALIDATOR_OWNERSHIP,
		errors,
	);
	validateEnum(
		value.authority,
		"mutationPolicy.authority",
		ROUTE_DECISION_MUTATION_AUTHORITIES,
		errors,
	);
	return value;
}

function validateRouteConsistency(
	value: Record<string, unknown>,
	route: Record<string, unknown> | null,
	mutationPolicy: Record<string, unknown> | null,
	errors: HeValidationError[],
): void {
	const status = value.status;
	const failureClass = value.failureClass;
	const blockerBoundary = value.blockerBoundary;
	const isBlockedOrFail = status === "blocked" || status === "fail";

	if (isBlockedOrFail && typeof failureClass !== "string") {
		errors.push(
			toValidationError(
				"failureClass must be set when status is blocked or fail",
				"failureClass",
			),
		);
	}
	if (
		status === "pass" &&
		(failureClass !== null || blockerBoundary !== "none")
	) {
		errors.push(
			toValidationError(
				"pass routes must use failureClass null and blockerBoundary none",
				"failureClass",
			),
		);
	}
	if (
		status === "action_required" &&
		blockerBoundary === "none" &&
		failureClass !== null
	) {
		errors.push(
			toValidationError(
				"action_required routes without blockerBoundary must use failureClass null",
				"failureClass",
			),
		);
	}
	if (isBlockedOrFail && blockerBoundary === "none") {
		errors.push(
			toValidationError(
				"blocked or fail routes must use a non-none blockerBoundary",
				"blockerBoundary",
			),
		);
	}
	if (route?.id === "human_escalation" && value.requiresHuman !== true) {
		errors.push(
			toValidationError(
				"human_escalation routes must require human review",
				"requiresHuman",
			),
		);
	}
	if (
		route?.id === "none" &&
		(route.targetCommand !== null || route.targetSkill !== null)
	) {
		errors.push(
			toValidationError(
				"none routes must not set targetCommand or targetSkill",
				"route",
			),
		);
	}
	validateMutationPolicyConsistency(value, mutationPolicy, errors);
	if (isBlockedOrFail && value.safeToUse === true) {
		errors.push(
			toValidationError(
				"safeToUse must be false when status is blocked or fail",
				"safeToUse",
			),
		);
	}
}

function validateMutationPolicyConsistency(
	value: Record<string, unknown>,
	mutationPolicy: Record<string, unknown> | null,
	errors: HeValidationError[],
): void {
	if (mutationPolicy === null) return;

	const notApplicablePolicy =
		mutationPolicy.scope === "none" &&
		mutationPolicy.riskTier === "none" &&
		mutationPolicy.evidenceFreshness === "not_applicable" &&
		mutationPolicy.validatorOwnership === "not_applicable" &&
		mutationPolicy.authority === "not_applicable";

	if (value.mutates === false) {
		if (!notApplicablePolicy) {
			errors.push(
				toValidationError(
					"non-mutating routes must use a not-applicable mutation policy",
					"mutationPolicy",
				),
			);
		}
		return;
	}

	if (value.mutates !== true) return;

	if (notApplicablePolicy) {
		errors.push(
			toValidationError(
				"mutating routes must set a mutation policy",
				"mutationPolicy",
			),
		);
		return;
	}

	const incompletePolicy =
		mutationPolicy.scope === "none" ||
		mutationPolicy.riskTier === "none" ||
		mutationPolicy.evidenceFreshness === "not_applicable" ||
		mutationPolicy.validatorOwnership === "not_applicable" ||
		mutationPolicy.authority === "not_applicable";

	if (incompletePolicy) {
		errors.push(
			toValidationError(
				"mutating routes must set a complete mutation policy",
				"mutationPolicy",
			),
		);
		return;
	}

	if (
		mutationPolicy.authority === "human_required" &&
		value.requiresHuman !== true
	) {
		errors.push(
			toValidationError(
				"human-required mutation policies must require human review",
				"requiresHuman",
			),
		);
	}
	if (
		mutationPolicy.authority === "agent_local" &&
		value.requiresHuman === true
	) {
		errors.push(
			toValidationError(
				"agent-local mutation policies must not require human review",
				"mutationPolicy.authority",
			),
		);
	}

	const agentLocalPolicy =
		mutationPolicy.scope === "repo_local" &&
		mutationPolicy.riskTier === "low" &&
		mutationPolicy.evidenceFreshness === "current" &&
		mutationPolicy.validatorOwnership === "present" &&
		mutationPolicy.authority === "agent_local" &&
		value.requiresNetwork === false;

	if (value.requiresHuman === false && !agentLocalPolicy) {
		errors.push(
			toValidationError(
				"agent-local mutating routes require low-risk repo-local current validator-owned policy",
				"mutationPolicy",
			),
		);
	}
}

/**
 * Validate an unknown value against the `route-decision/v1` contract.
 *
 * The validator accumulates deterministic string errors so callers can report
 * every contract failure without executing or trusting route payload content.
 */
export function validateRouteDecision(
	value: unknown,
): RouteDecisionValidationResult {
	const errors: HeValidationError[] = [];
	if (!isRecord(value)) {
		return {
			valid: false,
			errors: [toValidationError("route decision must be an object")],
		};
	}

	if (value.schemaVersion !== ROUTE_DECISION_SCHEMA_VERSION) {
		errors.push(
			toValidationError(
				`schemaVersion must be ${ROUTE_DECISION_SCHEMA_VERSION}`,
				"schemaVersion",
			),
		);
	}
	validateString(value.producer, "producer", errors);
	if (!VALID_ROUTE_STATUSES.includes(value.status as RouteDecisionStatus)) {
		errors.push(
			toValidationError(
				"status must be pass, fail, blocked, or action_required",
				"status",
			),
		);
	}
	const route = validateRouteShape(value.route, errors);
	const mutationPolicyInput =
		value.mutationPolicy === undefined
			? NOT_APPLICABLE_MUTATION_POLICY
			: value.mutationPolicy;
	const mutationPolicy = validateMutationPolicyShape(
		mutationPolicyInput,
		errors,
	);
	validateNullableString(value.sourcePath, "sourcePath", errors);
	validateBoolean(value.safeToUse, "safeToUse", errors);
	validateBoolean(value.requiresHuman, "requiresHuman", errors);
	validateBoolean(value.requiresNetwork, "requiresNetwork", errors);
	validateBoolean(value.mutates, "mutates", errors);
	validateNullableString(value.failureClass, "failureClass", errors);
	validateEnum(
		value.blockerBoundary,
		"blockerBoundary",
		ROUTE_DECISION_BLOCKER_BOUNDARIES,
		errors,
	);
	validateStringArray(value.evidenceRef, "evidenceRef", errors);
	validateStringArray(value.redactionsApplied, "redactionsApplied", errors);
	validateStringArray(value.warnings, "warnings", errors);
	if (value.meta !== undefined && !isRecord(value.meta)) {
		errors.push(
			toValidationError("meta must be an object when present", "meta"),
		);
	}
	validateRouteConsistency(value, route, mutationPolicy, errors);

	return { valid: errors.length === 0, errors };
}

/** Type guard for values that satisfy the `route-decision/v1` contract. */
export function isRouteDecision(value: unknown): value is RouteDecision {
	return validateRouteDecision(value).valid;
}

/**
 * Convert a valid route decision into additive cockpit lifecycle metadata.
 *
 * This helper validates before mapping and intentionally preserves route fields
 * as nested advisory metadata instead of promoting them onto `HarnessDecision`.
 */
export function toHarnessDecisionLifecycleRouteMeta(
	routeDecision: RouteDecision,
): HarnessDecisionLifecycleRouteMeta {
	if (!validateRouteDecision(routeDecision).valid) {
		throw new Error("routeDecision must satisfy route-decision/v1");
	}

	return {
		schemaVersion: routeDecision.schemaVersion,
		advisory: true,
		routeId: routeDecision.route.id,
		routeStatus: routeDecision.status,
		targetCommand: routeDecision.route.targetCommand,
		targetSkill: routeDecision.route.targetSkill,
		sourcePath: routeDecision.sourcePath,
		safeToUse: routeDecision.safeToUse,
		requiresHuman: routeDecision.requiresHuman,
		requiresNetwork: routeDecision.requiresNetwork,
		mutates: routeDecision.mutates,
		mutationPolicy: {
			...(routeDecision.mutationPolicy ?? NOT_APPLICABLE_MUTATION_POLICY),
		},
		failureClass: routeDecision.failureClass,
		blockerBoundary: routeDecision.blockerBoundary,
		evidenceRef: [...routeDecision.evidenceRef],
		redactionsApplied: [...routeDecision.redactionsApplied],
		warnings: [...routeDecision.warnings],
	};
}

/**
 * Attach advisory lifecycle route metadata to a cockpit decision.
 *
 * The mapper returns a new `HarnessDecision` and refuses to overwrite an
 * existing `meta.lifecycleRoute` payload so callers must choose replacement or
 * history semantics explicitly in a later adapter.
 */
export function withLifecycleRouteMeta(
	decision: HarnessDecision,
	routeDecision: RouteDecision,
): HarnessDecision {
	if (decision.meta !== undefined && "lifecycleRoute" in decision.meta) {
		throw new Error("decision.meta.lifecycleRoute already exists");
	}

	return {
		...decision,
		meta: {
			...(decision.meta ?? {}),
			lifecycleRoute: toHarnessDecisionLifecycleRouteMeta(routeDecision),
		},
	};
}
