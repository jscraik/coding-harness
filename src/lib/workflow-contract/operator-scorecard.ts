/**
 * Operator Feedback Dashboard — Scorecard (Slice 4a)
 *
 * Produces a compact scorecard from a GateBundleEnvelope, optimized for
 * an operator (Jamie) to decide "continue, intervene, or stop" in under
 * one minute.
 *
 * Each scorecard includes:
 * - state reached (workflow state)
 * - blockers raised
 * - tests executed
 * - policy gates passed/failed
 * - decision_time_ms
 * - confidence (1–5 rubric)
 * - recommended_action
 * - blocking_reason
 * - remediation suggestions
 *
 * Usage:
 *   const scorecard = generateScorecard(bundle, {
 *     workflowState: "S2 IN_REVIEW",
 *     testSummary: { total: 183, passed: 183, failed: 0 },
 *   });
 */

import type { GateBundleEnvelope, GateEntry } from "./gate-bundle.js";

// ─── Types ──────────────────────────────────────────────────────────────────────

/** Operator's recommended action. */
export type RecommendedAction = "continue" | "intervene" | "stop";

/** Confidence level (maps to 1–5 score). */
export type ConfidenceLevel = "high" | "medium" | "low";

/** Confidence rubric — mirrors review-gate pattern. */
export interface ConfidenceRubric {
	/** 1–5 score (5 = highest confidence). */
	score: 1 | 2 | 3 | 4 | 5;
	/** Human-readable level. */
	level: ConfidenceLevel;
	/** Rationale items explaining the score. */
	rationale: string[];
}

/** Test summary for the scorecard. */
export interface TestSummary {
	/** Total test count. */
	total: number;
	/** Passed test count. */
	passed: number;
	/** Failed test count. */
	failed: number;
}

/** A remediation suggestion for the operator. */
export interface RemediationSuggestion {
	/** Which gate this remediation applies to. */
	gate: string;
	/** What to do. */
	action: string;
	/** Urgency: high = must fix before proceeding. */
	urgency: "high" | "medium" | "low";
}

/**
 * The complete operator scorecard.
 *
 * Designed to be scannable in under one minute.
 */
export interface OperatorScorecard {
	/** Schema version. */
	schemaVersion: "scorecard/v1";
	/** ISO 8601 timestamp when scorecard was generated. */
	generatedAt: string;
	/** Workflow state reached (e.g. "S2 IN_REVIEW"). */
	stateReached: string;
	/** Overall bundle decision. */
	bundleDecision: string;
	/** Recommended operator action. */
	recommendedAction: RecommendedAction;
	/** Blocking reason (empty string if not blocked). */
	blockingReason: string;
	/** Confidence rubric. */
	confidence: ConfidenceRubric;
	/** Time to generate this scorecard in milliseconds. */
	decisionTimeMs: number;

	// ─── Gate summary ────────────────────────────────────────────────────

	/** Per-gate pass/fail/skip status. */
	gates: GateStatusRow[];
	/** Count of blockers raised (error-severity findings). */
	blockersRaised: number;
	/** Count of warnings raised. */
	warningsRaised: number;

	// ─── Test summary ────────────────────────────────────────────────────

	/** Tests executed summary (null if not provided). */
	testsExecuted: TestSummary | null;

	// ─── Remediation ─────────────────────────────────────────────────────

	/** Ordered remediation suggestions. */
	remediations: RemediationSuggestion[];

	// ─── Rendering ───────────────────────────────────────────────────────

	/** Plain-text summary for terminal output. */
	textSummary: string;
}

/** Per-gate status row for the scorecard table. */
export interface GateStatusRow {
	/** Gate name. */
	gate: string;
	/** Status. */
	status: "pass" | "fail" | "skip" | "error";
	/** Required for overall pass? */
	required: boolean;
	/** Finding count. */
	findings: number;
	/** Duration in ms (-1 if unknown). */
	durationMs: number;
}

// ─── Scorecard Input ────────────────────────────────────────────────────────────

/** Input for scorecard generation. */
export interface ScorecardInput {
	/** Workflow state reached. */
	workflowState?: string;
	/** Test summary. */
	testSummary?: TestSummary;
	/** Override timestamp for deterministic testing. */
	timestamp?: string;
}

