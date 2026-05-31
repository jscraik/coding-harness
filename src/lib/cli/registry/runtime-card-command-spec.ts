import { runRuntimeCardCLI } from "../../../commands/runtime-card.js";
import { defineCommandSpec } from "./define-command-spec.js";
import type { CommandSpec } from "./types.js";

/** Build the runtime-card registry seam. */
export function createRuntimeCardCommandSpec(): CommandSpec {
	return defineCommandSpec({
		name: "runtime-card",
		summary:
			"Build runtime-card/v1 plus optional evidence-bundle and handoff artifacts from git, harness evidence, normalized evidence bundles, and optional live provider state",
		example:
			"runtime-card --json --evidence .harness/runtime/session-evidence.json --out .harness/runtime/JSC-311.json --evidence-out .harness/runtime/JSC-311-evidence.json --handoff-out .harness/runtime/JSC-311-handoff.json",
		errorLabel: "Runtime Card Error",
		runner: runRuntimeCardCLI,
	});
}
