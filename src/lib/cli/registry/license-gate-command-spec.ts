import { runLicenseGateCLI } from "../../../commands/license-gate.js";
import { getFlagValue, parseCsvList } from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

type LicenseGateOptions = Parameters<typeof runLicenseGateCLI>[0];

/** Build the license-gate registry seam. */
export function createLicenseGateCommandSpec(): CommandSpec {
	return {
		name: "license-gate",
		aliases: ["license-check"],
		summary: "Validate open-source license (MIT, Apache-2.0, etc.)",
		errorLabel: "License Gate Error",
		execute: runLicenseGateCommand,
	};
}

function runLicenseGateCommand(args: string[]): number | Promise<number> {
	const options: LicenseGateOptions = {};
	if (args.includes("--json")) options.json = true;
	if (args.includes("--require-osi")) options.requireOsiApproved = true;
	if (args.includes("--no-copyleft")) options.allowCopyleft = false;

	const repoRootArg = getFlagValue(args, args.indexOf("--repo-root"));
	if (repoRootArg) options.repoRoot = repoRootArg;
	const allowedArg = getFlagValue(args, args.indexOf("--allowed"));
	if (allowedArg !== undefined)
		options.allowedLicenses = parseCsvList(allowedArg);

	return runLicenseGateCLI(options);
}
