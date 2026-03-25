import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Ruleset, RulesetSummary } from "../lib/github/client.js";
import { runVerifyGreptile } from "./verify-greptile.js";

vi.mock("../lib/github/client.js", () => ({
	GitHubClient: vi.fn(),
}));

import { GitHubClient } from "../lib/github/client.js";

const mockGitHubClient = vi.mocked(GitHubClient);

function createRepoFixture(): string {
	const repoPath = mkdtempSync(join(tmpdir(), "verify-greptile-"));
	mkdirSync(join(repoPath, ".greptile"), { recursive: true });
	mkdirSync(join(repoPath, ".github", "workflows"), { recursive: true });

	writeFileSync(
		join(repoPath, ".greptile", "config.json"),
		JSON.stringify(
			{
				version: "1",
				strictness: 2,
				fileChangeLimit: 300,
				commentTypes: ["bug-risk", "security"],
				enableCrossFileGraphQueries: true,
				requireIndependentValidation: true,
				confidence: { minMergeScore: 4, targetScore: 5 },
			},
			null,
			2,
		),
	);
	writeFileSync(join(repoPath, ".greptile", "rules.md"), "# rules\n");
	writeFileSync(join(repoPath, ".greptile", "files.json"), "[]\n");
	writeFileSync(
		join(repoPath, ".github", "workflows", "greptile-review.yml"),
		[
			"on:",
			"  pull_request:",
			"  pull_request_review:",
			"  pull_request_review_comment:",
			"  issue_comment:",
			"permissions:",
			"  checks: write",
		].join("\n"),
	);
	writeFileSync(join(repoPath, ".npmrc"), "ignore-scripts=true\n");

	return repoPath;
}

describe("runVerifyGreptile", () => {
	let repoPath: string;

	beforeEach(() => {
		repoPath = createRepoFixture();
		vi.clearAllMocks();
		vi.stubGlobal("fetch", vi.fn());
		vi.stubEnv("GITHUB_TOKEN", "");
		vi.stubEnv("GITHUB_PERSONAL_ACCESS_TOKEN", "");
		vi.stubEnv("GITHUB_APP_ID", "");
		vi.stubEnv("GITHUB_APP_PRIVATE_KEY", "");
		vi.stubEnv("GITHUB_APP_PRIVATE_KEY_PATH", "");
	});

	afterEach(() => {
		rmSync(repoPath, { recursive: true, force: true });
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
	});

	it("shows actionable warning when PAT is used for installation endpoint", async () => {
		vi.mocked(fetch).mockResolvedValue({
			status: 401,
			json: async () => ({ message: "A JSON web token could not be decoded" }),
		} as Response);

		mockGitHubClient.mockImplementation(
			() =>
				({
					listRulesets: vi.fn(
						async () =>
							[
								{
									id: 1,
									name: "protect",
									target: "branch",
									enforcement: "active",
								},
							] as RulesetSummary[],
					),
					getRuleset: vi.fn(
						async () =>
							({
								id: 1,
								name: "protect",
								target: "branch",
								enforcement: "active",
								bypass_actors: [],
								conditions: {
									ref_name: { include: ["refs/heads/main"], exclude: [] },
								},
								rules: [
									{
										type: "required_status_checks",
										parameters: {
											required_status_checks: [{ context: "Greptile Review" }],
										},
									},
								],
							}) as Ruleset,
					),
				}) as unknown as GitHubClient,
		);

		const result = await runVerifyGreptile({
			token: "ghp_test",
			owner: "jscraik",
			repo: "coding-harness",
			repoPath,
		});

		const appCheck = result.checks.find(
			(check) => check.name === "GitHub App Installation",
		);
		expect(appCheck?.status).toBe("warn");
		expect(appCheck?.message).toContain("expects a GitHub App JWT");

		const rulesetCheck = result.checks.find(
			(check) => check.name === "Ruleset Configuration",
		);
		expect(rulesetCheck?.status).toBe("pass");
	});

	it("verifies installation with GitHub App JWT when app credentials are provided", async () => {
		const { privateKey } = generateKeyPairSync("rsa", {
			modulusLength: 2048,
			privateKeyEncoding: { type: "pkcs1", format: "pem" },
			publicKeyEncoding: { type: "spki", format: "pem" },
		});
		const keyPath = join(repoPath, "app-private-key.pem");
		writeFileSync(keyPath, privateKey);

		vi.mocked(fetch).mockResolvedValue({
			status: 200,
			json: async () => ({ id: 123 }),
		} as Response);

		const result = await runVerifyGreptile({
			owner: "jscraik",
			repo: "coding-harness",
			repoPath,
			appId: "12345",
			appPrivateKeyPath: keyPath,
		});

		const appCheck = result.checks.find(
			(check) => check.name === "GitHub App Installation",
		);
		expect(appCheck?.status).toBe("pass");
		expect(appCheck?.details?.authMode).toBe("app_jwt");

		const rulesetCheck = result.checks.find(
			(check) => check.name === "Ruleset Configuration",
		);
		expect(rulesetCheck?.status).toBe("warn");
		expect(rulesetCheck?.message).toContain("Skipped ruleset verification");

		expect(fetch).toHaveBeenCalledTimes(1);
		const authorizationHeader = vi.mocked(fetch).mock.calls[0]?.[1]
			?.headers as Record<string, string>;
		const authorizationValue = authorizationHeader.Authorization;
		expect(authorizationValue).toBeDefined();
		expect(authorizationValue?.startsWith("Bearer ")).toBe(true);
		expect(authorizationValue?.split(".").length).toBe(3);
		expect(mockGitHubClient).not.toHaveBeenCalled();
	});

	it("fails when required local Greptile files are missing", async () => {
		rmSync(join(repoPath, ".greptile", "rules.md"));
		rmSync(join(repoPath, ".greptile", "files.json"));

		const result = await runVerifyGreptile({
			repoPath,
		});

		expect(result.ok).toBe(false);
		expect(
			result.checks.find((check) => check.name === ".greptile/rules.md")
				?.status,
		).toBe("fail");
		expect(
			result.checks.find((check) => check.name === ".greptile/files.json")
				?.status,
		).toBe("fail");
	});

	it("shows actionable warning when .npmrc is missing", async () => {
		rmSync(join(repoPath, ".npmrc"));

		const result = await runVerifyGreptile({
			repoPath,
		});

		const npmrcCheck = result.checks.find(
			(check) => check.name === ".npmrc configuration",
		);
		expect(npmrcCheck?.status).toBe("warn");
		expect(npmrcCheck?.message).toContain("harness init");
		expect(npmrcCheck?.message).toContain("ignore-scripts=true");
	});
});
