import { existsSync } from "node:fs";
import { join } from "node:path";
import type { AgentReadinessContextHealth } from "../agent-readiness/types.js";
import type { SessionContextTraversalHint } from "../session-context/types.js";
import type {
	HarnessOrientArchitectureContext,
	HarnessOrientConditionalContext,
	HarnessOrientContextCommand,
	HarnessOrientContextRef,
	HarnessOrientTruthLaneWarning,
} from "./types.js";

/** Public command prefix used when orient suggests follow-up harness commands. */
export type HarnessOrientCommandPrefix =
	| "pnpm exec harness"
	| "harness"
	| "node --import tsx src/cli.ts";

/** Repository-relative path for the lazy architecture context map. */
export const ARCHITECTURE_CONTEXT_PATH = "AI/context/diagram-context.md";

/** Repository-relative path for the generated diagram manifest. */
export const DIAGRAM_MANIFEST_PATH = ".diagram/manifest.json";

const ORIENTATION_REF_INPUTS: Array<{ path: string; reason: string }> = [
	{
		path: "AGENTS.md",
		reason: "Repository operating contract and truth-lane boundaries.",
	},
	{
		path: "CODESTYLE.md",
		reason: "Codestyle front door before technical edits or validation claims.",
	},
	{
		path: ".harness/active-artifacts.md",
		reason:
			"Current route-driving plans, specs, receipts, and handoff artifacts.",
	},
	{
		path: ".harness/knowledge/INDEX.md",
		reason: "Project Brain knowledge index for orientation-only context.",
	},
	{
		path: ".harness/memory/LEARNINGS.md",
		reason: "Durable local lessons that may route recurring failures.",
	},
	{
		path: ARCHITECTURE_CONTEXT_PATH,
		reason:
			"Lazy architecture map for source, command, script, and docs architecture work.",
	},
	{
		path: "docs/cli-reference.md",
		reason: "Extended command reference and command catalog contract.",
	},
];

/** Truth-lane caveats that keep orient from implying external readiness. */
export const TRUTH_LANE_WARNINGS: HarnessOrientTruthLaneWarning[] = [
	{
		lane: "local_code",
		warning:
			"orient reports local checkout evidence only; run the selected validation command before claiming code behavior.",
	},
	{
		lane: "runtime_artifact",
		warning:
			"runtime cards, session context, and preflight receipts are evidence refs, not proof that external state is current.",
	},
	{
		lane: "pr_ci",
		warning:
			"orient does not refresh hosted PR checks or CI state; use live PR/CI tools before claiming those lanes.",
	},
	{
		lane: "review_threads",
		warning:
			"orient does not prove review threads are resolved or reviewer approval exists.",
	},
	{
		lane: "tracker",
		warning:
			"orient does not prove Linear or tracker fields are current, closed, or owner-accepted.",
	},
	{
		lane: "merge_readiness",
		warning:
			"orient never proves mergeability or merge readiness; that requires current PR and policy evidence.",
	},
];

/** Classify the default cold-start reading list as present or missing. */
export function buildOrientationRefs(
	repoRoot: string,
): HarnessOrientContextRef[] {
	return ORIENTATION_REF_INPUTS.map((input) => ({
		path: input.path,
		status: pathExists(repoRoot, input.path) ? "present" : "missing",
		reason: input.reason,
	}));
}

/** Build the follow-up command rail using the repo-appropriate public entrypoint. */
export function buildContextCommands(
	commandPrefix: HarnessOrientCommandPrefix,
	repoRoot: string,
): HarnessOrientContextCommand[] {
	const quotedRepoRoot = shellQuote(repoRoot);
	return [
		{
			id: "next",
			command: scopedHarnessCommand(commandPrefix, repoRoot, "next --json"),
			reason: "Get the next action only, without the full orientation bundle.",
		},
		{
			id: "session-context",
			command: scopedHarnessCommand(
				commandPrefix,
				repoRoot,
				`session-context --json --repo-root ${quotedRepoRoot}`,
			),
			reason:
				"Inspect local branch, changed files, artifacts, runtime cards, reviews, and traversal hints.",
		},
		{
			id: "agent-readiness",
			command: scopedHarnessCommand(
				commandPrefix,
				repoRoot,
				`agent-readiness --json --repo-root ${quotedRepoRoot}`,
			),
			reason:
				"Audit agent-readable instructions, artifacts, capabilities, approval gates, traceability, and context health.",
		},
		{
			id: "commands-orient",
			command: scopedHarnessCommand(
				commandPrefix,
				repoRoot,
				"commands --json --for-agent --mode orient",
			),
			reason: "List the compact command rail available for orientation work.",
		},
	];
}

/** Normalize embedded harness command hints to the entrypoint orient selected. */
export function normalizeOrientHarnessCommand(
	command: string | null,
	commandPrefix: HarnessOrientCommandPrefix,
): string | null {
	if (command === null) return null;
	return command.replace(HARNESS_COMMAND_PREFIX_PATTERN, commandPrefix);
}

/** Scope embedded harness command hints to the repository orient inspected. */
export function scopeOrientHarnessCommand(
	command: string | null,
	commandPrefix: HarnessOrientCommandPrefix,
	repoRoot: string,
): string | null {
	if (command === null) return null;
	const normalized = normalizeOrientHarnessCommand(command, commandPrefix);
	if (normalized === null) return null;
	if (!HARNESS_COMMAND_PREFIX_PATTERN.test(command)) return normalized;
	return scopedHarnessCommand(
		commandPrefix,
		repoRoot,
		commandWithoutPrefix(normalized),
	);
}

