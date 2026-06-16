import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sanitizeGitEnvironment } from "../lib/git/safe-env.js";
import { normaliseLinearGateResult } from "../lib/output/normalise.js";
import { runLinearGate } from "./linear-gate.js";

function restoreEnvVar(
	key: "GITHUB_HEAD_REF" | "GITHUB_REF_NAME" | "PR_TITLE" | "PR_BODY",
	value?: string,
) {
	if (value === undefined) {
		Reflect.deleteProperty(process.env, key);
		return;
	}
	process.env[key] = value;
}

function writeHarnessContract(tempDir: string): void {
	writeFileSync(
		join(tempDir, "harness.contract.json"),
		JSON.stringify(
			{
				version: "1.2.0",
				riskTierRules: {},
				issueTrackingPolicy: {
					provider: "linear",
					projectUrl: "https://linear.app/acme/project/platform-123",
					requirePackageBugsUrl: true,
					disableGitHubIssues: true,
					requireBranchIssueKey: true,
					requirePrIssueKey: true,
					prReferenceMode: "either",
					branchPrefix: "codex",
				},
			},
			null,
			2,
		),
		"utf-8",
	);
}

function runFixtureGit(args: string[], cwd: string): void {
	const env = sanitizeGitEnvironment({ policy: "minimal" });

	execFileSync("git", args, {
		cwd,
		env,
		stdio: "ignore",
	});
}

