import { runAgentReadinessCLI } from "../../agent-readiness/cli.js";
import type { CommandSpec } from "./types.js";
import { defineCommandSpec } from "./define-command-spec.js";

/** Build the agent-readiness registry seam. */
export function createAgentReadinessCommandSpec(): CommandSpec {
	return defineCommandSpec({
		name: "agent-readiness",
		summary:
			"Audit agent-readable instructions, artifacts, capabilities, approval gates, traceability, and context freshness",
		example: "agent-readiness [path] [--json]",
		errorLabel: "Agent Readiness Error",
		execute: runAgentReadinessCLI,
	});
}
