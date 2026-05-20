import { runVerifyCodeRabbitCLI } from "../../../commands/verify-coderabbit.js";
import { getFlagValue } from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

/** Build the CodeRabbit review evidence command adapter. */
export function createVerifyCodeRabbitCommandSpec(): CommandSpec {
	return {
		name: "verify-coderabbit",
		summary: "Verify CodeRabbit configuration and review settings",
		errorLabel: "Verify CodeRabbit Error",
		execute: async (args) => {
			const jsonFlag = args.includes("--json");
			const verboseFlag = args.includes("--verbose");
			const ownerIndex = args.indexOf("--owner");
			const repoIndex = args.indexOf("--repo");
			const repoPathIndex = args.indexOf("--repo-path");
			const tokenIndex = args.indexOf("--token");

			const options: Parameters<typeof runVerifyCodeRabbitCLI>[0] = {};
			if (jsonFlag) options.json = true;
			if (verboseFlag) options.verbose = true;
			const ownerArg = getFlagValue(args, ownerIndex);
			if (ownerArg) options.owner = ownerArg;
			const repoArg = getFlagValue(args, repoIndex);
			if (repoArg) options.repo = repoArg;
			const repoPathArg = getFlagValue(args, repoPathIndex);
			if (repoPathArg) options.repoPath = repoPathArg;
			const tokenArg = getFlagValue(args, tokenIndex);
			if (tokenArg) options.token = tokenArg;

			return runVerifyCodeRabbitCLI(options);
		},
	};
}
