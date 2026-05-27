import { runDecisionRequestCLI } from "../../decision-request/cli.js";
import type { CommandSpec } from "./types.js";

/** Create the registry adapter for the read-only decision-request command. */
export function createDecisionRequestCommandSpec(): CommandSpec {
	return {
		name: "decision-request",
		summary:
			"Emit a read-only decision-request/v1 governance packet for human or operator escalation",
		example:
			"decision-request --json --intent 'Refresh external state?' --default-option refresh --option refresh='Refresh state'",
		errorLabel: "Decision Request Error",
		execute: runDecisionRequestCLI,
	};
}
