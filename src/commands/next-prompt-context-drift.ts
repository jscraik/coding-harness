import type { HarnessDecision } from "../lib/decision/harness-decision.js";
import type { HePhaseExit } from "../lib/decision/he-phase-exit.js";
import type { AgentReadinessContextHealth } from "../lib/agent-readiness/types.js";
import type { DecisionSource } from "../lib/decision/sources.js";
import type { RuntimeCard } from "../lib/runtime/runtime-card.js";
import {
	prCloseoutDecisionMeta,
	type HarnessNextPrCloseoutEvidence,
} from "./next-pr-closeout.js";
import {
	createNextDecision,
	nextDecisionOperationalMeta,
} from "./next-decision-meta.js";
import type { HarnessNextMode } from "./next-decision-types.js";

interface PromptContextDriftDecisionArgs {
	mode: HarnessNextMode;
	filesSource: "override" | "git";
	sourceErrors: readonly DecisionSource[];
	phaseExit?: HePhaseExit | undefined;
	runtimeCard?: RuntimeCard | undefined;
	prCloseout?: HarnessNextPrCloseoutEvidence | undefined;
	agentReadinessContext?: AgentReadinessContextHealth | undefined;
}

function promptContextDriftRefreshCommand(
	contextHealth: AgentReadinessContextHealth | undefined,
): { command: string; evidenceRef: string[] } | null {
	const surface = contextHealth?.surfaces.find(
		(candidate) =>
			candidate.id === "prompt_context_drift" &&
			candidate.status !== "pass" &&
			candidate.evidence.length > 0 &&
			candidate.suggestedRefreshCommands.length > 0,
	);
	if (!surface) return null;
	return {
		command: surface.suggestedRefreshCommands[0] as string,
		evidenceRef: surface.evidence,
	};
}

/** Build a next-step decision when prompt-context drift should block clean-worktree handoff. */
export function promptContextDriftDecision(
	args: PromptContextDriftDecisionArgs,
): HarnessDecision | undefined {
	const promptContextRefresh = promptContextDriftRefreshCommand(
		args.agentReadinessContext,
	);
	if (!promptContextRefresh) return undefined;

	const sourceRef = args.filesSource === "git" ? "git:status" : "input:files";
	return createNextDecision({
		status: "action_required",
		summary:
			"No changed files detected, but prompt-context orientation is stale.",
		nextAction:
			"Refresh the prompt-context drift report before using clean-worktree context for handoff.",
		nextCommand: promptContextRefresh.command,
		phase: "orient",
		objective:
			"Refresh degraded prompt-context orientation before relying on the clean-worktree handoff path.",
		requiredEvidence: [sourceRef, ...promptContextRefresh.evidenceRef],
		stopConditions: [
			"Stop if prompt-context drift validation still reports stale or invalid context.",
		],
		humanEscalation: null,
		followUpCommands: ["harness check --json"],
		hiddenPlumbing: ["git:status", "prompt_context_drift", "check"],
		safeToRun: true,
		requiresHuman: false,
		requiresNetwork: false,
		writesFiles: false,
		evidenceRef: [sourceRef, ...promptContextRefresh.evidenceRef],
		failureClass: null,
		retry: "safe",
		riskTier: "low",
		meta: nextDecisionOperationalMeta({
			mode: args.mode,
			filesSource: args.filesSource,
			changedFileCount: 0,
			commands: [promptContextRefresh.command],
			frictionClass: "repo_state",
			delayClass: "normal",
			phaseExit: args.phaseExit,
			runtimeCard: args.runtimeCard,
			extra: prCloseoutDecisionMeta(args.prCloseout),
			agentReadinessContext: args.agentReadinessContext,
			sourceErrors: args.sourceErrors,
		}),
	});
}
