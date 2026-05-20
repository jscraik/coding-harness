import {
	EXIT_CODES as VERIFY_WORK_EXIT_CODES,
	runVerifyWorkCLI,
} from "../../../commands/verify-work.js";
import { getValidationGateSpec } from "../../validation/gate-specs.js";
import { inspectFlagValue } from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

/** Build the canonical verify-work command adapter. */
export function createVerifyWorkCommandSpec(): CommandSpec {
	return {
		name: "verify-work",
		summary:
			"Run canonical verification with fresh/resume modes via harness command",
		example: "verify-work --fast --resume-from validate-codestyle-fast",
		errorLabel: "Verify Work Error",
		execute: (args) => {
			const resumeFromFlag = inspectFlagValue(args, "--resume-from");
			const repoRootFlag = inspectFlagValue(args, "--repo-root");
			const projectGovernanceFlag = args.includes("--project-governance");
			const workspaceGovernanceFlag = args.includes("--workspace-governance");
			if (resumeFromFlag.missingValue) {
				console.error("Error: --resume-from requires a gate id");
				return VERIFY_WORK_EXIT_CODES.USAGE_ERROR;
			}
			if (repoRootFlag.missingValue) {
				console.error("Error: --repo-root requires a path");
				return VERIFY_WORK_EXIT_CODES.USAGE_ERROR;
			}
			if (
				resumeFromFlag.value &&
				getValidationGateSpec(resumeFromFlag.value) === undefined
			) {
				console.error(
					`[verify-work] unknown gate id for --resume-from: ${resumeFromFlag.value}`,
				);
				return VERIFY_WORK_EXIT_CODES.USAGE_ERROR;
			}
			if (projectGovernanceFlag && workspaceGovernanceFlag) {
				console.error(
					"Error: --project-governance and --workspace-governance are mutually exclusive",
				);
				return VERIFY_WORK_EXIT_CODES.USAGE_ERROR;
			}
			return runVerifyWorkCLI({
				all: args.includes("--all"),
				changedOnly: args.includes("--changed-only"),
				strict: args.includes("--strict"),
				fast: args.includes("--fast"),
				projectGovernance: projectGovernanceFlag,
				workspaceGovernance: workspaceGovernanceFlag,
				json: args.includes("--json"),
				...(resumeFromFlag.value ? { resumeFrom: resumeFromFlag.value } : {}),
				...(repoRootFlag.value ? { repoRoot: repoRootFlag.value } : {}),
			});
		},
	};
}
