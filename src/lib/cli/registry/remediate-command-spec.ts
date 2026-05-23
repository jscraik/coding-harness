import { runRemediateCLI } from "../../../commands/remediate.js";
import { buildRemediateOptionsFromCliArgs } from "../../remediate/cli-args.js";
import type { CommandSpec } from "./types.js";

/** Build the canonical remediate command adapter. */
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
