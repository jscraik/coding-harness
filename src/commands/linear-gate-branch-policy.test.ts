import { describe, expect, it } from "vitest";
import { DEFAULT_ISSUE_TRACKING_POLICY } from "../lib/contract/types.js";
import type { LinearGateCheck } from "./linear-gate-core.js";
import { addStandaloneBranchPrefixCheck } from "./linear-gate-branch-policy.js";

describe("addStandaloneBranchPrefixCheck", () => {
	it("fails standalone PR branch linkage when the configured prefix is missing", () => {
		const checks: LinearGateCheck[] = [];

		addStandaloneBranchPrefixCheck({
			checks,
			branch: "feature/fix-agent-native-gaps",
			allowMissingBranch: false,
			policy: {
				...DEFAULT_ISSUE_TRACKING_POLICY,
				branchPrefix: "codex",
			},
		});

		expect(checks).toEqual([
			{
				code: "branch-linkage",
				passed: false,
				message: "Branch name must use the configured prefix.",
				expected: "codex/<linear-key>-...",
				actual: "feature/fix-agent-native-gaps",
			},
		]);
	});
});
