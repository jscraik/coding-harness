import { runRiskTierCLI } from "../../../commands/risk-tier.js";
import { getFlagValue, parseCsvList } from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

/** Build the risk-tier registry seam. */
export function createRiskTierCommandSpec(): CommandSpec {
	return {
		name: "risk-tier",
		summary: "Classify files by risk tier",
		example: "risk-tier --files src/auth.ts,src/api.ts --json",
		errorLabel: "Risk Tier Error",
		execute: runRiskTierCommand,
	};
}

function runRiskTierCommand(args: string[]): number {
	const filesArg = getFlagValue(args, args.indexOf("--files"));
	const contractArg = getFlagValue(args, args.indexOf("--contract"));
	return runRiskTierCLI({
		contractPath: contractArg ?? "harness.contract.json",
		files: parseCsvList(filesArg),
		json: args.includes("--json"),
	});
}
