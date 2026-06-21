import type { HarnessDecision } from "../lib/decision/harness-decision.js";
import type { HePhaseExit } from "../lib/decision/he-phase-exit.js";
import type { AgentReadinessContextHealth } from "../lib/agent-readiness/types.js";
import type { DecisionSource } from "../lib/decision/sources.js";
import type { RuntimeCard } from "../lib/runtime/runtime-card.js";
import { PROMPT_CONTEXT_DRIFT_REPORT_PATHS } from "../lib/prompt-context-drift/index.js";
import {
	prCloseoutDecisionMeta,
	type HarnessNextPrCloseoutEvidence,
} from "./next-pr-closeout.js";
import {
	createNextDecision,
	nextDecisionOperationalMeta,
} from "./next-decision-meta.js";
import type { HarnessNextMode } from "./next-decision-types.js";

interface PromptContextDriftDecisionArgs {
	mode: HarnessNextMode;
	filesSource: "override" | "git";
	sourceErrors: readonly DecisionSource[];
	phaseExit?: HePhaseExit | undefined;
	runtimeCard?: RuntimeCard | undefined;
	prCloseout?: HarnessNextPrCloseoutEvidence | undefined;
	agentReadinessContext?: AgentReadinessContextHealth | undefined;
}

const TRUSTED_PROMPT_CONTEXT_REFRESH_COMMANDS = new Set([
	"harness prompt-context-drift:write",
	"harness artifact-routine --active-index .harness/active-artifacts.md --json",
	"harness brain status --json",
	"harness runtime-card --json --repo . --out artifacts/runtime-card.json",
]);
const WRITING_PROMPT_CONTEXT_REFRESH_COMMANDS = new Set([
	"harness prompt-context-drift:write",
	"harness runtime-card --json --repo . --out artifacts/runtime-card.json",
]);
const TRUSTED_PROMPT_CONTEXT_REPORT_PATHS: ReadonlySet<string> = new Set(
	PROMPT_CONTEXT_DRIFT_REPORT_PATHS,
);

function promptContextDriftRefreshCommand(
	contextHealth: AgentReadinessContextHealth | undefined,
): { command: string; evidenceRef: string[] } | null {
	const surface = contextHealth?.surfaces.find(
		(candidate) =>
			candidate.id === "prompt_context_drift" &&
			candidate.status !== "pass" &&
			candidate.evidence.length > 0 &&
			candidate.suggestedRefreshCommands.length > 0,
	);
	if (!surface) return null;
	const command = surface.suggestedRefreshCommands[0]?.trim();
	if (!command) return null;
	return {
		command,
		evidenceRef: surface.evidence,
	};
}

function isTrustedRefreshCommand(
	command: string,
	evidenceRefs: readonly string[],
): boolean {
	const normalized = command.trim();
	if (TRUSTED_PROMPT_CONTEXT_REFRESH_COMMANDS.has(normalized)) return true;
	const cleanup = normalized.match(/^rm (\S+)$/u);
	if (
		cleanup?.[1] !== undefined &&
		TRUSTED_PROMPT_CONTEXT_REPORT_PATHS.has(cleanup[1]) &&
		evidenceRefs.includes(cleanup[1]) &&
		evidenceRefs.some(
			(ref) =>
				ref !== cleanup[1] && TRUSTED_PROMPT_CONTEXT_REPORT_PATHS.has(ref),
		)
	) {
		return true;
	}
	const alternate = normalized.match(
		/^harness prompt-context-drift:write --output (\S+)$/u,
	);
	return (
		alternate?.[1] !== undefined &&
		TRUSTED_PROMPT_CONTEXT_REPORT_PATHS.has(alternate[1])
	);
}

function refreshCommandWritesFiles(command: string): boolean {
	const normalized = command.trim();
	if (WRITING_PROMPT_CONTEXT_REFRESH_COMMANDS.has(normalized)) return true;
	if (normalized.match(/^rm (\S+)$/u)) return true;
	return Boolean(
		normalized.match(/^harness prompt-context-drift:write --output (\S+)$/u),
	);
}

function validateCommandForEvidence(
	evidenceRefs: readonly string[],
	refreshCommand: string,
): string {
	return `harness prompt-context-drift:validate ${reportPathForEvidence(evidenceRefs, refreshCommand)}`;
}

