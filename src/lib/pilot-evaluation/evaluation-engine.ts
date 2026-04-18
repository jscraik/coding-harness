/**
 * Evaluation Engine — NIST AI RMF-aligned Measure/Manage control loop
 *
 * Formalizes `pilot-evaluate` as a measurable AI-governance decision engine
 * with explicit phases, NIST AI RMF alignment, and traceable outputs.
 *
 * ## Phases
 *
 * | Phase     | NIST Function | Purpose                                      |
 * |-----------|---------------|----------------------------------------------|
 * | INGEST    | Measure 2.x   | Collect metrics and governance evidence       |
 * | MEASURE   | Measure 2.x   | Compare metrics against defined thresholds    |
 * | EVALUATE  | Manage 1.x    | Apply lane-specific and rollout-stage policies|
 * | DECIDE    | Manage 2.x    | Determine promote / hold / rollback / block  |
 * | REPORT    | Manage 4.x    | Emit artifacts with full traceability         |
 *
 * ## Standards alignment
 *
 * - **NIST AI RMF 1.0** — Measure (MG) and Manage (MV) functions
 * - **CISA Secure by Design** — Evidence-based operational safety decisions
 * - **NIST SP 800-218A** — Secure Software Development Framework controls
 */

import type { PilotMetrics } from "./types.js";
import { PILOT_THRESHOLDS } from "./types.js";

// ---------------------------------------------------------------------------
// Phase identifiers and NIST alignment map
// ---------------------------------------------------------------------------

/** Named phases of the evaluation pipeline */
export type EvaluationPhase =
	| "ingest"
	| "measure"
	| "evaluate"
	| "decide"
	| "report";

/** NIST AI RMF alignment metadata for each evaluation phase */
export interface PhaseNistAlignment {
	/** NIST AI RMF function: Measure or Manage */
	nistFunction: "Measure" | "Manage";
	/** Relevant AI RMF subcategory identifiers */
	subcategories: readonly string[];
	/** Human-readable description of this phase's RMF purpose */
	description: string;
}

/**
 * Static mapping from evaluation phases to NIST AI RMF subcategories.
 *
 * **Measure (MG)** covers data collection (MG-2.1, MG-2.3, MG-2.6) and
 * criteria-based evaluation (MG-2.9, MG-2.10, MG-2.11).
 *
 * **Manage (MV)** covers risk-based policy application (MV-1.1, MV-1.2),
 * decision from evidence (MV-2.1, MV-2.3, MV-2.4), and documentation /
 * communication (MV-4.1, MV-4.2).
 */
export const NIST_PHASE_ALIGNMENT: Record<EvaluationPhase, PhaseNistAlignment> =
	{
		ingest: {
			nistFunction: "Measure",
			subcategories: ["MG-2.1", "MG-2.3", "MG-2.6"],
			description:
				"Collect appropriate data and metrics from artifacts and governance sources",
		},
		measure: {
			nistFunction: "Measure",
			subcategories: ["MG-2.9", "MG-2.10", "MG-2.11"],
			description:
				"Compare collected metrics against defined criteria and thresholds",
		},
		evaluate: {
			nistFunction: "Manage",
			subcategories: ["MV-1.1", "MV-1.2", "MV-1.3"],
			description:
				"Apply lane-specific and rollout-stage policies to measured evidence",
		},
		decide: {
			nistFunction: "Manage",
			subcategories: ["MV-2.1", "MV-2.3", "MV-2.4"],
			description:
				"Determine promotion, hold, rollback, or block decision from evaluated evidence",
		},
		report: {
			nistFunction: "Manage",
			subcategories: ["MV-4.1", "MV-4.2"],
			description:
				"Document results with full traceability for audit and operator review",
		},
	} as const;

// ---------------------------------------------------------------------------
// Threshold audit
// ---------------------------------------------------------------------------

/** Severity classification for a threshold check */
export type ThresholdSeverity = "gate" | "guardrail" | "advisory";

/** Comparison operator used for a threshold check */
export type ThresholdOperator = "min" | "max" | "exact";