/** Normalize embedded agent-readiness context-health command hints for orient's selected repo command rail. */
export function summarizeAgentReadinessContextHealth(
	contextHealth: AgentReadinessContextHealth,
	commandPrefix: HarnessOrientCommandPrefix,
	repoRoot: string,
): AgentReadinessContextHealth {
	return {
		...contextHealth,
		canonicalReport: {
			...contextHealth.canonicalReport,
			command:
				scopeOrientReadinessCommand(
					contextHealth.canonicalReport.command,
					commandPrefix,
					repoRoot,
				) ?? contextHealth.canonicalReport.command,
		},
		surfaces: contextHealth.surfaces.map((surface) => ({
			...surface,
			suggestedRefreshCommands: surface.suggestedRefreshCommands.map(
				(command) =>
					scopeOrientReadinessCommand(command, commandPrefix, repoRoot) ??
					command,
			),
		})),
		suggestedRefreshCommands: contextHealth.suggestedRefreshCommands.map(
			(command) =>
				scopeOrientReadinessCommand(command, commandPrefix, repoRoot) ??
				command,
		),
	};
}

/** Scope readiness refresh commands to the repository orient inspected. */
function scopeOrientReadinessCommand(
	command: string | null,
	commandPrefix: HarnessOrientCommandPrefix,
	repoRoot: string,
): string | null {
	if (command === null) return null;
	if (!HARNESS_COMMAND_PREFIX_PATTERN.test(command)) {
		return scopedShellCommand(repoRoot, command);
	}
	return (
		scopeOrientHarnessCommand(command, commandPrefix, repoRoot) ??
		scopedShellCommand(repoRoot, command)
	);
}

/** Rebuild session-context hints with the public command prefix orient selected. */
export function buildOrientTraversalHints(
	commandPrefix: HarnessOrientCommandPrefix,
	repoRoot: string,
): SessionContextTraversalHint[] {
	const quotedRepoRoot = shellQuote(repoRoot);
	return (
		[
			[
				"agent cockpit",
				"next --json",
				"Ask the narrow cockpit for the next safe command before acting.",
			],
			[
				"runtime card",
				`runtime-card --json --repo ${quotedRepoRoot}`,
				"Refresh the runtime-card summary when local runtime evidence is missing or stale.",
			],
			[
				"agent readiness",
				`agent-readiness --json --repo-root ${quotedRepoRoot}`,
				"Check instruction, artifact, capability, approval, traceability, and context-health surfaces.",
			],
			[
				"orientation rail",
				"commands --json --for-agent --mode orient",
				"List the compact orient-mode command rail available to agents.",
			],
		] as const
	).map(([label, command, reason]) => ({
		label,
		command: scopedHarnessCommand(commandPrefix, repoRoot, command),
		reason,
	}));
}

/** List context files that should be opened only when their trigger surface is touched. */
export function buildConditionalContext(
	commandPrefix: HarnessOrientCommandPrefix,
	repoRoot: string,
): HarnessOrientConditionalContext[] {
	return [
		{
			when: "touching src/**, scripts/**, command registry, architecture docs, or module boundaries",
			read: ARCHITECTURE_CONTEXT_PATH,
			validate: scopedShellCommand(
				repoRoot,
				"bash scripts/check-diagram-freshness.sh",
			),
		},
		{
			when: "touching docs/**, README.md, AGENTS.md, templates, or PR/checklist surfaces",
			read: "docs/agents/04-validation.md",
			validate: scopedShellCommand(
				repoRoot,
				"bash scripts/run-harness-gate.sh docs-gate --mode required --json",
			),
		},
		{
			when: "touching command metadata, command docs, or agent command discovery",
			read: "docs/cli-reference.md",
			validate: scopedHarnessCommand(
				commandPrefix,
				repoRoot,
				"commands --json --for-agent",
			),
		},
	];
}

/** Describe the lazy architecture context and its freshness check command. */
export function buildArchitectureContext(
	repoRoot: string,
): HarnessOrientArchitectureContext {
	return {
		path: ARCHITECTURE_CONTEXT_PATH,
		status: pathExists(repoRoot, ARCHITECTURE_CONTEXT_PATH)
			? "present"
			: "missing",
		manifestPath: DIAGRAM_MANIFEST_PATH,
		readWhen:
			"Read when touching src/**, scripts/**, command registry, architecture docs, generated diagrams, or module boundaries.",
		validateWhenChangedCommand: scopedShellCommand(
			repoRoot,
			"bash scripts/check-diagram-freshness.sh",
		),
	};
}

/** Build a follow-up command that first enters the repository orient inspected. */
function scopedHarnessCommand(
	commandPrefix: HarnessOrientCommandPrefix,
	repoRoot: string,
	args: string,
): string {
	return `cd ${shellQuote(repoRoot)} && ${commandPrefix} ${args}`;
}

/** Build a non-harness validation command that first enters the repository orient inspected. */
export function scopedShellCommand(repoRoot: string, command: string): string {
	return `cd ${shellQuote(repoRoot)} && ${command}`;
}

function commandWithoutPrefix(command: string): string {
	return command.replace(HARNESS_COMMAND_PREFIX_PATTERN, "").trimStart();
}

/** Quote a filesystem path for shell command rails emitted by orient. */
function shellQuote(value: string): string {
	return `'${value.replaceAll("'", "'\\''")}'`;
}

const HARNESS_COMMAND_PREFIX_PATTERN =
	/^(?:pnpm exec harness|harness|node --import tsx src\/cli\.ts)(?=\s|$)/;

/** Check for a repository-relative path inside context helpers. */
function pathExists(repoRoot: string, repoPath: string): boolean {
	return existsSync(join(repoRoot, repoPath));
}
