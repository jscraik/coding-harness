import type { HeGateResult, HePhaseExit } from "../decision/he-phase-exit.js";
import { buildGateResult, uniqueStrings } from "./normalise-core.js";
import type { GateFinding, GateResult } from "./types.js";

/**
 * Derives the canonical gate status for a HE phase-exit aggregation result.
 *
 * @param result - The HE phase-exit result used to evaluate blockers, recommendation, and warnings
 * @returns `fail` if `result.blockers` is non-empty or `result.recommendation` is not `"continue"`; `warn` if there are warnings and no blockers and the recommendation is `"continue"`; `pass` otherwise
 */
function phaseExitStatus(result: HePhaseExit): GateResult["status"] {
	if (result.blockers.length > 0 || result.recommendation !== "continue") {
		return "fail";
	}
	return result.warnings.length > 0 ? "warn" : "pass";
}

/**
 * Create a GateFinding representing a HE phase-exit blocker or warning.
 *
 * @param message - The human-readable issue message to include in the finding
 * @param index - The zero-based index used to build a deterministic finding id
 * @param kind - Whether the issue is a `"blocker"` (error) or `"warning"`
 * @returns A `GateFinding` with a deterministic `id`, appropriate `severity`, `failureClass`, and a `fix.manual` guidance string
 */
function adaptPhaseExitIssue(
	message: string,
	index: number,
	kind: "blocker" | "warning",
): GateFinding {
	return {
		id: `he-phase-exit.${kind}.${index}`,
		severity: kind === "blocker" ? "error" : "warning",
		gate: "he-phase-exit",
		message,
		baseline: false,
		failureClass:
			kind === "blocker" ? "phase_exit_blocked" : "phase_exit_warning",
		fix: {
			manual:
				kind === "blocker"
					? "Resolve the blocking HE gate evidence, then rerun phase-exit aggregation."
					: "Review optional HE gate warning before handoff.",
			suppressible: false,
		},
	};
}

/**
 * Produce operator-facing immediate action steps based on the HE phase-exit recommendation.
 *
 * @param result - HE phase-exit decision whose `recommendation` and `warnings` determine the returned actions
 * @returns An array of immediate action strings to present to operators; empty when no immediate action is required
 */
function phaseExitActionNow(result: HePhaseExit): string[] {
	switch (result.recommendation) {
		case "continue":
			return result.warnings.length > 0
				? ["Review optional HE phase-exit warnings before handoff."]
				: [];
		case "human_review_required":
			return [
				"Run the required human review gate, record artifact-backed evidence, then rerun phase-exit aggregation.",
			];
		case "commit_blocked":
			return [
				"Resolve required HE phase-exit blockers before commit readiness.",
			];
		case "stop":
			return [
				"Stop the current HE phase and repair the blocking gate evidence before continuing.",
			];
	}
}

/**
 * Produce a blocker-style `GateFinding` for the HE phase-exit recommendation when it prevents automatic continuation and there are no explicit blockers.
 *
 * @param result - The HE phase-exit decision whose `recommendation` and `blockers` are evaluated
 * @returns An array containing a single `GateFinding` for the recommendation when `recommendation` is not `"continue"` and `blockers` is empty; otherwise an empty array
 */
function phaseExitRecommendationFinding(result: HePhaseExit): GateFinding[] {
	if (result.recommendation === "continue" || result.blockers.length > 0) {
		return [];
	}
	return [
		adaptPhaseExitIssue(
			`HE phase exit recommendation is ${result.recommendation}.`,
			0,
			"blocker",
		),
	];
}

/**
 * Synthesizes GateFinding entries for an HE phase-exit result.
 *
 * Builds a list that first includes a recommendation finding when applicable, followed by one finding per blocker and one per warning.
 *
 * @param result - The HE phase-exit outcome containing recommendation, blockers, and warnings
 * @returns An array of `GateFinding` representing the recommendation (optional), blockers, and warnings in that order
 */
function phaseExitFindings(result: HePhaseExit): GateFinding[] {
	return [
		...phaseExitRecommendationFinding(result),
		...result.blockers.map((blocker, index) =>
			adaptPhaseExitIssue(blocker, index, "blocker"),
		),
		...result.warnings.map((warning, index) =>
			adaptPhaseExitIssue(warning, index, "warning"),
		),
	];
}