/** A single machine-auditable threshold comparison result */
export interface ThresholdAuditEntry {
	/** Human-readable metric name */
	metricName: string;
	/** Metric field key (matches PilotMetrics key) */
	metricKey: string;
	/** The threshold value from PILOT_THRESHOLDS */
	thresholdValue: number;
	/** The actual metric value measured */
	actualValue: number;
	/** How the comparison is performed */
	operator: ThresholdOperator;
	/** Whether the threshold passed */
	passed: boolean;
	/** Classification: gate=hard blocker, guardrail=soft blocker, advisory=informational */
	severity: ThresholdSeverity;
	/** NIST AI RMF subcategory this threshold maps to */
	nistRef: string;
}

/**
 * Machine-auditable threshold audit report.
 *
 * Every PILOT_THRESHOLD is compared against the supplied metrics, producing
 * a pass/fail result with severity classification. This report can be
 * consumed by CI gates, policy engines, and audit tooling.
 */
export interface ThresholdAuditReport {
	schemaVersion: "threshold-audit-report/v1";
	generatedAt: string;
	phase: EvaluationPhase;
	entries: ThresholdAuditEntry[];
	allGatesPassed: boolean;
	allGuardrailsPassed: boolean;
	gatePassCount: number;
	gateFailCount: number;
	guardrailPassCount: number;
	guardrailFailCount: number;
	advisoryCount: number;
}

/**
 * Threshold definition used internally to drive the audit.
 */
interface ThresholdDefinition {
	metricKey: keyof PilotMetrics;
	thresholdKey: keyof typeof PILOT_THRESHOLDS;
	operator: ThresholdOperator;
	severity: ThresholdSeverity;
	label: string;
	nistRef: string;
}

/**
 * All threshold comparisons that the MEASURE phase performs.
 *
 * Each entry maps a PilotMetrics field to its PILOT_THRESHOLDS counterpart
 * with comparison semantics and severity classification.
 */
const THRESHOLD_DEFINITIONS: ThresholdDefinition[] = [
	{
		metricKey: "sampleSize",
		thresholdKey: "minTotalSampleSize",
		operator: "min",
		severity: "gate",
		label: "Total sample size",
		nistRef: "MG-2.9",
	},
	{
		metricKey: "leadTimeP50Improvement",
		thresholdKey: "leadTimeP50Improvement",
		operator: "max",
		severity: "gate",
		label: "Lead time p50 improvement",
		nistRef: "MG-2.10",
	},
	{
		metricKey: "leadTimeP75Improvement",
		thresholdKey: "leadTimeP75Improvement",
		operator: "max",
		severity: "gate",
		label: "Lead time p75 improvement",
		nistRef: "MG-2.10",
	},
	{
		metricKey: "leadTimeP50CiHalfWidth",
		thresholdKey: "leadTimeCiHalfWidth",
		operator: "max",
		severity: "guardrail",
		label: "P50 confidence interval half-width",
		nistRef: "MG-2.11",
	},
	{
		metricKey: "leadTimeP75CiHalfWidth",
		thresholdKey: "leadTimeCiHalfWidth",
		operator: "max",
		severity: "guardrail",
		label: "P75 confidence interval half-width",
		nistRef: "MG-2.11",
	},
	{
		metricKey: "rollbackReliability",
		thresholdKey: "rollbackReliability",
		operator: "min",
		severity: "gate",
		label: "Rollback reliability",
		nistRef: "MG-2.9",
	},
	{
		metricKey: "highRiskAutomationIncidents",
		thresholdKey: "highRiskAutomationIncidents",
		operator: "max",
		severity: "gate",
		label: "High-risk automation incidents",
		nistRef: "MG-2.9",
	},
	{
		metricKey: "unresolvedCriticalIncidents",
		thresholdKey: "unresolvedCriticalIncidents",
		operator: "max",
		severity: "gate",
		label: "Unresolved critical incidents",
		nistRef: "MG-2.9",
	},
	{
		metricKey: "incidentClassificationP95Hours",
		thresholdKey: "incidentClassificationP95Hours",
		operator: "max",
		severity: "guardrail",
		label: "Incident classification p95 latency",
		nistRef: "MG-2.11",
	},
	{
		metricKey: "evidenceCompletenessRatio",
		thresholdKey: "evidenceCompletenessRatio",
		operator: "min",
		severity: "gate",
		label: "Evidence completeness ratio",
		nistRef: "MG-2.9",
	},
];

