import { describe, expect, it } from "vitest";
import {
	NIST_PHASE_ALIGNMENT,
	evaluateThresholds,
	formatReadableDecision,
	generateEvaluationTrace,
} from "./evaluation-engine.js";
import type { PilotMetrics } from "./types.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePassingMetrics(): PilotMetrics {
	return {
		windowStart: "2026-03-01",
		windowEnd: "2026-03-14",
		sampleSize: 30,
		leadTimeP50Improvement: -0.45,
		leadTimeP75Improvement: -0.3,
		leadTimeP50CiHalfWidth: 0.05,
		leadTimeP75CiHalfWidth: 0.08,
		rollbackReliability: 1.0,
		rollbackTriggerCount: 2,
		interventionRate: 0.1,
		highRiskAutomationIncidents: 0,
		unresolvedCriticalIncidents: 0,
		incidentClassificationP95Hours: 1,
		evidenceCompletenessRatio: 0.98,
		thrashRate: 0.02,
		sensitiveFieldLeakCount: 0,
		runIdCollisionCount: 0,
		repoSampleSizes: { "test/repo": 30 },
	};
}

function makeFailingMetrics(): PilotMetrics {
	return {
		windowStart: "2026-03-01",
		windowEnd: "2026-03-14",
		sampleSize: 5,
		leadTimeP50Improvement: -0.1,
		leadTimeP75Improvement: -0.05,
		leadTimeP50CiHalfWidth: 0.5,
		leadTimeP75CiHalfWidth: 0.6,
		rollbackReliability: 0.8,
		rollbackTriggerCount: 3,
		interventionRate: 0.6,
		highRiskAutomationIncidents: 2,
		unresolvedCriticalIncidents: 1,
		incidentClassificationP95Hours: 48,
		evidenceCompletenessRatio: 0.7,
		thrashRate: 0.4,
		sensitiveFieldLeakCount: 1,
		runIdCollisionCount: 2,
		repoSampleSizes: { "test/repo": 5 },
	};
}

