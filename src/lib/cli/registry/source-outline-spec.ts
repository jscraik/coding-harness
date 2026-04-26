import { runSourceOutlineCLI } from "../../source-outline.js";
import type { CommandSpec } from "./types.js";

/** Registry entry for the source-outline exploration command. */
export const SOURCE_OUTLINE_COMMAND_SPEC: CommandSpec = {
	name: "source-outline",

	summary:
		"Inspect TypeScript signatures/comments before opening implementations",
	example:
		"source-outline src/lib/source-outline.ts --symbol runSourceOutline --json",

	errorLabel: "Source Outline Error",
	execute: (args) => runSourceOutlineCLI(args),
};
