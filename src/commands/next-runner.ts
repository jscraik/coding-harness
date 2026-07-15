import type { AgentReadinessContextHealth } from "../lib/agent-readiness/types.js";
import type { HarnessDecision } from "../lib/decision/harness-decision.js";
import type { HePhaseExit } from "../lib/decision/he-phase-exit.js";
import type { DecisionSource } from "../lib/decision/sources.js";
import type { RuntimeCard } from "../lib/runtime/runtime-card.js";
import {
	readSynaipseRepositoryName,
	withSynaipseState,
} from "../lib/synaipse/state.js";
import type { HarnessNextPrCloseoutEvidence } from "./next-pr-closeout.js";
import { operatorLocalOnlyDecision } from "./next-operator-local-decision.js";
import type {
	HarnessNextWorktreeRole,
	HarnessNextEvidenceMode,
} from "./next-args.js";
import {
	changedFilesDecision,
	noChangedFilesDecision,
	type HarnessNextMode,
} from "./next-decisions.js";
import {
	resolveHarnessNextState,
	type HarnessNextReadyState,
} from "./next-runner-state.js";
import { resolveOptionalNextContext } from "./next-synaipse-context.js";

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
	/** Test seam for the read-only repository identity adapter. */
	readRepositoryName?: (repoRoot: string) => string | null;
}

/** Build shared evidence metadata for recommendation decisions. */
function decisionContext(resolution: HarnessNextReadyState) {
	return {
		mode: resolution.mode,
		sourceErrors: resolution.sourceErrors,
		...(resolution.phaseExit ? { phaseExit: resolution.phaseExit } : {}),
		...(resolution.runtimeCard ? { runtimeCard: resolution.runtimeCard } : {}),
		...(resolution.prCloseout ? { prCloseout: resolution.prCloseout } : {}),
		agentReadinessContext: resolution.agentReadinessContext,
	};
}

/** Produce the recommendation for changes excluded as operator-local state. */
function operatorLocalOnlyNextDecision(
	resolution: HarnessNextReadyState,
): HarnessDecision {
	return operatorLocalOnlyDecision({
		...decisionContext(resolution),
		files: resolution.changedFiles.files,
		filesSource: resolution.changedFiles.filesSource,
		classification: resolution.changedFiles.classification,
	});
}

/** Produce the recommendation for validation-relevant changed files. */
function changedFilesNextDecision(
	resolution: HarnessNextReadyState,
): HarnessDecision {
	const { changedFiles } = resolution;
	return changedFilesDecision({
		...decisionContext(resolution),
		files: changedFiles.classification.validationFiles,
		filesSource: changedFiles.filesSource,
		classification: changedFiles.classification,
	});
}

/** Produce the recommendation for a clean repository with no changed files. */
function noChangedFilesNextDecision(
	resolution: HarnessNextReadyState,
): HarnessDecision {
	const { changedFiles } = resolution;
	return noChangedFilesDecision({
		...decisionContext(resolution),
		filesSource: changedFiles.filesSource,
		classification: changedFiles.classification,
	});
}

/** Return whether every observed change is excluded from default validation. */
function hasOnlyExcludedChangedFiles(
	resolution: HarnessNextReadyState,
): boolean {
	const { changedFiles } = resolution;
	return (
		changedFiles.files.length > 0 &&
		changedFiles.classification.validationFiles.length === 0
	);
}

/** Select the empty or validation-relevant changed-file recommendation. */
function changedFilesRecommendation(
	resolution: HarnessNextReadyState,
): HarnessDecision {
	return resolution.changedFiles.files.length === 0
		? noChangedFilesNextDecision(resolution)
		: changedFilesNextDecision(resolution);
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
	const context = resolveOptionalNextContext(
		options.synaipseContext,
		repoRoot,
		options.readRepositoryName ?? readSynaipseRepositoryName,
	);
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
	const decision = hasOnlyExcludedChangedFiles(resolution)
		? operatorLocalOnlyNextDecision(resolution)
		: changedFilesRecommendation(resolution);
	return withSynaipseState(decision, repoRoot, context.refs, context.unknowns);
}
