import { runGapCaseFromCliArgs } from "../../gap-case/cli.js";
import type { CommandSpec } from "./types.js";

/** Build the gap-case lifecycle command adapter. */
export function createGapCaseCommandSpec(): CommandSpec {
	return {
		name: "gap-case",
		summary: "Manage production gap cases (open/resolve)",
		errorLabel: "Gap Case Error",
		execute: (args) => runGapCaseFromCliArgs(args),
	};
}
