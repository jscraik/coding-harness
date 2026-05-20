import { runRuntimeCardCLI } from "../../../commands/runtime-card.js";
import type { CommandSpec } from "./types.js";

/** Build the runtime-card registry seam. */
export function createRuntimeCardCommandSpec(): CommandSpec {
	return {
		name: "runtime-card",
		summary:
			"Build runtime-card/v1 and optional normalized evidence artifacts from git, harness evidence, normalized evidence bundles, and optional live provider state",
		example:
			"runtime-card --json --evidence .harness/runtime/session-evidence.json --out .harness/runtime/JSC-311.json --evidence-out .harness/runtime/JSC-311-evidence.json",
		errorLabel: "Runtime Card Error",
		execute: (args) => runRuntimeCardCLI(args),
	};
}
