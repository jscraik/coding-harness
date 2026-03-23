/**
 * Scale-out Pilot Tracker (Slice 6)
 *
 * Implements the scale-out pilot evaluation logic:
 * - Define constrained project lanes with exit criteria
 * - Track run outcomes within 14-day evaluation windows
 * - Evaluate gate contract thresholds (pass rate, decision time, etc.)
 * - Determine transition readiness (expand / freeze / demote)
 * - Enforce "two consecutive passing windows" rule before expansion
 *
 * Designed to be consumed by existing pilot-evaluation control-plane
 * infrastructure and the operator scorecard from Slice 4a.
 *
 * Usage:
 *   const lane = createPilotLane({ repoFullName: "jamie/repo-a" });
 *   recordRunOutcome(lane, outcome);
 *   const window = evaluateWindow(lane);
 *   const decision = computeTransitionDecision(lane);
 */

import type { OperatorScorecard } from "./operator-scorecard.js";

// ─── Types ──────────────────────────────────────────────────────────────────────

/** Gate IDs from the gate contract table. */
export type PilotGateId =
	| "pilot_stability"
	| "behavior_change_honesty"
	| "operator_speed"
	| "false_block_control"
	| "solo_operator_efficiency"
	| "pr_green_closure"
	| "guardrail_capture"
	| "compaction_health"
	| "review_capacity";

/** Transition decision for the pilot. */
export type TransitionDecision = "expand" | "hold" | "freeze" | "demote";

/** Operator metric IDs. */
export type OperatorMetricId =
	| "decision_time_ms"
	| "manual_intervention_rate"
	| "false_block_rate"
	| "pr_green_closure_rate"
	| "repeat_failure_recurrence"
	| "compaction_event_rate";

/** Gates that require supplemental evidence beyond per-run operator metrics. */
export type SupplementalPilotGateId = Exclude<
	PilotGateId,
	| "pilot_stability"
	| "operator_speed"
	| "false_block_control"
	| "solo_operator_efficiency"
	| "pr_green_closure"
>;

/** Supplemental gate values for gates that cannot be derived from run metrics alone. */
export type SupplementalGateActuals = Partial<
	Record<SupplementalPilotGateId, number>
>;

/** Metric threshold definition. */
export interface MetricThreshold {
	/** Metric identifier. */
	metricId: OperatorMetricId;
	/** Healthy threshold value. */
	healthyThreshold: number;
	/** Comparison: at_most = value must be ≤ threshold, at_least = value must be ≥ threshold. */
	comparison: "at_most" | "at_least";
	/** Whether exceeding for 2 consecutive windows triggers a response. */
	requiresConsecutiveWindowCheck: boolean;
}

/** A single run outcome recorded within a pilot lane. */
export interface RunOutcome {
	/** Unique run identifier. */
	runId: string;
	/** ISO 8601 timestamp of the run. */
	timestamp: string;
	/** Overall pass/fail of the run. */
	passed: boolean;
	/** Whether the run was blocked. */
	blocked: boolean;
	/** Whether a policy bypass was used. */
	policyBypass: boolean;
	/** Whether manual intervention was required. */
	manualIntervention: boolean;
	/** Decision time in milliseconds. */
	decisionTimeMs: number;
	/** Whether the false-block adjudication determined this was a false block. */
	falseBlock: boolean;
	/** Whether the PR reached green or explicit blocked state. */
	prReachedTerminal: boolean;
	/** Optional scorecard reference. */
	scorecardRef?: string | undefined;
}

/** Gate evaluation result within a window. */
export interface GateEvaluation {
	/** Gate ID. */
	gateId: PilotGateId;
	/** Whether the gate passed. */
	passed: boolean;
	/** Actual metric value. */
	actual: number;
	/** Threshold value. */
	threshold: number;
	/** Comparison used. */
	comparison: "at_most" | "at_least";
	/** Message explaining the result. */
	message: string;
}

/** Evaluation window result. */
export interface WindowEvaluation {
	/** Window ID. */
	windowId: string;
	/** Window start (ISO 8601). */
	windowStart: string;
	/** Window end (ISO 8601). */
	windowEnd: string;
	/** Number of runs in this window. */
	runCount: number;
	/** Gate evaluations. */
	gates: GateEvaluation[];
	/** Overall window pass. */
	passed: boolean;
	/** Stop criteria triggered. */
	stopCriteria: string[];
	/** Warning signs detected. */
	warningSignsDetected: string[];
}

