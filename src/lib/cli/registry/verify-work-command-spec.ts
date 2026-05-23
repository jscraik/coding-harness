import { runVerifyWorkArgsCLI } from "../../../commands/verify-work.js";
import type { CommandSpec } from "./types.js";

/** Build the canonical verify-work command adapter. */
export function createVerifyWorkCommandSpec(): CommandSpec {
	return {
		name: "verify-work",
		summary:
			"Run canonical verification with fresh/resume modes via harness command",
		example: "verify-work --fast --resume-from validate-codestyle-fast",
		errorLabel: "Verify Work Error",
		execute: (args) => {
			return runVerifyWorkArgsCLI(args);
		},
	};
}
