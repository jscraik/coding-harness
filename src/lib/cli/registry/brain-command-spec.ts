import * as brainCli from "../../project-brain/cli.js";
import type { CommandSpec } from "./types.js";

/** Build the canonical Project Brain command adapter. */
export function createBrainCommandSpec(): CommandSpec {
	return {
		name: "brain",
		summary: "Project Brain knowledge and quality management",
		example: "brain status --json",
		errorLabel: "Brain Error",
		execute: (args) => brainCli.runBrainCLI(args),
	};
}
