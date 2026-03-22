import { describe, expect, it } from "vitest";
import {
	createPilotLane,
	recordRunOutcome,
	recordScorecardOutcome,
	getRunsInWindow,
	computeWindowMetrics,
	evaluateWindow,
	recordWindowEvaluation,
	computeTransitionDecision,
	freezeLane,
	unfreezeLane,
	validatePilotLane,
	DEFAULT_METRIC_THRESHOLDS,
	DEFAULT_GATE_THRESHOLDS,
	type RunOutcome,
	type PilotLane,
	type PilotGateId,
	type OperatorScorecard,
	type GateEvaluation,
	type SupplementalGateActuals,
} from "./index.js";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function makeRun(
	overrides: Partial<RunOutcome> & { runId: string },
): RunOutcome {
	return {
		timestamp: "2026-03-01T12:00:00Z",
		passed: true,
		blocked: false,
		policyBypass: false,
		manualIntervention: false,
		decisionTimeMs: 5000,
		falseBlock: false,
		prReachedTerminal: true,
		...overrides,
	};
}

function makePassingRuns(count: number, windowStart: string): RunOutcome[] {
	const start = new Date(windowStart).getTime();
	return Array.from({ length: count }, (_, i) =>
		makeRun({
			runId: `run-${i}`,
			timestamp: new Date(start + i * 3600000).toISOString(),
		}),
	);
}

function makeMixedRuns(
	passCount: number,
	failCount: number,
	windowStart: string,
): RunOutcome[] {
	const start = new Date(windowStart).getTime();
	const runs: RunOutcome[] = [];
	for (let i = 0; i < passCount; i++) {
		runs.push(
			makeRun({
				runId: `pass-${i}`,
				timestamp: new Date(start + i * 3600000).toISOString(),
			}),
		);
	}
	for (let i = 0; i < failCount; i++) {
		runs.push(
			makeRun({
				runId: `fail-${i}`,
				timestamp: new Date(
					start + (passCount + i) * 3600000,
				).toISOString(),
				passed: false,
			}),
		);
	}
	return runs;
}

const HEALTHY_SUPPLEMENTAL_GATE_ACTUALS: SupplementalGateActuals = {
	behavior_change_honesty: 1,
	guardrail_capture: 1,
	compaction_health: 0,
	review_capacity: 0,
};

function evaluateWindowWithHealthySupplementalGates(
	lane: PilotLane,
	windowStart: string,
	windowEnd: string,
	overrides?: SupplementalGateActuals,
) {
	return evaluateWindow(lane, windowStart, windowEnd, {
		...HEALTHY_SUPPLEMENTAL_GATE_ACTUALS,
		...overrides,
	});
}

function makeGateEvaluation(
	gateId: PilotGateId,
	passed: boolean,
): GateEvaluation {
	return {
		gateId,
		passed,
		actual: passed ? 0 : 1,
		threshold: passed ? 0 : 1,
		comparison: "at_most",
		message: `${gateId} ${passed ? "passed" : "failed"}`,
	};
}

// ─── createPilotLane ────────────────────────────────────────────────────────────

describe("createPilotLane", () => {
	it("creates a lane with defaults", () => {
		const lane = createPilotLane({
			repoFullName: "jamie/test-repo",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});
		expect(lane.schemaVersion).toBe("pilot-lane/v1");
		expect(lane.config.repoFullName).toBe("jamie/test-repo");
		expect(lane.config.windowDurationDays).toBe(14);
		expect(lane.config.requiredConsecutiveWindows).toBe(2);
		expect(lane.runs).toEqual([]);
		expect(lane.windows).toEqual([]);
		expect(lane.consecutivePassingWindows).toBe(0);
		expect(lane.expansionReady).toBe(false);
		expect(lane.frozen).toBe(false);
	});

	it("uses custom timestamp", () => {
		const lane = createPilotLane(
			{
				repoFullName: "jamie/test-repo",
				windowDurationDays: 14,
				requiredConsecutiveWindows: 2,
			},
			"2026-01-01T00:00:00Z",
		);
		expect(lane.createdAt).toBe("2026-01-01T00:00:00Z");
		expect(lane.updatedAt).toBe("2026-01-01T00:00:00Z");
	});

	it("applies default window duration and consecutive windows", () => {
		const lane = createPilotLane({
			repoFullName: "jamie/repo",
			windowDurationDays: 7,
			requiredConsecutiveWindows: 3,
		});
		expect(lane.config.windowDurationDays).toBe(7);
		expect(lane.config.requiredConsecutiveWindows).toBe(3);
	});
});

