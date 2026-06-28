const NEXT_ORIENTATION_REFS = [
	"AGENTS.md",
	"CODESTYLE.md",
	"AI/context/diagram-context.md",
	".harness/active-artifacts.md",
] as const;

const NEXT_CONTEXT_COMMANDS = [
	"harness orient --json",
	"harness session-context --json --repo-root .",
	"harness agent-readiness . --json",
	"harness commands --json --for-agent --mode orient",
] as const;

const NEXT_CONDITIONAL_CONTEXT = [
	{
		when: "touching src/**, scripts/**, command registry, architecture docs, or module boundaries",
		read: "AI/context/diagram-context.md",
		validate: "bash scripts/check-diagram-freshness.sh",
	},
] as const;

const NEXT_TRUTH_LANE_WARNINGS = [
	"Local next/orient output does not prove PR, CI, review-thread, tracker, or merge-readiness truth.",
] as const;

/** Build the static cold-start orientation metadata attached to next decisions. */
export function orientationMeta(): Record<string, unknown> {
	return {
		orientationRefs: [...NEXT_ORIENTATION_REFS],
		contextCommands: [...NEXT_CONTEXT_COMMANDS],
		conditionalContext: NEXT_CONDITIONAL_CONTEXT.map((item) => ({ ...item })),
		truthLaneWarnings: [...NEXT_TRUTH_LANE_WARNINGS],
	};
}
