import { runRuntimeBudgetCLI } from "../../../commands/runtime-budget.js";
import type { CommandSpec } from "./types.js";

/**
 * Create the CommandSpec for the `runtime-budget` CLI command.
 *
 * The spec defines the command name, human-readable summary and example, an
 * `errorLabel`, and an `execute` handler that forwards the provided arguments
 * to the runtime-budget CLI implementation.
 *
 * @returns A `CommandSpec` configured for the `runtime-budget` command.
 */
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
