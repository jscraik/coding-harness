import { runPromptGateFromCliArgs } from "../../prompt-gate/cli.js";
import { defineCommandSpec } from "./define-command-spec.js";
import type { CommandSpec } from "./types.js";

/** Build the prompt template validation command adapter. */
export function createPromptGateCommandSpec(): CommandSpec {
	return defineCommandSpec({
		name: "prompt-gate",
		summary: "Validate prompt template usage",
		errorLabel: "Prompt Gate Error",
		runner: runPromptGateFromCliArgs,
	});
}
