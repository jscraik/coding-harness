import { COMMAND_CATALOG_SCHEMA_VERSION } from "../lib/cli/registry/command-capabilities.js";
import {
	buildHarnessDecision,
	type HarnessDecision,
	type HarnessDecisionInput,
} from "../lib/decision/harness-decision.js";
import type {
	DecisionSource,
	RecommendationCandidate,
} from "../lib/decision/sources.js";
import {
	chooseNextCommandParts,
	decisionMeta,
	shellQuote,
	sourceMetaExtra,
} from "./next-support.js";

/** Context posture used by `harness next` when selecting a recommendation. */
export type HarnessNextMode = "local" | "pr" | "ci";

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
		meta: decisionMeta({
			mode,
			frictionClass: "unclear_instruction",
			delayClass: "human_needed",
			startupCost: "none",
			requiresHuman: true,
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
 * Produce a decision recommending conversion of a Harness upgrade matrix artifact into a fleet remediation plan.
 *
 * @param args.mode - The current harness next mode (`"local" | "pr" | "ci"`) used to populate decision metadata.
 * @param args.matrixArtifact - Filesystem path to the detected upgrade matrix artifact.
 * @returns A `HarnessDecision` with `status: "action_required"` that includes a `nextCommand` invoking `harness fleet-plan --from <artifact> --json`, execution metadata, evidence referencing the artifact, and a low risk tier.
 */
export function fleetMatrixArtifactDecision(args: {
	mode: HarnessNextMode;
	matrixArtifact: string;
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
		meta: decisionMeta({
			mode: args.mode,
			nextCommandArgv: [
				"harness",
				"fleet-plan",
				"--from",
				args.matrixArtifact,
				"--json",
			],
			commands: [command],
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
		meta: decisionMeta({
			mode: args.mode,
			filesSource: args.filesSource,
			changedFileCount: 0,
			commands: ["harness check --json"],
			extra: sourceMetaExtra(args.sourceErrors),
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
		hiddenPlumbing: ["git:status", "command-catalog", "risk-tier"],
		safeToRun: candidate.safeToRun,
		requiresHuman: candidate.requiresHuman,
		requiresNetwork: candidate.requiresNetwork,
		writesFiles: candidate.writesFiles,
		evidenceRef: candidate.sourceRefs,
		failureClass: null,
		retry: "safe",
		riskTier: candidate.riskTier,
		meta: decisionMeta({
			mode: args.mode,
			filesSource: args.filesSource,
			changedFileCount: args.files.length,
			nextCommandArgv: candidate.argv,
			commands: candidate.command ? [candidate.command] : [],
			extra: sourceMetaExtra(args.sourceErrors),
		}),
	});
}