/** Pilot lane configuration. */
export interface PilotLaneConfig {
	/** Repository full name (e.g. "jamie/repo-a"). */
	repoFullName: string;
	/** Window duration in days. */
	windowDurationDays: number;
	/** Required consecutive passing windows before expansion. */
	requiredConsecutiveWindows: number;
	/** Custom metric thresholds (overrides defaults). */
	thresholdOverrides?: Partial<Record<OperatorMetricId, number>> | undefined;
}

/** A pilot lane with tracked state. */
export interface PilotLane {
	/** Schema version. */
	schemaVersion: "pilot-lane/v1";
	/** Lane configuration. */
	config: PilotLaneConfig;
	/** All recorded runs. */
	runs: RunOutcome[];
	/** Evaluated windows. */
	windows: WindowEvaluation[];
	/** Current consecutive passing windows. */
	consecutivePassingWindows: number;
	/** Whether expansion criteria are met. */
	expansionReady: boolean;
	/** Active freeze flag. */
	frozen: boolean;
	/** Freeze reason (empty if not frozen). */
	freezeReason: string;
	/** Created timestamp. */
	createdAt: string;
	/** Last updated timestamp. */
	updatedAt: string;
}

/** Transition decision result. */
export interface TransitionResult {
	/** Decision. */
	decision: TransitionDecision;
	/** Consecutive passing windows so far. */
	consecutivePassingWindows: number;
	/** Required consecutive windows. */
	requiredConsecutiveWindows: number;
	/** Reasons for the decision. */
	reasons: string[];
	/** Active stop criteria. */
	activeStopcriteria: string[];
	/** Warning signs across last 2 windows. */
	warningSignCount: number;
	/** Whether the lane should be frozen. */
	shouldFreeze: boolean;
	/** Plain-text summary. */
	summary: string;
}

// ─── Default Metric Thresholds ──────────────────────────────────────────────────

/**
 * Default operator metric thresholds from the plan.
 */
export const DEFAULT_METRIC_THRESHOLDS: readonly MetricThreshold[] = [
	{
		metricId: "decision_time_ms",
		healthyThreshold: 60000,
		comparison: "at_most",
		requiresConsecutiveWindowCheck: true,
	},
	{
		metricId: "manual_intervention_rate",
		healthyThreshold: 0.2,
		comparison: "at_most",
		requiresConsecutiveWindowCheck: false,
	},
	{
		metricId: "false_block_rate",
		healthyThreshold: 0.05,
		comparison: "at_most",
		requiresConsecutiveWindowCheck: false,
	},
	{
		metricId: "pr_green_closure_rate",
		healthyThreshold: 0.9,
		comparison: "at_least",
		requiresConsecutiveWindowCheck: false,
	},
	{
		metricId: "repeat_failure_recurrence",
		healthyThreshold: 0, // downward trend — 0 is best
		comparison: "at_most",
		requiresConsecutiveWindowCheck: false,
	},
	{
		metricId: "compaction_event_rate",
		healthyThreshold: 0.1,
		comparison: "at_most",
		requiresConsecutiveWindowCheck: false,
	},
];

/**
 * Default pilot gate thresholds.
 */
export const DEFAULT_GATE_THRESHOLDS: Record<
	PilotGateId,
	{ threshold: number; comparison: "at_most" | "at_least" }
> = {
	pilot_stability: { threshold: 0.95, comparison: "at_least" },
	behavior_change_honesty: { threshold: 1.0, comparison: "at_least" },
	operator_speed: { threshold: 60000, comparison: "at_most" },
	false_block_control: { threshold: 0.05, comparison: "at_most" },
	solo_operator_efficiency: { threshold: 0.2, comparison: "at_most" },
	pr_green_closure: { threshold: 0.9, comparison: "at_least" },
	guardrail_capture: { threshold: 1.0, comparison: "at_least" },
	compaction_health: { threshold: 0.0, comparison: "at_most" },
	review_capacity: { threshold: 0.0, comparison: "at_most" },
};

// ─── Pilot Lane Management ──────────────────────────────────────────────────────

