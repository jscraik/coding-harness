import { runCheckEnvironmentCLI } from "../../../commands/check-environment.js";
import { getFlagValue, parseCsvList } from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

type CheckEnvironmentOptions = Parameters<typeof runCheckEnvironmentCLI>[0];

/** Build the check-environment registry seam. */
export function createCheckEnvironmentCommandSpec(): CommandSpec {
	return {
		name: "check-environment",
		summary: "Validate pilot environment governance checks",
		errorLabel: "Check Environment Error",
		execute: runCheckEnvironmentCommand,
	};
}

function runCheckEnvironmentCommand(args: string[]): number | Promise<number> {
	const options: CheckEnvironmentOptions = {};
	if (args.includes("--json")) options.json = true;
	if (args.includes("--check-secrets")) options.checkSecrets = true;

	const contractArg = getFlagValue(args, args.indexOf("--contract"));
	if (contractArg !== undefined) options.contractPath = contractArg;
	const attestationArg = getFlagValue(args, args.indexOf("--attestation"));
	if (attestationArg) options.attestationPath = attestationArg;
	const allowedSandboxArg = getFlagValue(
		args,
		args.indexOf("--allowed-sandbox"),
	);
	if (allowedSandboxArg) {
		options.allowedSandboxModes = parseCsvList(allowedSandboxArg);
	}

	return runCheckEnvironmentCLI(options);
}
