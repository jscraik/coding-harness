/**
 * Counterfactual policy simulation types.
 *
 * Defines interfaces, exit codes, and constants for deterministic
 * baseline-vs-candidate policy simulation against historical telemetry.
 */
import type { GateVerdict, PolicyAction } from "../contract/types.js";

// ============================================================================
// EXIT CODES
// ============================================================================

/**
 * Exit codes for simulate CLI command.
 */
export const SIMULATE_EXIT_CODES = {
	/** Simulation completed successfully */
	SUCCESS: 0,
	/** Validation error (invalid inputs) */
	VALIDATION_ERROR: 1,
	/** Input not found (missing files/paths) */
	INPUT_NOT_FOUND: 2,
	/** Input too large (exceeds size limits) */
	INPUT_TOO_LARGE: 3,
	/** System error (runtime failure) */
	SYSTEM_ERROR: 10,
} as const;

// ============================================================================
// SIMULATION LIMITS
// ============================================================================

/**
 * Bounded execution limits for CI safety.
 */
export const SIMULATION_LIMITS = {
	/** Maximum individual artifact file size in MB */
	maxArtifactSizeMB: 50,
	/** Maximum individual trace file size in MB */
	maxTraceSizeMB: 100,
	/** Maximum total events to process */
	maxEventCount: 100000,
	/** Maximum ingestion time in milliseconds */
	maxIngestionTimeMs: 30000,
	/** Maximum output report size in MB */
	maxOutputSizeMB: 5,
	/** Maximum traces to process */
	maxTraceCount: 100,
	/** Maximum artifacts to process */
	maxArtifactCount: 50,
} as const;

// ============================================================================
// SCHEMA VERSION
// ============================================================================

/**
 * Current simulation report schema version.
 */
export const SIMULATION_SCHEMA_VERSION =
	"counterfactual-simulation/v1" as const;

// ============================================================================
// CONFIDENCE TYPES
// ============================================================================

/**
 * Confidence level for simulation results.
 */
export type ConfidenceLevel = "high" | "medium" | "low" | "insufficient-data";

/**
 * Confidence score mapping.
 */
export const CONFIDENCE_SCORES: Record<ConfidenceLevel, number> = {
	high: 5,
	medium: 3,
	low: 1,
	"insufficient-data": 0,
} as const;

/**
 * Sample size assessment.
 */
export type SampleSizeAssessment = "adequate" | "marginal" | "insufficient";

/**
 * Data quality assessment for confidence scoring.
 */
export interface DataQualityAssessment {
	/** Sample size sufficiency */
	sampleSize: SampleSizeAssessment;
	/** Trace coverage percentage (0-100) */
	traceCoverage: number;
	/** Artifact completeness percentage (0-100) */
	artifactCompleteness: number;
	/** Effective sample size for statistical purposes */
	effectiveSampleSize: number;
}

/**
 * Confidence assessment with rationale.
 */
export interface ConfidenceAssessment {
	/** Overall confidence level */
	level: ConfidenceLevel;
	/** Numeric score (0-5) for programmatic comparison */
	score: number;
	/** Rationale for confidence level */
	rationale: string[];
	/** Data quality indicators */
	dataQuality: DataQualityAssessment;
}

// ============================================================================
// METRIC DELTA TYPES
// ============================================================================

/**
 * Metric delta between baseline and candidate.
 */
export interface MetricDelta {
	/** Baseline value */
	baseline: number;
	/** Candidate value */
	candidate: number;
	/** Delta = candidate - baseline */
	delta: number;
	/** Relative change as percentage */
	percentChange: number;
	/** 95% confidence interval half-width (optional) */
	ciHalfWidth?: number;
}

/**
 * Simulation metrics comparing baseline vs candidate policies.
 */
export interface SimulationMetrics {
	/** Estimated risk prevented by candidate policy */
	preventedRisk: MetricDelta;
	/** Estimated false block rate change */
	falseBlockRate: MetricDelta;
	/** Lead time change (negative = improvement) */
	leadTimeDelta: MetricDelta;
	/** Rollback pressure change */
	rollbackPressureDelta: MetricDelta;
}

