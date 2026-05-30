import type { HarnessDecision } from "../lib/decision/harness-decision.js";
import type { HePhaseExit } from "../lib/decision/he-phase-exit.js";
import type { DecisionSource } from "../lib/decision/sources.js";
import { normaliseHePhaseExitResult } from "../lib/output/normalise.js";
import {
	runtimeCardBlocksContinuation,
	type RuntimeCard,
} from "../lib/runtime/runtime-card.js";
import {
	createNextDecision,
	nextDecisionOperationalMeta,
} from "./next-decision-meta.js";
import type { HarnessNextMode } from "./next-decision-types.js";
import type { HarnessNextWorktreeRole } from "./next-args.js";
import {
	type NextWorktreeState,
	decisionMeta,
	humanRequiredDecisionMeta,
	sourceMetaExtra,
} from "./next-support.js";

/**
 * Build a `HarnessDecision` representing a blocked, read-only state that requires human intervention.
 *
 * @param args - Blocking summary, next action, failure class, retry posture, evidence references, and optional metadata
 * @returns A blocked HarnessDecision with standardized read-only fields populated
 */
export function blockedDecision(args: {
	summary: string;
	nextAction: string;
	failureClass: string;
	retry?: HarnessDecision["retry"];
	evidenceRef?: string[];
	meta?: Record<string, unknown>;
}): HarnessDecision {
	return createNextDecision({
		status: "blocked",
		summary: args.summary,
		nextAction: args.nextAction,
		nextCommand: null,
		safeToRun: false,
		requiresHuman: true,
		requiresNetwork: false,
		writesFiles: false,
		evidenceRef: args.evidenceRef ?? ["input:argv"],
		failureClass: args.failureClass,
		retry: args.retry ?? "manual",
		riskTier: "unknown",
		...(args.meta ? { meta: args.meta } : {}),
	});
}

/**
 * Produce a blocked decision signaling that the provided mode is unsupported.
 *
 * @param mode - The invalid mode value passed by the caller
 * @returns A HarnessDecision that instructs using a supported harness-next mode
 */
export function invalidModeDecision(mode: string): HarnessDecision {
	return blockedDecision({
		summary: `Unsupported next mode: ${mode}.`,
		nextAction: "Use --mode local, --mode pr, or --mode ci.",
		failureClass: "invalid_mode",
		meta: humanRequiredDecisionMeta({
			mode,
			frictionClass: "unclear_instruction",
		}),
	});
}

/**
 * Produce a blocked HarnessDecision when a required decision source is unavailable.
 *
 * @param args - Source evidence and ambient harness-next mode for constructing the blocked decision
 * @returns A blocked HarnessDecision that points the operator to `harness doctor --json`
 */
export function sourceBlockedDecision(args: {
	mode: HarnessNextMode;
	source: DecisionSource;
	sourceErrors: DecisionSource[];
}): HarnessDecision {
	return createNextDecision({
		status: "blocked",
		summary: `Required decision source is blocked: ${args.source.ref}.`,
		nextAction:
			"Run harness doctor --json, fix the reported source issue, then retry harness next --json.",
		nextCommand: "harness doctor --json",
		phase: "repair",
		objective: "Restore usable decision sources before choosing workflow work.",
		requiredEvidence: [args.source.ref, "harness doctor --json output"],
		stopConditions: [
			`Stop if ${args.source.failureClass ?? "source_blocked"} remains blocked after harness doctor.`,
		],
		humanEscalation: null,
		followUpCommands: ["harness next --json"],
		hiddenPlumbing: ["decision-sources", "source-error-ranking"],
		safeToRun: true,
		requiresHuman: false,
		requiresNetwork: false,
		writesFiles: false,
		evidenceRef: [args.source.ref],
		failureClass: args.source.failureClass ?? "source_blocked",
		retry: "manual",
		riskTier: "unknown",
		meta: decisionMeta({
			mode: args.mode,
			frictionClass: "repo_state",
			delayClass: "human_needed",
			commands: ["harness doctor --json"],
			extra: sourceMetaExtra(args.sourceErrors),
		}),
	});
}