// ─── recordRunOutcome ───────────────────────────────────────────────────────────

describe("recordRunOutcome", () => {
	it("appends a run to the lane", () => {
		let lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});
		const run = makeRun({
			runId: "run-1",
			timestamp: "2026-03-05T12:00:00Z",
		});
		lane = recordRunOutcome(lane, run);
		expect(lane.runs.length).toBe(1);
		expect(lane.runs[0]?.runId).toBe("run-1");
		expect(lane.updatedAt).toBe("2026-03-05T12:00:00Z");
	});

	it("appends multiple runs", () => {
		let lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});
		lane = recordRunOutcome(
			lane,
			makeRun({ runId: "r1", timestamp: "2026-03-01T00:00:00Z" }),
		);
		lane = recordRunOutcome(
			lane,
			makeRun({ runId: "r2", timestamp: "2026-03-02T00:00:00Z" }),
		);
		expect(lane.runs.length).toBe(2);
	});
});

// ─── recordScorecardOutcome ─────────────────────────────────────────────────────

describe("recordScorecardOutcome", () => {
	it("converts scorecard to run outcome", () => {
		let lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});
		const scorecard = {
			bundleDecision: "pass",
			generatedAt: "2026-03-10T12:00:00Z",
			recommendedAction: "continue",
			decisionTimeMs: 8000,
		} as unknown as OperatorScorecard;

		lane = recordScorecardOutcome(lane, scorecard, "sc-run-1");
		expect(lane.runs.length).toBe(1);
		const run = lane.runs[0]!;
		expect(run.runId).toBe("sc-run-1");
		expect(run.passed).toBe(true);
		expect(run.blocked).toBe(false);
		expect(run.decisionTimeMs).toBe(8000);
		expect(run.manualIntervention).toBe(false);
	});

	it("records blocked scorecard as blocked", () => {
		let lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});
		const scorecard = {
			bundleDecision: "blocked",
			generatedAt: "2026-03-10T12:00:00Z",
			recommendedAction: "intervene",
			decisionTimeMs: 120000,
		} as unknown as OperatorScorecard;

		lane = recordScorecardOutcome(lane, scorecard, "sc-run-2");
		const run = lane.runs[0]!;
		expect(run.passed).toBe(false);
		expect(run.blocked).toBe(true);
		expect(run.manualIntervention).toBe(true);
	});
});

// ─── getRunsInWindow ────────────────────────────────────────────────────────────

describe("getRunsInWindow", () => {
	it("filters runs within a window", () => {
		const runs = [
			makeRun({ runId: "r1", timestamp: "2026-02-28T23:59:59Z" }),
			makeRun({ runId: "r2", timestamp: "2026-03-01T00:00:00Z" }),
			makeRun({ runId: "r3", timestamp: "2026-03-07T12:00:00Z" }),
			makeRun({ runId: "r4", timestamp: "2026-03-15T00:00:00Z" }),
			makeRun({ runId: "r5", timestamp: "2026-03-15T00:00:01Z" }),
		];
		const filtered = getRunsInWindow(
			runs,
			"2026-03-01T00:00:00Z",
			"2026-03-15T00:00:00Z",
		);
		expect(filtered.length).toBe(3);
		expect(filtered.map((r) => r.runId)).toEqual(["r2", "r3", "r4"]);
	});

	it("returns empty for no matching runs", () => {
		const runs = [
			makeRun({ runId: "r1", timestamp: "2026-01-01T00:00:00Z" }),
		];
		const filtered = getRunsInWindow(
			runs,
			"2026-03-01T00:00:00Z",
			"2026-03-15T00:00:00Z",
		);
		expect(filtered).toEqual([]);
	});
});

// ─── computeWindowMetrics ───────────────────────────────────────────────────────

