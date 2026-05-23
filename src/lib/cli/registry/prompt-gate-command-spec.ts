import { runPromptGateFromCliArgs } from "../../prompt-gate/cli.js";
import type { CommandSpec } from "./types.js";

/** Build the prompt template validation command adapter. */
export function createPromptGateCommandSpec(): CommandSpec {
	return {
		name: "prompt-gate",
		summary: "Validate prompt template usage",
		errorLabel: "Prompt Gate Error",
		execute: (args) => runPromptGateFromCliArgs(args),
	};
}
