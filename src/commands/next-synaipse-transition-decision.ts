import type { HarnessDecision } from "../lib/decision/harness-decision.js";
import type { SynaipseValidationError } from "../lib/synaipse/lifecycle.js";
import type { HarnessNextMode } from "./next-decision-types.js";
import { nextDecisionOperationalMeta } from "./next-decision-meta.js";
import { createNextDecision } from "./next-decision-meta.js";

/** Route one lifecycle transition through Codex repair or the Vital Decision Gate. */
export function synaipseTransitionBlockedDecision(args: {
	mode: HarnessNextMode;
	vitalDecision: boolean;
	validationErrors: readonly SynaipseValidationError[];
}): HarnessDecision {
	const vitalDecision = args.vitalDecision;
	return createNextDecision({
		status: "blocked",
		summary: vitalDecision
			? "SynAIpse Vital Decision requires operator input."
			: "SynAIpse transition evidence blocks continuation.",
		nextAction: vitalDecision
			? "Provide one bounded decision for the Vital Decision Gate, then rerun harness next --json."
			: "Refresh the current-SHA transition evidence, repair the lifecycle packet, then rerun harness next --json.",
		nextCommand: null,
		phase: "repair",
		objective: vitalDecision
			? "Pause routine automation until the operator resolves the Vital Decision."
			: "Restore a valid current-SHA lifecycle transition before continuing.",
		requiredEvidence: ["synaipse-transition/v1", "repository HEAD SHA"],
		stopConditions: [
			vitalDecision
				? "Stop until the Vital Decision has one bounded operator response."
				: "Stop until transition validation passes against the current repository SHA.",
		],
		humanEscalation: vitalDecision
			? "A Vital Decision is the only lifecycle condition that interrupts Jamie."
			: null,
		followUpCommands: ["harness next --json"],
		hiddenPlumbing: ["synaipse-transition/v1", "current-sha-binding"],
		safeToRun: false,
		requiresHuman: vitalDecision,
		requiresNetwork: false,
		writesFiles: false,
		evidenceRef: ["synaipse-transition/v1"],
		failureClass: vitalDecision
			? "synaipse_vital_decision"
			: "synaipse_transition_invalid",
		retry: "manual",
		riskTier: vitalDecision ? "high" : "medium",
		meta: nextDecisionOperationalMeta({
			mode: args.mode,
			frictionClass: vitalDecision
				? "unclear_instruction"
				: "validation_failure",
			delayClass: vitalDecision ? "human_needed" : "normal",
			requiresHuman: vitalDecision,
			extra: {
				validationErrors: args.validationErrors,
			},
		}),
	});
}
