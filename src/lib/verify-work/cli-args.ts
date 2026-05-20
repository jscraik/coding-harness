import { getValidationGateSpec } from "../validation/gate-specs.js";
import { runVerifyWork } from "./runner.js";
import { EXIT_CODES, type VerifyWorkCliOptions } from "./types.js";

interface FlagValueInspection {
	value?: string;
	missingValue: boolean;
}

function inspectFlagValue(args: string[], flag: string): FlagValueInspection {
	const index = args.indexOf(flag);
	if (index === -1) {
		return { missingValue: false };
	}
	const value = args[index + 1];
	if (value === undefined || value.startsWith("--")) {
		return { missingValue: true };
	}
	return { value, missingValue: false };
}

/**
 * Convert raw verify-work command arguments into the typed command contract.
 */
export function buildVerifyWorkOptionsFromCliArgs(
	args: string[],
): VerifyWorkCliOptions | typeof EXIT_CODES.USAGE_ERROR {
	const resumeFromFlag = inspectFlagValue(args, "--resume-from");
	const repoRootFlag = inspectFlagValue(args, "--repo-root");
	const projectGovernanceFlag = args.includes("--project-governance");
	const workspaceGovernanceFlag = args.includes("--workspace-governance");

	if (resumeFromFlag.missingValue) {
		console.error("Error: --resume-from requires a gate id");
		return EXIT_CODES.USAGE_ERROR;
	}
	if (repoRootFlag.missingValue) {
		console.error("Error: --repo-root requires a path");
		return EXIT_CODES.USAGE_ERROR;
	}
	if (
		resumeFromFlag.value &&
		getValidationGateSpec(resumeFromFlag.value) === undefined
	) {
		console.error(
			`[verify-work] unknown gate id for --resume-from: ${resumeFromFlag.value}`,
		);
		return EXIT_CODES.USAGE_ERROR;
	}
	if (projectGovernanceFlag && workspaceGovernanceFlag) {
		console.error(
			"Error: --project-governance and --workspace-governance are mutually exclusive",
		);
		return EXIT_CODES.USAGE_ERROR;
	}

	return {
		all: args.includes("--all"),
		changedOnly: args.includes("--changed-only"),
		strict: args.includes("--strict"),
		fast: args.includes("--fast"),
		projectGovernance: projectGovernanceFlag,
		workspaceGovernance: workspaceGovernanceFlag,
		json: args.includes("--json"),
		...(resumeFromFlag.value ? { resumeFrom: resumeFromFlag.value } : {}),
		...(repoRootFlag.value ? { repoRoot: repoRootFlag.value } : {}),
	};
}

/**
 * Run verify-work from raw CLI arguments after local option validation.
 */
export function runVerifyWorkFromCliArgs(args: string[]): number {
	const options = buildVerifyWorkOptionsFromCliArgs(args);
	if (options === EXIT_CODES.USAGE_ERROR) {
		return EXIT_CODES.USAGE_ERROR;
	}
	return runVerifyWork(options);
}
