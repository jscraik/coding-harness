import { runCheckAuthzCLI } from "../../../commands/check-authz.js";
import { getFlagValue } from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

type CheckAuthzOptions = Parameters<typeof runCheckAuthzCLI>[0];

/** Build the check-authz registry seam. */
export function createCheckAuthzCommandSpec(): CommandSpec {
	return {
		name: "check-authz",
		summary: "Validate authorization policy for mutative operations",
		errorLabel: "Check Authz Error",
		execute: runCheckAuthzCommand,
	};
}

function runCheckAuthzCommand(args: string[]): number | Promise<number> {
	const options: CheckAuthzOptions = {};
	if (args.includes("--json")) options.json = true;
	if (args.includes("--check-scopes")) options.checkScopes = true;

	const contractArg = getFlagValue(args, args.indexOf("--contract"));
	if (contractArg !== undefined) options.contractPath = contractArg;
	const repoArg = getFlagValue(args, args.indexOf("--repo"));
	if (repoArg) options.repo = repoArg;
	const branchArg = getFlagValue(args, args.indexOf("--branch"));
	if (branchArg) options.branch = branchArg;

	return runCheckAuthzCLI(options);
}
