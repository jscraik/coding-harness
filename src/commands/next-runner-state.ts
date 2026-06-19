import { existsSync } from "node:fs";
import { join } from "node:path";
import { cwd } from "node:process";
import { buildContextHealthProjection } from "../lib/agent-readiness/context-health.js";
import type { AgentReadinessContextHealth } from "../lib/agent-readiness/types.js";
import type { HarnessDecision } from "../lib/decision/harness-decision.js";
import type { HePhaseExit } from "../lib/decision/he-phase-exit.js";
import {
	type DecisionSource,
	collectSourceErrors,
	findBlockingSource,
} from "../lib/decision/sources.js";
import {
	runtimeCardBlocksContinuation,
	type RuntimeCard,
} from "../lib/runtime/runtime-card.js";
import type { HarnessNextEvidenceMode } from "./next-args.js";
import { isHarnessNextMode } from "./next-args.js";
import {
	blockedDecision,
	fleetMatrixArtifactDecision,
	gitInspectionBlockedDecision,
	invalidModeDecision,
	phaseExitBlockedDecision,
	runtimeCardBlockedDecision,
	sourceBlockedDecision,
	worktreeStateBlockedDecision,
	type HarnessNextMode,
} from "./next-decisions.js";
import {
	blocksDirtyWorktree,
	inspectWorktreeState,
	resolveChangedFiles,
	type ChangedFilesResult,
} from "./next-runner-inputs.js";
import type { HarnessNextOptions } from "./next-runner.js";
import {
	humanRequiredDecisionMeta,
	optionalNetworkSources,
	sourceMetaExtra,
} from "./next-support.js";
import { requiredEvidenceMissingDecision } from "./next-usage-errors.js";

const DEFAULT_FLEET_MATRIX_ARTIFACT =
	"artifacts/harness-upgrade-matrix-dev.json";

/** Fully resolved, non-blocked input state for selecting a harness-next recommendation. */
export interface HarnessNextReadyState {
	/** Discriminant for state that can safely continue to recommendation selection. */
	kind: "ready";
	/** Repository root used for local git and artifact inspection. */
	repoRoot: string;
	/** Validated harness-next context posture. */
	mode: HarnessNextMode;
	/** Non-blocking source errors to surface in the final decision metadata. */
	sourceErrors: readonly DecisionSource[];
	/** Resolved changed-file set and the authority used to produce it. */
	changedFiles: ChangedFilesResult;
	/** Optional HE phase-exit evidence already accepted by the state resolver. */
	phaseExit?: HePhaseExit;
	/** Optional runtime-card evidence already accepted by the state resolver. */
	runtimeCard?: RuntimeCard;
	/** Orientation-only agent readiness context to attach to final metadata. */
	agentReadinessContext: AgentReadinessContextHealth;
}

/** Result of resolving harness-next input state before final recommendation selection. */
export type HarnessNextStateResolution =
	| HarnessNextReadyState
	| {
			/** Discriminant for a terminal decision produced during state resolution. */
			kind: "decision";
			/** Blocking or special-case decision to return directly to the operator. */
			decision: HarnessDecision;
	  };

function requiredEvidenceMissing(
	mode: HarnessNextMode,
	evidenceMode: HarnessNextEvidenceMode | undefined,
	options: Pick<HarnessNextOptions, "phaseExit" | "runtimeCard">,
): string[] {
	const resolvedEvidenceMode =
		evidenceMode ?? (mode === "local" ? "optional" : "required");
	if (resolvedEvidenceMode !== "required") return [];
	return [
		...(options.phaseExit ? [] : ["phase-exit"]),
		...(options.runtimeCard ? [] : ["runtime-card"]),
	];
}

function evidenceBlockedDecision(args: {
	mode: HarnessNextMode;
	options: HarnessNextOptions;
	sourceErrors: readonly DecisionSource[];
}): HarnessDecision | null {
	if (
		args.options.phaseExit &&
		(!args.options.phaseExit.commitAllowed ||
			!args.options.phaseExit.exitAllowed)
	) {
		return phaseExitBlockedDecision({
			mode: args.mode,
			phaseExit: args.options.phaseExit,
			sourceErrors: args.sourceErrors,
		});
	}
	if (
		args.options.runtimeCard &&
		runtimeCardBlocksContinuation(args.options.runtimeCard)
	) {
		return runtimeCardBlockedDecision({
			mode: args.mode,
			runtimeCard: args.options.runtimeCard,
			sourceErrors: args.sourceErrors,
		});
	}
	const missing = requiredEvidenceMissing(
		args.mode,
		args.options.evidenceMode,
		args.options,
	);
	return missing.length > 0
		? requiredEvidenceMissingDecision({
				mode: args.mode,
				missing,
				sourceErrors: args.sourceErrors,
			})
		: null;
}

function filesOverrideEmptyDecision(
	mode: HarnessNextMode,
	sourceErrors: readonly DecisionSource[],
): HarnessDecision {
	return blockedDecision({
		summary: "--files did not include any paths.",
		nextAction:
			"Pass one or more changed files, or omit --files so harness next can inspect git state.",
		failureClass: "files_override_empty",
		evidenceRef: ["input:files"],
		meta: humanRequiredDecisionMeta({
			mode,
			filesSource: "override",
			frictionClass: "unclear_instruction",
			extra: sourceMetaExtra(sourceErrors),
		}),
	});
}

