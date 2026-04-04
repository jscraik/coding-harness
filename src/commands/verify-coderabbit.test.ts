/**
 * Tests for verify-coderabbit command
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	CheckRun,
	Ruleset,
	RulesetSummary,
} from "../lib/github/client.js";
import {
	EXIT_CODES,
	runVerifyCodeRabbit,
	runVerifyCodeRabbitCLI,
} from "./verify-coderabbit.js";

vi.mock("../lib/github/client.js", () => ({
	GitHubClient: vi.fn(),
}));

import { GitHubClient } from "../lib/github/client.js";

const mockGitHubClient = vi.mocked(GitHubClient);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRepoFixture(
	opts: {
		withCodeRabbitYaml?: boolean;
		codeRabbitContent?: string;
		withNpmrc?: boolean;
		npmrcContent?: string;
	} = {},
): string {
	const repoPath = mkdtempSync(join(tmpdir(), "verify-coderabbit-test-"));

	if (opts.withCodeRabbitYaml) {
		const content =
			opts.codeRabbitContent ??
			"reviews:\n  commit_status: true\n  auto_review:\n    enabled: true\n";
		writeFileSync(join(repoPath, ".coderabbit.yaml"), content);
	}

	if (opts.withNpmrc) {
		const content = opts.npmrcContent ?? "ignore-scripts=true\n";
		writeFileSync(join(repoPath, ".npmrc"), content);
	}

	return repoPath;
}

function makeRulesetSummary(name: string, id = 1): RulesetSummary {
	return { id, name, target: "branch", enforcement: "active" };
}

function makeRuleset(checks: string[]): Ruleset {
	return {
		id: 1,
		name: "protect",
		target: "branch",
		enforcement: "active",
		bypass_actors: [],
		conditions: { ref_name: { include: ["refs/heads/main"], exclude: [] } },
		rules: [
			{
				type: "required_status_checks",
				parameters: {
					required_status_checks: checks.map((c) => ({ context: c })),
				},
			},
		],
	};
}

function makeCheckRun(name: string, id = 1): CheckRun {
	return {
		id,
		name,
		status: "completed",
		conclusion: "success",
		head_sha: "a".repeat(40),
	};
}

// ---------------------------------------------------------------------------
// .coderabbit.yaml config checks
// ---------------------------------------------------------------------------

describe("runVerifyCodeRabbit - .coderabbit.yaml config", () => {
	let repoPath: string;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("GITHUB_TOKEN", "");
		vi.stubEnv("GITHUB_PERSONAL_ACCESS_TOKEN", "");
	});

	afterEach(() => {
		if (repoPath) rmSync(repoPath, { recursive: true, force: true });
		vi.unstubAllEnvs();
	});

	it("fails when .coderabbit.yaml is missing", async () => {
		repoPath = createRepoFixture();
		const result = await runVerifyCodeRabbit({ repoPath });

		const configCheck = result.checks.find(
			(c) => c.name === ".coderabbit.yaml config",
		);
		expect(configCheck?.status).toBe("fail");
		expect(configCheck?.message).toContain(".coderabbit.yaml not found");
		expect(configCheck?.message).toContain("harness init");
	});

	it("passes with a valid .coderabbit.yaml containing reviews section and commit_status: true", async () => {
		repoPath = createRepoFixture({
			withCodeRabbitYaml: true,
			codeRabbitContent: "reviews:\n  commit_status: true\n",
		});
		const result = await runVerifyCodeRabbit({ repoPath });

		const configCheck = result.checks.find(
			(c) => c.name === ".coderabbit.yaml config",
		);
		expect(configCheck?.status).toBe("pass");
		expect(configCheck?.message).toContain("Valid .coderabbit.yaml");
		expect(configCheck?.details?.features).toContain("reviews section present");
		expect(configCheck?.details?.features).toContain("commit_status enabled");
	});

	it("fails when reviews section is missing", async () => {
		repoPath = createRepoFixture({
			withCodeRabbitYaml: true,
			codeRabbitContent: "language: en\n",
		});
		const result = await runVerifyCodeRabbit({ repoPath });

		const configCheck = result.checks.find(
			(c) => c.name === ".coderabbit.yaml config",
		);
		expect(configCheck?.status).toBe("fail");
		expect(configCheck?.message).toContain(
			"missing top-level 'reviews:' section",
		);
	});

	it("warns when commit_status is false", async () => {
		repoPath = createRepoFixture({
			withCodeRabbitYaml: true,
			codeRabbitContent: "reviews:\n  commit_status: false\n",
		});
		const result = await runVerifyCodeRabbit({ repoPath });

		const configCheck = result.checks.find(
			(c) => c.name === ".coderabbit.yaml config",
		);
		expect(configCheck?.status).toBe("warn");
		expect(configCheck?.message).toContain("commit_status: false");
		expect(configCheck?.message).toContain("branch protection will not work");
	});

	it("warns when auto_review is disabled", async () => {
		repoPath = createRepoFixture({
			withCodeRabbitYaml: true,
			codeRabbitContent:
				"reviews:\n  commit_status: true\n  auto_review:\n    enabled: false\n",
		});
		const result = await runVerifyCodeRabbit({ repoPath });

		const configCheck = result.checks.find(
			(c) => c.name === ".coderabbit.yaml config",
		);
		expect(configCheck?.status).toBe("warn");
		expect(configCheck?.message).toContain("auto_review is disabled");
	});

	it("passes without commit_status line (no explicit false)", async () => {
		repoPath = createRepoFixture({
			withCodeRabbitYaml: true,
			codeRabbitContent: "reviews:\n  request_changes_workflow: true\n",
		});
		const result = await runVerifyCodeRabbit({ repoPath });

		const configCheck = result.checks.find(
			(c) => c.name === ".coderabbit.yaml config",
		);
		// commit_status absent is not a failure — only explicit false is
		expect(configCheck?.status).toBe("pass");
	});

	it("passes when fail_commit_status is false but commit_status is not disabled", async () => {
		repoPath = createRepoFixture({
			withCodeRabbitYaml: true,
			codeRabbitContent:
				"reviews:\n  commit_status: true\n  fail_commit_status: false\n",
		});
		const result = await runVerifyCodeRabbit({ repoPath });

		const configCheck = result.checks.find(
			(c) => c.name === ".coderabbit.yaml config",
		);
		expect(configCheck?.status).toBe("pass");
		expect(configCheck?.message).toContain("Valid .coderabbit.yaml");
		expect(configCheck?.message).not.toContain("commit_status: false");
	});
});

// ---------------------------------------------------------------------------
// .npmrc checks
// ---------------------------------------------------------------------------

describe("runVerifyCodeRabbit - .npmrc checks", () => {
	let repoPath: string;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("GITHUB_TOKEN", "");
		vi.stubEnv("GITHUB_PERSONAL_ACCESS_TOKEN", "");
	});

	afterEach(() => {
		if (repoPath) rmSync(repoPath, { recursive: true, force: true });
		vi.unstubAllEnvs();
	});

	it("warns when .npmrc is missing", async () => {
		repoPath = createRepoFixture({ withCodeRabbitYaml: true });
		const result = await runVerifyCodeRabbit({ repoPath });

		const npmrcCheck = result.checks.find(
			(c) => c.name === ".npmrc configuration",
		);
		expect(npmrcCheck?.status).toBe("warn");
		expect(npmrcCheck?.message).toContain("No .npmrc file found");
		expect(npmrcCheck?.message).toContain("ignore-scripts=true");
	});

	it("passes when .npmrc has ignore-scripts=true", async () => {
		repoPath = createRepoFixture({
			withCodeRabbitYaml: true,
			withNpmrc: true,
			npmrcContent: "ignore-scripts=true\n",
		});
		const result = await runVerifyCodeRabbit({ repoPath });

		const npmrcCheck = result.checks.find(
			(c) => c.name === ".npmrc configuration",
		);
		expect(npmrcCheck?.status).toBe("pass");
		expect(npmrcCheck?.message).toContain("Valid .npmrc");
	});

	it("warns when .npmrc lacks ignore-scripts=true", async () => {
		repoPath = createRepoFixture({
			withCodeRabbitYaml: true,
			withNpmrc: true,
			npmrcContent: "@myorg:registry=https://registry.npmjs.org/\n",
		});
		const result = await runVerifyCodeRabbit({ repoPath });

		const npmrcCheck = result.checks.find(
			(c) => c.name === ".npmrc configuration",
		);
		expect(npmrcCheck?.status).toBe("warn");
		expect(npmrcCheck?.message).toContain("ignore-scripts=true");
	});

	it("warns when .npmrc contains an auth token override", async () => {
		repoPath = createRepoFixture({
			withCodeRabbitYaml: true,
			withNpmrc: true,
			npmrcContent:
				"@brainwav:registry=https://registry.npmjs.org/\n//registry.npmjs.org/:_authToken=${NPM_TOKEN}\nignore-scripts=true\n",
		});
		const result = await runVerifyCodeRabbit({ repoPath });

		const npmrcCheck = result.checks.find(
			(c) => c.name === ".npmrc configuration",
		);
		expect(npmrcCheck?.status).toBe("warn");
		expect(npmrcCheck?.message).toContain("user-level ~/.npmrc");
	});

	it("passes with scoped registry and ignore-scripts=true, lists features", async () => {
		repoPath = createRepoFixture({
			withCodeRabbitYaml: true,
			withNpmrc: true,
			npmrcContent:
				"@brainwav:registry=https://registry.npmjs.org/\nignore-scripts=true\n",
		});
		const result = await runVerifyCodeRabbit({ repoPath });

		const npmrcCheck = result.checks.find(
			(c) => c.name === ".npmrc configuration",
		);
		expect(npmrcCheck?.status).toBe("pass");
		expect(npmrcCheck?.details?.features).toContain("scoped registry");
		expect(npmrcCheck?.details?.features).toContain(
			"ignore-scripts=true (security)",
		);
	});
});

// ---------------------------------------------------------------------------
// Remote checks - no owner/repo
// ---------------------------------------------------------------------------

describe("runVerifyCodeRabbit - no owner/repo provided", () => {
	let repoPath: string;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("GITHUB_TOKEN", "");
		vi.stubEnv("GITHUB_PERSONAL_ACCESS_TOKEN", "");
	});

	afterEach(() => {
		if (repoPath) rmSync(repoPath, { recursive: true, force: true });
		vi.unstubAllEnvs();
	});

	it("emits a single skipped-remote-checks warning when owner/repo are absent", async () => {
		repoPath = createRepoFixture({ withCodeRabbitYaml: true, withNpmrc: true });
		const result = await runVerifyCodeRabbit({ repoPath });

		const remoteCheck = result.checks.find((c) => c.name === "Remote checks");
		expect(remoteCheck?.status).toBe("warn");
		expect(remoteCheck?.message).toContain("Skipped remote checks");
		expect(remoteCheck?.message).toContain("--owner");
		expect(remoteCheck?.message).toContain("--repo");
	});
});

// ---------------------------------------------------------------------------
// Remote checks - with owner/repo but no token
// ---------------------------------------------------------------------------

describe("runVerifyCodeRabbit - owner/repo provided, no token", () => {
	let repoPath: string;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("GITHUB_TOKEN", "");
		vi.stubEnv("GITHUB_PERSONAL_ACCESS_TOKEN", "");
	});

	afterEach(() => {
		if (repoPath) rmSync(repoPath, { recursive: true, force: true });
		vi.unstubAllEnvs();
	});

	it("warns for both check run presence and ruleset when token is absent", async () => {
		repoPath = createRepoFixture({ withCodeRabbitYaml: true, withNpmrc: true });
		const result = await runVerifyCodeRabbit({
			repoPath,
			owner: "octo",
			repo: "harness",
		});

		const checkRunCheck = result.checks.find(
			(c) => c.name === "CodeRabbit check run presence",
		);
		const rulesetCheck = result.checks.find(
			(c) => c.name === "Ruleset Configuration",
		);
		expect(checkRunCheck?.status).toBe("warn");
		expect(checkRunCheck?.message).toContain("Skipped check run verification");
		expect(rulesetCheck?.status).toBe("warn");
		expect(rulesetCheck?.message).toContain("Skipped ruleset verification");
	});

	it("treats empty-string GITHUB_TOKEN as absent", async () => {
		repoPath = createRepoFixture({ withCodeRabbitYaml: true, withNpmrc: true });
		vi.stubEnv("GITHUB_TOKEN", "");
		const result = await runVerifyCodeRabbit({
			repoPath,
			owner: "octo",
			repo: "harness",
		});

		const checkRunCheck = result.checks.find(
			(c) => c.name === "CodeRabbit check run presence",
		);
		expect(checkRunCheck?.status).toBe("warn");
		expect(checkRunCheck?.message).toContain("Skipped check run verification");
	});

	it('treats "undefined" string token as absent', async () => {
		repoPath = createRepoFixture({ withCodeRabbitYaml: true, withNpmrc: true });
		const result = await runVerifyCodeRabbit({
			repoPath,
			owner: "octo",
			repo: "harness",
			token: "undefined",
		});

		const checkRunCheck = result.checks.find(
			(c) => c.name === "CodeRabbit check run presence",
		);
		expect(checkRunCheck?.status).toBe("warn");
		expect(checkRunCheck?.message).toContain("Skipped check run verification");
	});

	it('treats "null" string token as absent', async () => {
		repoPath = createRepoFixture({ withCodeRabbitYaml: true, withNpmrc: true });
		const result = await runVerifyCodeRabbit({
			repoPath,
			owner: "octo",
			repo: "harness",
			token: "null",
		});

		const checkRunCheck = result.checks.find(
			(c) => c.name === "CodeRabbit check run presence",
		);
		expect(checkRunCheck?.status).toBe("warn");
		expect(checkRunCheck?.message).toContain("Skipped check run verification");
	});
});

// ---------------------------------------------------------------------------
// Remote checks - with token, full GitHub API mocking
// ---------------------------------------------------------------------------

describe("runVerifyCodeRabbit - remote checks with token", () => {
	let repoPath: string;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("GITHUB_TOKEN", "");
		vi.stubEnv("GITHUB_PERSONAL_ACCESS_TOKEN", "");
	});

	afterEach(() => {
		if (repoPath) rmSync(repoPath, { recursive: true, force: true });
		vi.unstubAllEnvs();
	});

	it("passes check run check when CodeRabbit run exists on default branch", async () => {
		repoPath = createRepoFixture({ withCodeRabbitYaml: true, withNpmrc: true });

		mockGitHubClient.mockImplementation(
			() =>
				({
					getDefaultBranch: vi.fn(async () => "main"),
					listCheckRunsForRef: vi.fn(async () => [makeCheckRun("CodeRabbit")]),
					listRulesets: vi.fn(
						async () => [makeRulesetSummary("protect")] as RulesetSummary[],
					),
					getRuleset: vi.fn(async () => makeRuleset(["CodeRabbit"])),
				}) as unknown as GitHubClient,
		);

		const result = await runVerifyCodeRabbit({
			repoPath,
			token: "ghp_test",
			owner: "octo",
			repo: "harness",
		});

		const checkRunCheck = result.checks.find(
			(c) => c.name === "CodeRabbit check run presence",
		);
		expect(checkRunCheck?.status).toBe("pass");
		expect(checkRunCheck?.message).toContain("CodeRabbit check found on main");
		expect(checkRunCheck?.details?.branch).toBe("main");
	});

	it("warns when no CodeRabbit check run exists on default branch", async () => {
		repoPath = createRepoFixture({ withCodeRabbitYaml: true, withNpmrc: true });

		mockGitHubClient.mockImplementation(
			() =>
				({
					getDefaultBranch: vi.fn(async () => "main"),
					listCheckRunsForRef: vi.fn(async () => [
						makeCheckRun("lint"),
						makeCheckRun("test"),
					]),
					listRulesets: vi.fn(async () => [] as RulesetSummary[]),
					getRuleset: vi.fn(async () => makeRuleset([])),
				}) as unknown as GitHubClient,
		);

		const result = await runVerifyCodeRabbit({
			repoPath,
			token: "ghp_test",
			owner: "octo",
			repo: "harness",
		});

		const checkRunCheck = result.checks.find(
			(c) => c.name === "CodeRabbit check run presence",
		);
		expect(checkRunCheck?.status).toBe("warn");
		expect(checkRunCheck?.message).toContain('No "CodeRabbit" check run found');
		expect(checkRunCheck?.details?.hint).toContain(
			"Install the CodeRabbit GitHub App",
		);
	});

	it("passes ruleset check when protect ruleset requires CodeRabbit", async () => {
		repoPath = createRepoFixture({ withCodeRabbitYaml: true, withNpmrc: true });

		mockGitHubClient.mockImplementation(
			() =>
				({
					getDefaultBranch: vi.fn(async () => "main"),
					listCheckRunsForRef: vi.fn(async () => [makeCheckRun("CodeRabbit")]),
					listRulesets: vi.fn(
						async () => [makeRulesetSummary("protect")] as RulesetSummary[],
					),
					getRuleset: vi.fn(async () =>
						makeRuleset(["CodeRabbit", "security-scan"]),
					),
				}) as unknown as GitHubClient,
		);

		const result = await runVerifyCodeRabbit({
			repoPath,
			token: "ghp_test",
			owner: "octo",
			repo: "harness",
		});

		const rulesetCheck = result.checks.find(
			(c) => c.name === "Ruleset Configuration",
		);
		expect(rulesetCheck?.status).toBe("pass");
		expect(rulesetCheck?.message).toContain(
			'requires "CodeRabbit" status check',
		);
	});

	it("fails ruleset check when protect ruleset does not require CodeRabbit", async () => {
		repoPath = createRepoFixture({ withCodeRabbitYaml: true, withNpmrc: true });

		mockGitHubClient.mockImplementation(
			() =>
				({
					getDefaultBranch: vi.fn(async () => "main"),
					listCheckRunsForRef: vi.fn(async () => [makeCheckRun("CodeRabbit")]),
					listRulesets: vi.fn(
						async () => [makeRulesetSummary("protect")] as RulesetSummary[],
					),
					getRuleset: vi.fn(async () => makeRuleset(["lint", "security-scan"])),
				}) as unknown as GitHubClient,
		);

		const result = await runVerifyCodeRabbit({
			repoPath,
			token: "ghp_test",
			owner: "octo",
			repo: "harness",
		});

		const rulesetCheck = result.checks.find(
			(c) => c.name === "Ruleset Configuration",
		);
		expect(rulesetCheck?.status).toBe("fail");
		expect(rulesetCheck?.message).toContain('does not require "CodeRabbit"');
		expect(rulesetCheck?.details?.currentChecks).toContain("lint");
		expect(rulesetCheck?.details?.currentChecks).toContain("security-scan");
		expect(result.ok).toBe(false);
	});

	it("warns when no protect ruleset is found", async () => {
		repoPath = createRepoFixture({ withCodeRabbitYaml: true, withNpmrc: true });

		mockGitHubClient.mockImplementation(
			() =>
				({
					getDefaultBranch: vi.fn(async () => "main"),
					listCheckRunsForRef: vi.fn(async () => [makeCheckRun("CodeRabbit")]),
					listRulesets: vi.fn(async () => [] as RulesetSummary[]),
					getRuleset: vi.fn(async () => makeRuleset([])),
				}) as unknown as GitHubClient,
		);

		const result = await runVerifyCodeRabbit({
			repoPath,
			token: "ghp_test",
			owner: "octo",
			repo: "harness",
		});

		const rulesetCheck = result.checks.find(
			(c) => c.name === "Ruleset Configuration",
		);
		expect(rulesetCheck?.status).toBe("warn");
		expect(rulesetCheck?.message).toContain('No "protect" ruleset found');
		expect(rulesetCheck?.message).toContain("harness branch-protect");
	});

	it("warns when getDefaultBranch throws", async () => {
		repoPath = createRepoFixture({ withCodeRabbitYaml: true, withNpmrc: true });

		mockGitHubClient.mockImplementation(
			() =>
				({
					getDefaultBranch: vi.fn(async () => {
						throw new Error("API error: 503");
					}),
					listCheckRunsForRef: vi.fn(async () => [] as CheckRun[]),
					listRulesets: vi.fn(async () => [] as RulesetSummary[]),
					getRuleset: vi.fn(async () => makeRuleset([])),
				}) as unknown as GitHubClient,
		);

		const result = await runVerifyCodeRabbit({
			repoPath,
			token: "ghp_test",
			owner: "octo",
			repo: "harness",
		});

		const checkRunCheck = result.checks.find(
			(c) => c.name === "CodeRabbit check run presence",
		);
		expect(checkRunCheck?.status).toBe("warn");
		expect(checkRunCheck?.message).toContain("Failed to verify check runs");
	});

	it("warns when listRulesets throws", async () => {
		repoPath = createRepoFixture({ withCodeRabbitYaml: true, withNpmrc: true });

		mockGitHubClient.mockImplementation(
			() =>
				({
					getDefaultBranch: vi.fn(async () => "main"),
					listCheckRunsForRef: vi.fn(async () => [makeCheckRun("CodeRabbit")]),
					listRulesets: vi.fn(async () => {
						throw new Error("403 Forbidden");
					}),
					getRuleset: vi.fn(async () => makeRuleset([])),
				}) as unknown as GitHubClient,
		);

		const result = await runVerifyCodeRabbit({
			repoPath,
			token: "ghp_test",
			owner: "octo",
			repo: "harness",
		});

		const rulesetCheck = result.checks.find(
			(c) => c.name === "Ruleset Configuration",
		);
		expect(rulesetCheck?.status).toBe("warn");
		expect(rulesetCheck?.message).toContain("Failed to check ruleset");
	});

	it("uses GITHUB_TOKEN env var when no explicit token is provided", async () => {
		repoPath = createRepoFixture({ withCodeRabbitYaml: true, withNpmrc: true });
		vi.stubEnv("GITHUB_TOKEN", "ghp_env_token");

		let capturedOptions: { token?: string } | undefined;
		mockGitHubClient.mockImplementation((opts) => {
			capturedOptions = opts as { token?: string };
			return {
				getDefaultBranch: vi.fn(async () => "main"),
				listCheckRunsForRef: vi.fn(async () => [makeCheckRun("CodeRabbit")]),
				listRulesets: vi.fn(async () => [] as RulesetSummary[]),
				getRuleset: vi.fn(async () => makeRuleset([])),
			} as unknown as GitHubClient;
		});

		await runVerifyCodeRabbit({
			repoPath,
			owner: "octo",
			repo: "harness",
		});

		expect(capturedOptions?.token).toBe("ghp_env_token");
	});

	it("falls back to GITHUB_PERSONAL_ACCESS_TOKEN when GITHUB_TOKEN is absent", async () => {
		repoPath = createRepoFixture({ withCodeRabbitYaml: true, withNpmrc: true });
		vi.stubEnv("GITHUB_PERSONAL_ACCESS_TOKEN", "ghp_pat_token");

		let capturedOptions: { token?: string } | undefined;
		mockGitHubClient.mockImplementation((opts) => {
			capturedOptions = opts as { token?: string };
			return {
				getDefaultBranch: vi.fn(async () => "main"),
				listCheckRunsForRef: vi.fn(async () => [] as CheckRun[]),
				listRulesets: vi.fn(async () => [] as RulesetSummary[]),
				getRuleset: vi.fn(async () => makeRuleset([])),
			} as unknown as GitHubClient;
		});

		await runVerifyCodeRabbit({
			repoPath,
			owner: "octo",
			repo: "harness",
		});

		expect(capturedOptions?.token).toBe("ghp_pat_token");
	});

	it("includes check run conclusion in pass message", async () => {
		repoPath = createRepoFixture({ withCodeRabbitYaml: true, withNpmrc: true });

		mockGitHubClient.mockImplementation(
			() =>
				({
					getDefaultBranch: vi.fn(async () => "develop"),
					listCheckRunsForRef: vi.fn(
						async () =>
							[
								{
									id: 99,
									name: "CodeRabbit",
									status: "completed" as const,
									conclusion: "failure",
									head_sha: "b".repeat(40),
								},
							] as CheckRun[],
					),
					listRulesets: vi.fn(async () => [makeRulesetSummary("protect")]),
					getRuleset: vi.fn(async () => makeRuleset(["CodeRabbit"])),
				}) as unknown as GitHubClient,
		);

		const result = await runVerifyCodeRabbit({
			repoPath,
			token: "ghp_test",
			owner: "octo",
			repo: "harness",
		});

		const checkRunCheck = result.checks.find(
			(c) => c.name === "CodeRabbit check run presence",
		);
		expect(checkRunCheck?.status).toBe("pass");
		expect(checkRunCheck?.message).toContain("develop");
		expect(checkRunCheck?.message).toContain("conclusion: failure");
	});

	it("handles check run with null conclusion (pending)", async () => {
		repoPath = createRepoFixture({ withCodeRabbitYaml: true, withNpmrc: true });

		mockGitHubClient.mockImplementation(
			() =>
				({
					getDefaultBranch: vi.fn(async () => "main"),
					listCheckRunsForRef: vi.fn(
						async () =>
							[
								{
									id: 1,
									name: "CodeRabbit",
									status: "in_progress" as const,
									conclusion: null,
									head_sha: "a".repeat(40),
								},
							] as CheckRun[],
					),
					listRulesets: vi.fn(async () => [] as RulesetSummary[]),
					getRuleset: vi.fn(async () => makeRuleset([])),
				}) as unknown as GitHubClient,
		);

		const result = await runVerifyCodeRabbit({
			repoPath,
			token: "ghp_test",
			owner: "octo",
			repo: "harness",
		});

		const checkRunCheck = result.checks.find(
			(c) => c.name === "CodeRabbit check run presence",
		);
		expect(checkRunCheck?.status).toBe("pass");
		expect(checkRunCheck?.message).toContain("conclusion: pending");
	});
});

// ---------------------------------------------------------------------------
// Summary and ok flag
// ---------------------------------------------------------------------------

describe("runVerifyCodeRabbit - summary and ok flag", () => {
	let repoPath: string;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("GITHUB_TOKEN", "");
		vi.stubEnv("GITHUB_PERSONAL_ACCESS_TOKEN", "");
	});

	afterEach(() => {
		if (repoPath) rmSync(repoPath, { recursive: true, force: true });
		vi.unstubAllEnvs();
	});

	it("ok is true when there are no failed checks", async () => {
		repoPath = createRepoFixture({ withCodeRabbitYaml: true, withNpmrc: true });
		const result = await runVerifyCodeRabbit({ repoPath });

		expect(result.ok).toBe(true);
		expect(result.summary.failed).toBe(0);
	});

	it("ok is false when at least one check fails", async () => {
		repoPath = createRepoFixture({ withNpmrc: true }); // no .coderabbit.yaml
		const result = await runVerifyCodeRabbit({ repoPath });

		expect(result.ok).toBe(false);
		expect(result.summary.failed).toBeGreaterThan(0);
	});

	it("summary counts are accurate across pass, fail, and warn", async () => {
		// .coderabbit.yaml missing → fail
		// .npmrc present with ignore-scripts → pass
		// no owner/repo → warn (remote checks skipped)
		repoPath = createRepoFixture({ withNpmrc: true });
		const result = await runVerifyCodeRabbit({ repoPath });

		expect(result.summary.failed).toBe(1);
		expect(result.summary.passed).toBe(1);
		expect(result.summary.warnings).toBe(1);
		expect(
			result.summary.passed + result.summary.failed + result.summary.warnings,
		).toBe(result.checks.length);
	});

	it("returns all check objects in the checks array", async () => {
		repoPath = createRepoFixture({ withCodeRabbitYaml: true, withNpmrc: true });
		const result = await runVerifyCodeRabbit({ repoPath });

		expect(Array.isArray(result.checks)).toBe(true);
		expect(result.checks.length).toBeGreaterThanOrEqual(2);
		for (const check of result.checks) {
			expect(check).toHaveProperty("name");
			expect(check).toHaveProperty("status");
			expect(check).toHaveProperty("message");
		}
	});
});

// ---------------------------------------------------------------------------
// runVerifyCodeRabbitCLI exit codes and output
// ---------------------------------------------------------------------------

describe("runVerifyCodeRabbitCLI", () => {
	let repoPath: string;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("GITHUB_TOKEN", "");
		vi.stubEnv("GITHUB_PERSONAL_ACCESS_TOKEN", "");
	});

	afterEach(() => {
		if (repoPath) rmSync(repoPath, { recursive: true, force: true });
		vi.unstubAllEnvs();
	});

	it("returns EXIT_CODES.SUCCESS when all checks pass", async () => {
		repoPath = createRepoFixture({ withCodeRabbitYaml: true, withNpmrc: true });
		const consoleSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		const exitCode = await runVerifyCodeRabbitCLI({ repoPath });

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		consoleSpy.mockRestore();
	});

	it("returns EXIT_CODES.VALIDATION_ERROR when any check fails", async () => {
		repoPath = createRepoFixture(); // missing .coderabbit.yaml → fail
		const consoleSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		const exitCode = await runVerifyCodeRabbitCLI({ repoPath });

		expect(exitCode).toBe(EXIT_CODES.VALIDATION_ERROR);
		consoleSpy.mockRestore();
	});

	it("outputs JSON when json: true", async () => {
		repoPath = createRepoFixture({ withCodeRabbitYaml: true, withNpmrc: true });
		const consoleSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		await runVerifyCodeRabbitCLI({ repoPath, json: true });

		expect(consoleSpy).toHaveBeenCalledTimes(1);
		const raw = consoleSpy.mock.calls[0]?.[0] as string;
		const parsed = JSON.parse(raw) as {
			ok: boolean;
			checks: unknown[];
			summary: unknown;
		};
		expect(parsed).toHaveProperty("ok");
		expect(parsed).toHaveProperty("checks");
		expect(parsed).toHaveProperty("summary");
		consoleSpy.mockRestore();
	});

	it("JSON output ok is true when all local checks pass", async () => {
		repoPath = createRepoFixture({ withCodeRabbitYaml: true, withNpmrc: true });
		const consoleSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		await runVerifyCodeRabbitCLI({ repoPath, json: true });

		const raw = consoleSpy.mock.calls[0]?.[0] as string;
		const parsed = JSON.parse(raw) as { ok: boolean };
		expect(parsed.ok).toBe(true);
		consoleSpy.mockRestore();
	});

	it("does not print human-readable header when json: true", async () => {
		repoPath = createRepoFixture({ withCodeRabbitYaml: true, withNpmrc: true });
		const consoleSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		await runVerifyCodeRabbitCLI({ repoPath, json: true });

		const allOutput = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
		expect(allOutput).not.toContain("CodeRabbit Setup Verification");
		consoleSpy.mockRestore();
	});

	it("prints human-readable output when json is not set", async () => {
		repoPath = createRepoFixture({ withCodeRabbitYaml: true, withNpmrc: true });
		const consoleSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		await runVerifyCodeRabbitCLI({ repoPath });

		const allOutput = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
		expect(allOutput).toContain("CodeRabbit Setup Verification");
		expect(allOutput).toContain("Summary");
		consoleSpy.mockRestore();
	});

	it("prints details when verbose: true", async () => {
		repoPath = createRepoFixture({ withCodeRabbitYaml: true, withNpmrc: true });
		const consoleSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		await runVerifyCodeRabbitCLI({ repoPath, verbose: true });

		const allOutput = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
		// verbose should print Details: JSON for checks that have details
		expect(allOutput).toContain("Details:");
		consoleSpy.mockRestore();
	});

	it("does not print details when verbose is not set", async () => {
		repoPath = createRepoFixture({ withCodeRabbitYaml: true, withNpmrc: true });
		const consoleSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		await runVerifyCodeRabbitCLI({ repoPath });

		const allOutput = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
		expect(allOutput).not.toContain("Details:");
		consoleSpy.mockRestore();
	});

	it("EXIT_CODES constants have expected values", () => {
		expect(EXIT_CODES.SUCCESS).toBe(0);
		expect(EXIT_CODES.VALIDATION_ERROR).toBe(1);
		expect(EXIT_CODES.NOT_FOUND).toBe(2);
		expect(EXIT_CODES.PERMISSION_DENIED).toBe(3);
		expect(EXIT_CODES.SYSTEM_ERROR).toBe(10);
	});
});

// ---------------------------------------------------------------------------
// Edge/regression cases
// ---------------------------------------------------------------------------

describe("runVerifyCodeRabbit - edge cases", () => {
	let repoPath: string;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("GITHUB_TOKEN", "");
		vi.stubEnv("GITHUB_PERSONAL_ACCESS_TOKEN", "");
	});

	afterEach(() => {
		if (repoPath) rmSync(repoPath, { recursive: true, force: true });
		vi.unstubAllEnvs();
	});

	it("uses process.cwd() as repoPath when none is provided (does not throw)", async () => {
		// Just verify the call resolves without throwing; cwd is not a controlled fixture
		const result = await runVerifyCodeRabbit({});
		expect(result).toHaveProperty("ok");
		expect(result).toHaveProperty("checks");
		expect(result).toHaveProperty("summary");
	});

	it("ruleset with no required_status_checks rule treats as missing CodeRabbit", async () => {
		repoPath = createRepoFixture({ withCodeRabbitYaml: true, withNpmrc: true });

		mockGitHubClient.mockImplementation(
			() =>
				({
					getDefaultBranch: vi.fn(async () => "main"),
					listCheckRunsForRef: vi.fn(async () => [makeCheckRun("CodeRabbit")]),
					listRulesets: vi.fn(async () => [makeRulesetSummary("protect")]),
					getRuleset: vi.fn(
						async () =>
							({
								id: 1,
								name: "protect",
								target: "branch",
								enforcement: "active",
								bypass_actors: [],
								conditions: {},
								rules: [{ type: "deletion" }], // no required_status_checks rule
							}) as Ruleset,
					),
				}) as unknown as GitHubClient,
		);

		const result = await runVerifyCodeRabbit({
			repoPath,
			token: "ghp_test",
			owner: "octo",
			repo: "harness",
		});

		const rulesetCheck = result.checks.find(
			(c) => c.name === "Ruleset Configuration",
		);
		expect(rulesetCheck?.status).toBe("fail");
		expect(rulesetCheck?.message).toContain('does not require "CodeRabbit"');
	});

	it("only the first non-CodeRabbit check run in list still returns warn for check run presence", async () => {
		repoPath = createRepoFixture({ withCodeRabbitYaml: true, withNpmrc: true });

		mockGitHubClient.mockImplementation(
			() =>
				({
					getDefaultBranch: vi.fn(async () => "main"),
					listCheckRunsForRef: vi.fn(async () => [
						makeCheckRun("lint", 1),
						makeCheckRun("typecheck", 2),
					]),
					listRulesets: vi.fn(async () => [] as RulesetSummary[]),
					getRuleset: vi.fn(async () => makeRuleset([])),
				}) as unknown as GitHubClient,
		);

		const result = await runVerifyCodeRabbit({
			repoPath,
			token: "ghp_test",
			owner: "octo",
			repo: "harness",
		});

		const checkRunCheck = result.checks.find(
			(c) => c.name === "CodeRabbit check run presence",
		);
		expect(checkRunCheck?.status).toBe("warn");
	});

	it("a non-protect ruleset with CodeRabbit does not satisfy the protect check", async () => {
		repoPath = createRepoFixture({ withCodeRabbitYaml: true, withNpmrc: true });

		mockGitHubClient.mockImplementation(
			() =>
				({
					getDefaultBranch: vi.fn(async () => "main"),
					listCheckRunsForRef: vi.fn(async () => [makeCheckRun("CodeRabbit")]),
					listRulesets: vi.fn(
						async () =>
							[makeRulesetSummary("other-ruleset", 2)] as RulesetSummary[],
					),
					getRuleset: vi.fn(async () => makeRuleset(["CodeRabbit"])),
				}) as unknown as GitHubClient,
		);

		const result = await runVerifyCodeRabbit({
			repoPath,
			token: "ghp_test",
			owner: "octo",
			repo: "harness",
		});

		const rulesetCheck = result.checks.find(
			(c) => c.name === "Ruleset Configuration",
		);
		// No "protect" ruleset → warn, not pass
		expect(rulesetCheck?.status).toBe("warn");
	});
});