describe("computeWindowMetrics", () => {
	it("computes metrics for passing runs", () => {
		const runs = makePassingRuns(10, "2026-03-01T00:00:00Z");
		const m = computeWindowMetrics(runs);
		expect(m.passRate).toBe(1.0);
		expect(m.policyBypassCount).toBe(0);
		expect(m.manualInterventionRate).toBe(0);
		expect(m.falseBlockRate).toBe(0);
		expect(m.prGreenClosureRate).toBe(1.0);
		expect(m.totalRuns).toBe(10);
	});

	it("computes metrics for mixed runs", () => {
		const runs = makeMixedRuns(8, 2, "2026-03-01T00:00:00Z");
		const m = computeWindowMetrics(runs);
		expect(m.passRate).toBe(0.8);
		expect(m.totalRuns).toBe(10);
	});

	it("handles empty runs", () => {
		const m = computeWindowMetrics([]);
		expect(m.passRate).toBe(0);
		expect(m.totalRuns).toBe(0);
	});

	it("computes false block rate correctly", () => {
		const runs = [
			makeRun({ runId: "r1", blocked: true, falseBlock: true }),
			makeRun({ runId: "r2", blocked: true, falseBlock: false }),
			makeRun({ runId: "r3", blocked: false }),
		];
		const m = computeWindowMetrics(runs);
		expect(m.falseBlockRate).toBe(0.5); // 1 false / 2 blocked
	});

	it("computes p50 decision time for odd count", () => {
		const runs = [
			makeRun({ runId: "r1", decisionTimeMs: 1000 }),
			makeRun({ runId: "r2", decisionTimeMs: 3000 }),
			makeRun({ runId: "r3", decisionTimeMs: 5000 }),
		];
		const m = computeWindowMetrics(runs);
		expect(m.p50DecisionTimeMs).toBe(3000);
	});

	it("computes p50 decision time for even count", () => {
		const runs = [
			makeRun({ runId: "r1", decisionTimeMs: 1000 }),
			makeRun({ runId: "r2", decisionTimeMs: 2000 }),
			makeRun({ runId: "r3", decisionTimeMs: 4000 }),
			makeRun({ runId: "r4", decisionTimeMs: 6000 }),
		];
		const m = computeWindowMetrics(runs);
		expect(m.p50DecisionTimeMs).toBe(3000); // (2000 + 4000) / 2
	});

	it("computes manual intervention rate", () => {
		const runs = [
			makeRun({ runId: "r1", manualIntervention: true }),
			makeRun({ runId: "r2", manualIntervention: false }),
			makeRun({ runId: "r3", manualIntervention: true }),
			makeRun({ runId: "r4", manualIntervention: false }),
		];
		const m = computeWindowMetrics(runs);
		expect(m.manualInterventionRate).toBe(0.5);
	});

	it("computes PR green closure rate on non-blocked only", () => {
		const runs = [
			makeRun({ runId: "r1", blocked: true, prReachedTerminal: true }),
			makeRun({ runId: "r2", blocked: false, prReachedTerminal: true }),
			makeRun({ runId: "r3", blocked: false, prReachedTerminal: false }),
		];
		const m = computeWindowMetrics(runs);
		// 2 non-blocked: 1 terminal / 2 = 0.5
		expect(m.prGreenClosureRate).toBe(0.5);
	});
});

// ─── evaluateWindow ─────────────────────────────────────────────────────────────

