import { runRuntimeBudgetCLI } from "../../../commands/runtime-budget.js";
import type { CommandSpec } from "./types.js";

/** Build the runtime-budget registry seam. */
export function createRuntimeBudgetCommandSpec(): CommandSpec {
	return {
		name: "runtime-budget",
		summary:
			"Build command-runtime-budget/v1 from measured command durations and budget thresholds",
		example:
			"runtime-budget --command 'pnpm check' --duration-ms 45000 --budget-ms 60000 --evidence-ref local:pnpm-check --json",
		errorLabel: "Runtime Budget Error",
		execute: (args) => runRuntimeBudgetCLI(args),
	};
}