// ─── Scorecard Generation ───────────────────────────────────────────────────────

/**
 * Generate an operator scorecard from a gate bundle.
 *
 * The scorecard distills the bundle into a format optimized for
 * rapid operator decision-making.
 */
export function generateScorecard(
	bundle: GateBundleEnvelope,
	input?: ScorecardInput,
): OperatorScorecard {
	const startMs = Date.now();
	const timestamp = input?.timestamp ?? new Date().toISOString();

	// Build gate status rows
	const gates = buildGateRows(bundle.gates);

	// Compute blockers / warnings
	const blockersRaised = bundle.summary.errorCount;
	const warningsRaised = bundle.summary.warningCount;

	// Build remediation suggestions
	const remediations = buildRemediations(bundle.gates);

	// Compute confidence
	const confidence = computeConfidence(bundle, input?.testSummary);

	// Determine recommended action
	const recommendedAction = computeRecommendedAction(
		bundle.decision,
		confidence,
		blockersRaised,
	);

	// Determine blocking reason
	const blockingReason = computeBlockingReason(bundle.gates);

	// Calculate decision time
	const decisionTimeMs = Date.now() - startMs;

	// Build text summary
	const textSummary = renderTextSummary({
		stateReached: input?.workflowState ?? "unknown",
		bundleDecision: bundle.decision,
		recommendedAction,
		blockingReason,
		confidence,
		gates,
		blockersRaised,
		warningsRaised,
		testsExecuted: input?.testSummary ?? null,
		remediations,
	});

	return {
		schemaVersion: "scorecard/v1",
		generatedAt: timestamp,
		stateReached: input?.workflowState ?? "unknown",
		bundleDecision: bundle.decision,
		recommendedAction,
		blockingReason,
		confidence,
		decisionTimeMs,
		gates,
		blockersRaised,
		warningsRaised,
		testsExecuted: input?.testSummary ?? null,
		remediations,
		textSummary,
	};
}

/**
 * Validate a scorecard is structurally correct.
 */
export function validateScorecard(scorecard: OperatorScorecard): {
	valid: boolean;
	errors: string[];
} {
	const errors: string[] = [];

	if (scorecard.schemaVersion !== "scorecard/v1") {
		errors.push(
			`Invalid schema version '${scorecard.schemaVersion}', expected 'scorecard/v1'`,
		);
	}

	const validActions: RecommendedAction[] = ["continue", "intervene", "stop"];
	if (!validActions.includes(scorecard.recommendedAction)) {
		errors.push(`Invalid recommended action '${scorecard.recommendedAction}'`);
	}

	if (scorecard.confidence.score < 1 || scorecard.confidence.score > 5) {
		errors.push(
			`Invalid confidence score ${scorecard.confidence.score}, must be 1–5`,
		);
	}

	const validLevels: ConfidenceLevel[] = ["high", "medium", "low"];
	if (!validLevels.includes(scorecard.confidence.level)) {
		errors.push(`Invalid confidence level '${scorecard.confidence.level}'`);
	}

	if (scorecard.decisionTimeMs < 0) {
		errors.push(
			`Invalid decision time ${scorecard.decisionTimeMs}ms, must be >= 0`,
		);
	}

	if (!scorecard.generatedAt || scorecard.generatedAt.trim().length === 0) {
		errors.push("Missing generatedAt timestamp");
	}

	if (scorecard.textSummary.trim().length === 0) {
		errors.push("Empty text summary");
	}

	return { valid: errors.length === 0, errors };
}

// ─── Internal Helpers ───────────────────────────────────────────────────────────

function buildGateRows(gates: GateEntry[]): GateStatusRow[] {
	return gates.map((g) => ({
		gate: g.category,
		status: g.status,
		required: g.required,
		findings: g.findings.length,
		durationMs: g.durationMs,
	}));
}