describe("evaluateWindow", () => {
	it("passes when all gates pass", () => {
		let lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});
		const runs = makePassingRuns(20, "2026-03-01T00:00:00Z");
		for (const r of runs) {
			lane = recordRunOutcome(lane, r);
		}

		const evalResult = evaluateWindowWithHealthySupplementalGates(
			lane,
			"2026-03-01T00:00:00Z",
			"2026-03-15T00:00:00Z",
		);
		expect(evalResult.passed).toBe(true);
		expect(evalResult.stopCriteria).toEqual([]);
		expect(evalResult.runCount).toBe(20);
		expect(evalResult.gates).toHaveLength(9);
	});

	it("fails when pass rate below threshold", () => {
		let lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});
		// 80% pass rate (below 95%)
		const runs = makeMixedRuns(8, 2, "2026-03-01T00:00:00Z");
		for (const r of runs) {
			lane = recordRunOutcome(lane, r);
		}

		const evalResult = evaluateWindowWithHealthySupplementalGates(
			lane,
			"2026-03-01T00:00:00Z",
			"2026-03-15T00:00:00Z",
		);
		expect(evalResult.passed).toBe(false);
		expect(evalResult.stopCriteria).toContain(
			"pilot_stability threshold not met",
		);
	});

	it("fails when policy bypass detected", () => {
		let lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});
		// All pass but one has policy bypass
		const runs = makePassingRuns(10, "2026-03-01T00:00:00Z");
		runs[0] = { ...runs[0]!, policyBypass: true };
		for (const r of runs) {
			lane = recordRunOutcome(lane, r);
		}

		const evalResult = evaluateWindowWithHealthySupplementalGates(
			lane,
			"2026-03-01T00:00:00Z",
			"2026-03-15T00:00:00Z",
		);
		expect(evalResult.passed).toBe(false);
		expect(evalResult.stopCriteria).toContain(
			"pilot_stability threshold not met",
		);
	});

	it("does not warn on the first slow operator-speed window", () => {
		let lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});
		// High decision time
		const runs = makePassingRuns(3, "2026-03-01T00:00:00Z").map((r) => ({
			...r,
			decisionTimeMs: 90000,
		}));
		for (const r of runs) {
			lane = recordRunOutcome(lane, r);
		}

		const evalResult = evaluateWindowWithHealthySupplementalGates(
			lane,
			"2026-03-01T00:00:00Z",
			"2026-03-15T00:00:00Z",
		);
		expect(evalResult.warningSignsDetected).not.toContain(
			"operator_speed: p50 decision time above threshold",
		);
	});

	it("warns after a second consecutive slow operator-speed window", () => {
		let lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});
		const firstWindowRuns = makePassingRuns(3, "2026-03-01T00:00:00Z").map(
			(run) => ({
				...run,
				decisionTimeMs: 90000,
			}),
		);
		for (const run of firstWindowRuns) {
			lane = recordRunOutcome(lane, run);
		}
		const firstWindow = evaluateWindowWithHealthySupplementalGates(
			lane,
			"2026-03-01T00:00:00Z",
			"2026-03-15T00:00:00Z",
		);
		lane = recordWindowEvaluation(lane, firstWindow);

		const secondWindowRuns = makePassingRuns(3, "2026-03-15T00:00:00Z").map(
			(run) => ({
				...run,
				decisionTimeMs: 95000,
			}),
		);
		for (const run of secondWindowRuns) {
			lane = recordRunOutcome(lane, run);
		}

		const secondWindow = evaluateWindowWithHealthySupplementalGates(
			lane,
			"2026-03-15T00:00:00Z",
			"2026-03-29T00:00:00Z",
		);
		expect(secondWindow.warningSignsDetected).toContain(
			"operator_speed: p50 decision time above threshold",
		);
	});

	it("honors threshold overrides for operator metrics", () => {
		let lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
			thresholdOverrides: {
				decision_time_ms: 100000,
				manual_intervention_rate: 0.4,
				false_block_rate: 0.5,
				pr_green_closure_rate: 0.5,
			},
		});
		const runs = [
			makeRun({
				runId: "override-1",
				timestamp: "2026-03-01T01:00:00Z",
				decisionTimeMs: 90000,
				manualIntervention: true,
				falseBlock: true,
			}),
			makeRun({
				runId: "override-2",
				timestamp: "2026-03-01T02:00:00Z",
				decisionTimeMs: 90000,
				prReachedTerminal: false,
			}),
		];
		for (const run of runs) {
			lane = recordRunOutcome(lane, run);
		}

		const evalResult = evaluateWindowWithHealthySupplementalGates(
			lane,
			"2026-03-01T00:00:00Z",
			"2026-03-15T00:00:00Z",
		);
		expect(evalResult.passed).toBe(true);
		expect(
			evalResult.gates.find((gate) => gate.gateId === "operator_speed")
				?.threshold,
		).toBe(100000);
		expect(
			evalResult.gates.find(
				(gate) => gate.gateId === "solo_operator_efficiency",
			)?.threshold,
		).toBe(0.4);
		expect(
			evalResult.gates.find(
				(gate) => gate.gateId === "false_block_control",
			)?.threshold,
		).toBe(0.5);
		expect(
			evalResult.gates.find((gate) => gate.gateId === "pr_green_closure")
				?.threshold,
		).toBe(0.5);
	});

	it("fails when required supplemental gate evidence is omitted", () => {
		let lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});
		const runs = makePassingRuns(5, "2026-03-01T00:00:00Z");
		for (const run of runs) {
			lane = recordRunOutcome(lane, run);
		}

		const evalResult = evaluateWindow(
			lane,
			"2026-03-01T00:00:00Z",
			"2026-03-15T00:00:00Z",
		);
		expect(evalResult.passed).toBe(false);
		expect(evalResult.stopCriteria).toContain(
			"behavior_change_honesty supplemental evidence missing",
		);
		expect(
			evalResult.gates.find(
				(gate) => gate.gateId === "behavior_change_honesty",
			)?.message,
		).toContain("supplemental evidence not provided");
	});

	it("defers 30-day guardrail_capture until 30 days of observation exist", () => {
		let lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});
		const runs = makePassingRuns(5, "2026-03-01T00:00:00Z");
		for (const run of runs) {
			lane = recordRunOutcome(lane, run);
		}

		const evalResult = evaluateWindowWithHealthySupplementalGates(
			lane,
			"2026-03-01T00:00:00Z",
			"2026-03-15T00:00:00Z",
			{ guardrail_capture: 0 },
		);
		expect(evalResult.passed).toBe(true);
		expect(evalResult.stopCriteria).not.toContain(
			"guardrail_capture threshold not met",
		);
		expect(
			evalResult.gates.find((gate) => gate.gateId === "guardrail_capture")
				?.message,
		).toContain("requires a rolling 30-day observation window");
	});

	it("enforces 30-day guardrail_capture once enough history exists", () => {
		let lane = createPilotLane(
			{
				repoFullName: "jamie/test",
				windowDurationDays: 14,
				requiredConsecutiveWindows: 2,
			},
			"2026-03-01T00:00:00Z",
		);
		const runs = [
			...makePassingRuns(3, "2026-03-01T00:00:00Z"),
			...makePassingRuns(3, "2026-03-20T00:00:00Z"),
			...makePassingRuns(3, "2026-04-02T00:00:00Z"),
		];
		for (const run of runs) {
			lane = recordRunOutcome(lane, run);
		}

		const evalResult = evaluateWindowWithHealthySupplementalGates(
			lane,
			"2026-04-01T00:00:00Z",
			"2026-04-15T00:00:00Z",
			{ guardrail_capture: 0 },
		);
		expect(evalResult.passed).toBe(false);
		expect(evalResult.stopCriteria).toContain(
			"guardrail_capture threshold not met",
		);
	});

	it("returns correct window id and boundaries", () => {
		const lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});
		const evalResult = evaluateWindow(
			lane,
			"2026-03-01T00:00:00Z",
			"2026-03-15T00:00:00Z",
		);
		expect(evalResult.windowId).toBe("window-2026-03-01-2026-03-15");
		expect(evalResult.windowStart).toBe("2026-03-01T00:00:00Z");
		expect(evalResult.windowEnd).toBe("2026-03-15T00:00:00Z");
	});
});

