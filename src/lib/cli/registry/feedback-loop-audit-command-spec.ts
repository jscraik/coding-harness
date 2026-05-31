import { runFeedbackLoopAuditCLI } from "../../feedback-loop-audit-cli.js";
import type { CommandSpec } from "./types.js";

/** Build the feedback-loop-audit registry entry. */
export function createFeedbackLoopAuditCommandSpec(): CommandSpec {
	return {
		name: "feedback-loop-audit",
		summary:
			"Audit local feedback-loop findings, lifecycle states, and closure evidence",
		example: "feedback-loop-audit --json",
		errorLabel: "Feedback Loop Audit Error",
		execute: (args) => runFeedbackLoopAuditCLI(args),
	};
}