function buildRemediations(gates: GateEntry[]): RemediationSuggestion[] {
	const remediations: RemediationSuggestion[] = [];

	for (const gate of gates) {
		if (gate.status === "fail" || gate.status === "error") {
			const errorFindings = gate.findings.filter((f) => f.severity === "error");
			const warningFindings = gate.findings.filter(
				(f) => f.severity === "warning",
			);

			if (errorFindings.length > 0) {
				remediations.push({
					gate: gate.category,
					action: buildRemediationAction(gate.category, errorFindings),
					urgency: gate.required ? "high" : "medium",
				});
			} else if (warningFindings.length > 0) {
				remediations.push({
					gate: gate.category,
					action: buildRemediationAction(gate.category, warningFindings),
					urgency: "low",
				});
			} else {
				// Gate failed with no findings — generic remediation
				remediations.push({
					gate: gate.category,
					action: `Investigate ${gate.category} gate failure`,
					urgency: gate.required ? "high" : "medium",
				});
			}
		}

		if (gate.status === "skip" && gate.required) {
			remediations.push({
				gate: gate.category,
				action: `Run the ${gate.category} gate — it was skipped but is required`,
				urgency: "high",
			});
		}
	}

	// Sort by urgency: high first, then medium, then low
	const urgencyOrder: Record<string, number> = {
		high: 0,
		medium: 1,
		low: 2,
	};
	remediations.sort(
		(a, b) => (urgencyOrder[a.urgency] ?? 99) - (urgencyOrder[b.urgency] ?? 99),
	);

	return remediations;
}

function buildRemediationAction(
	category: string,
	findings: Array<{ code: string; message: string }>,
): string {
	if (findings.length === 1 && findings[0]) {
		return `Fix ${category}: ${findings[0].message}`;
	}
	const codes = findings
		.map((f) => f.code)
		.filter((c, i, a) => a.indexOf(c) === i)
		.slice(0, 3);
	const suffix = findings.length > 3 ? ` (+${findings.length - 3} more)` : "";
	return `Fix ${findings.length} ${category} issues: ${codes.join(", ")}${suffix}`;
}

function computeConfidence(
	bundle: GateBundleEnvelope,
	testSummary?: TestSummary,
): ConfidenceRubric {
	let score = 5;
	const rationale: string[] = [];

	// Deduct for failed gates
	if (bundle.summary.failed > 0) {
		score -= Math.min(bundle.summary.failed, 2);
		rationale.push(`${bundle.summary.failed} gate(s) failed`);
	}

	// Deduct for skipped required gates
	const skippedRequired = bundle.gates.filter(
		(g) => g.required && g.status === "skip",
	).length;
	if (skippedRequired > 0) {
		score -= Math.min(skippedRequired, 2);
		rationale.push(`${skippedRequired} required gate(s) were skipped`);
	}

	// Deduct for warnings
	if (bundle.summary.warningCount > 3) {
		score -= 1;
		rationale.push(`${bundle.summary.warningCount} warnings raised`);
	}

	// Boost for test coverage
	if (testSummary && testSummary.total > 0) {
		if (testSummary.failed === 0) {
			rationale.push(`All ${testSummary.total} tests passed`);
		} else {
			score -= 1;
			rationale.push(
				`${testSummary.failed} of ${testSummary.total} tests failed`,
			);
		}
	} else {
		// No test data available
		score -= 1;
		rationale.push("No test summary available");
	}

	// Add positive rationale if everything looks good
	if (bundle.decision === "pass" && rationale.length === 0) {
		rationale.push("All gates passed with no issues");
	}

	// Clamp to 1–5
	score = Math.max(1, Math.min(5, score)) as 1 | 2 | 3 | 4 | 5;

	const level: ConfidenceLevel =
		score >= 4 ? "high" : score >= 3 ? "medium" : "low";

	return { score: score as 1 | 2 | 3 | 4 | 5, level, rationale };
}

function computeRecommendedAction(
	decision: string,
	confidence: ConfidenceRubric,
	blockersRaised: number,
): RecommendedAction {
	// Clear pass with high confidence → continue
	if (decision === "pass" && confidence.score >= 4) {
		return "continue";
	}

	// Blocked → stop
	if (decision === "blocked") {
		return "stop";
	}

	// Failed with many blockers → stop
	if (decision === "fail" && blockersRaised >= 3) {
		return "stop";
	}

	// Failed with few issues or low confidence → intervene
	if (decision === "fail") {
		return "intervene";
	}

	// Pass with low confidence → intervene
	if (decision === "pass" && confidence.score < 4) {
		return "intervene";
	}

	return "intervene";
}