// ─── recordWindowEvaluation ─────────────────────────────────────────────────────

describe("recordWindowEvaluation", () => {
	it("increments consecutive windows on pass", () => {
		let lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});

		const passingWindow = {
			windowId: "w1",
			windowStart: "2026-03-01T00:00:00Z",
			windowEnd: "2026-03-15T00:00:00Z",
			runCount: 10,
			gates: [],
			passed: true,
			stopCriteria: [],
			warningSignsDetected: [],
		};

		lane = recordWindowEvaluation(lane, passingWindow);
		expect(lane.consecutivePassingWindows).toBe(1);
		expect(lane.expansionReady).toBe(false);

		const passingWindow2 = {
			...passingWindow,
			windowId: "w2",
			windowStart: "2026-03-15T00:00:00Z",
			windowEnd: "2026-03-29T00:00:00Z",
		};
		lane = recordWindowEvaluation(lane, passingWindow2);
		expect(lane.consecutivePassingWindows).toBe(2);
		expect(lane.expansionReady).toBe(true);
	});

	it("resets consecutive windows on fail", () => {
		let lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});

		const passingWindow = {
			windowId: "w1",
			windowStart: "2026-03-01T00:00:00Z",
			windowEnd: "2026-03-15T00:00:00Z",
			runCount: 10,
			gates: [],
			passed: true,
			stopCriteria: [],
			warningSignsDetected: [],
		};

		lane = recordWindowEvaluation(lane, passingWindow);
		expect(lane.consecutivePassingWindows).toBe(1);

		const failingWindow = {
			...passingWindow,
			windowId: "w2",
			passed: false,
			stopCriteria: ["pilot_stability threshold not met"],
		};
		lane = recordWindowEvaluation(lane, failingWindow);
		expect(lane.consecutivePassingWindows).toBe(0);
		expect(lane.expansionReady).toBe(false);
	});
});

// ─── computeTransitionDecision ──────────────────────────────────────────────────