/**
 * Compare a numeric value against a threshold using the given operator.
 *
 * @param actual - The measured numeric value to evaluate
 * @param threshold - The threshold value to compare against
 * @param operator - Comparison semantics: `"min"` requires `actual >= threshold`, `"max"` requires `actual <= threshold`, `"exact"` requires `actual === threshold`
 * @returns `true` if the comparison passes according to `operator`, `false` otherwise
 */
function compareThreshold(
	actual: number,
	threshold: number,
	operator: ThresholdOperator,
): boolean {
	switch (operator) {
		case "min":
			return actual >= threshold;
		case "max":
			return actual <= threshold;
		case "exact":
			return actual === threshold;
	}
}

function asFiniteNumber(value: unknown, label: string): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new Error(`${label} is not a finite number: ${String(value)}`);
	}
	return value;
}

function operatorFailureSymbol(operator: ThresholdOperator): string {
	switch (operator) {
		case "min":
			return "<";
		case "max":
			return ">";
		case "exact":
			return "!=";
	}
}

/**
 * Evaluate all PILOT_THRESHOLDS against the supplied metrics.
 *
 * Produces a machine-auditable `ThresholdAuditReport` where each configured
 * threshold check becomes a structured entry describing pass/fail, severity,
 * operator, and NIST reference.
 *
 * @param metrics - The captured pilot metrics to evaluate
 * @returns A `ThresholdAuditReport` containing per-threshold `entries` with pass/fail results, and aggregate booleans and counts for gate and guardrail outcomes
 */
export function evaluateThresholds(
	metrics: PilotMetrics,
	options?: { generatedAt?: string },
): ThresholdAuditReport {
	const now = options?.generatedAt ?? new Date().toISOString();
	const metricEntries: ThresholdAuditEntry[] = THRESHOLD_DEFINITIONS.map(
		(def) => {
			const actualValue = asFiniteNumber(
				metrics[def.metricKey],
				`Metric ${String(def.metricKey)}`,
			);
			const thresholdValue = asFiniteNumber(
				PILOT_THRESHOLDS[def.thresholdKey],
				`Threshold ${String(def.thresholdKey)}`,
			);
			const passed = compareThreshold(
				actualValue,
				thresholdValue,
				def.operator,
			);

			return {
				metricName: def.label,
				metricKey: def.metricKey,
				thresholdValue,
				actualValue,
				operator: def.operator,
				passed,
				severity: def.severity,
				nistRef: def.nistRef,
			};
		},
	);
	const minPerRepoSampleSize = PILOT_THRESHOLDS.minPerRepoSampleSize;
	const perRepoEntries: ThresholdAuditEntry[] = Object.entries(
		metrics.repoSampleSizes,
	).map(([repoName, sampleSize]) => {
		const actualValue = asFiniteNumber(
			sampleSize,
			`Per-repo sample size for ${repoName}`,
		);
		const passed = compareThreshold(actualValue, minPerRepoSampleSize, "min");
		return {
			metricName: `Per-repo sample size (${repoName})`,
			metricKey: `repoSampleSizes.${repoName}`,
			thresholdValue: minPerRepoSampleSize,
			actualValue,
			operator: "min",
			passed,
			severity: "gate",
			nistRef: "MG-2.9",
		};
	});
	const entries: ThresholdAuditEntry[] = [...metricEntries, ...perRepoEntries];

	const gateEntries = entries.filter((e) => e.severity === "gate");
	const guardrailEntries = entries.filter((e) => e.severity === "guardrail");
	const advisoryEntries = entries.filter((e) => e.severity === "advisory");

	return {
		schemaVersion: "threshold-audit-report/v1",
		generatedAt: now,
		phase: "measure",
		entries,
		allGatesPassed: gateEntries.every((e) => e.passed),
		allGuardrailsPassed: guardrailEntries.every((e) => e.passed),
		gatePassCount: gateEntries.filter((e) => e.passed).length,
		gateFailCount: gateEntries.filter((e) => !e.passed).length,
		guardrailPassCount: guardrailEntries.filter((e) => e.passed).length,
		guardrailFailCount: guardrailEntries.filter((e) => !e.passed).length,
		advisoryCount: advisoryEntries.length,
	};
}

