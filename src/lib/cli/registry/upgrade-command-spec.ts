import { buildUpgradeOptionsFromCliArgs } from "../../upgrade/cli-args.js";
import { runUpgradeCLI } from "../../upgrade/runner.js";
import type { CommandSpec } from "./types.js";

/** Build the upgrade command adapter. */
export function createUpgradeCommandSpec(): CommandSpec {
	return {
		name: "upgrade",
		summary: "Upgrade harness to the latest version",
		errorLabel: "Upgrade Error",
		execute: (args) => {
			const parsed = buildUpgradeOptionsFromCliArgs(args);
			return runUpgradeCLI(parsed.targetDir, parsed.options);
		},
	};
}