/**
 * Create a blocked decision indicating the repository git state could not be inspected.
 *
 * @param mode - The current Harness next mode used to populate decision metadata
 * @returns A blocked HarnessDecision that points to `harness doctor --json` as the next command
 */
export function gitInspectionBlockedDecision(
	mode: HarnessNextMode,
): HarnessDecision {
	const gitSourceError: DecisionSource = {
		kind: "git",
		ref: "git:status",
		freshness: "unknown",
		sha: null,
		status: "blocked",
		failureClass: "git_state_unavailable",
	};
	return createNextDecision({
		status: "blocked",
		summary: "Git state could not be inspected.",
		nextAction:
			"Run harness doctor --json, fix the reported setup issue, then retry harness next --json.",
		nextCommand: "harness doctor --json",
		phase: "repair",
		objective: "Restore git-state visibility before choosing workflow work.",
		requiredEvidence: ["git:status", "harness doctor --json output"],
		stopConditions: [
			"Stop if git_state_unavailable remains after harness doctor.",
		],
		humanEscalation: null,
		followUpCommands: ["harness next --json"],
		hiddenPlumbing: ["git:status", "decision-source-errors"],
		safeToRun: true,
		requiresHuman: false,
		requiresNetwork: false,
		writesFiles: false,
		evidenceRef: ["git:status"],
		failureClass: "git_state_unavailable",
		retry: "manual",
		riskTier: "unknown",
		meta: decisionMeta({
			mode,
			filesSource: "git",
			frictionClass: "repo_state",
			delayClass: "human_needed",
			commands: ["harness doctor --json"],
			extra: sourceMetaExtra([gitSourceError]),
		}),
	});
}

/**
 * Produce a blocked decision when supplied HE phase-exit evidence says the current phase cannot safely exit or commit.
 *
 * @param args - Phase-exit evidence and ambient harness-next context
 * @returns A blocked HarnessDecision carrying normalized HE phase-exit metadata
 */
export function phaseExitBlockedDecision(args: {
	mode: HarnessNextMode;
	phaseExit: HePhaseExit;
	sourceErrors: readonly DecisionSource[];
}): HarnessDecision {
	const gateResult = normaliseHePhaseExitResult(args.phaseExit);
	const requiresHuman = args.phaseExit.gates.some((gate) => gate.requiresHuman);
	const actionNow =
		gateResult.action_now[0] ??
		"Resolve required HE phase-exit blockers before continuing.";
	return createNextDecision({
		status: "blocked",
		summary: "HE phase-exit evidence blocks continuation.",
		nextAction: actionNow,
		nextCommand: null,
		phase: "repair",
		objective:
			"Resolve required HE phase-exit evidence before choosing workflow work.",
		requiredEvidence: gateResult.evidence_ref,
		stopConditions: [
			"Stop until HE phase-exit aggregation reports commitAllowed=true and exitAllowed=true.",
		],
		humanEscalation: requiresHuman
			? "HE phase-exit evidence requires human review before continuing."
			: null,
		followUpCommands: ["harness next --json"],
		hiddenPlumbing: ["he-phase-exit", "gate-normalizer"],
		safeToRun: false,
		requiresHuman: requiresHuman,
		requiresNetwork: false,
		writesFiles: false,
		evidenceRef: gateResult.evidence_ref,
		failureClass: "he_phase_exit_blocked",
		retry: "manual",
		riskTier: "medium",
		meta: nextDecisionOperationalMeta({
			mode: args.mode,
			frictionClass: "validation_failure",
			delayClass: requiresHuman ? "human_needed" : "normal",
			startupCost: "none",
			requiresHuman: requiresHuman,
			sourceErrors: args.sourceErrors,
			phaseExit: args.phaseExit,
		}),
	});
}

/**
 * Produce a blocked decision when supplied runtime-card evidence says the current lifecycle is unsafe to advance.
 *
 * @param args - Runtime-card evidence and ambient harness-next context
 * @returns A blocked HarnessDecision carrying normalized runtime-card metadata
 */
