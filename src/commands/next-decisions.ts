import { COMMAND_CATALOG_SCHEMA_VERSION } from "../lib/cli/registry/command-capabilities.js";
import {
	buildHarnessDecision,
	type HarnessDecision,
	type HarnessDecisionInput,
} from "../lib/decision/harness-decision.js";
import type { HePhaseExit } from "../lib/decision/he-phase-exit.js";
import type {
	DecisionSource,
	RecommendationCandidate,
} from "../lib/decision/sources.js";
import { normaliseHePhaseExitResult } from "../lib/output/normalise.js";
import {
	normaliseRuntimeCard,
	runtimeCardBlocksContinuation,
	type RuntimeCard,
} from "../lib/runtime/runtime-card.js";
import {
	chooseNextCommandParts,
	decisionMeta,
	humanRequiredDecisionMeta,
	shellQuote,
	sourceMetaExtra,
} from "./next-support.js";

/** Context posture used by `harness next` when selecting a recommendation. */
export type HarnessNextMode = "local" | "pr" | "ci";

/**
 * Produce metadata containing a normalized HE phase-exit result for inclusion in decision `meta`.
 *
 * @param phaseExit - The HE phase-exit evidence to normalize; when `undefined` no metadata is produced
 * @returns An object with `hePhaseExit` set to the normalized phase-exit result, or `undefined` when `phaseExit` is not provided
 */
function phaseExitMeta(
	phaseExit: HePhaseExit | undefined,
): Record<string, unknown> | undefined {
	if (!phaseExit) return undefined;
	return {
		hePhaseExit: normaliseHePhaseExitResult(phaseExit),
	};
}

function runtimeCardMeta(
	runtimeCard: RuntimeCard | undefined,
): Record<string, unknown> | undefined {
	if (!runtimeCard) return undefined;
	return {
		runtimeCard: normaliseRuntimeCard(runtimeCard),
	};
}

/**
 * Builds standardized operational metadata for a `harness next` decision.
 *
 * @param args.mode - Execution mode (`"local" | "pr" | "ci"`) that produced the decision
 * @param args.filesSource - Origin of the changed-files list (`"git"` or `"override"`)
 * @param args.changedFileCount - Number of changed files detected
 * @param args.nextCommandArgv - Argument vector for the proposed next command
 * @param args.frictionClass - Optional friction classification to attach to the meta
 * @param args.delayClass - Optional delay classification to attach to the meta
 * @param args.startupCost - Optional startup cost classification to attach to the meta
 * @param args.commands - List of command strings relevant to the decision
 * @param args.requiresHuman - Whether the decision requires human intervention
 * @param args.sourceErrors - Source diagnostic records to include in meta.extra
 * @param args.phaseExit - Optional HE phase-exit evidence to normalize and include in meta.extra
 * @param args.runtimeCard - Optional runtime-card evidence to normalize and include in meta.extra
 * @returns A decision meta object populated with the provided operational fields and `extra` merged from `sourceErrors`, normalized HE phase-exit evidence, and normalized runtime-card evidence when present
 */
function nextDecisionOperationalMeta(args: {
	mode: HarnessNextMode;
	filesSource?: "override" | "git";
	changedFileCount?: number;
	nextCommandArgv?: string[];
	frictionClass?: Parameters<typeof decisionMeta>[0]["frictionClass"];
	delayClass?: Parameters<typeof decisionMeta>[0]["delayClass"];
	startupCost?: Parameters<typeof decisionMeta>[0]["startupCost"];
	commands?: string[];
	requiresHuman?: boolean;
	sourceErrors?: readonly DecisionSource[];
	phaseExit?: HePhaseExit | undefined;
	runtimeCard?: RuntimeCard | undefined;
}): ReturnType<typeof decisionMeta> {
	return decisionMeta({
		mode: args.mode,
		...(args.filesSource ? { filesSource: args.filesSource } : {}),
		...(args.changedFileCount !== undefined
			? { changedFileCount: args.changedFileCount }
			: {}),
		...(args.nextCommandArgv ? { nextCommandArgv: args.nextCommandArgv } : {}),
		...(args.frictionClass ? { frictionClass: args.frictionClass } : {}),
		...(args.delayClass ? { delayClass: args.delayClass } : {}),
		...(args.startupCost ? { startupCost: args.startupCost } : {}),
		...(args.commands ? { commands: args.commands } : {}),
		...(args.requiresHuman !== undefined
			? { requiresHuman: args.requiresHuman }
			: {}),
		extra: {
			...sourceMetaExtra(args.sourceErrors ?? []),
			...phaseExitMeta(args.phaseExit),
			...runtimeCardMeta(args.runtimeCard),
		},
	});
}