// ---------------------------------------------------------------------------
// Evaluation phase trace
// ---------------------------------------------------------------------------

/** A finding produced during an evaluation phase */
export interface EvaluationFinding {
	/** Machine-readable finding code */
	code: string;
	/** Finding severity */
	severity: "info" | "warning" | "error";
	/** Human-readable finding description */
	message: string;
	/** Optional threshold detail for measure-phase findings */
	threshold?: {
		required: number;
		actual: number;
		passed: boolean;
	};
	/** NIST AI RMF subcategory reference */
	nistRef?: string;
}

/** A trace record for a single evaluation phase */
export interface EvaluationPhaseTrace {
	/** Which phase this trace covers */
	phase: EvaluationPhase;
	/** NIST AI RMF alignment metadata */
	nistAlignment: PhaseNistAlignment;
	/** When the phase started (ISO 8601) */
	startedAt: string;
	/** When the phase completed (ISO 8601) */
	completedAt: string;
	/** Phase completion status */
	status: "completed" | "blocked" | "skipped";
	/** Findings produced during this phase */
	findings: EvaluationFinding[];
}

/**
 * Generate an evaluation phase trace from the available evidence.
 *
 * Takes the outputs of each pipeline phase and produces structured trace
 * records that make the evaluation path traceable end-to-end.
 *
 * @param input - Phase inputs gathered from the evaluation pipeline
 * @returns Ordered array of phase trace records
 */
