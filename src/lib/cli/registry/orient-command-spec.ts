import { defineCommandSpec } from "./define-command-spec.js";
import type { CommandSpec } from "./types.js";

/** Build the orient registry seam. */
export function createOrientCommandSpec(
	runner: CommandSpec["execute"],
): CommandSpec {
	return defineCommandSpec({
		name: "orient",
		summary:
			"Emit a compact cold-start orientation packet with next, session-context, agent-readiness, preflight, Project Brain, and truth-lane refs",
		example: "orient --json --repo-root .",
		errorLabel: "Orient Error",
		runner,
	});
}