/**
 * Build a standardized HarnessDecision scoped to the "harness next" CLI.
 *
 * @param decision - Input decision fields used to construct the final HarnessDecision
 * @returns A fully formed HarnessDecision with "harness next" as its producer context
 */
function createDecision(decision: HarnessDecisionInput): HarnessDecision {
	return buildHarnessDecision("harness next", decision);
}

function inferRiskTier(files: string[]): HarnessDecision["riskTier"] {
	if (files.length === 0) return "low";
	if (
		files.some((file) =>
			/^(src\/|scripts\/|package\.json$|pnpm-lock\.yaml$|harness\.contract\.json$|\.github\/)/.test(
				file,
			),
		)
	) {
		return "medium";
	}
	return "low";
}

/**
 * Build a `HarnessDecision` representing a blocked, read-only state that requires human intervention.
 *
 * @param summary - Short human-readable summary of why the decision is blocked
 * @param nextAction - Instruction describing the next steps an operator should take
 * @param failureClass - Classification of the failure (e.g., `"source_blocked"`, `"git_state_unavailable"`)
 * @param retry - Suggested retry strategy; defaults to `"manual"`
 * @param evidenceRef - References identifying the evidence for this decision; defaults to `["input:argv"]`
 * @param meta - Optional additional metadata to attach to the decision
 * @returns A `HarnessDecision` with `status: "blocked"`, `safeToRun: false`, `requiresHuman: true`, and other standardized read-only fields populated
 */