export function generateEvaluationTrace(
	input: {
		/** Whether metrics capture succeeded */
		metricsCaptured: boolean;
		/** Captured metrics (null if capture failed) */
		metrics: PilotMetrics | null;
		/** Metrics capture errors */
		metricsErrors: string[];
		/** Threshold audit report (null if not yet computed) */
		thresholdReport: ThresholdAuditReport | null;
		/** Governance trust level */
		governanceTrustLevel: "trusted" | "degraded";
		/** Governance warnings */
		governanceWarnings: string[];
		/** Instruction parity status */
		instructionParityStatus: "pass" | "fail" | "not_applicable" | "error";
		/** Final evaluation decision */
		evaluationDecision: string;
		/** Decision reasons */
		decisionReasons: string[];
		/** Decision blocker codes */
		blockerCodes: string[];
		/** Whether artifacts were written */
		artifactsWritten: boolean;
	},
	options?: { timestamp?: string },
): EvaluationPhaseTrace[] {
	const now = options?.timestamp ?? new Date().toISOString();
	const traces: EvaluationPhaseTrace[] = [];

	// Phase 1: INGEST
	const ingestFindings: EvaluationFinding[] = [];
	if (!input.metricsCaptured) {
		ingestFindings.push({
			code: "INGEST_METRICS_FAILED",
			severity: "error",
			message: "Metrics capture failed — cannot proceed to MEASURE phase",
			nistRef: "MG-2.1",
		});
	}
	for (const error of input.metricsErrors) {
		ingestFindings.push({
			code: "INGEST_ERROR",
			severity: "warning",
			message: error,
			nistRef: "MG-2.3",
		});
	}
	traces.push({
		phase: "ingest",
		nistAlignment: NIST_PHASE_ALIGNMENT.ingest,
		startedAt: now,
		completedAt: now,
		status: input.metricsCaptured ? "completed" : "blocked",
		findings: ingestFindings,
	});

	// Phase 2: MEASURE
	if (input.metricsCaptured && input.thresholdReport) {
		const measureFindings: EvaluationFinding[] = [];
		for (const entry of input.thresholdReport.entries) {
			if (!entry.passed) {
				measureFindings.push({
					code: `THRESHOLD_${entry.metricKey.toUpperCase()}`,
					severity: entry.severity === "gate" ? "error" : "warning",
					message: `${entry.metricName}: ${entry.actualValue} ${operatorFailureSymbol(entry.operator)} ${entry.thresholdValue}`,
					threshold: {
						required: entry.thresholdValue,
						actual: entry.actualValue,
						passed: entry.passed,
					},
					nistRef: entry.nistRef,
				});
			}
		}
		traces.push({
			phase: "measure",
			nistAlignment: NIST_PHASE_ALIGNMENT.measure,
			startedAt: now,
			completedAt: now,
			status:
				input.thresholdReport.allGatesPassed &&
				input.thresholdReport.allGuardrailsPassed
					? "completed"
					: "blocked",
			findings: measureFindings,
		});
	} else if (!input.metricsCaptured) {
		traces.push({
			phase: "measure",
			nistAlignment: NIST_PHASE_ALIGNMENT.measure,
			startedAt: now,
			completedAt: now,
			status: "skipped",
			findings: [
				{
					code: "MEASURE_SKIPPED",
					severity: "warning",
					message: "Skipped because INGEST phase was blocked",
					nistRef: "MG-2.9",
				},
			],
		});
	} else {
		traces.push({
			phase: "measure",
			nistAlignment: NIST_PHASE_ALIGNMENT.measure,
			startedAt: now,
			completedAt: now,
			status: "blocked",
			findings: [
				{
					code: "MEASURE_NO_THRESHOLD",
					severity: "error",
					message: "Threshold audit report was not computed",
					nistRef: "MG-2.9",
				},
			],
		});
	}

	// Phase 3: EVALUATE
	const evaluateFindings: EvaluationFinding[] = [];
	if (input.governanceTrustLevel !== "trusted") {
		evaluateFindings.push({
			code: "GOVERNANCE_DEGRADED",
			severity: "error",
			message: `Governance trust level is ${input.governanceTrustLevel}`,
			nistRef: "MV-1.1",
		});
	}
	for (const warning of input.governanceWarnings) {
		evaluateFindings.push({
			code: "GOVERNANCE_WARNING",
			severity: "warning",
			message: warning,
			nistRef: "MV-1.2",
		});
	}
	if (
		input.instructionParityStatus === "fail" ||
		input.instructionParityStatus === "error"
	) {
		evaluateFindings.push({
			code: "INSTRUCTION_PARITY_FAILED",
			severity: "error",
			message:
				input.instructionParityStatus === "error"
					? "Instruction parity check errored"
					: "Instruction parity check failed",
			nistRef: "MV-1.3",
		});
	}
	traces.push({
		phase: "evaluate",
		nistAlignment: NIST_PHASE_ALIGNMENT.evaluate,
		startedAt: now,
		completedAt: now,
		status: evaluateFindings.some((f) => f.severity === "error")
			? "blocked"
			: "completed",
		findings: evaluateFindings,
	});

	// Phase 4: DECIDE
	const decideFindings: EvaluationFinding[] = [];
	for (const reason of input.decisionReasons) {
		decideFindings.push({
			code: "DECISION_REASON",
			severity: input.evaluationDecision === "promote" ? "info" : "warning",
			message: reason,
			nistRef: "MV-2.1",
		});
	}
	for (const code of input.blockerCodes) {
		decideFindings.push({
			code: "BLOCKER_CODE",
			severity: "error",
			message: `Blocker: ${code}`,
			nistRef: "MV-2.3",
		});
	}
	traces.push({
		phase: "decide",
		nistAlignment: NIST_PHASE_ALIGNMENT.decide,
		startedAt: now,
		completedAt: now,
		status: ["promote", "hold", "rollback"].includes(input.evaluationDecision)
			? "completed"
			: "blocked",
		findings: decideFindings,
	});

	// Phase 5: REPORT
	traces.push({
		phase: "report",
		nistAlignment: NIST_PHASE_ALIGNMENT.report,
		startedAt: now,
		completedAt: now,
		status: input.artifactsWritten ? "completed" : "blocked",
		findings: input.artifactsWritten
			? []
			: [
					{
						code: "REPORT_NOT_WRITTEN",
						severity: "warning",
						message: "Artifacts were not written to disk",
						nistRef: "MV-4.1",
					},
				],
	});

	return traces;
}

