import { runWorkflowGenerateCLI } from "../../../commands/workflow-generate.js";
import { getFlagValue } from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

type WorkflowGenerateOptions = Parameters<typeof runWorkflowGenerateCLI>[0];

/** Build the workflow:generate registry seam. */
export function createWorkflowGenerateCommandSpec(): CommandSpec {
	return {
		name: "workflow:generate",
		aliases: ["workflow-generate"],
		summary:
			"Generate compact operational spec (S/E/G/A/P/R/N format) from annotated markdown",
		errorLabel: "Workflow Generate Error",
		execute: runWorkflowGenerateCommand,
	};
}

function runWorkflowGenerateCommand(args: string[]): number | Promise<number> {
	const options: WorkflowGenerateOptions = {};
	if (args.includes("--json")) options.json = true;
	if (args.includes("--dry-run")) options.dryRun = true;
	if (args.includes("--watch")) options.watch = true;

	const sourceArg = getFlagValue(args, args.indexOf("--source"));
	if (sourceArg) options.source = sourceArg;
	const outputArg = getFlagValue(args, args.indexOf("--output"));
	if (outputArg) options.output = outputArg;
	const formatArg = getFlagValue(args, args.indexOf("--format"));
	if (formatArg === "segarn" || formatArg === "segaprn") {
		options.format = formatArg;
	}

	return runWorkflowGenerateCLI(options);
}
