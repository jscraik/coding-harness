import type { AgentReadinessContextHealth } from "../lib/agent-readiness/types.js";
import type { HarnessDecision } from "../lib/decision/harness-decision.js";
import type { HePhaseExit } from "../lib/decision/he-phase-exit.js";
import type { DecisionSource } from "../lib/decision/sources.js";
import type { RuntimeCard } from "../lib/runtime/runtime-card.js";
import type { HarnessNextPrCloseoutEvidence } from "./next-pr-closeout.js";
import {
	createNextDecision,
	nextDecisionOperationalMeta,
} from "./next-decision-meta.js";
import type { HarnessNextMode } from "./next-decision-types.js";
import {
	changedFileClassificationMeta,
	type ChangedFileClassification,
} from "./next-file-classification.js";

/** Recommend cleanup or explicit inclusion when only non-validation files changed. */
export function operatorLocalOnlyDecision(args: {
	mode: HarnessNextMode;
	files: string[];
	filesSource: "override" | "git";
	classification: ChangedFileClassification;
	sourceErrors: readonly DecisionSource[];
	phaseExit?: HePhaseExit | undefined;
	runtimeCard?: RuntimeCard | undefined;
	prCloseout?: HarnessNextPrCloseoutEvidence | undefined;
	agentReadinessContext?: AgentReadinessContextHealth | undefined;
}): HarnessDecision {
	return createNextDecision({
		status: "action_required",
		summary: `Detected ${args.files.length} changed file${args.files.length === 1 ? "" : "s"}; none require default validation.`,
		nextAction:
			"Review the operator-local, private-memory, or generated paths; clean or ignore them, or pass an explicit --files override when they are intentionally in scope.",
		nextCommand: "harness check --json",
		phase: "orient",
		objective: "Separate local operator state from validation-relevant work.",
		requiredEvidence: [
			args.filesSource === "git" ? "git:status" : "input:files",
			"changed-file-classification",
		],
		stopConditions: [
			"Stop if an excluded path is actually part of the intended change and has not been explicitly included.",
		],
		humanEscalation: null,
		followUpCommands: ["harness check --json"],
		hiddenPlumbing: ["git:status", "changed-file-classification"],
		safeToRun: true,
		requiresHuman: false,
		requiresNetwork: false,
		writesFiles: false,
		evidenceRef: [args.filesSource === "git" ? "git:status" : "input:files"],
		failureClass: null,
		retry: "safe",
		riskTier: "low",
		meta: nextDecisionOperationalMeta({
			mode: args.mode,
			filesSource: args.filesSource,
			changedFileCount: args.files.length,
			commands: ["harness check --json"],
			sourceErrors: args.sourceErrors,
			phaseExit: args.phaseExit,
			runtimeCard: args.runtimeCard,
			extra: changedFileClassificationMeta(args.classification),
			agentReadinessContext: args.agentReadinessContext,
		}),
	});
}
