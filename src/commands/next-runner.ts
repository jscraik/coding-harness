import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { cwd } from "node:process";
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
import {
	type HarnessNextEvidenceMode,
	isHarnessNextMode,
} from "./next-args.js";
import {
	humanRequiredDecisionMeta,
	optionalNetworkSources,
	parseGitStatusShort,
	sourceMetaExtra,
} from "./next-support.js";
import {
	blockedDecision,
	changedFilesDecision,
	fleetMatrixArtifactDecision,
	gitInspectionBlockedDecision,
	invalidModeDecision,
	noChangedFilesDecision,
	phaseExitBlockedDecision,
	runtimeCardBlockedDecision,
	sourceBlockedDecision,
	type HarnessNextMode,
} from "./next-decisions.js";
import { requiredEvidenceMissingDecision } from "./next-usage-errors.js";

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
	/** Evidence strictness for phase-exit and runtime-card inputs. */
	evidenceMode?: HarnessNextEvidenceMode;
}

const DEFAULT_FLEET_MATRIX_ARTIFACT =
	"artifacts/harness-upgrade-matrix-dev.json";

type ChangedFilesResult = {
	files: string[];
	filesSource: "override" | "git";
};

function inspectGitChangedFiles(repoRoot: string): string[] {
	const output = execFileSync(
		"git",
		["status", "--short", "--untracked-files=all"],
		{
			cwd: repoRoot,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 10_000,
		},
	);
	return parseGitStatusShort(output);
}

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

function resolveChangedFiles(
	repoRoot: string,
	options: HarnessNextOptions,
): ChangedFilesResult {
	if (options.files !== undefined) {
		return { files: [...options.files].sort(), filesSource: "override" };
	}
	return {
		files: (options.inspectChangedFiles ?? inspectGitChangedFiles)(repoRoot),
		filesSource: "git",
	};
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

/**
 * Produce a HarnessDecision recommending the next Harness command or explaining why no safe action can be taken.
 *
 * @param options - Configuration for decision production.
 * @returns A HarnessDecision describing the next action or the blocking condition.
 */
export function runHarnessNext(
	options: HarnessNextOptions = {},
): HarnessDecision {
	const repoRoot = options.repoRoot ?? cwd();
	const mode = options.mode ?? "local";
	if (!isHarnessNextMode(mode)) return invalidModeDecision(String(mode));

	const allSources = [
		...(options.decisionSources ?? []),
		...optionalNetworkSources(mode),
	];
	const sourceErrors = collectSourceErrors(allSources);
	const blockingSource = findBlockingSource(sourceErrors);
	if (blockingSource) {
		return sourceBlockedDecision({
			mode,
			source: blockingSource,
			sourceErrors,
		});
	}

	const evidenceBlock = evidenceBlockedDecision({
		mode,
		options,
		sourceErrors,
	});
	if (evidenceBlock) return evidenceBlock;
	if (options.files !== undefined && options.files.length === 0) {
		return filesOverrideEmptyDecision(mode, sourceErrors);
	}
	if (
		options.files === undefined &&
		mode === "ci" &&
		existsSync(join(repoRoot, DEFAULT_FLEET_MATRIX_ARTIFACT))
	) {
		return fleetMatrixArtifactDecision({
			mode,
			matrixArtifact: DEFAULT_FLEET_MATRIX_ARTIFACT,
			...(options.phaseExit ? { phaseExit: options.phaseExit } : {}),
			...(options.runtimeCard ? { runtimeCard: options.runtimeCard } : {}),
		});
	}

	let changedFiles: ChangedFilesResult;
	try {
		changedFiles = resolveChangedFiles(repoRoot, options);
	} catch {
		return gitInspectionBlockedDecision(mode);
	}
	return changedFiles.files.length === 0
		? noChangedFilesDecision({
				mode,
				sourceErrors,
				...changedFiles,
				...(options.phaseExit ? { phaseExit: options.phaseExit } : {}),
				...(options.runtimeCard ? { runtimeCard: options.runtimeCard } : {}),
			})
		: changedFilesDecision({
				mode,
				sourceErrors,
				...changedFiles,
				...(options.phaseExit ? { phaseExit: options.phaseExit } : {}),
				...(options.runtimeCard ? { runtimeCard: options.runtimeCard } : {}),
			});
}
