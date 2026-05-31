import { runPlanGateFromCliArgs } from "../../plan-gate/cli.js";
import { defineCommandSpec } from "./define-command-spec.js";
import type { CommandSpec } from "./types.js";

/** Build the plan artifact gate command adapter. */
export function createPlanGateCommandSpec(): CommandSpec {
	return defineCommandSpec({
		name: "plan-gate",
		summary: "Validate plan artifacts",
		errorLabel: "Plan Gate Error",
		runner: runPlanGateFromCliArgs,
	});
}