// ---------------------------------------------------------------------------
// Readable decision packet
// ---------------------------------------------------------------------------

/**
 * Human-readable decision packet.
 *
 * Designed to be understood by someone who did not author the code.
 * Provides a headline decision, evidence summary, and operator actions.
 */
export interface ReadableDecisionPacket {
	/** One-line decision headline */
	headline: string;
	/** The evaluation decision */
	decision: string;
	/** Enforcement interpretation */
	enforcement: string;
	/** Evidence supporting the decision */
	evidenceSummary: string[];
	/** What is blocking promotion (if anything) */
	blockedBy: string[];
	/** Thresholds that passed */
	passedChecks: string[];
	/** Thresholds that failed */
	failedChecks: string[];
	/** Actions the operator should take next */
	operatorActions: string[];
	/** NIST AI RMF phase trace summary */
	phaseSummary: Array<{
		phase: EvaluationPhase;
		nistFunction: string;
		status: string;
		findingCount: number;
	}>;
}

/**
 * Format a human-readable decision packet from evaluation outputs.
 *
 * Transforms structured evaluation data into a summary that someone who
 * did not author the code can understand. Includes evidence, blockers,
 * passed/failed checks, and concrete operator actions.
 *
 * @param input - Evaluation outputs to format
 * @returns A human-readable decision packet
 */
export function formatReadableDecision(input: {
	/** The evaluation decision */
	decision: string;
	/** The enforcement decision */
	enforcement: string;
	/** Governance trust level */
	governanceTrustLevel: string;
	/** Instruction parity status */
	instructionParityStatus: string;
	/** Identity status */
	identityStatus: string;
	/** Decision reasons */
	reasons: string[];
	/** Blocker codes */
	blockerCodes: string[];
	/** Threshold audit report */
	thresholdReport: ThresholdAuditReport | null;
	/** Evaluation phase trace */
	phaseTrace: EvaluationPhaseTrace[];
	/** Warnings */
	warnings: string[];
}): ReadableDecisionPacket {
	const headline = deriveHeadline(input.decision, input.enforcement);

	const enforcementLabel = mapEnforcementLabel(input.enforcement);

	const evidenceSummary: string[] = [];
	evidenceSummary.push(`Governance trust: ${input.governanceTrustLevel}`);
	evidenceSummary.push(`Instruction parity: ${input.instructionParityStatus}`);
	evidenceSummary.push(`Agent identity: ${input.identityStatus}`);

	if (input.thresholdReport) {
		evidenceSummary.push(
			`Threshold gates: ${input.thresholdReport.gatePassCount}/${input.thresholdReport.gatePassCount + input.thresholdReport.gateFailCount} passed`,
		);
		evidenceSummary.push(
			`Guardrails: ${input.thresholdReport.guardrailPassCount}/${input.thresholdReport.guardrailPassCount + input.thresholdReport.guardrailFailCount} passed`,
		);
	}

	const passedChecks: string[] = [];
	const failedChecks: string[] = [];
	if (input.thresholdReport) {
		for (const entry of input.thresholdReport.entries) {
			const label = `${entry.metricName}: ${entry.actualValue} (required ${entry.operator} ${entry.thresholdValue})`;
			if (entry.passed) {
				passedChecks.push(label);
			} else {
				failedChecks.push(label);
			}
		}
	}

	const blockedBy =
		input.decision === "promote"
			? []
			: [
					...input.blockerCodes.map((code) => `Blocker: ${code}`),
					...input.reasons.filter(
						(r) => !input.blockerCodes.some((c) => r.includes(c)),
					),
				];

	const operatorActions = deriveOperatorActions(
		input.decision,
		input.blockerCodes,
		input.warnings,
		input.thresholdReport,
	);

	const phaseSummary = input.phaseTrace.map((trace) => ({
		phase: trace.phase,
		nistFunction: trace.nistAlignment.nistFunction,
		status: trace.status,
		findingCount: trace.findings.length,
	}));

	return {
		headline,
		decision: input.decision,
		enforcement: enforcementLabel,
		evidenceSummary,
		blockedBy,
		passedChecks,
		failedChecks,
		operatorActions,
		phaseSummary,
	};
}

