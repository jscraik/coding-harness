import { runDriftGateFromCliArgs } from "../../drift-gate/cli-args.js";
import type { CommandSpec } from "./types.js";

/**
 * Create the canonical command specification for the `drift-gate` CLI command.
 *
 * @returns The command specification object with `name: "drift-gate"`, a short `summary`, an `example` invocation, an `errorLabel`, and the `execute` handler bound to the drift-gate implementation.
 */
export function createDriftGateCommandSpec(): CommandSpec {
	return {
		name: "drift-gate",
		summary: "Evaluate consistency drift across governance surfaces",
		example: "drift-gate --mode advisory --json",
		errorLabel: "Drift Gate Error",
		execute: runDriftGateCommand,
	};
}

/**
 * Run the drift-gate command using the provided CLI arguments.
 *
 * @param args - CLI arguments to forward to the drift-gate runner
 * @returns The numeric exit code produced by the drift-gate runner
 */
function runDriftGateCommand(args: string[]): number {
	return runDriftGateFromCliArgs(args);
}
