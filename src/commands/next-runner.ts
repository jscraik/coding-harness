import type { AgentReadinessContextHealth } from "../lib/agent-readiness/types.js";
import type { HarnessDecision } from "../lib/decision/harness-decision.js";
import type { HePhaseExit } from "../lib/decision/he-phase-exit.js";
import type { DecisionSource } from "../lib/decision/sources.js";
import type { RuntimeCard } from "../lib/runtime/runtime-card.js";
import {
	readSynaipseRepositorySha,
	withSynaipseState,
} from "../lib/synaipse/state.js";
import {
	isSynaipseVitalDecision,
	validateSynaipseTransition,
} from "../lib/synaipse/lifecycle.js";
import type { HarnessNextPrCloseoutEvidence } from "./next-pr-closeout.js";
import type {
	HarnessNextWorktreeRole,
	HarnessNextEvidenceMode,
} from "./next-args.js";
import {
	changedFilesDecision,
	noChangedFilesDecision,
	synaipseTransitionBlockedDecision,
	type HarnessNextMode,
} from "./next-decisions.js";
import { resolveHarnessNextState } from "./next-runner-state.js";

/** Options for the read-only harness next decision producer. */
export interface HarnessNextOptions {
	/** Optional context posture. Defaults to local. */
	mode?: HarnessNextMode;
	/** Optional changed-file override; when omitted, git state is inspected. */
	files?: string[];
	/** Repository root for git inspection. Defaults to the current directory. */
	repoRoot?: string;
	/** Test hook or alternate changed-file provider. */
	inspectChangedFiles?: (repoRoot: string) => string[];
	/** Test hook or future normalized source provider. */
	decisionSources?: DecisionSource[];
	/** Optional HE phase-exit evidence already collected by the caller. */
	phaseExit?: HePhaseExit;
	/** Optional runtime-card evidence already collected by the caller. */
	runtimeCard?: RuntimeCard;
	/** Optional pr-closeout/v1 evidence already collected by the caller. */
	prCloseout?: HarnessNextPrCloseoutEvidence;
	/** Optional orientation-only readiness context already collected by the caller. */
	agentReadinessContext?: AgentReadinessContextHealth;
	/** Evidence strictness for phase-exit and runtime-card inputs. */
	evidenceMode?: HarnessNextEvidenceMode;
	/** Worktree posture requested for next recommendations. */
	worktreeRole?: HarnessNextWorktreeRole;
	/** Optional lifecycle transition evidence to route before ordinary recommendations. */
	synaipseTransition?: unknown;
}

function resolveSynaipseTransitionDecision(
	options: HarnessNextOptions,
	repoRoot: string,
): HarnessDecision | undefined {
	if (options.synaipseTransition === undefined) return undefined;
	const currentSha = readSynaipseRepositorySha(repoRoot);
	const validation =
		currentSha === null
			? {
					valid: false,
					errors: [
						{
							path: "repository.sha",
							message: "current repository SHA is unavailable",
						},
					],
				}
			: validateSynaipseTransition(options.synaipseTransition, currentSha);
	const vitalDecision =
		currentSha !== null &&
		isSynaipseVitalDecision(options.synaipseTransition, currentSha);
	if (validation.valid && !vitalDecision) return undefined;
	return withSynaipseState(
		synaipseTransitionBlockedDecision({
			mode: options.mode ?? "local",
			vitalDecision,
			validationErrors: validation.errors,
		}),
		repoRoot,
	);
}

/**
 * Produce a HarnessDecision recommending the next Harness command or explaining why no safe action can be taken.
 *
 * @param options - Configuration for decision production.
 * @returns A HarnessDecision describing the next action or the blocking condition.
 */
export function runHarnessNext(
	options: HarnessNextOptions = {},
): HarnessDecision {
	const repoRoot = options.repoRoot ?? process.cwd();
	const synaipseDecision = resolveSynaipseTransitionDecision(options, repoRoot);
	if (synaipseDecision !== undefined) return synaipseDecision;
	const resolution = resolveHarnessNextState(options);
	if (resolution.kind === "decision")
		return withSynaipseState(resolution.decision, repoRoot);
	const { changedFiles } = resolution;
	const decision =
		changedFiles.files.length === 0
			? noChangedFilesDecision({
					mode: resolution.mode,
					sourceErrors: resolution.sourceErrors,
					...changedFiles,
					...(resolution.phaseExit ? { phaseExit: resolution.phaseExit } : {}),
					...(resolution.runtimeCard
						? { runtimeCard: resolution.runtimeCard }
						: {}),
					...(resolution.prCloseout
						? { prCloseout: resolution.prCloseout }
						: {}),
					agentReadinessContext: resolution.agentReadinessContext,
				})
			: changedFilesDecision({
					mode: resolution.mode,
					sourceErrors: resolution.sourceErrors,
					...changedFiles,
					...(resolution.phaseExit ? { phaseExit: resolution.phaseExit } : {}),
					...(resolution.runtimeCard
						? { runtimeCard: resolution.runtimeCard }
						: {}),
					...(resolution.prCloseout
						? { prCloseout: resolution.prCloseout }
						: {}),
					agentReadinessContext: resolution.agentReadinessContext,
				});
	return withSynaipseState(decision, repoRoot);
}
