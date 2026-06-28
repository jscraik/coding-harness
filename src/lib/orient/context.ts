import { existsSync } from "node:fs";
import { join } from "node:path";
import type { SessionContextTraversalHint } from "../session-context/types.js";
import type {
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
): HarnessOrientContextCommand[] {
	return [
		{
			id: "next",
			command: `${commandPrefix} next --json`,
			reason: "Get the next action only, without the full orientation bundle.",
		},
		{
			id: "session-context",
			command: `${commandPrefix} session-context --json --repo-root .`,
			reason:
				"Inspect local branch, changed files, artifacts, runtime cards, reviews, and traversal hints.",
		},
		{
			id: "agent-readiness",
			command: `${commandPrefix} agent-readiness . --json`,
			reason:
				"Audit agent-readable instructions, artifacts, capabilities, approval gates, traceability, and context health.",
		},
		{
			id: "commands-orient",
			command: `${commandPrefix} commands --json --for-agent --mode orient`,
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
	return command.replace(
		/^(?:pnpm exec harness|harness|node --import tsx src\/cli\.ts)(?=\s|$)/,
		commandPrefix,
	);
}

/** Rebuild session-context hints with the public command prefix orient selected. */
export function buildOrientTraversalHints(
	commandPrefix: HarnessOrientCommandPrefix,
): SessionContextTraversalHint[] {
	return (
		[
			[
				"agent cockpit",
				"next --json",
				"Ask the narrow cockpit for the next safe command before acting.",
			],
			[
				"runtime card",
				"runtime-card --json --repo .",
				"Refresh the runtime-card summary when local runtime evidence is missing or stale.",
			],
			[
				"agent readiness",
				"agent-readiness --json --repo-root .",
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
		command: `${commandPrefix} ${command}`,
		reason,
	}));
}

/** List context files that should be opened only when their trigger surface is touched. */
export function buildConditionalContext(
	commandPrefix: HarnessOrientCommandPrefix,
): HarnessOrientConditionalContext[] {
	return [
		{
			when: "touching src/**, scripts/**, command registry, architecture docs, or module boundaries",
			read: ARCHITECTURE_CONTEXT_PATH,
			validate: "bash scripts/check-diagram-freshness.sh",
		},
		{
			when: "touching docs/**, README.md, AGENTS.md, templates, or PR/checklist surfaces",
			read: "docs/agents/04-validation.md",
			validate:
				"bash scripts/run-harness-gate.sh docs-gate --mode required --json",
		},
		{
			when: "touching command metadata, command docs, or agent command discovery",
			read: "docs/cli-reference.md",
			validate: `${commandPrefix} commands --json --for-agent`,
		},
	];
}

/** Check for a repository-relative path inside context helpers. */
function pathExists(repoRoot: string, repoPath: string): boolean {
	return existsSync(join(repoRoot, repoPath));
}