/**
 * Create a new pilot lane for a constrained project.
 */
export function createPilotLane(
	config: PilotLaneConfig,
	timestamp?: string,
): PilotLane {
	const now = timestamp ?? new Date().toISOString();
	return {
		schemaVersion: "pilot-lane/v1",
		config,
		runs: [],
		windows: [],
		consecutivePassingWindows: 0,
		expansionReady: false,
		frozen: false,
		freezeReason: "",
		createdAt: now,
		updatedAt: now,
	};
}

/**
 * Record a run outcome in a pilot lane.
 */
export function recordRunOutcome(
	lane: PilotLane,
	outcome: RunOutcome,
): PilotLane {
	return {
		...lane,
		runs: [...lane.runs, outcome],
		updatedAt: outcome.timestamp,
	};
}

/**
 * Record a run outcome from an OperatorScorecard.
 */
export function recordScorecardOutcome(
	lane: PilotLane,
	scorecard: OperatorScorecard,
	runId: string,
): PilotLane {
	const outcome: RunOutcome = {
		runId,
		timestamp: scorecard.generatedAt,
		passed: scorecard.bundleDecision === "pass",
		blocked: scorecard.bundleDecision === "blocked",
		policyBypass: false,
		manualIntervention: scorecard.recommendedAction === "intervene",
		decisionTimeMs: scorecard.decisionTimeMs,
		falseBlock: false,
		prReachedTerminal:
			scorecard.bundleDecision === "pass" ||
			scorecard.bundleDecision === "blocked",
	};
	return recordRunOutcome(lane, outcome);
}

// ─── Window Evaluation ──────────────────────────────────────────────────────────

/**
 * Get runs within a specific time window.
 */
export function getRunsInWindow(
	runs: RunOutcome[],
	windowStart: string,
	windowEnd: string,
): RunOutcome[] {
	const startMs = new Date(windowStart).getTime();
	const endMs = new Date(windowEnd).getTime();
	return runs.filter((r) => {
		const t = new Date(r.timestamp).getTime();
		return t >= startMs && t <= endMs;
	});
}

/**
 * Compute metrics from a set of runs.
 */
export function computeWindowMetrics(runs: RunOutcome[]): {
	passRate: number;
	policyBypassCount: number;
	manualInterventionRate: number;
	falseBlockRate: number;
	prGreenClosureRate: number;
	p50DecisionTimeMs: number;
	totalRuns: number;
} {
	if (runs.length === 0) {
		return {
			passRate: 0,
			policyBypassCount: 0,
			manualInterventionRate: 0,
			falseBlockRate: 0,
			prGreenClosureRate: 0,
			p50DecisionTimeMs: 0,
			totalRuns: 0,
		};
	}

	const passRate = runs.filter((r) => r.passed).length / runs.length;
	const policyBypassCount = runs.filter((r) => r.policyBypass).length;
	const manualInterventionRate =
		runs.filter((r) => r.manualIntervention).length / runs.length;
	const blockedRuns = runs.filter((r) => r.blocked);
	const falseBlockRate =
		blockedRuns.length > 0
			? blockedRuns.filter((r) => r.falseBlock).length / blockedRuns.length
			: 0;
	const nonBlockedRuns = runs.filter((r) => !r.blocked);
	const prGreenClosureRate =
		nonBlockedRuns.length > 0
			? nonBlockedRuns.filter((r) => r.prReachedTerminal).length /
				nonBlockedRuns.length
			: 1;

	// p50 decision time
	const times = runs.map((r) => r.decisionTimeMs).sort((a, b) => a - b);
	const midIndex = Math.floor(times.length / 2);
	const p50DecisionTimeMs =
		times.length % 2 === 0
			? ((times[midIndex - 1] ?? 0) + (times[midIndex] ?? 0)) / 2
			: (times[midIndex] ?? 0);

	return {
		passRate,
		policyBypassCount,
		manualInterventionRate,
		falseBlockRate,
		prGreenClosureRate,
		p50DecisionTimeMs,
		totalRuns: runs.length,
	};
}

/**
 * Evaluate a 14-day window against gate contract thresholds.
 */
