import * as artifactGate from "../../artifact-gate.js";
import type { CommandSpec } from "./types.js";

/** Build the generated artifact provenance gate command adapter. */
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
