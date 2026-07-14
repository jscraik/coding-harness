import type { AgentReadinessContextHealth } from "../lib/agent-readiness/types.js";
import type { HarnessDecision } from "../lib/decision/harness-decision.js";
import type { HePhaseExit } from "../lib/decision/he-phase-exit.js";
import type { DecisionSource } from "../lib/decision/sources.js";
import type { RuntimeCard } from "../lib/runtime/runtime-card.js";
import {
	SynaipseContextContractError,
	resolveSynaipseContext,
} from "../lib/synaipse/context-plane.js";
import type {
	SynaipseContextProjection,
	SynaipseContextUnknown,
} from "../lib/synaipse/context-projection.js";
import {
	readSynaipseRepositoryName,
	withSynaipseState,
} from "../lib/synaipse/state.js";
import type { HarnessNextPrCloseoutEvidence } from "./next-pr-closeout.js";
import type {
	HarnessNextWorktreeRole,
	HarnessNextEvidenceMode,
} from "./next-args.js";
import {
	changedFilesDecision,
	blockedDecision,
	noChangedFilesDecision,
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
	/** Optional caller-supplied catalog, task snapshot, policy, and observations. */
	synaipseContext?: unknown;
}

/** Resolve supplied task-admitted context before repository inspection begins. */
function resolveNextContext(
	value: unknown,
	repoRoot: string,
): {
	decision: HarnessDecision | null;
	refs: SynaipseContextProjection[];
	unknowns: SynaipseContextUnknown[];
} {
	try {
		const resolution = resolveSynaipseContext(value);
		const targetRepository = readSynaipseRepositoryName(repoRoot);
		if (targetRepository !== resolution.catalogRepository)
			return {
				decision: blockedDecision({
					summary: "SynAIpse context targets a different repository.",
					nextAction: "Rebuild the task context for the target repository.",
					failureClass: "context_project_mismatch",
					evidenceRef: [`repository:${resolution.catalogRepository}`],
				}),
				refs: [],
				unknowns: [],
			};
		if (resolution.status === "resolved")
			return {
				decision: null,
				refs: resolution.selectedRefs,
				unknowns: resolution.unknowns,
			};
		const blocker = resolution.blockers[0];
		return {
			decision: blockedDecision({
				summary: "Required SynAIpse context could not be resolved.",
				nextAction: blocker?.recovery ?? "repair_context_contract",
				failureClass: blocker?.code ?? "context_resolution_blocked",
				evidenceRef: blocker ? [`context:${blocker.contextId}`] : [],
			}),
			refs: resolution.selectedRefs,
			unknowns: resolution.unknowns,
		};
	} catch (error) {
		const detail =
			error instanceof SynaipseContextContractError
				? `${error.path}: ${error.detail}`
				: "context resolution input is invalid";
		return {
			decision: blockedDecision({
				summary: `SynAIpse context contract is malformed: ${detail}.`,
				nextAction:
					"Repair the context packet, then rerun harness next --json.",
				failureClass: "malformed_context",
				evidenceRef: ["context:input"],
			}),
			refs: [],
			unknowns: [],
		};
	}
}

/** Resolve optional context while preserving the no-context compatibility path. */
function resolveOptionalNextContext(value: unknown, repoRoot: string) {
	return value === undefined
		? {
				decision: null,
				refs: [] as SynaipseContextProjection[],
				unknowns: [] as SynaipseContextUnknown[],
			}
		: resolveNextContext(value, repoRoot);
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
	const context = resolveOptionalNextContext(options.synaipseContext, repoRoot);
	if (context.decision)
		return withSynaipseState(
			context.decision,
			repoRoot,
			context.refs,
			context.unknowns,
		);
	const resolution = resolveHarnessNextState(options);
	if (resolution.kind === "decision")
		return withSynaipseState(
			resolution.decision,
			repoRoot,
			context.refs,
			context.unknowns,
		);
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
	return withSynaipseState(decision, repoRoot, context.refs, context.unknowns);
}