function makeTraceInput(
	overrides: Partial<Parameters<typeof generateEvaluationTrace>[0]> = {},
) {
	return {
		metricsCaptured: true,
		metrics: makePassingMetrics(),
		metricsErrors: [],
		thresholdReport: evaluateThresholds(makePassingMetrics()),
		governanceTrustLevel: "trusted" as const,
		governanceWarnings: [],
		instructionParityStatus: "pass" as const,
		evaluationDecision: "promote",
		decisionReasons: [],
		blockerCodes: [],
		artifactsWritten: true,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// NIST alignment
// ---------------------------------------------------------------------------

describe("NIST_PHASE_ALIGNMENT", () => {
	it("covers all five phases", () => {
		const phases = Object.keys(NIST_PHASE_ALIGNMENT);
		expect(phases).toEqual([
			"ingest",
			"measure",
			"evaluate",
			"decide",
			"report",
		]);
	});

	it("each phase has required NIST metadata", () => {
		for (const [, alignment] of Object.entries(NIST_PHASE_ALIGNMENT)) {
			expect(alignment.nistFunction).toMatch(/^(Measure|Manage)$/);
			expect(alignment.subcategories.length).toBeGreaterThan(0);
			expect(alignment.description.length).toBeGreaterThan(0);
		}
	});

	it("ingest and measure use the Measure function", () => {
		expect(NIST_PHASE_ALIGNMENT.ingest.nistFunction).toBe("Measure");
		expect(NIST_PHASE_ALIGNMENT.measure.nistFunction).toBe("Measure");
	});

	it("evaluate, decide, and report use the Manage function", () => {
		expect(NIST_PHASE_ALIGNMENT.evaluate.nistFunction).toBe("Manage");
		expect(NIST_PHASE_ALIGNMENT.decide.nistFunction).toBe("Manage");
		expect(NIST_PHASE_ALIGNMENT.report.nistFunction).toBe("Manage");
	});
});

// ---------------------------------------------------------------------------
// evaluateThresholds
// ---------------------------------------------------------------------------

describe("evaluateThresholds", () => {
	it("returns a valid schema version", () => {
		const report = evaluateThresholds(makePassingMetrics());
		expect(report.schemaVersion).toBe("threshold-audit-report/v1");
	});

	it("marks phase as measure", () => {
		const report = evaluateThresholds(makePassingMetrics());
		expect(report.phase).toBe("measure");
	});

	it("passes all gates when metrics meet thresholds", () => {
		const report = evaluateThresholds(makePassingMetrics());
		expect(report.allGatesPassed).toBe(true);
		expect(report.gateFailCount).toBe(0);
		expect(report.gatePassCount).toBeGreaterThan(0);
	});

	it("fails gates when metrics do not meet thresholds", () => {
		const report = evaluateThresholds(makeFailingMetrics());
		expect(report.allGatesPassed).toBe(false);
		expect(report.gateFailCount).toBeGreaterThan(0);
	});

	it("produces an entry for every defined threshold", () => {
		const report = evaluateThresholds(makePassingMetrics());
		expect(report.entries.length).toBeGreaterThanOrEqual(10);
	});

	it("each entry has required fields", () => {
		const report = evaluateThresholds(makePassingMetrics());
		for (const entry of report.entries) {
			expect(entry.metricName).toBeTruthy();
			expect(entry.metricKey).toBeTruthy();
			expect(typeof entry.thresholdValue).toBe("number");
			expect(typeof entry.actualValue).toBe("number");
			expect(entry.operator).toMatch(/^(min|max|exact)$/);
			expect(typeof entry.passed).toBe("boolean");
			expect(entry.severity).toMatch(/^(gate|guardrail|advisory)$/);
			expect(entry.nistRef).toMatch(/^MG-2\.\d+$/);
		}
	});

	it("detects sample size below minimum", () => {
		const metrics = makeFailingMetrics();
		const report = evaluateThresholds(metrics);
		const sampleEntry = report.entries.find(
			(e) => e.metricKey === "sampleSize",
		);
		expect(sampleEntry).toBeDefined();
		expect(sampleEntry!.passed).toBe(false);
		expect(sampleEntry!.severity).toBe("gate");
	});

	it("detects high-risk automation incidents above zero", () => {
		const metrics = makeFailingMetrics();
		const report = evaluateThresholds(metrics);
		const incidentEntry = report.entries.find(
			(e) => e.metricKey === "highRiskAutomationIncidents",
		);
		expect(incidentEntry).toBeDefined();
		expect(incidentEntry!.passed).toBe(false);
		expect(incidentEntry!.actualValue).toBe(2);
		expect(incidentEntry!.thresholdValue).toBe(0);
	});

	it("detects lead time improvement above threshold (worse)", () => {
		const metrics = makeFailingMetrics();
		const report = evaluateThresholds(metrics);
		const p50Entry = report.entries.find(
			(e) => e.metricKey === "leadTimeP50Improvement",
		);
		expect(p50Entry).toBeDefined();
		expect(p50Entry!.passed).toBe(false);
		// -0.1 > -0.35 (max threshold for negative improvement)
		expect(p50Entry!.actualValue).toBeGreaterThan(p50Entry!.thresholdValue);
	});

	it("detects evidence completeness below minimum", () => {
		const metrics = makeFailingMetrics();
		const report = evaluateThresholds(metrics);
		const completenessEntry = report.entries.find(
			(e) => e.metricKey === "evidenceCompletenessRatio",
		);
		expect(completenessEntry).toBeDefined();
		expect(completenessEntry!.passed).toBe(false);
	});

	it("counts gate and guardrail totals correctly", () => {
		const report = evaluateThresholds(makePassingMetrics());
		const totalGates = report.gatePassCount + report.gateFailCount;
		const totalGuardrails =
			report.guardrailPassCount + report.guardrailFailCount;
		expect(totalGates).toBeGreaterThan(0);
		expect(totalGuardrails).toBeGreaterThan(0);
		expect(totalGates + totalGuardrails + report.advisoryCount).toBe(
			report.entries.length,
		);
	});

	it("guardrails fail for wide confidence intervals", () => {
		const report = evaluateThresholds(makeFailingMetrics());
		expect(report.allGuardrailsPassed).toBe(false);
		expect(report.guardrailFailCount).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// generateEvaluationTrace
// ---------------------------------------------------------------------------

describe("generateEvaluationTrace", () => {
	it("produces exactly five phases", () => {
		const traces = generateEvaluationTrace(makeTraceInput());
		expect(traces.length).toBe(5);
		expect(traces.map((t) => t.phase)).toEqual([
			"ingest",
			"measure",
			"evaluate",
			"decide",
			"report",
		]);
	});

	it("each trace has NIST alignment metadata", () => {
		const traces = generateEvaluationTrace(makeTraceInput());
		for (const trace of traces) {
			expect(trace.nistAlignment.nistFunction).toMatch(/^(Measure|Manage)$/);
			expect(trace.nistAlignment.subcategories.length).toBeGreaterThan(0);
		}
	});

	it("marks ingest as blocked when metrics capture fails", () => {
		const traces = generateEvaluationTrace(
			makeTraceInput({
				metricsCaptured: false,
				metrics: null,
				metricsErrors: ["Schema validation error"],
				thresholdReport: null,
				governanceTrustLevel: "degraded",
				instructionParityStatus: "error",
				evaluationDecision: "block_for_evidence",
				decisionReasons: ["Metrics capture failed"],
				blockerCodes: ["telemetry_unavailable"],
				artifactsWritten: false,
			}),
		);
		expect(traces[0]!.phase).toBe("ingest");
		expect(traces[0]!.status).toBe("blocked");
		expect(traces[0]!.findings.length).toBeGreaterThan(0);
	});

	it("skips measure when ingest is blocked", () => {
		const traces = generateEvaluationTrace(
			makeTraceInput({
				metricsCaptured: false,
				metrics: null,
				metricsErrors: [],
				thresholdReport: null,
				governanceTrustLevel: "degraded",
				instructionParityStatus: "error",
				evaluationDecision: "block_for_evidence",
				decisionReasons: [],
				blockerCodes: [],
				artifactsWritten: false,
			}),
		);
		const measureTrace = traces.find((t) => t.phase === "measure");
		expect(measureTrace!.status).toBe("skipped");
	});

	it("includes findings for failed threshold entries", () => {
		const traces = generateEvaluationTrace(
			makeTraceInput({
				metrics: makeFailingMetrics(),
				thresholdReport: evaluateThresholds(makeFailingMetrics()),
				evaluationDecision: "hold",
				decisionReasons: ["Sample size below minimum"],
			}),
		);
		const measureTrace = traces.find((t) => t.phase === "measure");
		expect(measureTrace!.findings.length).toBeGreaterThan(0);
		expect(measureTrace!.status).toBe("blocked");
	});

	it("flags governance degradation in evaluate phase", () => {
		const traces = generateEvaluationTrace(
			makeTraceInput({
				governanceTrustLevel: "degraded",
				governanceWarnings: ["Canonical AGENTS.md missing"],
				evaluationDecision: "block_for_evidence",
				decisionReasons: ["Governance degraded"],
				blockerCodes: ["governance_trust_mismatch"],
			}),
		);
		const evaluateTrace = traces.find((t) => t.phase === "evaluate");
		expect(evaluateTrace!.status).toBe("blocked");
		const govFinding = evaluateTrace!.findings.find(
			(f) => f.code === "GOVERNANCE_DEGRADED",
		);
		expect(govFinding).toBeDefined();
		expect(govFinding!.severity).toBe("error");
	});

	it("flags instruction parity failure in evaluate phase", () => {
		const traces = generateEvaluationTrace(
			makeTraceInput({
				instructionParityStatus: "fail",
				evaluationDecision: "block_for_parity",
				decisionReasons: ["Parity failed"],
				blockerCodes: ["instruction_parity_failed"],
			}),
		);
		const evaluateTrace = traces.find((t) => t.phase === "evaluate");
		const parityFinding = evaluateTrace!.findings.find(
			(f) => f.code === "INSTRUCTION_PARITY_FAILED",
		);
		expect(parityFinding).toBeDefined();
		expect(parityFinding!.severity).toBe("error");
	});

	it("shows promote decision as completed in decide phase", () => {
		const traces = generateEvaluationTrace(
			makeTraceInput({
				evaluationDecision: "promote",
				decisionReasons: [
					"Legacy pilot thresholds and trusted control-plane evidence permit promotion",
				],
			}),
		);
		const decideTrace = traces.find((t) => t.phase === "decide");
		expect(decideTrace!.status).toBe("completed");
		const reasonFinding = decideTrace!.findings.find(
			(f) => f.code === "DECISION_REASON",
		);
		expect(reasonFinding).toBeDefined();
		expect(reasonFinding!.severity).toBe("info");
	});

	it("records blocker codes in decide phase", () => {
		const traces = generateEvaluationTrace(
			makeTraceInput({
				governanceTrustLevel: "degraded",
				instructionParityStatus: "error",
				evaluationDecision: "block_for_evidence",
				decisionReasons: ["Governance degraded"],
				blockerCodes: ["governance_trust_mismatch", "identity_degraded"],
			}),
		);
		const decideTrace = traces.find((t) => t.phase === "decide");
		const blockerFindings = decideTrace!.findings.filter(
			(f) => f.code === "BLOCKER_CODE",
		);
		expect(blockerFindings.length).toBe(2);
		expect(blockerFindings.every((f) => f.severity === "error")).toBe(true);
	});

	it("flags report phase when artifacts not written", () => {
		const traces = generateEvaluationTrace(
			makeTraceInput({
				artifactsWritten: false,
			}),
		);
		const reportTrace = traces.find((t) => t.phase === "report");
		expect(reportTrace!.status).toBe("blocked");
		expect(
			reportTrace!.findings.some((f) => f.code === "REPORT_NOT_WRITTEN"),
		).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// formatReadableDecision
// ---------------------------------------------------------------------------

describe("formatReadableDecision", () => {
	it("formats a promotion decision", () => {
		const metrics = makePassingMetrics();
		const thresholdReport = evaluateThresholds(metrics);
		const packet = formatReadableDecision({
			decision: "promote",
			enforcement: "allow",
			governanceTrustLevel: "trusted",
			instructionParityStatus: "pass",
			identityStatus: "verified",
			reasons: [
				"Legacy pilot thresholds and trusted control-plane evidence permit promotion",
			],
			blockerCodes: [],
			thresholdReport,
			phaseTrace: generateEvaluationTrace(makeTraceInput()),
			warnings: [],
		});

		expect(packet.headline).toContain("Promotion approved");
		expect(packet.decision).toBe("promote");
		expect(packet.enforcement).toContain("Allow");
		expect(packet.blockedBy.length).toBe(0);
		expect(packet.failedChecks.length).toBe(0);
		expect(packet.passedChecks.length).toBeGreaterThan(0);
		expect(packet.operatorActions.length).toBeGreaterThan(0);
		expect(packet.phaseSummary.length).toBe(5);
	});

	it("formats a blocked decision with failed checks", () => {
		const metrics = makeFailingMetrics();
		const thresholdReport = evaluateThresholds(metrics);
		const packet = formatReadableDecision({
			decision: "block_for_evidence",
			enforcement: "block",
			governanceTrustLevel: "degraded",
			instructionParityStatus: "error",
			identityStatus: "identity_degraded",
			reasons: ["Governance degraded", "Metrics errors reported"],
			blockerCodes: ["governance_trust_mismatch"],
			thresholdReport,
			phaseTrace: generateEvaluationTrace(
				makeTraceInput({
					metrics,
					thresholdReport,
					governanceTrustLevel: "degraded",
					instructionParityStatus: "error",
					evaluationDecision: "block_for_evidence",
					decisionReasons: ["Governance degraded"],
					blockerCodes: ["governance_trust_mismatch"],
				}),
			),
			warnings: ["Canonical AGENTS.md missing"],
		});

		expect(packet.headline).toContain("Blocked");
		expect(packet.failedChecks.length).toBeGreaterThan(0);
		expect(packet.blockedBy.length).toBeGreaterThan(0);
		expect(packet.operatorActions.length).toBeGreaterThan(0);
	});

	it("formats a hold decision with human review enforcement", () => {
		const packet = formatReadableDecision({
			decision: "hold",
			enforcement: "require_human_review",
			governanceTrustLevel: "trusted",
			instructionParityStatus: "pass",
			identityStatus: "verified",
			reasons: ["Legacy pilot thresholds require operator hold"],
			blockerCodes: ["legacy_hold_required"],
			thresholdReport: null,
			phaseTrace: [],
			warnings: [],
		});

		expect(packet.headline).toContain("On hold");
		expect(packet.enforcement).toContain("Human review required");
	});

	it("formats a rollback decision", () => {
		const packet = formatReadableDecision({
			decision: "rollback",
			enforcement: "block",
			governanceTrustLevel: "trusted",
			instructionParityStatus: "pass",
			identityStatus: "verified",
			reasons: ["Legacy pilot thresholds triggered rollback"],
			blockerCodes: ["rollback_threshold_breached"],
			thresholdReport: null,
			phaseTrace: [],
			warnings: [],
		});

		expect(packet.headline).toContain("Rollback triggered");
		expect(packet.blockedBy).toContain("Blocker: rollback_threshold_breached");
	});

	it("includes phase summary for each phase", () => {
		const metrics = makePassingMetrics();
		const thresholdReport = evaluateThresholds(metrics);
		const traces = generateEvaluationTrace(makeTraceInput());

		const packet = formatReadableDecision({
			decision: "promote",
			enforcement: "allow",
			governanceTrustLevel: "trusted",
			instructionParityStatus: "pass",
			identityStatus: "verified",
			reasons: [],
			blockerCodes: [],
			thresholdReport,
			phaseTrace: traces,
			warnings: [],
		});

		for (const summary of packet.phaseSummary) {
			expect(summary.nistFunction).toMatch(/^(Measure|Manage)$/);
			expect(summary.status).toBeTruthy();
		}
	});

	it("provides actionable operator actions for blockers", () => {
		const packet = formatReadableDecision({
			decision: "block_for_evidence",
			enforcement: "block",
			governanceTrustLevel: "degraded",
			instructionParityStatus: "fail",
			identityStatus: "identity_degraded",
			reasons: [],
			blockerCodes: [
				"governance_trust_mismatch",
				"instruction_parity_failed",
				"adapter_unresolved",
				"identity_degraded",
			],
			thresholdReport: null,
			phaseTrace: [],
			warnings: [],
		});

		const actionText = packet.operatorActions.join(" ");
		expect(actionText).toContain("governance");
		expect(actionText).toContain("instruction parity");
		expect(actionText).toContain("provider adapter");
		expect(actionText).toContain("agent identity");
	});
});
