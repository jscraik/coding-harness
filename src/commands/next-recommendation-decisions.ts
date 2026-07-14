import { COMMAND_CATALOG_SCHEMA_VERSION } from "../lib/cli/registry/command-capabilities.js";
import type { HarnessDecision } from "../lib/decision/harness-decision.js";
import type { HePhaseExit } from "../lib/decision/he-phase-exit.js";
import type { AgentReadinessContextHealth } from "../lib/agent-readiness/types.js";
import type {
	DecisionSource,
	RecommendationCandidate,
} from "../lib/decision/sources.js";
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
import * as agentNativeRatchets from "./next-agent-native-ratchets.js";
import { promptContextDriftDecision } from "./next-prompt-context-drift.js";
import { chooseNextCommandParts, shellQuote } from "./next-support.js";
import type { ChangedFileClassification } from "./next-file-classification.js";

/** Infer the broadest risk tier implied by the changed-file set. */
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

/** Convert changed-file classification into decision metadata for operators. */
function classificationMeta(classification: ChangedFileClassification) {
	return {
		changedFileClassification: classification.byCategory,
		validationFileCount: classification.validationFiles.length,
		excludedChangedFiles: classification.excludedFiles,
		exclusionReasons: classification.exclusionReasons,
	};
}

/**
 * Recommend converting a Harness upgrade matrix artifact into a fleet remediation plan.
 * @param args - Matrix artifact path, mode, and optional normalized evidence metadata
 * @returns A HarnessDecision that directs the operator to run `harness fleet-plan`
 */
export function fleetMatrixArtifactDecision(args: {
	mode: HarnessNextMode;
	matrixArtifact: string;
	phaseExit?: HePhaseExit | undefined;
	runtimeCard?: RuntimeCard | undefined;
	prCloseout?: HarnessNextPrCloseoutEvidence | undefined;
	agentReadinessContext?: AgentReadinessContextHealth | undefined;
}): HarnessDecision {
	const command = `harness fleet-plan --from ${shellQuote(args.matrixArtifact)} --json`;
	return createNextDecision({
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
			extra: prCloseoutDecisionMeta(args.prCloseout),
			agentReadinessContext: args.agentReadinessContext,
		}),
	});
}

/**
 * Builds a passing HarnessDecision for the case where no changed files were found.
 *
 * @param args - Mode, files source, source errors, and optional evidence metadata
 * @returns A passing HarnessDecision that recommends `harness check --json`
 */
export function noChangedFilesDecision(args: {
	mode: HarnessNextMode;
	filesSource: "override" | "git";
	classification?: ChangedFileClassification;
	sourceErrors: readonly DecisionSource[];
	phaseExit?: HePhaseExit | undefined;
	runtimeCard?: RuntimeCard | undefined;
	prCloseout?: HarnessNextPrCloseoutEvidence | undefined;
	agentReadinessContext?: AgentReadinessContextHealth | undefined;
}): HarnessDecision {
	const driftDecision = promptContextDriftDecision(args);
	if (driftDecision) return driftDecision;
	return createNextDecision({
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
			extra: {
				...prCloseoutDecisionMeta(args.prCloseout),
				...(args.classification ? classificationMeta(args.classification) : {}),
			},
			agentReadinessContext: args.agentReadinessContext,
		}),
	});
}

/**
 * Produce an action-required HarnessDecision recommending the next harness command for the given changed files.
 *
 * @param args - Mode, sorted changed files, source errors, and optional evidence metadata
 * @returns A HarnessDecision with the recommended next command and review follow-up
 */
export function changedFilesDecision(args: {
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
	const candidate = createRecommendationCandidate(args);
	const reviewContextFollowUp = chooseNextCommandParts(
		"pr",
		args.files,
	).command;
	const ratchetFollowUpCommands = [
		agentNativeRatchets.SESSION_DISTILL_COMMAND,
		agentNativeRatchets.AGENT_NATIVE_RATCHET_COMMAND,
		args.mode === "pr"
			? "bash scripts/validate-codestyle.sh --fast"
			: reviewContextFollowUp,
	];
	return createNextDecision({
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
		followUpCommands: ratchetFollowUpCommands,
		hiddenPlumbing: [
			"git:status",
			"command-catalog",
			"risk-tier",
			"agent-native-ratchets",
			...(args.phaseExit ? ["he-phase-exit"] : []),
			...(args.runtimeCard ? ["runtime-card"] : []),
			...(args.prCloseout ? ["pr-closeout"] : []),
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
			extra: {
				...prCloseoutDecisionMeta(args.prCloseout),
				...agentNativeRatchets.agentNativeRatchetMeta(),
				...classificationMeta(args.classification),
			},
			agentReadinessContext: args.agentReadinessContext,
		}),
	});
}

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
			extra: classificationMeta(args.classification),
			agentReadinessContext: args.agentReadinessContext,
		}),
	});
}
