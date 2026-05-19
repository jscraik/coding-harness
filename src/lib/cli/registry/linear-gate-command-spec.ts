import { runLinearGateCLI } from "../../../commands/linear-gate.js";
import { getFlagValue } from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

/** Build the Linear gate command spec for the CLI registry. */
export function createLinearGateCommandSpec(): CommandSpec {
	return {
		name: "linear-gate",
		summary: "Enforce Linear-first intake, branch, and PR linkage policy",
		example: "linear-gate --branch feat/JSC-99-my-work --json",
		errorLabel: "Linear Gate Error",
		execute: (args) => runLinearGateCommand(args),
	};
}

function runLinearGateCommand(args: string[]): Promise<number> {
	const jsonFlag = args.includes("--json");
	const allowMissingBranchFlag = args.includes("--allow-missing-branch");
	const allowMissingPrMetadataFlag = args.includes("--allow-missing-pr");
	const contractIndex = args.indexOf("--contract");
	const repoRootIndex = args.indexOf("--repo-root");
	const branchIndex = args.indexOf("--branch");
	const prTitleIndex = args.indexOf("--pr-title");
	const prBodyIndex = args.indexOf("--pr-body");

	const options: Parameters<typeof runLinearGateCLI>[0] = {};

	if (jsonFlag) options.json = true;
	if (allowMissingBranchFlag) options.allowMissingBranch = true;
	if (allowMissingPrMetadataFlag) options.allowMissingPrMetadata = true;
	const contractArg = getFlagValue(args, contractIndex);
	if (contractArg !== undefined) options.contractPath = contractArg;
	const repoRootArg = getFlagValue(args, repoRootIndex);
	if (repoRootArg) options.repoRoot = repoRootArg;
	const branchArg = getFlagValue(args, branchIndex);
	if (branchArg !== undefined) options.branch = branchArg;
	const prTitleArg = getFlagValue(args, prTitleIndex);
	if (prTitleArg !== undefined) options.prTitle = prTitleArg;
	const prBodyArg = getFlagValue(args, prBodyIndex);
	if (prBodyArg !== undefined) options.prBody = prBodyArg;

	return runLinearGateCLI(options);
}
