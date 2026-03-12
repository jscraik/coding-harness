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
	/** Number of rollback-triggering events in the evaluation window */
	rollbackTriggerCount: number;
	/** Intervention event rate over canonical terminal runs */
	interventionRate: number;
	/** Count of confirmed high-risk automation-caused incidents */
	highRiskAutomationIncidents: number;
	/** Count of unresolved high-severity incidents awaiting classification */
	unresolvedCriticalIncidents: number;
	/** p95 hours to classify incident severity + causality */
	incidentClassificationP95Hours: number;
	/** Evidence completeness ratio across pilot artifacts */
	evidenceCompletenessRatio: number;
	/** Thrash rate over canonical terminal runs */
	thrashRate: number;
	/** Count of canonical bundle loads rejected for sensitive-field leakage */
	sensitiveFieldLeakCount: number;
	/** Count of runId collisions discovered while loading canonical bundles */
	runIdCollisionCount: number;
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
	/** Canonical-first ingestion metadata with explicit legacy adapter lanes */
	ingestion: PilotEvaluationIngestion;
	/** Lane controls and rollout posture for this evaluation */
	controls: PilotEvaluationControls;
	/** Optional provider-neutral companion artifact summary */
	controlPlane?: ControlPlaneSummary;
}

export interface PilotIngestionSourceMetadata {
	/** Canonical-first source lane used by evaluator */
	source: "canonical" | "legacy_adapter";
	/** Versioned adapter path for legacy fallback (none when canonical used) */
	adapterVersion: "none" | "legacy-jsonl-v1";
	/** Canonical run IDs consulted for this dataset */
	runIds: string[];
	/** Resolved artifact paths used for loading */
	mappedArtifactPaths: string[];
	/** Drift warnings emitted by canonical/adapter mapping */
	driftWarnings: string[];
	/** Adapter registry owner for fallback path governance */
	owner?: string;
	/** Adapter registry introduction date */
	introducedAt?: string;
	/** Adapter sunset date/condition */
	sunsetBy?: string;
	/** Adapter hard-stop date, if any */
	blockAfter?: string | null;
}

export interface PilotEvaluationIngestion {
	remediationEvents: PilotIngestionSourceMetadata;
	rollbackEvents: PilotIngestionSourceMetadata;
}

export interface PilotParityWindowStatus {
	/** Path to the persisted parity history artifact */
	historyPath: string;
	/** Whether the current evaluation window satisfies parity criteria */
	currentWindowPassing: boolean;
	/** Number of consecutive passing windows recorded, including the current window */
	consecutivePassingWindows: number;
	/** Required consecutive window count before retirement is allowed */
	requiredConsecutivePassingWindows: number;
	/** Critical drift count recorded for the current window */
	criticalDriftCount: number;
	/** Maximum allowed critical drift count for a passing window */
	allowedCriticalDrifts: number;
	/** Canonical coverage required by the parity policy */
	requiredCanonicalCoverage: number;
}

export interface PilotEvaluationControls {
	/** Rollout lane used for this evaluation */
	lane: "advisory" | "health";
	/** True when kill-switch/manual containment is engaged */
	killSwitchEngaged: boolean;
	/** True when operator intervention is required before promotion */
	manualSafeMode: boolean;
	/** Canonical coverage ratio across adapter-backed ingestion surfaces */
	canonicalCoverageRatio: number;
	/** Whether legacy retirement readiness thresholds pass in this window */
	legacyRetirementReady: boolean;
	/** Parity-window evidence used to evaluate legacy retirement readiness */
	parityWindow?: PilotParityWindowStatus;
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
	/** Optional override for canonical run-record discovery root */
	runRecordsDir?: string;
	/** Lane used for rollout checks */
	lane?: "advisory" | "health";
	/** Force manual safe mode regardless of metric outcome */
	killSwitch?: boolean;
	/** Optional override for adapter registry path */
	adapterRegistryPath?: string;
	/** Optional override for metric registry path */
	metricRegistryPath?: string;
	/** Optional override for persisted parity-window history */
	parityHistoryPath?: string;
	/** Trusted docs-gate machine report used for instruction parity */
	docsGateReportPath?: string;
	/** Evaluation context for control-plane decisions */
	evaluationMode?: EvaluationMode;
	/** Rollout stage that maps evaluation to enforcement */
	rolloutStage?: RolloutStage;
	/** Trusted PR-template validation status */
	prTemplateStatus?: "passed" | "failed" | "missing";
	/** Trusted PR-template validation artifact/reference */
	prTemplateRef?: string;
	/** Explicit actor identity for the evaluation */
	actorId?: string;
	/** Provider/client family under evaluation */
	clientFamily?: ClientFamily;
	/** Provider identifier backing the run */
	providerId?: string;
	/** Provider/model descriptor backing the run */
	modelDescriptor?: string;
	/** Execution mode for the evaluated run */
	executionMode?: "interactive" | "automation" | "ci";
	/** Operator mode that initiated the run */
	operatorType?: "human_directed" | "automation" | "autonomous";
	/** Optional control-plane override principal */
	overrideAuthorizedPrincipal?: string;
	/** Optional control-plane override scope */
	overrideScope?: ControlPlaneOverrideScope;
	/** Optional control-plane override reason */
	overrideReason?: string;
	/** Optional ticket reference that justifies the override */
	overrideTicketRef?: string;
	/** Optional explicit override approver list */
	overrideApprovedBy?: string[];
	/** Optional explicit override creation timestamp */
	overrideCreatedAt?: string;
	/** Optional explicit override expiry timestamp */
	overrideExpiresAt?: string;
}