describe("computeTransitionDecision", () => {
	it("returns hold when no windows", () => {
		const lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});
		const result = computeTransitionDecision(lane);
		expect(result.decision).toBe("hold");
		expect(result.summary).toContain("HOLD");
	});

	it("returns expand when 2 consecutive passing windows", () => {
		let lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});
		lane = recordWindowEvaluation(lane, {
			windowId: "w1",
			windowStart: "2026-03-01T00:00:00Z",
			windowEnd: "2026-03-15T00:00:00Z",
			runCount: 20,
			gates: [],
			passed: true,
			stopCriteria: [],
			warningSignsDetected: [],
		});
		lane = recordWindowEvaluation(lane, {
			windowId: "w2",
			windowStart: "2026-03-15T00:00:00Z",
			windowEnd: "2026-03-29T00:00:00Z",
			runCount: 20,
			gates: [],
			passed: true,
			stopCriteria: [],
			warningSignsDetected: [],
		});

		const result = computeTransitionDecision(lane);
		expect(result.decision).toBe("expand");
		expect(result.consecutivePassingWindows).toBe(2);
		expect(result.summary).toContain("EXPAND");
	});

	it("returns hold when only 1 passing window", () => {
		let lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});
		lane = recordWindowEvaluation(lane, {
			windowId: "w1",
			windowStart: "2026-03-01T00:00:00Z",
			windowEnd: "2026-03-15T00:00:00Z",
			runCount: 20,
			gates: [],
			passed: true,
			stopCriteria: [],
			warningSignsDetected: [],
		});

		const result = computeTransitionDecision(lane);
		expect(result.decision).toBe("hold");
		expect(result.consecutivePassingWindows).toBe(1);
	});

	it("returns freeze when 2+ warning signs in current window", () => {
		let lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});
		lane = recordWindowEvaluation(lane, {
			windowId: "w1",
			windowStart: "2026-03-01T00:00:00Z",
			windowEnd: "2026-03-15T00:00:00Z",
			runCount: 20,
			gates: [],
			passed: true,
			stopCriteria: [],
			warningSignsDetected: [
				"operator_speed: p50 decision time above threshold",
				"solo_operator_efficiency: manual intervention exceeds threshold",
			],
		});

		const result = computeTransitionDecision(lane);
		expect(result.decision).toBe("freeze");
		expect(result.shouldFreeze).toBe(true);
		expect(result.summary).toContain("FREEZE");
	});

	it("does not demote after 2 consecutive stop-criteria failures", () => {
		let lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});
		lane = recordWindowEvaluation(lane, {
			windowId: "w1",
			windowStart: "2026-03-01T00:00:00Z",
			windowEnd: "2026-03-15T00:00:00Z",
			runCount: 10,
			gates: [],
			passed: false,
			stopCriteria: ["pilot_stability"],
			warningSignsDetected: [],
		});
		lane = recordWindowEvaluation(lane, {
			windowId: "w2",
			windowStart: "2026-03-15T00:00:00Z",
			windowEnd: "2026-03-29T00:00:00Z",
			runCount: 10,
			gates: [],
			passed: false,
			stopCriteria: ["pilot_stability"],
			warningSignsDetected: [],
		});

		const result = computeTransitionDecision(lane);
		expect(result.decision).toBe("hold");
		expect(result.summary).toContain("HOLD");
	});

	it("demotes after 2 consecutive warning-threshold breaches", () => {
		let lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});
		lane = recordWindowEvaluation(lane, {
			windowId: "w1",
			windowStart: "2026-03-01T00:00:00Z",
			windowEnd: "2026-03-15T00:00:00Z",
			runCount: 10,
			gates: [makeGateEvaluation("solo_operator_efficiency", false)],
			passed: false,
			stopCriteria: [],
			warningSignsDetected: [
				"solo_operator_efficiency: manual intervention exceeds threshold",
			],
		});
		lane = recordWindowEvaluation(lane, {
			windowId: "w2",
			windowStart: "2026-03-15T00:00:00Z",
			windowEnd: "2026-03-29T00:00:00Z",
			runCount: 10,
			gates: [makeGateEvaluation("solo_operator_efficiency", false)],
			passed: false,
			stopCriteria: [],
			warningSignsDetected: [
				"solo_operator_efficiency: manual intervention exceeds threshold",
			],
		});

		const result = computeTransitionDecision(lane);
		expect(result.decision).toBe("demote");
		expect(result.summary).toContain("DEMOTE");
	});

	it("returns hold after a pass that follows a fail", () => {
		let lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});
		lane = recordWindowEvaluation(lane, {
			windowId: "w1",
			windowStart: "2026-03-01T00:00:00Z",
			windowEnd: "2026-03-15T00:00:00Z",
			runCount: 10,
			gates: [],
			passed: false,
			stopCriteria: ["pilot_stability"],
			warningSignsDetected: [],
		});
		lane = recordWindowEvaluation(lane, {
			windowId: "w2",
			windowStart: "2026-03-15T00:00:00Z",
			windowEnd: "2026-03-29T00:00:00Z",
			runCount: 20,
			gates: [],
			passed: true,
			stopCriteria: [],
			warningSignsDetected: [],
		});

		const result = computeTransitionDecision(lane);
		expect(result.decision).toBe("hold");
		expect(result.consecutivePassingWindows).toBe(1);
	});

	it("returns frozen decision for frozen lane", () => {
		let lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});
		lane = freezeLane(lane, "Manual freeze for incident review");

		const result = computeTransitionDecision(lane);
		expect(result.decision).toBe("freeze");
		expect(result.summary).toContain("FROZEN");
		expect(result.summary).toContain("incident review");
	});
});

