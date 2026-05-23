import { runMemoryGateFromCliArgs } from "../../memory-gate.js";
import type { CommandSpec } from "./types.js";

/** Build the canonical memory-gate command adapter. */
export function createMemoryGateCommandSpec(): CommandSpec {
	return {
		name: "memory-gate",
		summary: "Validate local-memory workflow compliance",
		errorLabel: "Memory Gate Error",
		execute: (args) => runMemoryGateFromCliArgs(args),
	};
}
