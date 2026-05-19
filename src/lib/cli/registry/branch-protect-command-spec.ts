import { runBranchProtectCLI } from "../../../commands/branch-protect.js";
import { getFlagValue, parseCsvList, parseIntegerArg } from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

type BranchProtectOptions = Parameters<typeof runBranchProtectCLI>[0];

/** Build the branch-protect registry seam. */
export function createBranchProtectCommandSpec(): CommandSpec {
	return {
		name: "branch-protect",
		summary: "Configure GitHub branch protection ruleset",
		errorLabel: "Branch Protect Error",
		execute: runBranchProtectCommand,
	};
}

function runBranchProtectCommand(args: string[]): number | Promise<number> {
	const options: BranchProtectOptions = {};
	applyBranchProtectScalarOptions(options, args);
	const approvalsStatus = applyRequiredApprovals(options, args);
	if (approvalsStatus !== undefined) return approvalsStatus;
	return runBranchProtectCLI(options);
}

function applyBranchProtectScalarOptions(
	options: BranchProtectOptions,
	args: string[],
): void {
	if (args.includes("--json")) options.json = true;
	if (args.includes("--dry-run")) options.dryRun = true;

	const tokenArg = getFlagValue(args, args.indexOf("--token"));
	if (tokenArg) options.token = tokenArg;
	const ownerArg = getFlagValue(args, args.indexOf("--owner"));
	if (ownerArg) options.owner = ownerArg;
	const repoArg = getFlagValue(args, args.indexOf("--repo"));
	if (repoArg) options.repo = repoArg;
	const branchArg = getFlagValue(args, args.indexOf("--branch"));
	if (branchArg) options.branch = branchArg;
	const rulesetArg = getFlagValue(args, args.indexOf("--ruleset"));
	if (rulesetArg) options.rulesetName = rulesetArg;
	const ecosystemArg = getFlagValue(args, args.indexOf("--ecosystem"));
	if (ecosystemArg) options.ecosystem = ecosystemArg;
	const checksArg = getFlagValue(args, args.indexOf("--checks"));
	if (checksArg !== undefined) options.requiredChecks = parseCsvList(checksArg);
}

function applyRequiredApprovals(
	options: BranchProtectOptions,
	args: string[],
): number | undefined {
	const approvalsIndex = args.indexOf("--required-approvals");
	if (approvalsIndex === -1) return undefined;

	const approvalsArg = getFlagValue(args, approvalsIndex);
	const parsedApprovals = parseIntegerArg(approvalsArg, 0);
	if (parsedApprovals === undefined) {
		console.error("--required-approvals expects a non-negative integer.");
		return 2;
	}

	options.requiredApprovingReviewCount = parsedApprovals;
	return undefined;
}