// ─── freezeLane / unfreezeLane ──────────────────────────────────────────────────

describe("freezeLane / unfreezeLane", () => {
	it("freezes a lane", () => {
		const lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});
		const frozen = freezeLane(lane, "incident investigation");
		expect(frozen.frozen).toBe(true);
		expect(frozen.freezeReason).toBe("incident investigation");
	});

	it("unfreezes a lane", () => {
		const lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});
		const frozen = freezeLane(lane, "incident investigation");
		const unfrozen = unfreezeLane(frozen);
		expect(unfrozen.frozen).toBe(false);
		expect(unfrozen.freezeReason).toBe("");
	});
});

// ─── validatePilotLane ──────────────────────────────────────────────────────────

describe("validatePilotLane", () => {
	it("validates a correct lane", () => {
		const lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});
		const result = validatePilotLane(lane);
		expect(result.valid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it("rejects missing repo name", () => {
		const lane = createPilotLane({
			repoFullName: "",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});
		const result = validatePilotLane(lane);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("repo full name"))).toBe(
			true,
		);
	});

	it("rejects invalid window duration", () => {
		const lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 0,
			requiredConsecutiveWindows: 2,
		});
		const result = validatePilotLane(lane);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("window duration"))).toBe(
			true,
		);
	});

	it("rejects invalid consecutive windows", () => {
		const lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 0,
		});
		const result = validatePilotLane(lane);
		expect(result.valid).toBe(false);
		expect(
			result.errors.some((e) => e.includes("consecutive windows")),
		).toBe(true);
	});

	it("rejects invalid schema version", () => {
		const lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});
		const bad = {
			...lane,
			schemaVersion: "pilot-lane/v99" as PilotLane["schemaVersion"],
		};
		const result = validatePilotLane(bad);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("schema version"))).toBe(
			true,
		);
	});

	it("detects expansionReady inconsistency", () => {
		const lane = createPilotLane({
			repoFullName: "jamie/test",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});
		const bad = { ...lane, expansionReady: true };
		const result = validatePilotLane(bad);
		expect(result.valid).toBe(false);
		expect(
			result.errors.some((e) =>
				e.includes("expansionReady is true"),
			),
		).toBe(true);
	});
});

// ─── Default Thresholds ─────────────────────────────────────────────────────────

describe("DEFAULT_METRIC_THRESHOLDS", () => {
	it("has entries for all operator metrics", () => {
		const ids = DEFAULT_METRIC_THRESHOLDS.map((t) => t.metricId);
		expect(ids).toContain("decision_time_ms");
		expect(ids).toContain("manual_intervention_rate");
		expect(ids).toContain("false_block_rate");
		expect(ids).toContain("pr_green_closure_rate");
		expect(ids).toContain("repeat_failure_recurrence");
		expect(ids).toContain("compaction_event_rate");
	});
});