/**
 * Builds an operator-facing reason message describing the HE phase-exit outcome.
 *
 * @param result - The HE phase-exit decision containing `blockers`, `warnings`, and `recommendation`
 * @returns A human-readable reason explaining whether the HE phase exit is blocked, blocked by recommendation, may continue with warnings, or passed with all required evidence
 */
function phaseExitReason(result: HePhaseExit): string {
	if (result.blockers.length > 0) {
		return `HE phase exit is blocked: ${result.blockers.join("; ")}`;
	}
	if (result.recommendation !== "continue") {
		return `HE phase exit is blocked by recommendation: ${result.recommendation}`;
	}
	if (result.warnings.length > 0) {
		return `HE phase exit may continue with warnings: ${result.warnings.join("; ")}`;
	}
	return "HE phase exit passed with all required gate evidence satisfied.";
}

/**
 * Builds a de-duplicated list of evidence reference identifiers for an HE phase-exit result.
 *
 * @param result - The HE phase-exit decision containing `schemaVersion`, `recommendation`, and `gates` (each with `gateId`, `status`, and `evidenceRefs`).
 * @returns Unique evidence reference strings: schema version (`schema:<schemaVersion>`), recommendation (`recommendation:<recommendation>`), per-gate status (`gate:<gateId>:<status>`), and per-gate evidence ids (`gate-evidence:<gateId>:<ref.id>`).
 */
function phaseExitEvidenceRefs(result: HePhaseExit): string[] {
	return uniqueStrings([
		`schema:${result.schemaVersion}`,
		`recommendation:${result.recommendation}`,
		...result.gates.map((gate) => `gate:${gate.gateId}:${gate.status}`),
		...result.gates.flatMap((gate) =>
			gate.evidenceRefs.map((ref) => `gate-evidence:${gate.gateId}:${ref.id}`),
		),
	]);
}

/**
 * Builds a concise summary object for each HE gate containing key metadata and evidence reference ids.
 *
 * @param gates - The list of HE gate results to summarize
 * @returns An array of per-gate summary objects with the properties: `gateId`, `required`, `executionMode`, `status`, `safeToContinue`, `requiresHuman`, `reason`, `blockedReason`, and `evidenceRefs` (an array of evidence reference ids)
 */
function phaseExitGateSummary(
	gates: HeGateResult[],
): Record<string, unknown>[] {
	return gates.map((gate) => ({
		gateId: gate.gateId,
		required: gate.required,
		executionMode: gate.executionMode,
		status: gate.status,
		safeToContinue: gate.safeToContinue,
		requiresHuman: gate.requiresHuman,
		reason: gate.reason,
		blockedReason: gate.blockedReason,
		evidenceRefs: gate.evidenceRefs.map((ref) => ref.id),
	}));
}

/**
 * Normalize a validated HE phase-exit decision into a canonical GateResult for operator visibility.
 *
 * Produces a GateResult that exposes phase-exit findings, compact evidence references, per-gate summary metadata,
 * and operator-facing decision guidance (reason, immediate actions, and suggested re-run).
 *
 * @param result - The validated HE phase-exit decision to convert
 * @returns A canonical GateResult representing phase-exit findings, metadata, and operator decisions
 */
export function normaliseHePhaseExitResult(result: HePhaseExit): GateResult {
	const gate = "he-phase-exit";
	const findings = phaseExitFindings(result);

	return buildGateResult({
		gate,
		status: phaseExitStatus(result),
		findings,
		meta: {
			schemaVersion: result.schemaVersion,
			phase: result.phaseContext.phase,
			failingEvidencePresent: result.phaseContext.failingEvidencePresent,
			reviewFeedbackPresent: result.phaseContext.reviewFeedbackPresent,
			recommendation: result.recommendation,
			commitAllowed: result.commitAllowed,
			exitAllowed: result.exitAllowed,
			gateSummary: phaseExitGateSummary(result.gates),
		},
		decision: {
			reason: phaseExitReason(result),
			actionNow: phaseExitActionNow(result),
			actionLater: [
				"Re-run HE phase-exit aggregation after the next gate evidence change.",
			],
			evidenceRef: phaseExitEvidenceRefs(result),
		},
	});
}
