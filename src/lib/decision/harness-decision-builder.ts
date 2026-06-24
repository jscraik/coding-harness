import {
	HARNESS_DECISION_SCHEMA_VERSION,
	type HarnessDecision,
	type HarnessDecisionCockpitLane,
	type HarnessDecisionInput,
	type HarnessDecisionPhase,
	type HarnessDecisionProducer,
} from "./harness-decision-types.js";

function inferDecisionPhase(input: HarnessDecisionInput): HarnessDecisionPhase {
	if (input.phase !== undefined) return input.phase;
	if (input.status === "blocked" || input.status === "fail") return "repair";
	if (input.status === "pass") return "handoff";
	const routingText = [
		input.summary,
		input.nextAction,
		input.nextCommand ?? "",
		input.failureClass ?? "",
	].join(" ");
	if (/\b(review|pr-ready|approval)\b/i.test(routingText)) return "review";
	if (
		/\b(orient|doctor|status|inspect|discover|catalog)\b/i.test(routingText)
	) {
		return "orient";
	}
	return "verify";
}

function cockpitLaneForPhase(
	phase: HarnessDecisionPhase,
): HarnessDecisionCockpitLane {
	return phase === "verify" ? "prove" : phase;
}

function defaultStopConditions(input: HarnessDecisionInput): string[] {
	if (input.stopConditions !== undefined) return input.stopConditions;
	if (input.nextCommand !== null) return [];
	if (input.failureClass !== null) {
		return [`Stop until ${input.failureClass} is resolved.`];
	}
	return ["Stop until the blocked decision has an explicit recovery path."];
}

/**
 * Build a complete `harness-decision/v1` envelope from producer-level intent.
 *
 * Producers provide the actionable recommendation; this helper fills the
 * shared agent-routing fields so command implementations do not duplicate
 * schema plumbing or accidentally emit shallow decision packets.
 */
export function buildHarnessDecision(
	producer: HarnessDecisionProducer,
	input: HarnessDecisionInput,
): HarnessDecision {
	const phase = inferDecisionPhase(input);
	return {
		schemaVersion: HARNESS_DECISION_SCHEMA_VERSION,
		producer,
		...input,
		phase,
		cockpitLane: input.cockpitLane ?? cockpitLaneForPhase(phase),
		objective: input.objective ?? input.nextAction,
		requiredEvidence: input.requiredEvidence ?? input.evidenceRef,
		stopConditions: defaultStopConditions(input),
		humanEscalation:
			input.humanEscalation ?? (input.requiresHuman ? input.nextAction : null),
		followUpCommands: input.followUpCommands ?? [],
		hiddenPlumbing: input.hiddenPlumbing ?? [],
	};
}
