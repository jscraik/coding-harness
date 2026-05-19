import { runSymphonyCheckCLI } from "../../../commands/symphony-check.js";
import { getFlagValue } from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

type SymphonyCheckOptions = Parameters<typeof runSymphonyCheckCLI>[0];

/** Build the symphony-check registry seam. */
export function createSymphonyCheckCommandSpec(): CommandSpec {
	return {
		name: "symphony-check",
		aliases: ["symphony:check"],
		summary:
			"Validate Symphony readiness (WORKFLOW.md, Linear config, transition table)",
		errorLabel: "Symphony Check Error",
		execute: runSymphonyCheckCommand,
	};
}

function runSymphonyCheckCommand(args: string[]): number | Promise<number> {
	const options: SymphonyCheckOptions = {};
	if (args.includes("--json")) options.json = true;

	const repoRootArg = getFlagValue(args, args.indexOf("--repo-root"));
	if (repoRootArg) options.repoRoot = repoRootArg;
	const workflowArg = getFlagValue(args, args.indexOf("--workflow"));
	if (workflowArg) options.workflowPath = workflowArg;
	const envFileArg = getFlagValue(args, args.indexOf("--env-file"));
	if (envFileArg) options.envFilePath = envFileArg;

	return runSymphonyCheckCLI(options);
}
