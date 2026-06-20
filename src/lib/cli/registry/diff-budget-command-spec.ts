import { getFlagValue } from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

type DiffBudgetRunner = (options: {
	base?: string;
	head?: string;
	contractPath?: string;
	overridePath?: string;
	json?: boolean;
}) => number;

function requiredFlagValue(
	args: string[],
	flag: string,
	index: number,
): string | undefined {
	if (index === -1) return undefined;
	const value = getFlagValue(args, index);
	if (value === undefined) {
		throw new Error(`Missing value for ${flag}`);
	}
	return value;
}

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
			try {
				const baseArg = requiredFlagValue(args, "--base", baseIndex);
				if (baseArg) options.base = baseArg;
				const headArg = requiredFlagValue(args, "--head", headIndex);
				if (headArg) options.head = headArg;
				const contractArg = requiredFlagValue(
					args,
					"--contract",
					contractIndex,
				);
				if (contractArg) options.contractPath = contractArg;
				const overrideArg = requiredFlagValue(
					args,
					"--override",
					overrideIndex,
				);
				if (overrideArg) options.overridePath = overrideArg;
			} catch (error) {
				console.error(
					error instanceof Error ? `Error: ${error.message}` : error,
				);
				return 2;
			}
			return runDiffBudgetCLI(options);
		},
	};
}