/**
 * Map a decision code to a concise, human-readable headline.
 *
 * @param decision - One of: `"promote"`, `"hold"`, `"rollback"`, `"block_for_parity"`, `"block_for_evidence"`, `"block_for_adapter"`, or any other decision code
 * @returns A headline string describing the decision; for unrecognized codes returns `Unknown decision: ${decision}`
 */
function deriveHeadline(decision: string, _enforcement: string): string {
	switch (decision) {
		case "promote":
			return "✓ Promotion approved — autonomy may safely expand";
		case "hold":
			return "⏸ On hold — operator review required before proceeding";
		case "rollback":
			return "⏭ Rollback triggered — autonomy must contract";
		case "block_for_parity":
			return "⊘ Blocked — instruction parity evidence is insufficient";
		case "block_for_evidence":
			return "⊘ Blocked — governance evidence is incomplete or degraded";
		case "block_for_adapter":
			return "⊘ Blocked — provider adapter could not be resolved";
		default:
			return `Unknown decision: ${decision}`;
	}
}

/**
 * Map an enforcement keyword to a human-readable label.
 *
 * @param enforcement - Enforcement keyword: `"allow"`, `"block"`, `"non_blocking"`, or `"require_human_review"`. Other values are allowed but will be returned unchanged.
 * @returns A human-readable label describing the enforcement; returns the original `enforcement` string if it is not recognized.
 */
function mapEnforcementLabel(enforcement: string): string {
	switch (enforcement) {
		case "allow":
			return "Allow — evaluation permits this action";
		case "block":
			return "Block — action is denied by control-plane policy";
		case "non_blocking":
			return "Non-blocking — result is advisory in the current rollout stage";
		case "require_human_review":
			return "Human review required — operator must approve before proceeding";
		default:
			return enforcement;
	}
}

const BLOCKER_ACTION_MAP: Record<string, string> = {
	governance_trust_mismatch:
		"Resolve governance trust degradation — check contract, workflows, and instruction files",
	instruction_parity_failed:
		"Fix instruction parity failures — ensure derived instruction files reference AGENTS.md",
	missing_required_instruction_surface:
		"Create missing instruction surface files (e.g., CLAUDE.md, AGENTS.md)",
	adapter_unresolved:
		"Register a provider adapter in the agent-adapter-registry or resolve client family",
	identity_degraded:
		"Provide complete agent identity (client family, provider ID, model descriptor)",
	rollback_threshold_breached:
		"Investigate metric regression before re-attempting evaluation",
};

/**
 * Builds an ordered list of human-readable operator action strings based on the evaluation decision, blocker codes, warnings, and threshold audit.
 *
 * @param decision - The evaluation decision (e.g., "promote", "hold", "rollback", or block variants) that influences recommended actions
 * @param blockerCodes - Identifiers for specific blocker conditions that require targeted remediation
 * @param warnings - Non-blocking warning messages; presence may prompt review actions
 * @param thresholdReport - Optional threshold audit report; if present and gate thresholds failed, actions to address those failures are included
 * @returns An ordered array of operator action strings describing recommended remediation or next steps
 */
function deriveOperatorActions(
	decision: string,
	blockerCodes: string[],
	warnings: string[],
	thresholdReport: ThresholdAuditReport | null,
): string[] {
	const actions: string[] = [];

	if (decision === "promote") {
		actions.push("Continue rollout using the current stage posture");
		if (warnings.length > 0) {
			actions.push(
				`Review ${warnings.length} warning(s) before next evaluation window`,
			);
		}
		return actions;
	}

	if (thresholdReport && !thresholdReport.allGatesPassed) {
		actions.push(
			`Address ${thresholdReport.gateFailCount} failing gate threshold(s) before re-evaluation`,
		);
	}

	for (const code of blockerCodes) {
		const mappedAction = BLOCKER_ACTION_MAP[code];
		if (mappedAction) actions.push(mappedAction);
	}

	if (actions.length === 0 && decision !== "promote") {
		actions.push("Review control-plane scorecard and resolve blockers");
	}

	return actions;
}
