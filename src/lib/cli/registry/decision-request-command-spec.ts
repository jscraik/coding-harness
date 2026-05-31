import { runDecisionRequestCLI } from "../../decision-request/cli.js";
import { defineCommandSpec } from "./define-command-spec.js";
import type { CommandSpec } from "./types.js";

/** Create the registry adapter for the read-only decision-request command. */
export function createDecisionRequestCommandSpec(): CommandSpec {
	return defineCommandSpec({
		name: "decision-request",
		summary:
			"Emit a read-only decision-request/v1 governance packet for a bounded HILT authority boundary",
		example:
			"decision-request --json --intent 'Refresh external state?' --default-option refresh --boundary external_mutation --option refresh='Refresh state'",
		errorLabel: "Decision Request Error",
		runner: runDecisionRequestCLI,
	});
}
