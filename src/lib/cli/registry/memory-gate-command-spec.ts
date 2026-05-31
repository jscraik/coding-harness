import * as memoryGate from "../../memory-gate.js";
import { defineCommandSpec } from "./define-command-spec.js";
import type { CommandSpec } from "./types.js";

/** Build the canonical memory-gate command adapter. */
export function createMemoryGateCommandSpec(): CommandSpec {
	return defineCommandSpec({
		name: "memory-gate",
		summary: "Validate local-memory workflow compliance",
		errorLabel: "Memory Gate Error",
		runner: (args) => memoryGate.runMemoryGateFromCliArgs(args),
	});
}
