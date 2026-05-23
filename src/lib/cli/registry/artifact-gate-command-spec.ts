import * as artifactGate from "../../artifact-gate.js";
import type { CommandSpec } from "./types.js";

/**
 * Create a CommandSpec for the `artifact-gate` CLI command that checks generated
 * artifact changes against the artifact provenance registry.
 *
 * The spec includes the command name, user-facing summary, example usage,
 * error label, and an execute handler invoked with CLI arguments.
 *
 * @returns A `CommandSpec` configured for the `artifact-gate` command
 */
export function createArtifactGateCommandSpec(): CommandSpec {
	return {
		name: "artifact-gate",
		summary:
			"Check generated artifact changes against the artifact provenance registry",
		example: "artifact-gate --files scripts/codex-preflight.sh --json",
		errorLabel: "Artifact Gate Error",
		execute: (args) => artifactGate.runArtifactGateFromCliArgs(args),
	};
}
