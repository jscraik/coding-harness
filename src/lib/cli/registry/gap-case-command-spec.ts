import { runGapCaseFromCliArgs } from "../../gap-case/cli.js";
import { defineCommandSpec } from "./define-command-spec.js";
import type { CommandSpec } from "./types.js";

/** Build the gap-case lifecycle command adapter. */
export function createGapCaseCommandSpec(): CommandSpec {
	return defineCommandSpec({
		name: "gap-case",
		summary: "Manage production gap cases (open/resolve)",
		errorLabel: "Gap Case Error",
		runner: runGapCaseFromCliArgs,
	});
}