/**
 * Exit codes for pilot-evaluate CLI
 */
export const PILOT_EVALUATE_EXIT_CODES = {
	/** Evaluation successful with promote outcome */
	PROMOTE: 0,
	/** Evaluation successful with hold outcome */
	HOLD: 1,
	/** Evaluation successful with rollback outcome */
	ROLLBACK: 3,
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

export type ClientFamily =
	| "codex"
	| "claude_family"
	| "gemini_family"
	| "kimi_family"
	| "custom";

export type EvaluationMode = "local" | "pr" | "merge_group";

export type RolloutStage = "shadow" | "advisory" | "enforced";

export type ControlPlaneOverrideScope =
	| "advisory_hold"
	| "temporary_unblock"
	| "temporary_promote";

export type ControlPlaneBlockerCode =
	| "governance_trust_mismatch"
	| "canonical_runtime_invalid"
	| "pr_template_invalid"
	| "missing_snapshot_integrity_verification"
	| "missing_required_instruction_surface"
	| "instruction_parity_failed"
	| "adapter_unresolved"
	| "adapter_coverage_incomplete"
	| "scorecard_denominator_insufficient"
	| "telemetry_unavailable"
	| "identity_degraded"
	| "rollback_threshold_breached"
	| "legacy_hold_required";

export type ControlPlaneDecision =
	| "promote"
	| "hold"
	| "rollback"
	| "block_for_parity"
	| "block_for_evidence"
	| "block_for_adapter";

export type ControlPlaneEnforcementDecision =
	| "allow"
	| "block"
	| "non_blocking"
	| "require_human_review";

export interface ArtifactFileRef {
	path: string;
	exists: boolean;
	required: boolean;
	sha256?: string;
	sizeBytes?: number;
}

export interface ControlPlaneArtifactMetadata {
	compatibilityMajor: number;
	producerVersion: string;
}

export interface ProviderAdapterDescriptor {
	adapterVersion: string;
	owner: string;
	introducedAt: string;
	sunsetBy: string;
	blockAfter: string | null;
	parityWindow?: {
		minimumCanonicalCoverage: number;
		minimumConsecutivePassingWindows: number;
		maxCriticalDrifts: number;
	};
	clientFamily?: ClientFamily;
	providerId?: string;
	status?: "active" | "shadow" | "deprecated";
}

export interface AgentIdentity {
	actorId: string;
	clientFamily: ClientFamily;
	providerId: string;
	modelDescriptor: string;
	executionMode: "interactive" | "automation" | "ci";
	operatorType: "human_directed" | "automation" | "autonomous";
	identityStatus: "verified" | "identity_degraded";
	degradedReasons: string[];
}

export interface RequiredCheckSurfaceAlignment {
	surfaceId: string;
	sourceRef: ArtifactFileRef;
	checks: string[];
	missingFromSurface: string[];
	extraInSurface: string[];
	status: "pass" | "fail";
}

export interface RequiredCheckAlignment {
	policyChecks: string[];
	policyRef: ArtifactFileRef;
	contractChecks: string[];
	workflowChecks: string[];
	initChecks: string[];
	governedDocChecks: string[];
	missingFromContract: string[];
	extraInContract: string[];
	missingFromWorkflow: string[];
	missingFromInit: string[];
	missingFromGovernedDocs: string[];
	surfaceAlignments: RequiredCheckSurfaceAlignment[];
	status: "pass" | "fail";
}

export interface GovernanceSnapshot extends ControlPlaneArtifactMetadata {
	schemaVersion: "governance-snapshot/v1";
	snapshotId: string;
	capturedAt: string;
	contractRef: ArtifactFileRef;
	workflowRefs: ArtifactFileRef[];
	requiredChecks: RequiredCheckAlignment;
	branchPolicyRef: {
		branch: string | null;
		headSha: string | null;
	};
	instructionPolicyRefs: ArtifactFileRef[];
	prTemplateRef: ArtifactFileRef;
	prTemplateValidationStatus: "passed" | "failed" | "missing";
	prTemplateValidationRef: string | null;
	sourceTrustLevel: "trusted" | "degraded";
	warnings: string[];
}

export interface InstructionSurfaceSummary {
	surfaceId: string;
	path: string;
	kind: "canonical" | "mirror" | "provider_specific";
	clientFamily: ClientFamily;
	requiredMode: "required" | "optional";
	sourceOfTruth: string;
}

export interface InstructionParityResult extends ControlPlaneArtifactMetadata {
	schemaVersion: "instruction-parity/v1";
	parityResultId: string;
	governanceSnapshotRef: string;
	evaluatedSurfaces: InstructionSurfaceSummary[];
	status: "pass" | "fail" | "not_applicable" | "error";
	contradictions: string[];
	missingRequiredSurfaces: string[];
	staleSurfaceRefs: string[];
	normalizationWarnings: string[];
	sourceReportRef: ArtifactFileRef | null;
}

export interface ControlPlaneScorecard extends ControlPlaneArtifactMetadata {
	schemaVersion: "control-plane-scorecard/v1";
	evaluationAttemptId: string;
	runId: string;
	recordedAt: string;
	headSha: string | null;
	evaluationDecision: ControlPlaneDecision;
	enforcementDecision: ControlPlaneEnforcementDecision;
	identityStatus: AgentIdentity["identityStatus"];
	instructionParityStatus: InstructionParityResult["status"];
	governanceTrustLevel: GovernanceSnapshot["sourceTrustLevel"];
	falseBlockRate: number | null;
	blockerCodes: ControlPlaneBlockerCode[];
	decisionReasons: string[];
	warnings: string[];
}

export interface ControlPlaneRun extends ControlPlaneArtifactMetadata {
	schemaVersion: "control-plane-run/v1";
	evaluationAttemptId: string;
	runId: string;
	recordedAt: string;
	artifactRoot: string;
	repoRoot: string;
	branch: string | null;
	headSha: string | null;
	evaluationMode: EvaluationMode;
	rolloutStage: RolloutStage;
	metricsWindow: {
		windowStart: string;
		windowEnd: string;
	};
	agentIdentity: AgentIdentity;
	governanceSnapshotRef: string;
	instructionParityRef: string;
}

export interface ControlPlaneAuditLogEntry
	extends ControlPlaneArtifactMetadata {
	schemaVersion: "control-plane-audit-log-entry/v1";
	evaluationAttemptId: string;
	runId: string;
	checkpointId: string;
	phase: string;
	command: string;
	status: "completed" | "blocked" | "failed";
	artifactRefs: string[];
	sourceProvenance: string[];
	blocker?: string;
	followUp?: string;
	recordedAt: string;
	auditStatus: "recorded" | "adjudicated";
	adjudication: "none" | "confirmed" | "false_block" | "operator_override";
}

export interface ControlPlanePhaseReport extends ControlPlaneArtifactMetadata {
	schemaVersion: "control-plane-phase-report/v1";
	evaluationAttemptId: string;
	runId: string;
	checkpointId: string;
	phase: string;
	command: string;
	status: "completed" | "blocked" | "failed";
	artifactRefs: string[];
	sourceProvenance: string[];
	blocker?: string;
	followUp?: string;
	recordedAt: string;
}

export interface OverridePolicyRecord extends ControlPlaneArtifactMetadata {
	schemaVersion: "override-policy-record/v1";
	evaluationAttemptId: string;
	runId: string;
	overrideId: string;
	authorizedPrincipal: string;
	scope: ControlPlaneOverrideScope;
	reason: string;
	ticketRef: string;
	approvedBy: string[];
	createdAt: string;
	expiresAt: string;
	nonOverridableControls: string[];
	requestedBlockerCodes: ControlPlaneBlockerCode[];
	status: "applied" | "rejected" | "expired";
	rejectionReason?: string;
	resultingEvaluationDecision: ControlPlaneDecision;
	resultingEnforcementDecision: ControlPlaneEnforcementDecision;
}

// ==========================================
// Phase 6: Rollout Window Tracking
// ==========================================

export interface RolloutWindowStageThresholds {
	/** Minimum sample size for the window */
	minimumSampleSize: number;
	/** Minimum canonical coverage ratio */
	minimumCanonicalCoverage: number;
	/** Minimum identity completeness ratio */
	minimumIdentityCompleteness: number;
	/** Minimum adapter coverage ratio */
	minimumAdapterCoverage: number;
	/** Minimum governance parity pass rate */
	minimumGovernanceParityPassRate: number;
	/** Maximum critical drift count allowed */
	maximumCriticalDrifts: number;
	/** Maximum false block rate */
	maximumFalseBlockRate: number;
	/** Required consecutive passing windows for promotion */
	requiredConsecutivePassingWindows: number;
	/** Required maintainer approval for stage transition */
	requiresMaintainerApproval: boolean;
}

export interface RolloutWindowMetrics {
	/** Window start timestamp */
	windowStart: string;
	/** Window end timestamp */
	windowEnd: string;
	/** Current rollout stage */
	stage: RolloutStage;
	/** Number of eligible runs in window */
	eligibleRuns: number;
	/** Number of passing runs */
	passingRuns: number;
	/** Number of blocked runs */
	blockedRuns: number;
	/** Number of false blocks (adjudicated) */
	falseBlocks: number;
	/** Canonical coverage ratio */
	canonicalCoverage: number;
	/** Identity completeness ratio */
	identityCompleteness: number;
	/** Adapter coverage ratio */
	adapterCoverage: number;
	/** Instruction parity pass rate */
	instructionParityPassRate: number;
	/** Governance parity pass rate */
	governanceParityPassRate: number;
	/** Evidence completeness ratio */
	evidenceCompleteness: number;
	/** Critical drift count */
	criticalDriftCount: number;
	/** Override rate */
	overrideRate: number;
	/** Telemetry coverage gap rate */
	telemetryCoverageGapRate: number;
}

export interface RolloutWindow extends ControlPlaneArtifactMetadata {
	schemaVersion: "rollout-window/v1";
	/** Unique window identifier */
	windowId: string;
	/** Current rollout stage */
	stage: RolloutStage;
	/** Window time bounds */
	windowStart: string;
	windowEnd: string;
	/** Metrics snapshot for this window */
	metrics: RolloutWindowMetrics;
	/** Whether window passes stage exit criteria */
	passesStageExitCriteria: boolean;
	/** Stage-specific thresholds used */
	thresholds: RolloutWindowStageThresholds;
	/** Number of consecutive passing windows including this one */
	consecutivePassingWindows: number;
	/** Whether ready for stage transition */
	readyForTransition: boolean;
	/** Any blockers preventing stage transition */
	transitionBlockers: string[];
	/** Warnings for operator attention */
	warnings: string[];
	/** When window was recorded */
	recordedAt: string;
}

export interface RolloutWindowHistory extends ControlPlaneArtifactMetadata {
	schemaVersion: "rollout-window-history/v1";
	/** Current rollout stage */
	currentStage: RolloutStage;
	/** All recorded windows */
	windows: RolloutWindow[];
	/** Current consecutive passing windows */
	consecutivePassingWindows: number;
	/** Whether currently eligible for promotion to next stage */
	eligibleForPromotion: boolean;
	/** Last promotion packet ID if any */
	lastPromotionPacketId: string | null;
	/** Any active demotion triggers */
	activeDemotionTriggers: string[];
	/** When history was last updated */
	updatedAt: string;
}

// ==========================================
// Promotion Packets
// ==========================================

export interface PromotionPacket extends ControlPlaneArtifactMetadata {
	schemaVersion: "promotion-packet/v1";
	/** Unique packet identifier */
	packetId: string;
	/** Source stage being promoted from */
	fromStage: RolloutStage;
	/** Target stage being promoted to */
	toStage: RolloutStage;
	/** Evaluation window for this promotion */
	windowStart: string;
	windowEnd: string;
	/** Metrics snapshot */
	metrics: RolloutWindowMetrics;
	/** Threshold results */
	thresholdResults: {
		threshold: string;
		required: number | boolean;
		actual: number | boolean;
		passed: boolean;
	}[];
	/** Unresolved drift count */
	unresolvedDriftCount: number;
	/** False block rate calculation */
	falseBlockRate: {
		falseBlocks: number;
		totalBlocks: number;
		rate: number;
	};
	/** Maintainer sign-offs */
	signOffs: {
		approver: string;
		signedAt: string;
		role: string;
	}[];
	/** Rollback proof - verification that rollback works */
	rollbackProof: {
		verifiedAt: string;
		demotionTestPassed: boolean;
		testDemotionId: string;
	};
	/** When packet was created */
	createdAt: string;
	/** Packet status */
	status: "pending" | "approved" | "rejected" | "superseded";
	/** Rejection reason if rejected */
	rejectionReason?: string;
}

// ==========================================
// Demotion Triggers
// ==========================================

export type DemotionTriggerReason =
	| "critical_drift_detected"
	| "false_block_rate_exceeded"
	| "threshold_breach_repeated"
	| "join_integrity_failure"
	| "missing_trusted_evidence"
	| "identity_degradation_spike"
	| "adapter_coverage_drop"
	| "manual_operator_trigger"
	| "system_health_critical";

export interface DemotionTrigger extends ControlPlaneArtifactMetadata {
	schemaVersion: "demotion-trigger/v1";
	/** Unique trigger identifier */
	triggerId: string;
	/** Reason for demotion */
	reason: DemotionTriggerReason;
	/** Stage being demoted from */
	fromStage: RolloutStage;
	/** Stage being demoted to */
	toStage: RolloutStage;
	/** Evidence supporting demotion */
	evidence: {
		description: string;
		artifactRefs: string[];
		metricSnapshots?: Record<string, number>;
	};
	/** Whether demotion was automatic or manual */
	automatic: boolean;
	/** Operator who triggered if manual */
	triggeredBy?: string;
	/** When trigger was created */
	createdAt: string;
	/** Trigger status */
	status: "pending" | "executed" | "dismissed";
	/** When demotion was executed */
	executedAt?: string;
	/** Follow-up actions required */
	followUpActions: string[];
}

// ==========================================
// Monitoring Metrics Persistence
// ==========================================

export interface MonitoringMetricsSnapshot
	extends ControlPlaneArtifactMetadata {
	schemaVersion: "monitoring-metrics/v1";
	/** Snapshot timestamp */
	snapshotAt: string;
	/** Current rollout stage */
	rolloutStage: RolloutStage;
	/** Parity drift metrics */
	parityDrift: {
		/** Number of unresolved drift items */
		unresolvedCount: number;
		/** Surfaces with drift */
		surfaces: {
			surfaceId: string;
			driftType: string;
			detectedAt: string;
		}[];
	};
	/** Adapter coverage metrics */
	adapterCoverage: {
		/** Coverage for active adapters */
		active: number;
		/** Coverage for shadow adapters */
		shadow: number;
		/** Gaps detected */
		gaps: {
			adapterId: string;
			missingCapability: string;
		}[];
	};
	/** Identity degradation metrics */
	identityDegradation: {
		/** Rate of degraded identities */
		degradationRate: number;
		/** Common degradation reasons */
		topReasons: {
			reason: string;
			count: number;
		}[];
	};
	/** Override usage metrics */
	overrideUsage: {
		/** Total overrides applied */
		totalApplied: number;
		/** Override rate */
		rate: number;
		/** Scopes used */
		scopes: {
			scope: ControlPlaneOverrideScope;
			count: number;
		}[];
	};
	/** False block adjudication metrics */
	falseBlockAdjudication: {
		/** Total false blocks adjudicated */
		totalAdjudicated: number;
		/** False block rate */
		rate: number;
		/** Pending adjudications */
		pending: number;
	};
	/** PR-template validation metrics */
	prTemplateValidation: {
		/** Pass rate */
		passRate: number;
		/** Missing validation rate */
		missingRate: number;
		/** Failed validation rate */
		failedRate: number;
	};
}

export interface ControlPlaneArtifactSet {
	controlPlaneRun: ControlPlaneRun;
	governanceSnapshot: GovernanceSnapshot;
	instructionParity: InstructionParityResult;
	scorecard: ControlPlaneScorecard;
	auditLog: ControlPlaneAuditLogEntry[];
	phaseReports: ControlPlanePhaseReport[];
	overridePolicyRecord?: OverridePolicyRecord | null;
	rolloutWindow?: RolloutWindow | null;
	rolloutWindowHistory?: RolloutWindowHistory | null;
	latestPromotionPacket?: PromotionPacket | null;
	latestDemotionTrigger?: DemotionTrigger | null;
	monitoringMetricsSnapshot?: MonitoringMetricsSnapshot | null;
}

export interface ControlPlaneSummary {
	artifactRoot: string;
	evaluationAttemptId: string;
	runId: string;
	evaluationDecision: ControlPlaneDecision;
	enforcementDecision: ControlPlaneEnforcementDecision;
	identityStatus: AgentIdentity["identityStatus"];
	instructionParityStatus: InstructionParityResult["status"];
	governanceTrustLevel: GovernanceSnapshot["sourceTrustLevel"];
	warnings: string[];
}
