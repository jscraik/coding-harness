import { runMemoryGateFromCliArgs } from "../../memory-gate.js";
import type { CommandSpec } from "./types.js";

/**
 * Create the canonical CommandSpec for the `memory-gate` CLI command.
 *
 * @returns A CommandSpec configured with name `"memory-gate"`, summary `"Validate local-memory workflow compliance"`, errorLabel `"Memory Gate Error"`, and an `execute` handler that invokes the command implementation with the provided CLI arguments.
 */
export function createMemoryGateCommandSpec(): CommandSpec {
	return {
		name: "memory-gate",
		summary: "Validate local-memory workflow compliance",
		errorLabel: "Memory Gate Error",
		execute: (args) => runMemoryGateFromCliArgs(args),
	};
}