export function blockedDecision(args: {
	summary: string;
	nextAction: string;
	failureClass: string;
	retry?: HarnessDecision["retry"];
	evidenceRef?: string[];
	meta?: Record<string, unknown>;
}): HarnessDecision {
	return createDecision({
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
 * @param mode - The invalid mode value passed by the caller.
 * @returns A HarnessDecision with status `"blocked"` that instructs using `--mode local`, `--mode pr`, or `--mode ci` and classifies the failure as `invalid_mode`.
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
 * @param args - Arguments for constructing the blocked decision
 * @param args.mode - The current harness next mode (`"local" | "pr" | "ci"`)
 * @param args.source - The decision source that is blocked; its `ref` is used as evidence and its `failureClass` (if present) is used for the decision's failure classification
 * @param args.sourceErrors - Additional decision source error records to include in the decision meta
 * @returns A `HarnessDecision` with `status: "blocked"` that describes the blocked source, recommends running `harness doctor --json`, and includes metadata about remediation commands and source errors
 */
export function sourceBlockedDecision(args: {
	mode: HarnessNextMode;
	source: DecisionSource;
	sourceErrors: DecisionSource[];
}): HarnessDecision {
	return createDecision({
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
 * @returns A `HarnessDecision` with `status: "blocked"` that points to `harness doctor --json` as the next command, includes `evidenceRef: ["git:status"]`, `failureClass: "git_state_unavailable"`, `retry: "manual"`, and meta describing the git files source and diagnostic command
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
	return createDecision({
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
 * Produce a blocked decision when supplied HE phase-exit evidence says the
 * current phase cannot safely exit or commit.
 *
 * @param args - Phase-exit evidence and ambient harness-next context
 * @returns A blocked HarnessDecision carrying normalized HE phase-exit metadata for operator visibility
 */
export function phaseExitBlockedDecision(args: {
	mode: HarnessNextMode;
	phaseExit: HePhaseExit;
	sourceErrors: DecisionSource[];
}): HarnessDecision {
	const gateResult = normaliseHePhaseExitResult(args.phaseExit);
	const requiresHuman = args.phaseExit.gates.some((gate) => gate.requiresHuman);
	const actionNow =
		gateResult.action_now[0] ??
		"Resolve required HE phase-exit blockers before continuing.";
	return createDecision({
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
 * Produce a blocked decision when supplied runtime-card evidence says the
 * current lifecycle state is blocked, stale, or otherwise unsafe to advance.
 *
 * @param args - Runtime-card evidence and ambient harness-next context
 * @returns A blocked HarnessDecision carrying normalized runtime-card metadata for operator visibility
 */
export function runtimeCardBlockedDecision(args: {
	mode: HarnessNextMode;
	runtimeCard: RuntimeCard;
	sourceErrors: DecisionSource[];
}): HarnessDecision {
	const runtimeBlocked = runtimeCardBlocksContinuation(args.runtimeCard);
	const blockerSummary =
		args.runtimeCard.blockers[0] ??
		(args.runtimeCard.lifecycle === "stale"
			? "Runtime card evidence is stale."
			: "Runtime card lifecycle blocks continuation.");
	return createDecision({
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
 * Recommend converting a Harness upgrade matrix artifact into a fleet remediation plan.
 *
 * @param args.matrixArtifact - Filesystem path to the detected upgrade matrix artifact.
 * @param args.mode - Current operation mode used to populate decision metadata.
 * @param args.phaseExit - Optional normalized HE phase-exit evidence to attach to decision metadata.
 * @param args.runtimeCard - Optional normalized runtime-card evidence to attach to decision metadata.
 * @returns A `HarnessDecision` with `status: "action_required"` that directs running `harness fleet-plan --from <artifact> --json`, references `artifact:<matrixArtifact>` as required evidence, and has `riskTier: "low"`.
 */
export function fleetMatrixArtifactDecision(args: {
	mode: HarnessNextMode;
	matrixArtifact: string;
	phaseExit?: HePhaseExit | undefined;
	runtimeCard?: RuntimeCard | undefined;
}): HarnessDecision {
	const command = `harness fleet-plan --from ${shellQuote(args.matrixArtifact)} --json`;
	return createDecision({
		status: "action_required",
		summary: "Harness upgrade matrix artifact detected.",
		nextAction:
			"Convert the upgrade matrix into an agent-native fleet remediation plan.",
		nextCommand: command,
		phase: "orient",
		objective:
			"Convert the detected upgrade matrix into a safe remediation plan.",
		requiredEvidence: [`artifact:${args.matrixArtifact}`],
		stopConditions: [
			"Stop if fleet-plan cannot parse the upgrade matrix artifact.",
		],
		humanEscalation: null,
		followUpCommands: [],
		hiddenPlumbing: ["artifact-discovery", "fleet-plan"],
		safeToRun: true,
		requiresHuman: false,
		requiresNetwork: false,
		writesFiles: false,
		evidenceRef: [`artifact:${args.matrixArtifact}`],
		failureClass: null,
		retry: "safe",
		riskTier: "low",
		meta: nextDecisionOperationalMeta({
			mode: args.mode,
			nextCommandArgv: [
				"harness",
				"fleet-plan",
				"--from",
				args.matrixArtifact,
				"--json",
			],
			commands: [command],
			phaseExit: args.phaseExit,
			runtimeCard: args.runtimeCard,
		}),
	});
}

/**
 * Builds a passing HarnessDecision for the case where no changed files were found.
 *
 * @param args - Parameters for constructing the decision.
 * @param args.mode - The operating mode (`"local" | "pr" | "ci"`) used to populate meta.
 * @param args.filesSource - Source of the file list; `"git"` when discovered from git, `"override"` when supplied via CLI/options.
 * @param args.sourceErrors - Collected source errors to include in decision meta when present.
 * @returns A `HarnessDecision` with `status: "pass"` that recommends running `harness check --json`, includes evidence referencing the files source, marks the change count as 0, and contains execution/meta details.
 */
export function noChangedFilesDecision(args: {
	mode: HarnessNextMode;
	filesSource: "override" | "git";
	sourceErrors: DecisionSource[];
	phaseExit?: HePhaseExit | undefined;
	runtimeCard?: RuntimeCard | undefined;
}): HarnessDecision {
	return createDecision({
		status: "pass",
		summary: "No changed files detected.",
		nextAction: "Run harness check --json to confirm repo readiness.",
		nextCommand: "harness check --json",
		phase: "handoff",
		objective:
			"Confirm the repository is ready when no changed files are detected.",
		requiredEvidence: [
			args.filesSource === "git" ? "git:status" : "input:files",
			"harness check --json output",
		],
		stopConditions: ["Stop if harness check reports a blocked or failed gate."],
		humanEscalation: null,
		followUpCommands: [],
		hiddenPlumbing: ["git:status", "check"],
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
			changedFileCount: 0,
			commands: ["harness check --json"],
			sourceErrors: args.sourceErrors,
			phaseExit: args.phaseExit,
			runtimeCard: args.runtimeCard,
		}),
	});
}

interface NextRecommendationCandidate extends RecommendationCandidate {
	argv: string[];
}

function createRecommendationCandidate(args: {
	mode: HarnessNextMode;
	files: string[];
	filesSource: "override" | "git";
}): NextRecommendationCandidate {
	const nextCommand = chooseNextCommandParts(args.mode, args.files);
	return {
		command: nextCommand.command,
		argv: nextCommand.argv,
		reason:
			args.mode === "pr"
				? "Generate reviewer context for the changed files."
				: "Generate a repo-canonical validation plan for the changed files.",
		sourceRefs: [
			args.filesSource === "git" ? "git:status" : "input:files",
			`command-catalog:${COMMAND_CATALOG_SCHEMA_VERSION}`,
		],
		score: args.mode === "pr" ? 80 : 90,
		riskTier: inferRiskTier(args.files),
		safeToRun: true,
		requiresHuman: false,
		requiresNetwork: false,
		writesFiles: false,
	};
}

/**
 * Produce an action-required HarnessDecision recommending the next harness command for the given changed files.
 *
 * @param args - Input arguments
 * @param args.mode - Execution mode (`"local"`, `"pr"`, or `"ci"`)
 * @param args.files - Sorted list of changed file paths to base the recommendation on
 * @param args.filesSource - Origin of `files`: `"override"` when provided by CLI, `"git"` when discovered from git status
 * @param args.sourceErrors - Collected DecisionSource entries describing any source errors encountered while gathering inputs
 * @returns A `HarnessDecision` with `status: "action_required"`, a recommended `nextCommand` and `nextAction`, evidence references, risk tier, and `meta` containing `changedFileCount`, `nextCommandArgv`, and related command metadata
 */
export function changedFilesDecision(args: {
	mode: HarnessNextMode;
	files: string[];
	filesSource: "override" | "git";
	sourceErrors: DecisionSource[];
	phaseExit?: HePhaseExit | undefined;
	runtimeCard?: RuntimeCard | undefined;
}): HarnessDecision {
	const candidate = createRecommendationCandidate(args);
	const reviewContextFollowUp = chooseNextCommandParts(
		"pr",
		args.files,
	).command;
	return createDecision({
		status: "action_required",
		summary: `Detected ${args.files.length} changed file${args.files.length === 1 ? "" : "s"}.`,
		nextAction: candidate.reason,
		nextCommand: candidate.command,
		phase: args.mode === "pr" ? "review" : "verify",
		objective:
			args.mode === "pr"
				? "Prepare reviewer-facing context for the changed files."
				: "Produce the repo-canonical validation plan for the changed files.",
		requiredEvidence: [...candidate.sourceRefs, `${candidate.command} output`],
		stopConditions: [
			`Stop if ${args.mode === "pr" ? "review-context" : "validation-plan"} cannot produce JSON for the changed files.`,
		],
		humanEscalation: null,
		followUpCommands:
			args.mode === "pr"
				? ["bash scripts/validate-codestyle.sh --fast"]
				: [reviewContextFollowUp],
		hiddenPlumbing: [
			"git:status",
			"command-catalog",
			"risk-tier",
			...(args.phaseExit ? ["he-phase-exit"] : []),
			...(args.runtimeCard ? ["runtime-card"] : []),
		],
		safeToRun: candidate.safeToRun,
		requiresHuman: candidate.requiresHuman,
		requiresNetwork: candidate.requiresNetwork,
		writesFiles: candidate.writesFiles,
		evidenceRef: candidate.sourceRefs,
		failureClass: null,
		retry: "safe",
		riskTier: candidate.riskTier,
		meta: nextDecisionOperationalMeta({
			mode: args.mode,
			filesSource: args.filesSource,
			changedFileCount: args.files.length,
			nextCommandArgv: candidate.argv,
			commands: candidate.command ? [candidate.command] : [],
			sourceErrors: args.sourceErrors,
			phaseExit: args.phaseExit,
			runtimeCard: args.runtimeCard,
		}),
	});
}