export function evaluateWindow(
	lane: PilotLane,
	windowStart: string,
	windowEnd: string,
	supplementalGateActuals?: SupplementalGateActuals,
): WindowEvaluation {
	const windowId = `window-${windowStart.slice(0, 10)}-${windowEnd.slice(0, 10)}`;
	const runs = getRunsInWindow(lane.runs, windowStart, windowEnd);
	const metrics = computeWindowMetrics(runs);
	const windowDurationDays = computeDurationDays(windowStart, windowEnd);
	const observationDurationDays = computeObservationDurationDays(
		lane,
		windowStart,
		windowEnd,
	);
	const gates: GateEvaluation[] = [];
	const stopCriteria: string[] = [];
	const warningSignsDetected: string[] = [];
	const previousWindow = lane.windows[lane.windows.length - 1] ?? null;
	const decisionTimeThreshold = resolveMetricThreshold(
		"decision_time_ms",
		lane.config.thresholdOverrides,
	);
	const falseBlockThreshold = resolveMetricThreshold(
		"false_block_rate",
		lane.config.thresholdOverrides,
	);
	const manualInterventionThreshold = resolveMetricThreshold(
		"manual_intervention_rate",
		lane.config.thresholdOverrides,
	);
	const prClosureThreshold = resolveMetricThreshold(
		"pr_green_closure_rate",
		lane.config.thresholdOverrides,
	);

	// pilot_stability: pass rate >= 95% and zero policy bypasses
	const stabilityPassed =
		compareAgainstThreshold(
			metrics.passRate,
			DEFAULT_GATE_THRESHOLDS.pilot_stability.threshold,
			DEFAULT_GATE_THRESHOLDS.pilot_stability.comparison,
		) && metrics.policyBypassCount === 0;
	gates.push({
		gateId: "pilot_stability",
		passed: stabilityPassed,
		actual: metrics.passRate,
		threshold: DEFAULT_GATE_THRESHOLDS.pilot_stability.threshold,
		comparison: DEFAULT_GATE_THRESHOLDS.pilot_stability.comparison,
		message: stabilityPassed
			? `Pass rate ${(metrics.passRate * 100).toFixed(1)}% meets threshold, 0 policy bypasses`
			: `Pass rate ${(metrics.passRate * 100).toFixed(1)}% ${metrics.passRate < DEFAULT_GATE_THRESHOLDS.pilot_stability.threshold ? `below ${(DEFAULT_GATE_THRESHOLDS.pilot_stability.threshold * 100).toFixed(0)}% threshold` : ""} ${metrics.policyBypassCount > 0 ? `and ${metrics.policyBypassCount} policy bypass(es)` : ""}`.trim(),
	});
	if (!stabilityPassed) {
		stopCriteria.push("pilot_stability threshold not met");
	}

	// behavior_change_honesty: explicit RED/contract evidence is required
	appendSupplementalGateEvaluation({
		gateId: "behavior_change_honesty",
		supplementalGateActuals,
		windowDurationDays,
		observationDurationDays,
		gates,
		stopCriteria,
	});

	// operator_speed: p50 decision time <= configured threshold
	const speedPassed = compareAgainstThreshold(
		metrics.p50DecisionTimeMs,
		decisionTimeThreshold,
		DEFAULT_GATE_THRESHOLDS.operator_speed.comparison,
	);
	gates.push({
		gateId: "operator_speed",
		passed: speedPassed,
		actual: metrics.p50DecisionTimeMs,
		threshold: decisionTimeThreshold,
		comparison: DEFAULT_GATE_THRESHOLDS.operator_speed.comparison,
		message: speedPassed
			? `p50 decision time ${metrics.p50DecisionTimeMs}ms within ${decisionTimeThreshold}ms threshold`
			: `p50 decision time ${metrics.p50DecisionTimeMs}ms exceeds ${decisionTimeThreshold}ms threshold`,
	});
	if (!speedPassed && didWindowFailGate(previousWindow, "operator_speed")) {
		warningSignsDetected.push(
			"operator_speed: p50 decision time above threshold",
		);
	}

	// false_block_control: false block rate <= configured threshold
	const falseBlockPassed = compareAgainstThreshold(
		metrics.falseBlockRate,
		falseBlockThreshold,
		DEFAULT_GATE_THRESHOLDS.false_block_control.comparison,
	);
	gates.push({
		gateId: "false_block_control",
		passed: falseBlockPassed,
		actual: metrics.falseBlockRate,
		threshold: falseBlockThreshold,
		comparison: DEFAULT_GATE_THRESHOLDS.false_block_control.comparison,
		message: falseBlockPassed
			? `False block rate ${(metrics.falseBlockRate * 100).toFixed(1)}% within threshold`
			: `False block rate ${(metrics.falseBlockRate * 100).toFixed(1)}% exceeds ${(falseBlockThreshold * 100).toFixed(1)}% threshold`,
	});
	if (!falseBlockPassed) {
		stopCriteria.push("false_block_control threshold not met");
	}

	// solo_operator_efficiency: manual intervention rate <= configured threshold
	const soloEffPassed = compareAgainstThreshold(
		metrics.manualInterventionRate,
		manualInterventionThreshold,
		DEFAULT_GATE_THRESHOLDS.solo_operator_efficiency.comparison,
	);
	gates.push({
		gateId: "solo_operator_efficiency",
		passed: soloEffPassed,
		actual: metrics.manualInterventionRate,
		threshold: manualInterventionThreshold,
		comparison: DEFAULT_GATE_THRESHOLDS.solo_operator_efficiency.comparison,
		message: soloEffPassed
			? `Manual intervention rate ${(metrics.manualInterventionRate * 100).toFixed(1)}% within threshold`
			: `Manual intervention rate ${(metrics.manualInterventionRate * 100).toFixed(1)}% exceeds ${(manualInterventionThreshold * 100).toFixed(1)}% threshold`,
	});
	if (!soloEffPassed) {
		warningSignsDetected.push(
			"solo_operator_efficiency: manual intervention exceeds threshold",
		);
	}

	// pr_green_closure: >= configured threshold of PRs reach terminal state
	const prClosurePassed = compareAgainstThreshold(
		metrics.prGreenClosureRate,
		prClosureThreshold,
		DEFAULT_GATE_THRESHOLDS.pr_green_closure.comparison,
	);
	gates.push({
		gateId: "pr_green_closure",
		passed: prClosurePassed,
		actual: metrics.prGreenClosureRate,
		threshold: prClosureThreshold,
		comparison: DEFAULT_GATE_THRESHOLDS.pr_green_closure.comparison,
		message: prClosurePassed
			? `PR closure rate ${(metrics.prGreenClosureRate * 100).toFixed(1)}% meets threshold`
			: `PR closure rate ${(metrics.prGreenClosureRate * 100).toFixed(1)}% below ${(prClosureThreshold * 100).toFixed(1)}% threshold`,
	});
	if (!prClosurePassed) {
		stopCriteria.push("pr_green_closure threshold not met");
	}

	appendSupplementalGateEvaluation({
		gateId: "guardrail_capture",
		supplementalGateActuals,
		windowDurationDays,
		observationDurationDays,
		gates,
		stopCriteria,
	});
	appendSupplementalGateEvaluation({
		gateId: "compaction_health",
		supplementalGateActuals,
		windowDurationDays,
		observationDurationDays,
		gates,
		stopCriteria,
	});
	appendSupplementalGateEvaluation({
		gateId: "review_capacity",
		supplementalGateActuals,
		windowDurationDays,
		observationDurationDays,
		gates,
		stopCriteria,
	});

	const passed = stopCriteria.length === 0;

	return {
		windowId,
		windowStart,
		windowEnd,
		runCount: runs.length,
		gates,
		passed,
		stopCriteria,
		warningSignsDetected,
	};
}