describe("runLinearGate", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "linear-gate-test-"));
		mkdirSync(join(tempDir, ".github/ISSUE_TEMPLATE"), { recursive: true });
		writeHarnessContract(tempDir);
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("passes when package metadata, branch, and PR metadata align with Linear policy", () => {
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify(
				{
					name: "fixture",
					bugs: {
						url: "https://linear.app/acme/project/platform-123",
					},
				},
				null,
				2,
			),
			"utf-8",
		);
		writeFileSync(
			join(tempDir, ".github/ISSUE_TEMPLATE/config.yml"),
			`blank_issues_enabled: false
contact_links:
  - name: Linear work intake
    url: https://linear.app/acme/project/platform-123
    about: Track all work in Linear.
`,
			"utf-8",
		);

		const result = runLinearGate({
			repoRoot: tempDir,
			branch: "codex/jsc-42-enforce-linear-policy",
			prTitle: "JSC-42: Enforce Linear policy",
			prBody: "Refs JSC-42\n\nFixes JSC-42",
		});

		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}

		expect(result.output.passed).toBe(true);
		expect(result.output.issueKeys.branch).toEqual(["JSC-42"]);
		expect(result.output.issueKeys.pr).toEqual(["JSC-42"]);
	});

	it("accepts Closes as a closing Linear reference", () => {
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify(
				{
					name: "fixture",
					bugs: "https://linear.app/acme/project/platform-123",
				},
				null,
				2,
			),
			"utf-8",
		);
		writeFileSync(
			join(tempDir, ".github/ISSUE_TEMPLATE/config.yml"),
			`blank_issues_enabled: false
contact_links:
  - name: Linear work intake
    url: https://linear.app/acme/project/platform-123
    about: Track all work in Linear.
`,
			"utf-8",
		);

		const result = runLinearGate({
			repoRoot: tempDir,
			branch: "codex/jsc-42-enforce-linear-policy",
			prTitle: "JSC-42: Enforce Linear policy",
			prBody: "Closes JSC-42",
		});

		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}

		expect(result.output.passed).toBe(true);
		expect(result.output.issueKeys.fixes).toEqual(["JSC-42"]);
	});

	it("fails pr-reference-mode when only Refs is allowed but PR uses Closes", () => {
		writeFileSync(
			join(tempDir, "harness.contract.json"),
			JSON.stringify(
				{
					version: "1.2.0",
					riskTierRules: {},
					issueTrackingPolicy: {
						provider: "linear",
						projectUrl: "https://linear.app/acme/project/platform-123",
						requirePackageBugsUrl: true,
						disableGitHubIssues: true,
						requireBranchIssueKey: true,
						requirePrIssueKey: true,
						prReferenceMode: "refs",
						branchPrefix: "codex",
					},
				},
				null,
				2,
			),
			"utf-8",
		);
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify(
				{
					name: "fixture",
					bugs: "https://linear.app/acme/project/platform-123",
				},
				null,
				2,
			),
			"utf-8",
		);
		writeFileSync(
			join(tempDir, ".github/ISSUE_TEMPLATE/config.yml"),
			`blank_issues_enabled: false
contact_links:
  - name: Linear work intake
    url: https://linear.app/acme/project/platform-123
    about: Track all work in Linear.
`,
			"utf-8",
		);

		const result = runLinearGate({
			repoRoot: tempDir,
			branch: "codex/jsc-42-enforce-linear-policy",
			prTitle: "JSC-42: Enforce Linear policy",
			prBody: "Closes JSC-42",
		});

		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}

		expect(result.output.passed).toBe(false);
		expect(result.output.issueKeys.refs).toEqual([]);
		expect(
			result.output.checks.find((check) => check.code === "pr-reference-mode")
				?.passed,
		).toBe(false);
	});

	it("fails when the branch omits the Linear issue key", () => {
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify(
				{
					name: "fixture",
					bugs: "https://linear.app/acme/project/platform-123",
				},
				null,
				2,
			),
			"utf-8",
		);
		writeFileSync(
			join(tempDir, ".github/ISSUE_TEMPLATE/config.yml"),
			`blank_issues_enabled: false
contact_links:
  - name: Linear work intake
    url: https://linear.app/acme/project/platform-123
    about: Track all work in Linear.
`,
			"utf-8",
		);

		const result = runLinearGate({
			repoRoot: tempDir,
			branch: "codex/no-issue-key",
			prTitle: "JSC-42: Enforce Linear policy",
			prBody: "Refs JSC-42",
		});

		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}

		expect(result.output.passed).toBe(false);
		expect(
			result.output.checks.find((check) => check.code === "branch-linkage")
				?.passed,
		).toBe(false);
	});

	it("accepts explicitly standalone untracked PRs without a Linear issue key", () => {
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify(
				{
					name: "fixture",
					bugs: "https://linear.app/acme/project/platform-123",
				},
				null,
				2,
			),
			"utf-8",
		);
		writeFileSync(
			join(tempDir, ".github/ISSUE_TEMPLATE/config.yml"),
			`blank_issues_enabled: false
contact_links:
  - name: Linear work intake
    url: https://linear.app/acme/project/platform-123
    about: Track all work in Linear.
`,
			"utf-8",
		);

		const result = runLinearGate({
			repoRoot: tempDir,
			branch: "codex/fix-agent-native-gaps",
			prTitle: "fix: remove Ralph dependency from readiness",
			prBody: [
				"## Work performed",
				"",
				"- Linear reference: n/a because no Linear issue was provided for this standalone PR review remediation.",
				"- Linked issue relationship: standalone/untracked work; this PR remediates review comments without claiming issue closure.",
			].join("\n"),
		});

		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}

		expect(result.output.passed).toBe(true);
		expect(
			result.output.checks.find((check) => check.code === "branch-linkage")
				?.message,
		).toContain("standalone/untracked");
		expect(
			result.output.checks.find((check) => check.code === "pr-reference-mode")
				?.message,
		).toContain("standalone/untracked");
	});

	it("classifies branch/PR key mismatch as non-retryable contract_policy", () => {
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify(
				{
					name: "fixture",
					bugs: "https://linear.app/acme/project/platform-123",
				},
				null,
				2,
			),
			"utf-8",
		);
		writeFileSync(
			join(tempDir, ".github/ISSUE_TEMPLATE/config.yml"),
			`blank_issues_enabled: false
contact_links:
  - name: Linear work intake
    url: https://linear.app/acme/project/platform-123
    about: Track all work in Linear.
`,
			"utf-8",
		);

		const gateResult = runLinearGate({
			repoRoot: tempDir,
			branch: "codex/JSC-42-enforce-linear-policy",
			prTitle: "JSC-99: Enforce Linear policy",
			prBody: "Refs JSC-99",
		});
		const normalised = normaliseLinearGateResult(gateResult);

		expect(gateResult.ok).toBe(true);
		expect(normalised.status).toBe("fail");
		expect(normalised.meta).toMatchObject({
			failureClass: "contract_policy",
			nextAction: "Fix contract/policy mismatch, then rerun linear-gate.",
		});
	});

	it("classifies unrecognized internal errors as internal_unknown", () => {
		const normalised = normaliseLinearGateResult({
			ok: false,
			error: {
				code: "UNHANDLED_EXCEPTION",
				message: "Unexpected gate failure",
			},
		});

		expect(normalised.status).toBe("fail");
		expect(normalised.meta).toMatchObject({
			failureClass: "internal_unknown",
			nextAction: "Inspect gate output, fix root cause, and rerun linear-gate.",
		});
	});

	it("allows merge-queue style runs when PR and branch metadata are unavailable", () => {
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify(
				{
					name: "fixture",
					bugs: "https://linear.app/acme/project/platform-123",
				},
				null,
				2,
			),
			"utf-8",
		);
		writeFileSync(
			join(tempDir, ".github/ISSUE_TEMPLATE/config.yml"),
			`blank_issues_enabled: false
contact_links:
  - name: Linear work intake
    url: https://linear.app/acme/project/platform-123
    about: Track all work in Linear.
`,
			"utf-8",
		);

		const previousGithubHeadRef = process.env.GITHUB_HEAD_REF;
		const previousGithubRefName = process.env.GITHUB_REF_NAME;
		const previousPrTitle = process.env.PR_TITLE;
		const previousPrBody = process.env.PR_BODY;
		Reflect.deleteProperty(process.env, "GITHUB_HEAD_REF");
		Reflect.deleteProperty(process.env, "GITHUB_REF_NAME");
		Reflect.deleteProperty(process.env, "PR_TITLE");
		Reflect.deleteProperty(process.env, "PR_BODY");

		const result = (() => {
			try {
				return runLinearGate({
					repoRoot: tempDir,
					branch: "",
					allowMissingBranch: true,
					allowMissingPrMetadata: true,
				});
			} finally {
				restoreEnvVar("GITHUB_HEAD_REF", previousGithubHeadRef);
				restoreEnvVar("GITHUB_REF_NAME", previousGithubRefName);
				restoreEnvVar("PR_TITLE", previousPrTitle);
				restoreEnvVar("PR_BODY", previousPrBody);
			}
		})();

		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}

		expect(result.output.passed).toBe(true);
		expect(
			result.output.checks.find((check) => check.code === "branch-linkage")
				?.message,
		).toContain("skipped");
	});

	it("skips branch linkage when --allow-missing-branch is set for split PR runs", () => {
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify(
				{
					name: "fixture",
					bugs: "https://linear.app/acme/project/platform-123",
				},
				null,
				2,
			),
			"utf-8",
		);
		writeFileSync(
			join(tempDir, ".github/ISSUE_TEMPLATE/config.yml"),
			`blank_issues_enabled: false
contact_links:
  - name: Linear work intake
    url: https://linear.app/acme/project/platform-123
    about: Track all work in Linear.
`,
			"utf-8",
		);
		runFixtureGit(["init", "--quiet", "--initial-branch=main"], tempDir);
		runFixtureGit(
			["checkout", "-b", "codex/pr2-validation-preflight-gates"],
			tempDir,
		);

		const previousGithubHeadRef = process.env.GITHUB_HEAD_REF;
		const previousGithubRefName = process.env.GITHUB_REF_NAME;
		Reflect.deleteProperty(process.env, "GITHUB_HEAD_REF");
		Reflect.deleteProperty(process.env, "GITHUB_REF_NAME");

		const result = (() => {
			try {
				return runLinearGate({
					repoRoot: tempDir,
					prTitle: "JSC-210: Tighten preflight and workflow gates",
					prBody: "Refs JSC-210",
					allowMissingBranch: true,
				});
			} finally {
				restoreEnvVar("GITHUB_HEAD_REF", previousGithubHeadRef);
				restoreEnvVar("GITHUB_REF_NAME", previousGithubRefName);
			}
		})();

		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}

		expect(result.output.passed).toBe(true);
		expect(
			result.output.checks.find((check) => check.code === "branch-linkage")
				?.message,
		).toContain("skipped");
	});
});
