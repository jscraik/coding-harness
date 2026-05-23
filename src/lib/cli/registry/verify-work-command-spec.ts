import { runVerifyWorkArgsCLI } from "../../../commands/verify-work.js";
import type { CommandSpec } from "./types.js";

/**
 * Create the canonical command specification for the `verify-work` CLI command.
 *
 * The returned spec is configured with name `verify-work`, a concise summary and
 * example, an error label, and an `execute` handler that delegates to
 * `runVerifyWorkArgsCLI`.
 *
 * @returns A `CommandSpec` configured for the `verify-work` command
 */
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