describe("DEFAULT_GATE_THRESHOLDS", () => {
	it("has entries for all pilot gates", () => {
		expect(DEFAULT_GATE_THRESHOLDS.pilot_stability).toBeDefined();
		expect(DEFAULT_GATE_THRESHOLDS.behavior_change_honesty).toBeDefined();
		expect(DEFAULT_GATE_THRESHOLDS.operator_speed).toBeDefined();
		expect(DEFAULT_GATE_THRESHOLDS.false_block_control).toBeDefined();
		expect(DEFAULT_GATE_THRESHOLDS.solo_operator_efficiency).toBeDefined();
		expect(DEFAULT_GATE_THRESHOLDS.pr_green_closure).toBeDefined();
		expect(DEFAULT_GATE_THRESHOLDS.guardrail_capture).toBeDefined();
		expect(DEFAULT_GATE_THRESHOLDS.compaction_health).toBeDefined();
		expect(DEFAULT_GATE_THRESHOLDS.review_capacity).toBeDefined();
	});

	it("pilot_stability threshold is 0.95", () => {
		expect(DEFAULT_GATE_THRESHOLDS.pilot_stability.threshold).toBe(0.95);
	});
});

// ─── End-to-End Scenario ────────────────────────────────────────────────────────

describe("end-to-end: two-window expansion", () => {
	it("reaches expand after two consecutive passing windows", () => {
		let lane = createPilotLane({
			repoFullName: "jamie/coding-harness",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});

		// Window 1: 20 passing runs
		const w1Runs = makePassingRuns(20, "2026-03-01T00:00:00Z");
		for (const r of w1Runs) {
			lane = recordRunOutcome(lane, r);
		}
		const w1Eval = evaluateWindowWithHealthySupplementalGates(
			lane,
			"2026-03-01T00:00:00Z",
			"2026-03-15T00:00:00Z",
		);
		expect(w1Eval.passed).toBe(true);
		lane = recordWindowEvaluation(lane, w1Eval);
		expect(lane.consecutivePassingWindows).toBe(1);

		let decision = computeTransitionDecision(lane);
		expect(decision.decision).toBe("hold");

		// Window 2: 20 passing runs
		const w2Runs = makePassingRuns(20, "2026-03-15T00:00:00Z");
		for (const r of w2Runs) {
			lane = recordRunOutcome(lane, r);
		}
		const w2Eval = evaluateWindowWithHealthySupplementalGates(
			lane,
			"2026-03-15T00:00:00Z",
			"2026-03-29T00:00:00Z",
		);
		expect(w2Eval.passed).toBe(true);
		lane = recordWindowEvaluation(lane, w2Eval);
		expect(lane.consecutivePassingWindows).toBe(2);
		expect(lane.expansionReady).toBe(true);

		decision = computeTransitionDecision(lane);
		expect(decision.decision).toBe("expand");
		expect(decision.summary).toContain("EXPAND");
		expect(decision.summary).toContain("2/2");
	});

	it("resets on a failing window mid-sequence", () => {
		let lane = createPilotLane({
			repoFullName: "jamie/coding-harness",
			windowDurationDays: 14,
			requiredConsecutiveWindows: 2,
		});

		// Window 1: passing
		const w1Runs = makePassingRuns(20, "2026-03-01T00:00:00Z");
		for (const r of w1Runs) {
			lane = recordRunOutcome(lane, r);
		}
		const w1Eval = evaluateWindowWithHealthySupplementalGates(
			lane,
			"2026-03-01T00:00:00Z",
			"2026-03-15T00:00:00Z",
		);
		lane = recordWindowEvaluation(lane, w1Eval);
		expect(lane.consecutivePassingWindows).toBe(1);

		// Window 2: failing (low pass rate)
		const w2Runs = makeMixedRuns(5, 15, "2026-03-15T00:00:00Z");
		for (const r of w2Runs) {
			lane = recordRunOutcome(lane, r);
		}
		const w2Eval = evaluateWindowWithHealthySupplementalGates(
			lane,
			"2026-03-15T00:00:00Z",
			"2026-03-29T00:00:00Z",
		);
		expect(w2Eval.passed).toBe(false);
		lane = recordWindowEvaluation(lane, w2Eval);
		expect(lane.consecutivePassingWindows).toBe(0);

		// Window 3: passing
		const w3Runs = makePassingRuns(20, "2026-03-29T00:00:00Z");
		for (const r of w3Runs) {
			lane = recordRunOutcome(lane, r);
		}
		const w3Eval = evaluateWindowWithHealthySupplementalGates(
			lane,
			"2026-03-29T00:00:00Z",
			"2026-04-12T00:00:00Z",
		);
		lane = recordWindowEvaluation(lane, w3Eval);
		expect(lane.consecutivePassingWindows).toBe(1);
		expect(lane.expansionReady).toBe(false);

		const decision = computeTransitionDecision(lane);
		expect(decision.decision).toBe("hold");
	});
});
