/**
 * Pilot evaluation types for throughput v1 scorecard and promotion gate.
 *
 * Defines metrics schema, evaluation result, and command interfaces.
 */

/**
 * Pilot evaluation outcome
 */
export type PilotOutcome = "promote" | "hold" | "rollback";

/**
 * Pilot evaluation metrics captured from artifacts
 */
export interface PilotMetrics {
	/** Start of evaluation window (ISO date) */
	windowStart: string;
	/** End of evaluation window (ISO date) */
	windowEnd: string;
	/** Number of eligible PRs in sample */
	sampleSize: number;
	/** PR lead time p50 improvement (negative = improvement, e.g., -0.41 = 41% reduction) */
	leadTimeP50Improvement: number;
	/** PR lead time p75 improvement (tail guardrail) */
	leadTimeP75Improvement: number;
	/** 95% confidence interval half-width for p50 improvement */
	leadTimeP50CiHalfWidth: number;
	/** 95% confidence interval half-width for p75 improvement */
	leadTimeP75CiHalfWidth: number;
	/** Rollback reliability ratio (successful_rollbacks / rollback_triggers) */
	rollbackReliability: number;
	/** Count of confirmed high-risk automation-caused incidents */
	highRiskAutomationIncidents: number;
	/** Count of unresolved high-severity incidents awaiting classification */
	unresolvedCriticalIncidents: number;
	/** p95 hours to classify incident severity + causality */
	incidentClassificationP95Hours: number;
	/** Evidence completeness ratio across pilot artifacts */
	evidenceCompletenessRatio: number;
	/** Per-repo sample sizes for minimum threshold check */
	repoSampleSizes: Record<string, number>;
}

/**
 * Pilot evaluation result with outcome decision
 */
export interface PilotEvaluationResult {
	/** Schema version for compatibility */
	schemaVersion: "pilot-evaluation/v1";
	/** When evaluation was generated */
	generatedAt: string;
	/** Metrics snapshot */
	metrics: PilotMetrics;
	/** Final promotion decision */
	outcome: PilotOutcome;
	/** Reasons for hold/rollback (empty if promote) */
	holdReasons: string[];
	/** Warnings that don't block promotion */
	warnings: string[];
}

/**
 * Options for pilot evaluation command
 */
export interface PilotEvaluateOptions {
	/** Path to contract file */
	contractPath?: string;
	/** Directory containing pilot artifacts */
	artifactsDir: string;
	/** Output file path for evaluation JSON */
	outputPath?: string;
	/** JSON output mode (suppresses human-readable output) */
	json?: boolean;
}

/**
 * Exit codes for pilot-evaluate CLI
 */
export const PILOT_EVALUATE_EXIT_CODES = {
	/** Evaluation successful with promote outcome */
	PROMOTE: 0,
	/** Evaluation successful with hold outcome */
	HOLD: 1,
	/** Validation or schema error */
	VALIDATION_ERROR: 2,
	/** Infrastructure/runtime failure */
	SYSTEM_ERROR: 10,
} as const;

/**
 * Pilot promotion gate thresholds (from plan)
 */
export const PILOT_THRESHOLDS = {
	/** Minimum PR lead time p50 improvement (negative, e.g., -0.35 = 35% reduction) */
	leadTimeP50Improvement: -0.35,
	/** Minimum PR lead time p75 improvement (tail guardrail) */
	leadTimeP75Improvement: -0.2,
	/** Maximum CI half-width for statistical confidence */
	leadTimeCiHalfWidth: 0.2,
	/** Required rollback reliability (1.0 = 100%) */
	rollbackReliability: 1.0,
	/** Maximum allowed high-risk automation incidents (hard gate) */
	highRiskAutomationIncidents: 0,
	/** Maximum unresolved critical incidents */
	unresolvedCriticalIncidents: 0,
	/** Maximum p95 classification latency in hours */
	incidentClassificationP95Hours: 24,
	/** Minimum evidence completeness ratio */
	evidenceCompletenessRatio: 0.95,
	/** Minimum per-repo sample size */
	minPerRepoSampleSize: 10,
	/** Minimum total sample size for promotion */
	minTotalSampleSize: 20,
} as const;

/**
 * Artifact schema versions supported by evaluator
 */
export const SUPPORTED_ARTIFACT_SCHEMAS = {
	PR_LEAD_TIME: "pr-lead-time/v1",
	REMEDIATION_EVENTS: "remediation-events/v1",
	ROLLBACK_EVENTS: "rollback-events/v1",
	INCIDENTS: "incidents/v1",
} as const;

/**
 * Artifact file names expected in artifacts directory
 */
export const ARTIFACT_FILES = {
	PR_LEAD_TIME: "pr-lead-time.json",
	REMEDIATION_EVENTS: "remediation-events.jsonl",
	ROLLBACK_EVENTS: "rollback-events.jsonl",
	INCIDENTS: "incidents.jsonl",
	PENDING_INCIDENTS: "pending-incidents.json",
} as const;

/**
 * PR lead time entry from artifact
 */
export interface PrLeadTimeEntry {
	schemaVersion: string;
	generatedAt: string;
	prNumber: number;
	repo: string;
	createdAt: string;
	mergedAt: string | null;
	draft: boolean;
	headSha: string;
	leadTimeHours: number | null;
	pilotEligible: boolean;
}

/**
 * Remediation event from artifact
 */
export interface RemediationEvent {
	schemaVersion: string;
	generatedAt: string;
	prNumber: number;
	repo: string;
	headSha: string;
	provider: string;
	severity: string;
	action: "applied" | "skipped" | "dry-run";
	reason?: string;
}

/**
 * Rollback event from artifact
 */
export interface RollbackEvent {
	schemaVersion: string;
	generatedAt: string;
	incidentId: string;
	triggerType: "drill" | "real";
	triggeredAt: string;
	completedAt: string | null;
	modeBefore: "autonomous" | "manual";
	modeAfter: "autonomous" | "manual" | null;
	result: "success" | "failed" | "pending";
	reason?: string;
}

/**
 * Incident record from artifact
 */
export interface IncidentRecord {
	schemaVersion: string;
	generatedAt: string;
	incidentId: string;
	severity: "low" | "medium" | "high";
	causality:
		| "automation_confirmed"
		| "automation_possible"
		| "human_or_external"
		| "unknown";
	confidence: "confirmed" | "probable" | "provisional";
	openedAt: string;
	classifiedAt: string | null;
	resolvedAt: string | null;
	slaDueAt: string;
	slaBreached: boolean;
}

/**
 * Pending incident from artifact
 */
export interface PendingIncident {
	incidentId: string;
	severity: "low" | "medium" | "high";
	openedAt: string;
	classificationDeadline: string;
}