/**
 * Record a window evaluation and update lane state.
 */
export function recordWindowEvaluation(
	lane: PilotLane,
	evaluation: WindowEvaluation,
): PilotLane {
	const newConsecutive = evaluation.passed
		? lane.consecutivePassingWindows + 1
		: 0;

	const expansionReady =
		newConsecutive >= lane.config.requiredConsecutiveWindows;

	return {
		...lane,
		windows: [...lane.windows, evaluation],
		consecutivePassingWindows: newConsecutive,
		expansionReady,
		updatedAt: evaluation.windowEnd,
	};
}

// ─── Transition Decision ────────────────────────────────────────────────────────

/**
 * Compute a transition decision for the pilot lane.
 *
 * Decision matrix:
 * - **expand**: 2+ consecutive passing windows, no active stops
 * - **hold**: last window passed but not yet 2 consecutive
 * - **freeze**: 2+ warning signs in the same window
 * - **demote**: above warning thresholds for 30 days (2+ windows)
 */
export function computeTransitionDecision(lane: PilotLane): TransitionResult {
	const reasons: string[] = [];
	const activeStopcriteria: string[] = [];
	let warningSignCount = 0;

	if (lane.frozen) {
		return {
			decision: "freeze",
			consecutivePassingWindows: lane.consecutivePassingWindows,
			requiredConsecutiveWindows: lane.config.requiredConsecutiveWindows,
			reasons: [`Lane is frozen: ${lane.freezeReason}`],
			activeStopcriteria: [],
			warningSignCount: 0,
			shouldFreeze: true,
			summary: `🛑 FROZEN: ${lane.freezeReason}`,
		};
	}

	if (lane.windows.length === 0) {
		return {
			decision: "hold",
			consecutivePassingWindows: 0,
			requiredConsecutiveWindows: lane.config.requiredConsecutiveWindows,
			reasons: ["No evaluation windows recorded yet"],
			activeStopcriteria: [],
			warningSignCount: 0,
			shouldFreeze: false,
			summary: "⏳ HOLD: No evaluation windows recorded yet",
		};
	}

	const lastWindow = lane.windows.at(-1);
	if (!lastWindow) {
		throw new Error("Expected at least one window in lane");
	}
	const secondLastWindow =
		lane.windows.length >= 2 ? lane.windows.at(-2) : null;

	// Collect stop criteria from last window
	for (const sc of lastWindow.stopCriteria) {
		activeStopcriteria.push(sc);
	}

	// Count warning signs across last 2 windows
	warningSignCount += lastWindow.warningSignsDetected.length;
	if (secondLastWindow) {
		warningSignCount += secondLastWindow.warningSignsDetected.length;
	}

	// Check for freeze condition: 2+ warning signs in same window
	const shouldFreeze = lastWindow.warningSignsDetected.length >= 2;
	if (shouldFreeze) {
		reasons.push(
			`${lastWindow.warningSignsDetected.length} warning signs in current window — freeze new features`,
		);
	}

	// Check for demotion: warning-threshold breaches persisted across 2 windows
	const shouldDemote =
		secondLastWindow != null &&
		hasWarningThresholdBreach(secondLastWindow) &&
		hasWarningThresholdBreach(lastWindow);
	if (shouldDemote) {
		reasons.push(
			"Warning-threshold breaches persisted for 2 consecutive windows — demote",
		);
	}

	// Determine decision
	let decision: TransitionDecision;
	if (shouldDemote) {
		decision = "demote";
		reasons.push(
			"Sustained warning-threshold breach for 30 days — demote one tier",
		);
	} else if (shouldFreeze) {
		decision = "freeze";
		reasons.push("Freeze new features until warning signs clear");
	} else if (lane.expansionReady) {
		decision = "expand";
		reasons.push(
			`${lane.consecutivePassingWindows} consecutive passing windows — ready to expand`,
		);
	} else if (lastWindow.passed) {
		decision = "hold";
		reasons.push(
			`${lane.consecutivePassingWindows} of ${lane.config.requiredConsecutiveWindows} consecutive passing windows — hold`,
		);
	} else {
		decision = "hold";
		reasons.push("Last window did not pass — hold");
	}

	const icon =
		decision === "expand"
			? "🚀"
			: decision === "hold"
				? "⏳"
				: decision === "freeze"
					? "🥶"
					: "📉";

	const summary = renderTransitionSummary({
		icon,
		decision,
		repoFullName: lane.config.repoFullName,
		consecutivePassingWindows: lane.consecutivePassingWindows,
		requiredConsecutiveWindows: lane.config.requiredConsecutiveWindows,
		reasons,
		activeStopcriteria,
		warningSignCount,
		lastWindow,
	});

	return {
		decision,
		consecutivePassingWindows: lane.consecutivePassingWindows,
		requiredConsecutiveWindows: lane.config.requiredConsecutiveWindows,
		reasons,
		activeStopcriteria,
		warningSignCount,
		shouldFreeze,
		summary,
	};
}