// ============================================================================
// DECISION DELTA TYPES
// ============================================================================

/**
 * Policy decision for a single event.
 */
export interface PolicyDecision {
	/** Decision action */
	action: PolicyAction;
	/** Resolved gate verdict for the decision action */
	verdict?: GateVerdict | undefined;
	/** Human-readable reason */
	reason: string;
	/** Confidence in this decision (0-1) */
	confidence: number;
	/** Event index in trace */
	traceEventIndex: number;
}

/**
 * Type of decision change between baseline and candidate.
 */
export type DeltaType =
	| "blocked_to_allowed"
	| "allowed_to_blocked"
	| "confidence_change"
	| "none";

/**
 * Decision delta for a single event between baseline and candidate.
 */
export interface DecisionDelta {
	/** Event index in trace */
	eventIndex: number;
	/** Baseline policy decision */
	baseline: PolicyDecision;
	/** Candidate policy decision */
	candidate: PolicyDecision;
	/** Whether decisions differ */
	changed: boolean;
	/** Delta category */
	deltaType: DeltaType;
}

// ============================================================================
// RECOMMENDATION TYPES
// ============================================================================

/**
 * Recommendation severity level.
 */
export type RecommendationSeverity =
	| "critical"
	| "high"
	| "medium"
	| "low"
	| "info";

/**
 * Recommendation category.
 */
export type RecommendationCategory =
	| "policy"
	| "threshold"
	| "workflow"
	| "evidence";

/**
 * Recommendation confidence.
 */
export type RecommendationConfidence = "high" | "medium" | "low";

/**
 * Simulation recommendation (advisory only).
 */
