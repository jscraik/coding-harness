import { runRemediateCLI } from "../../../commands/remediate.js";
import { buildRemediateOptionsFromCliArgs } from "../../remediate/cli-args.js";
import type { CommandSpec } from "./types.js";

/**
 * Create the canonical command specification for the `remediate` CLI command.
 *
 * The returned spec is configured with the command name, user-facing summary,
 * error label, and an `execute` handler that runs the remediation flow.
 *
 * @returns A `CommandSpec` configured for the `remediate` command
 */
export function createRemediateCommandSpec(): CommandSpec {
	return {
		name: "remediate",
		summary: "Auto-plan and execute deterministic remediation",
		errorLabel: "Remediate Error",
		execute: (args) => {
			const result = buildRemediateOptionsFromCliArgs(args);
			return result.ok ? runRemediateCLI(result.options) : result.exitCode;
		},
	};
}
