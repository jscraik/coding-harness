import { runPolicyGateCLI } from "../../../commands/policy-gate.js";
import { inspectFlagValue, parseCsvList } from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

/** Build the policy gate command spec for the CLI registry. */
export function createPolicyGateCommandSpec(): CommandSpec {
	return {
		name: "policy-gate",
		aliases: ["risk-policy-gate"],
		summary:
			"Validate policy expectations from changed files (alias: risk-policy-gate)",
		example:
			"policy-gate --files src/auth.ts --contract harness.contract.json --json",
		errorLabel: "Policy Gate Error",
		execute: (args) => runPolicyGateCommand(args),
	};
}

function runPolicyGateCommand(args: string[]): number {
	const jsonFlag = args.includes("--json");
	const contractFlag = inspectFlagValue(args, "--contract");
	const filesFlag = inspectFlagValue(args, "--files");
	const maxTierFlag = inspectFlagValue(args, "--max-tier");

	if (contractFlag.present && contractFlag.missingValue) {
		console.error("policy-gate requires a value for --contract.");
		return 2;
	}
	if (filesFlag.present && filesFlag.missingValue) {
		console.error("policy-gate requires a value for --files.");
		return 2;
	}
	if (maxTierFlag.present && maxTierFlag.missingValue) {
		console.error("policy-gate requires a value for --max-tier.");
		return 2;
	}

	const options: Parameters<typeof runPolicyGateCLI>[0] = {
		contractPath: "harness.contract.json",
		files: [],
	};

	if (jsonFlag) options.json = true;
	const contractArg = contractFlag.value;
	if (contractArg !== undefined) options.contractPath = contractArg;
	const filesArg = filesFlag.value;
	if (filesArg) {
		options.files = parseCsvList(filesArg);
	}
	const maxTierArg = maxTierFlag.value;
	if (
		maxTierArg !== undefined &&
		maxTierArg !== "high" &&
		maxTierArg !== "medium" &&
		maxTierArg !== "low"
	) {
		console.error("policy-gate --max-tier must be one of: high, medium, low.");
		return 2;
	}
	if (
		maxTierArg === "high" ||
		maxTierArg === "medium" ||
		maxTierArg === "low"
	) {
		options.maxTier = maxTierArg;
	}

	return runPolicyGateCLI(options);
}
