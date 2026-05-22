import {
	runCIMigrateCLI,
	runPromoteModeCLI,
	runSyncBranchProtectionCLI,
} from "../../../commands/ci-migrate.js";
import { buildCIMigrateOptionsFromCliArgs } from "../../ci-migrate/cli-args.js";
import type { CommandSpec } from "./types.js";

/** Build the CI migration command adapter. */
export function createCIMigrateCommandSpec(): CommandSpec {
	return {
		name: "ci-migrate",
		summary: "Migrate CI/CD pipelines to harness governance",
		example: "ci-migrate prepare [target-dir] --dry-run --json",
		errorLabel: "CI Migrate Error",
		execute: (args) => {
			const parsed = buildCIMigrateOptionsFromCliArgs(args);
			if (!parsed.ok) {
				console.error(parsed.message);
				return 2;
			}
			if (parsed.delegate === "sync-branch-protection") {
				return runSyncBranchProtectionCLI(
					parsed.targetDir,
					parsed.delegatedArgs,
				);
			}
			if (parsed.delegate === "promote-mode") {
				return runPromoteModeCLI(parsed.targetDir, parsed.delegatedArgs);
			}
			if ("options" in parsed) {
				return runCIMigrateCLI(parsed.targetDir, parsed.options);
			}
			return 2;
		},
	};
}
