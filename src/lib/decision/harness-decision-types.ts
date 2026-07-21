import type { HeValidationError } from "./validators.js";
import type { SynaipseContextFailureEnvelope } from "../synaipse/context-failures.js";

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

/** Agent work phase represented by a decision packet. */
export type HarnessDecisionPhase =
	| "orient"
	| "verify"
	| "review"
	| "repair"
	| "handoff";

/** Product cockpit lane represented by a decision packet. */
export type HarnessDecisionCockpitLane =
	| "orient"
	| "prove"
	| "repair"
	| "review"
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

/** Schema version for recommendation effects that have not yet been invoked. */
export const HARNESS_DECISION_RECOMMENDATION_EFFECTS_SCHEMA_VERSION =
	"harness-recommendation-effects/v1" as const;

/** Authority needed to invoke a recommendation after `harness next` returns it. */
export interface HarnessDecisionRecommendationAuthority {
	/** Whether the later recommendation is safe to invoke without extra approval. */
	safeToRun: boolean;
	/** Whether the later recommendation requires human judgment or approval. */
	requiresHuman: boolean;
	/** Whether the later recommendation requires network access. */
	requiresNetwork: boolean;
	/** Whether the later recommendation changes Git state. */
	requiresGitWrite: boolean;
}

/** Additive plan for a recommendation that `harness next` has not invoked. */
export interface HarnessDecisionRecommendationEffects {
	/** Versioned shape so consumers can ignore the projection until they adopt it. */
	schemaVersion: typeof HARNESS_DECISION_RECOMMENDATION_EFFECTS_SCHEMA_VERSION;
	/** Authority required for the later recommendation, not the current invocation. */
	authority: HarnessDecisionRecommendationAuthority;
	/** Recommendation effects are only planned; no rollback is needed before invocation. */
	rollbackPosture: "not_started";
	/** Evidence the later recommendation requires before closeout. */
	requiredEvidence: string[];
	/** Retry posture for the later recommendation. */
	retry: HarnessDecisionRetry;
	/** Permission plan for the later recommendation. */
	permissionPlan: HarnessDecisionPermissionPlan;
}

/** Metadata that `harness next` may add without changing the v1 envelope. */
export interface HarnessDecisionMeta extends Record<string, unknown> {
	/** Existing operational metadata for the later recommended action. */
	execution?: HarnessDecisionExecutionMetadata;
	/** Additive effects of the later recommended action. */
	recommendationEffects?: HarnessDecisionRecommendationEffects;
	/** Additive, versioned context-resolution failures; absent for legacy input. */
	synaipseContextFailures?: SynaipseContextFailureEnvelope;
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
	/** Product cockpit lane for guided operator routing. New producers emit this; legacy v1 packets may omit it. */
	cockpitLane?: HarnessDecisionCockpitLane;
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
	meta?: HarnessDecisionMeta;
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
	/** Product cockpit lane for guided operator routing. Defaults from phase. */
	cockpitLane?: HarnessDecisionCockpitLane;
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
	meta?: HarnessDecisionMeta;
}

/** Validation result for a candidate {@link HarnessDecision}. */
export interface HarnessDecisionValidationResult {
	/** Whether the candidate satisfies the v1 decision contract. */
	valid: boolean;
	/** Validation errors, empty when valid. */
	errors: HeValidationError[];
}

export const VALID_HARNESS_DECISION_STATUSES: readonly HarnessDecisionStatus[] =
	["pass", "fail", "blocked", "action_required"];

export const VALID_HARNESS_DECISION_PHASES: readonly HarnessDecisionPhase[] = [
	"orient",
	"verify",
	"review",
	"repair",
	"handoff",
];

export const VALID_HARNESS_DECISION_COCKPIT_LANES: readonly HarnessDecisionCockpitLane[] =
	["orient", "prove", "repair", "review", "handoff"];

export const VALID_HARNESS_DECISION_RETRIES: readonly HarnessDecisionRetry[] = [
	"safe",
	"conditional",
	"manual",
];

export const VALID_HARNESS_DECISION_RISK_TIERS: readonly HarnessDecisionRiskTier[] =
	["low", "medium", "high", "critical", "unknown"];

export const VALID_HARNESS_DECISION_FRICTION_CLASSES: readonly HarnessDecisionFrictionClass[] =
	[
		"none",
		"tool_friction",
		"permission_sandbox",
		"repo_state",
		"unclear_instruction",
		"validation_failure",
		"implementation_complexity",
		"external_service",
	];

export const VALID_HARNESS_DECISION_DELAY_CLASSES: readonly HarnessDecisionDelayClass[] =
	[
		"normal",
		"waiting_on_command",
		"waiting_on_agent",
		"repeated_failure",
		"human_needed",
	];

export const VALID_HARNESS_DECISION_EXECUTION_PROFILES: readonly HarnessDecisionExecutionProfile[] =
	["read_only", "local", "virtual", "container", "remote"];

export const VALID_HARNESS_DECISION_STARTUP_COSTS: readonly HarnessDecisionStartupCost[] =
	["none", "low", "medium", "high"];