/**
 * Freeze a pilot lane with a reason.
 */
export function freezeLane(
	lane: PilotLane,
	reason: string,
	timestamp?: string,
): PilotLane {
	return {
		...lane,
		frozen: true,
		freezeReason: reason,
		updatedAt: timestamp ?? new Date().toISOString(),
	};
}

/**
 * Unfreeze a pilot lane.
 */
export function unfreezeLane(lane: PilotLane, timestamp?: string): PilotLane {
	return {
		...lane,
		frozen: false,
		freezeReason: "",
		updatedAt: timestamp ?? new Date().toISOString(),
	};
}

/**
 * Validate a pilot lane structure.
 */
export function validatePilotLane(lane: PilotLane): {
	valid: boolean;
	errors: string[];
} {
	const errors: string[] = [];

	if (lane.schemaVersion !== "pilot-lane/v1") {
		errors.push(
			`Invalid schema version '${lane.schemaVersion}', expected 'pilot-lane/v1'`,
		);
	}

	if (
		!lane.config.repoFullName ||
		lane.config.repoFullName.trim().length === 0
	) {
		errors.push("Missing repo full name");
	}

	if (lane.config.windowDurationDays <= 0) {
		errors.push(
			`Invalid window duration ${lane.config.windowDurationDays} days, must be > 0`,
		);
	}

	if (lane.config.requiredConsecutiveWindows < 1) {
		errors.push(
			`Invalid required consecutive windows ${lane.config.requiredConsecutiveWindows}, must be >= 1`,
		);
	}

	if (lane.consecutivePassingWindows < 0) {
		errors.push("Consecutive passing windows cannot be negative");
	}

	if (
		lane.expansionReady &&
		lane.consecutivePassingWindows < lane.config.requiredConsecutiveWindows
	) {
		errors.push(
			"expansionReady is true but consecutive passing windows is below required threshold",
		);
	}

	return { valid: errors.length === 0, errors };
}

