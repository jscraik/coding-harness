import { createNextDecision } from "./next-decision-meta.js";
import type { HarnessDecision } from "../lib/decision/harness-decision.js";
import type { DecisionSource } from "../lib/decision/sources.js";
import { sourceMetaExtra, humanRequiredDecisionMeta } from "./next-support.js";
import type { HarnessNextMode } from "./next-decision-types.js";
import type { HarnessNextWorktreeRole } from "./next-args.js";
import type { NextWorktreeState } from "./next-support.js";

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
			? `ahead ${args.worktreeState.ahead ?? "?"}, behind ${args.worktreeState.behind ?? "?"}`
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
