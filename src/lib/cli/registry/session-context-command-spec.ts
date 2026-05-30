import { runSessionContextCLI } from "../../session-context/cli.js";
import { defineCommandSpec } from "./define-command-spec.js";
import type { CommandSpec } from "./types.js";

/** Build the session-context registry seam. */
export function createSessionContextCommandSpec(): CommandSpec {
	return defineCommandSpec({
		name: "session-context",
		summary:
			"Emit a read-only session-context/v1 packet for issue, branch, artifacts, runtime cards, review evidence, stale state, and traversal hints",
		example: "session-context --json --repo-root .",
		errorLabel: "Session Context Error",
		runner: runSessionContextCLI,
	});
}