function reportPathForEvidence(
	evidenceRefs: readonly string[],
	refreshCommand: string,
): string {
	const cleanupPath = refreshCommand.match(/^rm (\S+)$/u)?.[1];
	const reportPath = evidenceRefs.find(
		(ref) =>
			TRUSTED_PROMPT_CONTEXT_REPORT_PATHS.has(ref) && ref !== cleanupPath,
	);
	return reportPath ?? PROMPT_CONTEXT_DRIFT_REPORT_PATHS[0];
}

function writeCommandForEvidence(
	evidenceRefs: readonly string[],
	refreshCommand: string,
): string {
	const reportPath = reportPathForEvidence(evidenceRefs, refreshCommand);
	return reportPath === PROMPT_CONTEXT_DRIFT_REPORT_PATHS[0]
		? "harness prompt-context-drift:write"
		: `harness prompt-context-drift:write --output ${reportPath}`;
}

function refreshCommandWritesPromptContextReport(command: string): boolean {
	const normalized = command.trim();
	if (normalized === "harness prompt-context-drift:write") return true;
	return Boolean(
		normalized.match(/^harness prompt-context-drift:write --output (\S+)$/u),
	);
}

function refreshCommandDeletesPromptContextReport(command: string): boolean {
	return Boolean(command.trim().match(/^rm (\S+)$/u));
}

function followUpCommandsForEvidence(
	evidenceRefs: readonly string[],
	refreshCommand: string,
): string[] {
	const validationCommand = validateCommandForEvidence(
		evidenceRefs,
		refreshCommand,
	);
	if (
		refreshCommandWritesPromptContextReport(refreshCommand) ||
		refreshCommandDeletesPromptContextReport(refreshCommand)
	) {
		return [validationCommand, "harness check --json"];
	}
	return [
		writeCommandForEvidence(evidenceRefs, refreshCommand),
		validationCommand,
		"harness check --json",
	];
}

/** Build a next-step decision when prompt-context drift should block clean-worktree handoff. */
export function promptContextDriftDecision(
	args: PromptContextDriftDecisionArgs,
): HarnessDecision | undefined {
	const promptContextRefresh = promptContextDriftRefreshCommand(
		args.agentReadinessContext,
	);
	if (!promptContextRefresh) return undefined;

	const sourceRef = args.filesSource === "git" ? "git:status" : "input:files";
	const trustedCommand = isTrustedRefreshCommand(
		promptContextRefresh.command,
		promptContextRefresh.evidenceRef,
	);
	const writesFiles = refreshCommandWritesFiles(promptContextRefresh.command);
	return createNextDecision({
		status: "action_required",
		summary:
			"No changed files detected, but prompt-context orientation is stale.",
		nextAction:
			"Refresh the prompt-context drift report before using clean-worktree context for handoff.",
		nextCommand: promptContextRefresh.command,
		phase: "orient",
		objective:
			"Refresh degraded prompt-context orientation before relying on the clean-worktree handoff path.",
		requiredEvidence: [sourceRef, ...promptContextRefresh.evidenceRef],
		stopConditions: [
			"Stop if prompt-context drift validation still reports stale or invalid context.",
		],
		humanEscalation: null,
		followUpCommands: followUpCommandsForEvidence(
			promptContextRefresh.evidenceRef,
			promptContextRefresh.command,
		),
		hiddenPlumbing: ["git:status", "prompt_context_drift", "check"],
		safeToRun: trustedCommand,
		requiresHuman: !trustedCommand,
		requiresNetwork: false,
		writesFiles,
		evidenceRef: [sourceRef, ...promptContextRefresh.evidenceRef],
		failureClass: null,
		retry: "safe",
		riskTier: "low",
		meta: nextDecisionOperationalMeta({
			mode: args.mode,
			filesSource: args.filesSource,
			changedFileCount: 0,
			commands: trustedCommand ? [promptContextRefresh.command] : [],
			frictionClass: "repo_state",
			delayClass: "normal",
			phaseExit: args.phaseExit,
			runtimeCard: args.runtimeCard,
			writesFiles,
			extra: prCloseoutDecisionMeta(args.prCloseout),
			agentReadinessContext: args.agentReadinessContext,
			sourceErrors: args.sourceErrors,
		}),
	});
}
