import { runNextCLI } from "../../../commands/next.js";
import type { CommandSpec } from "./types.js";

/** Build the next registry seam. */
export function createNextCommandSpec(): CommandSpec {
	return {
		name: "next",
		summary:
			"Recommend the next safe harness command from current repo/runtime state",
		example: "next --json --runtime-card .harness/runtime/JSC-311.json",
		errorLabel: "Next Error",
		execute: (args) => runNextCLI(args),
	};
}