function computeBlockingReason(gates: GateEntry[]): string {
	const blockers: string[] = [];

	for (const gate of gates) {
		if (gate.required && gate.status === "fail") {
			const errorMsgs = gate.findings
				.filter((f) => f.severity === "error")
				.map((f) => f.message);
			if (errorMsgs.length > 0) {
				blockers.push(`${gate.category}: ${errorMsgs.slice(0, 2).join("; ")}`);
			} else {
				blockers.push(`${gate.category}: gate failed`);
			}
		}
		if (gate.required && gate.status === "skip") {
			blockers.push(`${gate.category}: required gate was skipped`);
		}
		if (gate.status === "error") {
			blockers.push(`${gate.category}: gate errored`);
		}
	}

	return blockers.join(" | ");
}

function renderTextSummary(data: {
	stateReached: string;
	bundleDecision: string;
	recommendedAction: RecommendedAction;
	blockingReason: string;
	confidence: ConfidenceRubric;
	gates: GateStatusRow[];
	blockersRaised: number;
	warningsRaised: number;
	testsExecuted: TestSummary | null;
	remediations: RemediationSuggestion[];
}): string {
	const icon =
		data.recommendedAction === "continue"
			? "✅"
			: data.recommendedAction === "intervene"
				? "⚠️"
				: "🛑";

	const lines: string[] = [];
	lines.push("═══════════════════════════════════════════════════");
	lines.push(`${icon}  OPERATOR SCORECARD  ${icon}`);
	lines.push("═══════════════════════════════════════════════════");
	lines.push("");
	lines.push(`  State:       ${data.stateReached}`);
	lines.push(`  Decision:    ${data.bundleDecision.toUpperCase()}`);
	lines.push(`  Action:      ${data.recommendedAction.toUpperCase()}`);
	lines.push(
		`  Confidence:  ${data.confidence.score}/5 (${data.confidence.level})`,
	);
	lines.push("");

	// Gate table
	lines.push("  ┌─────────────┬────────┬──────────┬──────────┐");
	lines.push("  │ Gate        │ Status │ Required │ Findings │");
	lines.push("  ├─────────────┼────────┼──────────┼──────────┤");
	for (const gate of data.gates) {
		const name = gate.gate.padEnd(11);
		const status = `${statusIcon(gate.status)} ${gate.status.padEnd(4)}`;
		const req = gate.required ? "yes" : "no ";
		const findings = String(gate.findings).padStart(4);
		lines.push(`  │ ${name} │ ${status} │   ${req}    │   ${findings}   │`);
	}
	lines.push("  └─────────────┴────────┴──────────┴──────────┘");
	lines.push("");

	// Blockers / warnings
	lines.push(
		`  Blockers: ${data.blockersRaised}    Warnings: ${data.warningsRaised}`,
	);

	// Tests
	if (data.testsExecuted) {
		lines.push(
			`  Tests:    ${data.testsExecuted.passed}/${data.testsExecuted.total} passed${data.testsExecuted.failed > 0 ? ` (${data.testsExecuted.failed} failed)` : ""}`,
		);
	}
	lines.push("");

	// Blocking reason
	if (data.blockingReason) {
		lines.push(`  ⛔ Blocking: ${data.blockingReason}`);
		lines.push("");
	}

	// Confidence rationale
	if (data.confidence.rationale.length > 0) {
		lines.push("  Confidence rationale:");
		for (const r of data.confidence.rationale) {
			lines.push(`    • ${r}`);
		}
		lines.push("");
	}

	// Remediations
	if (data.remediations.length > 0) {
		lines.push("  Remediation:");
		for (const rem of data.remediations) {
			const urgIcon =
				rem.urgency === "high" ? "🔴" : rem.urgency === "medium" ? "🟡" : "🟢";
			lines.push(`    ${urgIcon} [${rem.urgency}] ${rem.action}`);
		}
		lines.push("");
	}

	lines.push("═══════════════════════════════════════════════════");

	return lines.join("\n");
}

function statusIcon(status: string): string {
	switch (status) {
		case "pass":
			return "✓";
		case "fail":
			return "✗";
		case "skip":
			return "○";
		case "error":
			return "!";
		default:
			return "?";
	}
}
