import type { CommandSpec } from "./types.js";

type FitnessRunner = (args: string[]) => number;

/** Build the repository fitness command adapter. */
export function createFitnessCommandSpec(
	runFitnessCLI: FitnessRunner,
): CommandSpec {
	return {
		name: "fitness",
		summary:
			"Normalize repository fitness findings from existing harness gates",
		example: "fitness --json",
		errorLabel: "Fitness Error",
		execute: (args) => runFitnessCLI(args),
	};
}