function changedFileOptions(options: HarnessNextOptions): {
	files?: string[];
	inspectChangedFiles?: (repoRoot: string) => string[];
} {
	return {
		...(options.files !== undefined ? { files: options.files } : {}),
		...(options.inspectChangedFiles !== undefined
			? { inspectChangedFiles: options.inspectChangedFiles }
			: {}),
	};
}

function directDecision(decision: HarnessDecision): HarnessNextStateResolution {
	return { kind: "decision", decision };
}

function worktreeBlockedDecision(args: {
	repoRoot: string;
	mode: HarnessNextMode;
	options: HarnessNextOptions;
	sourceErrors: readonly DecisionSource[];
}): HarnessDecision | null {
	if (args.options.inspectChangedFiles !== undefined) return null;
	try {
		const worktreeState = inspectWorktreeState(args.repoRoot);
		return blocksDirtyWorktree(args.options.worktreeRole, worktreeState)
			? worktreeStateBlockedDecision({
					mode: args.mode,
					worktreeState,
					role: args.options.worktreeRole ?? "clean",
					sourceErrors: args.sourceErrors,
				})
			: null;
	} catch {
		return gitInspectionBlockedDecision(args.mode);
	}
}

function fleetMatrixDecision(args: {
	repoRoot: string;
	mode: HarnessNextMode;
	options: HarnessNextOptions;
	agentReadinessContext: AgentReadinessContextHealth;
}): HarnessDecision | null {
	if (args.options.files !== undefined || args.mode !== "ci") return null;
	if (!existsSync(join(args.repoRoot, DEFAULT_FLEET_MATRIX_ARTIFACT)))
		return null;
	return fleetMatrixArtifactDecision({
		mode: args.mode,
		matrixArtifact: DEFAULT_FLEET_MATRIX_ARTIFACT,
		...(args.options.phaseExit ? { phaseExit: args.options.phaseExit } : {}),
		...(args.options.runtimeCard
			? { runtimeCard: args.options.runtimeCard }
			: {}),
		agentReadinessContext: args.agentReadinessContext,
	});
}

function readyState(args: {
	repoRoot: string;
	mode: HarnessNextMode;
	options: HarnessNextOptions;
	sourceErrors: readonly DecisionSource[];
	agentReadinessContext: AgentReadinessContextHealth;
}): HarnessNextReadyState {
	return {
		kind: "ready",
		repoRoot: args.repoRoot,
		mode: args.mode,
		sourceErrors: args.sourceErrors,
		changedFiles: resolveChangedFiles(
			args.repoRoot,
			changedFileOptions(args.options),
		),
		...(args.options.phaseExit ? { phaseExit: args.options.phaseExit } : {}),
		...(args.options.runtimeCard
			? { runtimeCard: args.options.runtimeCard }
			: {}),
		agentReadinessContext: args.agentReadinessContext,
	};
}

/**
 * Resolve and validate all local state needed before harness next selects a recommendation.
 *
 * @param options - Runner options controlling mode, file overrides, evidence, sources, and worktree posture.
 * @returns Either a terminal decision or a ready state for recommendation selection.
 */
export function resolveHarnessNextState(
	options: HarnessNextOptions = {},
): HarnessNextStateResolution {
	const repoRoot = options.repoRoot ?? cwd();
	const mode = options.mode ?? "local";
	if (!isHarnessNextMode(mode)) {
		return directDecision(invalidModeDecision(String(mode)));
	}

	const agentReadinessContext =
		options.agentReadinessContext ?? buildContextHealthProjection(repoRoot);
	const allSources = [
		...(options.decisionSources ?? []),
		...optionalNetworkSources(mode),
	];
	const sourceErrors = collectSourceErrors(allSources);
	const blockingSource = findBlockingSource(sourceErrors);
	if (blockingSource) {
		return directDecision(
			sourceBlockedDecision({ mode, source: blockingSource, sourceErrors }),
		);
	}

	const evidenceBlock = evidenceBlockedDecision({
		mode,
		options,
		sourceErrors,
	});
	if (evidenceBlock) return directDecision(evidenceBlock);
	if (options.files !== undefined && options.files.length === 0) {
		return directDecision(filesOverrideEmptyDecision(mode, sourceErrors));
	}

	const worktreeBlock = worktreeBlockedDecision({
		repoRoot,
		mode,
		options,
		sourceErrors,
	});
	if (worktreeBlock) return directDecision(worktreeBlock);

	const fleetMatrixBlock = fleetMatrixDecision({
		repoRoot,
		mode,
		options,
		agentReadinessContext,
	});
	if (fleetMatrixBlock) return directDecision(fleetMatrixBlock);

	try {
		return readyState({
			repoRoot,
			mode,
			options,
			sourceErrors,
			agentReadinessContext,
		});
	} catch {
		return directDecision(gitInspectionBlockedDecision(mode));
	}
}
