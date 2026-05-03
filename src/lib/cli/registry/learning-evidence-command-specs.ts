import type { CommandSpec } from "./types.js";

/**
 * Command runners injected by the transitional command registry adapter.
 */
export type LearningEvidenceCommandRunners = {
	runLearningsCLI: (args: string[]) => number | Promise<number>;
	runNorthStarFeedbackCLI: (args: string[]) => number | Promise<number>;
	runReviewContextCLI: (args: string[]) => number | Promise<number>;
	runValidationPlanCLI: (args: string[]) => number | Promise<number>;
};

/**
 * Builds command registry specs for learning-evidence command surfaces.
 */
export function createLearningEvidenceCommandSpecs({
	runLearningsCLI,
	runNorthStarFeedbackCLI,
	runReviewContextCLI,
	runValidationPlanCLI,
}: LearningEvidenceCommandRunners): CommandSpec[] {
	return [
		{
			name: "learnings",
			summary:
				"Import, gate, and promote operational review learnings from provider exports",
			example:
				"learnings import --provider coderabbit-csv --source learnings.csv --repo coding-harness --json",
			errorLabel: "Learnings Error",
			execute: (args) => runLearningsCLI(args),
		},
		{
			name: "review-context",
			summary:
				"Generate PR review context from changed files and imported operational learnings",
			example:
				"review-context --source .harness/learnings/coderabbit.local.json --files src/cli.ts --json",
			errorLabel: "Review Context Error",
			execute: (args) => runReviewContextCLI(args),
		},
		{
			name: "validation-plan",
			summary:
				"Recommend repo-canonical validation commands from changed files and learning evidence",
			example:
				"validation-plan --source .harness/learnings/coderabbit.local.json --files src/cli.ts --json",
			errorLabel: "Validation Plan Error",
			execute: (args) => runValidationPlanCLI(args),
		},
		{
			name: "north-star-feedback",
			summary:
				"Measure operational-learning feedback loops against north-star review outcomes",
			example:
				"north-star-feedback --source .harness/learnings/coderabbit.local.json --json",
			errorLabel: "North Star Feedback Error",
			execute: (args) => runNorthStarFeedbackCLI(args),
		},
	];
}