// ─── Internal ───────────────────────────────────────────────────────────────────

function renderTransitionSummary(data: {
	icon: string;
	decision: TransitionDecision;
	repoFullName: string;
	consecutivePassingWindows: number;
	requiredConsecutiveWindows: number;
	reasons: string[];
	activeStopcriteria: string[];
	warningSignCount: number;
	lastWindow: WindowEvaluation;
}): string {
	const lines: string[] = [];
	lines.push("═══════════════════════════════════════════════════");
	lines.push(
		`${data.icon}  PILOT TRANSITION: ${data.decision.toUpperCase()}  ${data.icon}`,
	);
	lines.push("═══════════════════════════════════════════════════");
	lines.push("");
	lines.push(`  Repo:       ${data.repoFullName}`);
	lines.push(
		`  Windows:    ${data.consecutivePassingWindows}/${data.requiredConsecutiveWindows} consecutive passing`,
	);
	lines.push(`  Last run count: ${data.lastWindow.runCount}`);
	lines.push("");

	// Gate results
	if (data.lastWindow.gates.length > 0) {
		lines.push("  Gate results:");
		for (const g of data.lastWindow.gates) {
			const icon = g.passed ? "✓" : "✗";
			lines.push(`    ${icon} ${g.gateId}: ${g.message}`);
		}
		lines.push("");
	}

	// Reasons
	if (data.reasons.length > 0) {
		lines.push("  Decision reasons:");
		for (const r of data.reasons) {
			lines.push(`    • ${r}`);
		}
		lines.push("");
	}

	// Stop criteria
	if (data.activeStopcriteria.length > 0) {
		lines.push("  ⛔ Active stop criteria:");
		for (const sc of data.activeStopcriteria) {
			lines.push(`    • ${sc}`);
		}
		lines.push("");
	}

	// Warning signs
	if (data.warningSignCount > 0) {
		lines.push(
			`  ⚠️  ${data.warningSignCount} warning sign(s) in last 2 windows`,
		);
		lines.push("");
	}

	lines.push("═══════════════════════════════════════════════════");
	return lines.join("\n");
}

