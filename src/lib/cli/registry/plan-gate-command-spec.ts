import { runPlanGateFromCliArgs } from "../../plan-gate/cli.js";
import type { CommandSpec } from "./types.js";

/** Build the plan artifact gate command adapter. */
export function createPlanGateCommandSpec(): CommandSpec {
	return {
		name: "plan-gate",
		summary: "Validate plan artifacts",
		errorLabel: "Plan Gate Error",
		execute: (args) => runPlanGateFromCliArgs(args),
	};
}
