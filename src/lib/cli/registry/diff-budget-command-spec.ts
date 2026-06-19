import { getFlagValue } from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

type DiffBudgetRunner = (options: {
	base?: string;
	head?: string;
	contractPath?: string;
	overridePath?: string;
	json?: boolean;
}) => number;

/** Build the diff-budget command adapter. */
export function createDiffBudgetCommandSpec(
	runDiffBudgetCLI: DiffBudgetRunner,
): CommandSpec {
	return {
		name: "diff-budget",
		summary: "Enforce diff budget constraints",
		example: "diff-budget --base main --head HEAD --json",
		errorLabel: "Diff Budget Error",
		execute: (args) => {
			const jsonFlag = args.includes("--json");
			const baseIndex = args.indexOf("--base");
			const headIndex = args.indexOf("--head");
			const contractIndex = args.indexOf("--contract");
			const overrideIndex = args.indexOf("--override");
			const options: {
				base?: string;
				head?: string;
				contractPath?: string;
				overridePath?: string;
				json?: boolean;
			} = {};

			if (jsonFlag) options.json = true;
			const baseArg = getFlagValue(args, baseIndex);
			if (baseArg) options.base = baseArg;
			const headArg = getFlagValue(args, headIndex);
			if (headArg) options.head = headArg;
			const contractArg = getFlagValue(args, contractIndex);
			if (contractArg) options.contractPath = contractArg;
			const overrideArg = getFlagValue(args, overrideIndex);
			if (overrideArg) options.overridePath = overrideArg;
			return runDiffBudgetCLI(options);
		},
	};
}