function resolveMetricThreshold(
	metricId: OperatorMetricId,
	thresholdOverrides?: Partial<Record<OperatorMetricId, number>>,
): number {
	const override = thresholdOverrides?.[metricId];
	if (override !== undefined) {
		return override;
	}

	const defaultThreshold = DEFAULT_METRIC_THRESHOLDS.find(
		(metric) => metric.metricId === metricId,
	);
	if (!defaultThreshold) {
		throw new Error(`Missing default metric threshold for ${metricId}`);
	}

	return defaultThreshold.healthyThreshold;
}

function compareAgainstThreshold(
	actual: number,
	threshold: number,
	comparison: "at_most" | "at_least",
): boolean {
	return comparison === "at_most" ? actual <= threshold : actual >= threshold;
}

function didWindowFailGate(
	window: WindowEvaluation | null,
	gateId: PilotGateId,
): boolean {
	if (!window) {
		return false;
	}

	return window.gates.some((gate) => gate.gateId === gateId && !gate.passed);
}

function hasWarningThresholdBreach(window: WindowEvaluation): boolean {
	return (
		didWindowFailGate(window, "operator_speed") ||
		didWindowFailGate(window, "solo_operator_efficiency")
	);
}

function appendSupplementalGateEvaluation(input: {
	gateId: SupplementalPilotGateId;
	supplementalGateActuals: SupplementalGateActuals | undefined;
	windowDurationDays: number;
	observationDurationDays: number;
	gates: GateEvaluation[];
	stopCriteria: string[];
}): void {
	const gateThreshold = DEFAULT_GATE_THRESHOLDS[input.gateId];
	const actual = input.supplementalGateActuals?.[input.gateId];
	const requiredWindowDays = input.gateId === "guardrail_capture" ? 30 : 14;
	const observedDays = Math.max(0, Math.floor(input.observationDurationDays));

	if (input.gateId === "guardrail_capture") {
		if (input.observationDurationDays < requiredWindowDays) {
			input.gates.push({
				gateId: input.gateId,
				passed: true,
				actual: Number.NaN,
				threshold: gateThreshold.threshold,
				comparison: gateThreshold.comparison,
				message: `${input.gateId} requires a rolling ${requiredWindowDays}-day observation window; only ${observedDays} day(s) observed so far`,
			});
			return;
		}
	} else if (input.windowDurationDays < requiredWindowDays) {
		input.gates.push({
			gateId: input.gateId,
			passed: true,
			actual: Number.NaN,
			threshold: gateThreshold.threshold,
			comparison: gateThreshold.comparison,
			message: `${input.gateId} is evaluated on a ${requiredWindowDays}-day window and is not applied to this ${input.windowDurationDays}-day lane`,
		});
		return;
	}

	if (actual === undefined) {
		input.gates.push({
			gateId: input.gateId,
			passed: false,
			actual: Number.NaN,
			threshold: gateThreshold.threshold,
			comparison: gateThreshold.comparison,
			message: `${input.gateId} supplemental evidence not provided for this window`,
		});
		input.stopCriteria.push(`${input.gateId} supplemental evidence missing`);
		return;
	}

	const passed = compareAgainstThreshold(
		actual,
		gateThreshold.threshold,
		gateThreshold.comparison,
	);
	input.gates.push({
		gateId: input.gateId,
		passed,
		actual,
		threshold: gateThreshold.threshold,
		comparison: gateThreshold.comparison,
		message: passed
			? `${input.gateId} supplemental evidence meets threshold`
			: `${input.gateId} supplemental evidence does not meet threshold`,
	});
	if (!passed) {
		input.stopCriteria.push(`${input.gateId} threshold not met`);
	}
}

function computeDurationDays(start: string, end: string): number {
	return (new Date(end).getTime() - new Date(start).getTime()) / 86_400_000;
}

function computeObservationDurationDays(
	lane: PilotLane,
	windowStart: string,
	windowEnd: string,
): number {
	const observationStartCandidates = [
		windowStart,
		lane.createdAt,
		...lane.runs.map((run) => run.timestamp),
	]
		.map((timestamp) => new Date(timestamp).getTime())
		.filter((value) => Number.isFinite(value));
	const observationStartMs =
		observationStartCandidates.length > 0
			? Math.min(...observationStartCandidates)
			: new Date(windowStart).getTime();
	const observationEndMs = new Date(windowEnd).getTime();

	return Math.max(0, (observationEndMs - observationStartMs) / 86_400_000);
}