export function runtimeCardBlockedDecision(args: {
	mode: HarnessNextMode;
	runtimeCard: RuntimeCard;
	sourceErrors: readonly DecisionSource[];
}): HarnessDecision {
	const runtimeBlocked = runtimeCardBlocksContinuation(args.runtimeCard);
	const blockerSummary =
		args.runtimeCard.blockers[0] ??
		(args.runtimeCard.lifecycle === "stale"
			? "Runtime card evidence is stale."
			: "Runtime card lifecycle blocks continuation.");
	return createNextDecision({
		status: "blocked",
		summary: "Runtime card evidence blocks continuation.",
		nextAction: args.runtimeCard.nextSafeAction,
		nextCommand: null,
		phase: "repair",
		objective:
			"Resolve current runtime blockers before choosing workflow work.",
		requiredEvidence: args.runtimeCard.sources.map((source) => source.ref),
		stopConditions: [
			"Stop until runtime-card/v1 reports no blockers and a non-blocking lifecycle.",
		],
		humanEscalation: runtimeBlocked ? blockerSummary : null,
		followUpCommands: ["harness next --json"],
		hiddenPlumbing: ["runtime-card", "decision-sources"],
		safeToRun: false,
		requiresHuman: true,
		requiresNetwork: false,
		writesFiles: false,
		evidenceRef: args.runtimeCard.sources.map((source) => source.ref),
		failureClass: "runtime_card_blocked",
		retry: "manual",
		riskTier: "medium",
		meta: nextDecisionOperationalMeta({
			mode: args.mode,
			frictionClass: "repo_state",
			delayClass: "human_needed",
			startupCost: "none",
			requiresHuman: true,
			sourceErrors: args.sourceErrors,
			runtimeCard: args.runtimeCard,
		}),
	});
}

/**
 * Produce a blocked decision when the repo worktree is dirty, out of sync,
 * or otherwise mismatched against the requested worktree role.
 *
 * @param args - Current context, worktree role, and inspected worktree state
 * @returns A blocked HarnessDecision with explicit cleanup guidance and next actions
 */
export function worktreeStateBlockedDecision(args: {
	mode: HarnessNextMode;
	role: HarnessNextWorktreeRole;
	worktreeState: NextWorktreeState;
	sourceErrors: readonly DecisionSource[];
}): HarnessDecision {
	const branch = args.worktreeState.branch ?? "<detached>";
	const upstream = args.worktreeState.upstream ?? "<not-tracked>";
	const drift =
		(args.worktreeState.ahead ?? 0) + (args.worktreeState.behind ?? 0) > 0
			? `ahead ${args.worktreeState.ahead ?? "?"}, behind ${
					args.worktreeState.behind ?? "?"
				}`
			: "in-sync";
	const cleanState = args.worktreeState.clean
		? "clean"
		: "dirty or uncommitted-worktree";
	return createNextDecision({
		status: "blocked",
		summary: `Worktree state blocks recommendations for role ${args.role}.`,
		nextAction:
			args.role === "dirty-with-justification"
				? "Track this change under another role and rerun with --worktree-role dirty-with-justification."
				: `Use --worktree-role dirty-with-justification, then rerun harness next --json, or align branch ${branch} to ${upstream}.`,
		nextCommand: null,
		phase: "repair",
		objective:
			"Resolve worktree drift before recommending local next commands.",
		requiredEvidence: ["git:status"],
		stopConditions: [
			"Stop if requested worktree role and repository state are aligned.",
		],
		humanEscalation: `Worktree ${cleanState} on ${branch}; ${drift}.`,
		followUpCommands: ["harness next --json"],
		hiddenPlumbing: ["git:status", "worktree-role"],
		safeToRun: false,
		requiresHuman: true,
		requiresNetwork: false,
		writesFiles: false,
		evidenceRef: ["git:status"],
		failureClass: "worktree_state_blocked",
		retry: "manual",
		riskTier: "medium",
		meta: humanRequiredDecisionMeta({
			mode: args.mode,
			filesSource: "git",
			frictionClass: "repo_state",
			extra: {
				...sourceMetaExtra(args.sourceErrors),
				worktreeState: args.worktreeState,
				worktreeRole: args.role,
			},
		}),
	});
}
