import { runSourceOutlineCLI } from "../../../commands/source-outline.js";
import type { CommandSpec } from "./types.js";

/** Registry entry for the source-outline exploration command. */
export const SOURCE_OUTLINE_COMMAND_SPEC: CommandSpec = {
	name: "source-outline",
	summary: "Print declaration-style source signatures before unwrapping bodies",
	example: "source-outline src/commands/search.ts --symbol runSearchCLI --json",
	errorLabel: "Source Outline Error",
	execute: (args) => runSourceOutlineCLI(args),
};