export interface SimulationRecommendation {
	/** Unique recommendation ID */
	id: string;
	/** Severity level for prioritization */
	severity: RecommendationSeverity;
	/** Category for grouping */
	category: RecommendationCategory;
	/** Human-readable title */
	title: string;
	/** Detailed rationale (supports markdown) */
	rationale: string;
	/** Suggested action (advisory only, never auto-applied) */
	suggestion: string;
	/** Related metrics this recommendation is based on */
	relatedMetrics: string[];
	/** Confidence in this specific recommendation */
	confidence: RecommendationConfidence;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

/**
 * Simulation input metadata.
 */
export interface SimulationInputs {
	/** Path to baseline contract file */
	contractBaseline: string;
	/** Path to candidate contract file */
	contractCandidate: string;
	/** Directory containing pilot artifacts */
	artifactsDir: string;
	/** Directory containing replay traces */
	tracesDir: string;
	/** Content hash of baseline contract */
	contractBaselineHash: string;
	/** Content hash of candidate contract */
	contractCandidateHash: string;
}

/**
 * Simulation window (time range).
 */
export interface SimulationWindow {
	/** Window start (ISO 8601) */
	start: string;
	/** Window end (ISO 8601) */
	end: string;
}

// ============================================================================
// REPORT TYPES
// ============================================================================

/**
 * Delta summary statistics.
 */
export interface DeltaSummary {
	/** Total events evaluated */
	total: number;
	/** Events changed from blocked to allowed */
	blockedToAllowed: number;
	/** Events changed from allowed to blocked */
	allowedToBlocked: number;
	/** Events with confidence changes only */
	confidenceChanges: number;
	/** Unchanged events */
	unchanged: number;
}

/**
 * Simulation flags for CI integration.
 */
export type SimulationFlag =
	| "insufficient_data"
	| "high_false_block_risk"
	| "significant_lead_time_impact"
	| "rollback_pressure_increase"
	| "legacy_trace_format"
	| "partial_coverage";

/**
 * Summary statistics.
 */
export interface SimulationSummary {
	/** Total scenarios evaluated */
	scenariosEvaluated: number;
	/** Scenarios with sufficient data */
	sufficientDataCount: number;
	/** Total traces processed */
	tracesProcessed: number;
	/** Total artifacts processed */
	artifactsProcessed: number;
}

/**
 * Delta section of report.
 */
export interface SimulationDeltas {
	/** Summary counts */
	summary: DeltaSummary;
	/** Top N most impactful deltas (for summary) */
	topDeltas: DecisionDelta[];
}

/**
 * Simulation report (V1 schema).
 */
export interface CounterfactualSimulationReport {
	/** Schema version for compatibility */
	schemaVersion: typeof SIMULATION_SCHEMA_VERSION;
	/** When simulation was generated (ISO 8601) */
	generatedAt: string;
	/** Simulation duration in milliseconds */
	durationMs: number;
	/** Input metadata */
	inputs: SimulationInputs;
	/** Simulation window */
	window: SimulationWindow;
	/** Summary statistics */
	summary: SimulationSummary;
	/** Data quality assessment */
	dataQuality: DataQualityAssessment;
	/** Primary comparison metrics */
	metrics: SimulationMetrics;
	/** Decision delta summary */
	deltas: SimulationDeltas;
	/** Generated recommendations (advisory only) */
	recommendations: SimulationRecommendation[];
	/** Overall confidence assessment */
	confidence: ConfidenceAssessment;
	/** Machine-readable flags for CI integration */
	flags: SimulationFlag[];
}

// ============================================================================
// CLI OPTIONS
// ============================================================================

/**
 * Options for simulate command.
 */
export interface SimulateOptions {
	/** Path to baseline contract file (required) */
	contractA: string;
	/** Path to candidate contract file (required) */
	contractB: string;
	/** Directory containing pilot artifacts (default: ./artifacts/pilot) */
	artifactsDir?: string;
	/** Directory containing replay traces (default: ./.traces) */
	tracesDir?: string;
	/** Output file path for JSON report */
	outputPath?: string;
	/** Output as JSON (suppresses human-readable output) */
	json?: boolean;
	/** CI soft mode (non-blocking exit codes) */
	ciSoft?: boolean;
	/** Verbose output */
	verbose?: boolean;
}

/**
 * Simulate command result type.
 */
export type SimulateResult =
	| { ok: true; report: CounterfactualSimulationReport; exitCode: number }
	| { ok: false; error: { code: string; message: string }; exitCode: number };

// ============================================================================
// TYPE GUARDS
// ============================================================================

const VALID_CONFIDENCE_LEVELS: ConfidenceLevel[] = [
	"high",
	"medium",
	"low",
	"insufficient-data",
];

const VALID_POLICY_ACTIONS: PolicyAction[] = ["allow", "block", "warn"];
const VALID_GATE_VERDICTS: GateVerdict[] = ["pass", "fail"];

const VALID_DELTA_TYPES: DeltaType[] = [
	"blocked_to_allowed",
	"allowed_to_blocked",
	"confidence_change",
	"none",
];

const VALID_SEVERITIES: RecommendationSeverity[] = [
	"critical",
	"high",
	"medium",
	"low",
	"info",
];

const VALID_CATEGORIES: RecommendationCategory[] = [
	"policy",
	"threshold",
	"workflow",
	"evidence",
];

const VALID_FLAGS: SimulationFlag[] = [
	"insufficient_data",
	"high_false_block_risk",
	"significant_lead_time_impact",
	"rollback_pressure_increase",
	"legacy_trace_format",
	"partial_coverage",
];

/**
 * Type guard for ConfidenceLevel.
 */
export function isConfidenceLevel(value: unknown): value is ConfidenceLevel {
	return (
		typeof value === "string" &&
		VALID_CONFIDENCE_LEVELS.includes(value as ConfidenceLevel)
	);
}

/**
 * Type guard for PolicyAction.
 */
export function isPolicyAction(value: unknown): value is PolicyAction {
	return (
		typeof value === "string" &&
		VALID_POLICY_ACTIONS.includes(value as PolicyAction)
	);
}

export function isGateVerdict(value: unknown): value is GateVerdict {
	return (
		typeof value === "string" &&
		VALID_GATE_VERDICTS.includes(value as GateVerdict)
	);
}

/**
 * Type guard for DeltaType.
 */
export function isDeltaType(value: unknown): value is DeltaType {
	return (
		typeof value === "string" && VALID_DELTA_TYPES.includes(value as DeltaType)
	);
}

/**
 * Type guard for RecommendationSeverity.
 */
export function isRecommendationSeverity(
	value: unknown,
): value is RecommendationSeverity {
	return (
		typeof value === "string" &&
		VALID_SEVERITIES.includes(value as RecommendationSeverity)
	);
}

/**
 * Type guard for RecommendationCategory.
 */
export function isRecommendationCategory(
	value: unknown,
): value is RecommendationCategory {
	return (
		typeof value === "string" &&
		VALID_CATEGORIES.includes(value as RecommendationCategory)
	);
}

/**
 * Type guard for SimulationFlag.
 */
export function isSimulationFlag(value: unknown): value is SimulationFlag {
	return (
		typeof value === "string" && VALID_FLAGS.includes(value as SimulationFlag)
	);
}

/**
 * Type guard for MetricDelta.
 */
export function isMetricDelta(value: unknown): value is MetricDelta {
	if (typeof value !== "object" || value === null) return false;
	const v = value as Record<string, unknown>;
	return (
		typeof v.baseline === "number" &&
		typeof v.candidate === "number" &&
		typeof v.delta === "number" &&
		typeof v.percentChange === "number"
	);
}

/**
 * Type guard for PolicyDecision.
 */
export function isPolicyDecision(value: unknown): value is PolicyDecision {
	if (typeof value !== "object" || value === null) return false;
	const v = value as Record<string, unknown>;
	return (
		isPolicyAction(v.action) &&
		(v.verdict === undefined || isGateVerdict(v.verdict)) &&
		typeof v.reason === "string" &&
		typeof v.confidence === "number" &&
		typeof v.traceEventIndex === "number"
	);
}

/**
 * Type guard for DecisionDelta.
 */
export function isDecisionDelta(value: unknown): value is DecisionDelta {
	if (typeof value !== "object" || value === null) return false;
	const v = value as Record<string, unknown>;
	return (
		typeof v.eventIndex === "number" &&
		isPolicyDecision(v.baseline) &&
		isPolicyDecision(v.candidate) &&
		typeof v.changed === "boolean" &&
		isDeltaType(v.deltaType)
	);
}

/**
 * Type guard for SimulationRecommendation.
 */
export function isSimulationRecommendation(
	value: unknown,
): value is SimulationRecommendation {
	if (typeof value !== "object" || value === null) return false;
	const v = value as Record<string, unknown>;
	return (
		typeof v.id === "string" &&
		isRecommendationSeverity(v.severity) &&
		isRecommendationCategory(v.category) &&
		typeof v.title === "string" &&
		typeof v.rationale === "string" &&
		typeof v.suggestion === "string" &&
		Array.isArray(v.relatedMetrics) &&
		v.relatedMetrics.every((m) => typeof m === "string") &&
		(v.confidence === "high" ||
			v.confidence === "medium" ||
			v.confidence === "low")
	);
}

/**
 * Type guard for CounterfactualSimulationReport.
 */
export function isCounterfactualSimulationReport(
	value: unknown,
): value is CounterfactualSimulationReport {
	if (typeof value !== "object" || value === null) return false;
	const v = value as Record<string, unknown>;

	// Check schema version
	if (v.schemaVersion !== SIMULATION_SCHEMA_VERSION) return false;

	// Check required fields exist
	if (typeof v.generatedAt !== "string") return false;
	if (typeof v.durationMs !== "number") return false;
	if (typeof v.inputs !== "object" || v.inputs === null) return false;
	if (typeof v.window !== "object" || v.window === null) return false;
	if (typeof v.summary !== "object" || v.summary === null) return false;
	if (typeof v.dataQuality !== "object" || v.dataQuality === null) return false;
	if (typeof v.metrics !== "object" || v.metrics === null) return false;
	if (typeof v.deltas !== "object" || v.deltas === null) return false;
	if (!Array.isArray(v.recommendations)) return false;
	if (typeof v.confidence !== "object" || v.confidence === null) return false;
	if (!Array.isArray(v.flags)) return false;

	// Validate flags array
	if (!v.flags.every(isSimulationFlag)) return false;

	// Validate recommendations array
	if (!v.recommendations.every(isSimulationRecommendation)) return false;

	return true;
}
