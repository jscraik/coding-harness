import { runLinearCommand } from "./linear-command-runner.js";
import { defineCommandSpec } from "./define-command-spec.js";
import type { CommandSpec } from "./types.js";

/** Build the Linear workflow command spec for the CLI registry. */
export function createLinearCommandSpec(): CommandSpec {
	return defineCommandSpec({
		name: "linear",
		summary:
			"Prepare Linear branch/PR metadata, manage workflow transitions, and sync findings",
		example: "linear claim --issue JSC-123 --json",
		errorLabel: "Linear Workflow Error",
		runner: runLinearCommand,
	});
}
