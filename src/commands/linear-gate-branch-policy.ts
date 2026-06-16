import type { IssueTrackingPolicy } from "../lib/contract/types.js";
import type { LinearGateCheck } from "./linear-gate-core.js";

interface StandaloneBranchPrefixInput {
	checks: LinearGateCheck[];
	branch: string | undefined;
	allowMissingBranch: boolean | undefined;
	policy: IssueTrackingPolicy;
}

function addCheck(
	checks: LinearGateCheck[],
	code: string,
	passed: boolean,
	message: string,
	metadata: { expected?: string; actual?: string } = {},
): void {
	checks.push({
		code,
		passed,
		message,
		...metadata,
	});
}

/** Add branch-prefix validation while standalone PRs skip only Linear issue-key checks. */
export function addStandaloneBranchPrefixCheck({
	checks,
	branch,
	allowMissingBranch,
	policy,
}: StandaloneBranchPrefixInput): void {
	if (!branch && !allowMissingBranch) {
		addCheck(
			checks,
			"branch-linkage",
			false,
			"A branch name is required to validate the configured branch prefix.",
		);
		return;
	}

	if (!branch) {
		addCheck(
			checks,
			"branch-linkage",
			true,
			"Branch prefix check skipped because branch metadata is unavailable.",
		);
		return;
	}

	if (policy.branchPrefix && !branch.startsWith(`${policy.branchPrefix}/`)) {
		addCheck(
			checks,
			"branch-linkage",
			false,
			"Branch name must use the configured prefix.",
			{
				expected: `${policy.branchPrefix}/<linear-key>-...`,
				actual: branch,
			},
		);
		return;
	}

	addCheck(
		checks,
		"branch-linkage",
		true,
		"Branch uses the configured prefix; Linear issue key check skipped because PR metadata declares standalone/untracked work with a Linear n/a reason.",
		{
			actual: branch,
		},
	);
}
