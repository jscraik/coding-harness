import { runPrTemplateGateCLI } from "../../../commands/pr-template-gate.js";
import { getFlagValue } from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

/** Build the PR template gate command spec for the CLI registry. */
export function createPrTemplateGateCommandSpec(): CommandSpec {
	return {
		name: "pr-template-gate",
		aliases: ["pr-template-check"],
		summary:
			"Validate PR template completion and placeholder replacement before merge",
		errorLabel: "PR Template Gate Error",
		execute: (args) => runPrTemplateGateCommand(args),
	};
}

/** Parse CLI registry args and delegate to the PR template gate runner. */
function runPrTemplateGateCommand(args: string[]): number {
	const jsonFlag = args.includes("--json");
	const prBodyIndex = args.indexOf("--pr-body");
	const prBodyFileIndex = args.indexOf("--pr-body-file");

	const options: Parameters<typeof runPrTemplateGateCLI>[0] = {};

	if (jsonFlag) options.json = true;
	if (prBodyIndex >= 0) {
		const prBodyArg = getFlagValue(args, prBodyIndex);
		if (prBodyArg !== undefined) options.prBody = prBodyArg;
	}
	if (prBodyFileIndex >= 0) {
		const prBodyFileArg = getFlagValue(args, prBodyFileIndex);
		if (prBodyFileArg !== undefined) options.prBodyFile = prBodyFileArg;
	}

	return runPrTemplateGateCLI(options);
}
