import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	Ruleset,
	RulesetPayload,
	RulesetSummary,
} from "../lib/github/client.js";
import { runBranchProtect, runBranchProtectCLI } from "./branch-protect.js";

vi.mock("../lib/github/client.js", () => ({
	GitHubClient: vi.fn(),
}));

vi.mock("../lib/contract/loader.js", () => ({
	loadContract: vi.fn(),
	ContractLoadError: class ContractLoadError extends Error {},
}));

import { loadContract } from "../lib/contract/loader.js";
import { GitHubClient } from "../lib/github/client.js";

const mockGitHubClient = vi.mocked(GitHubClient);
const mockLoadContract = vi.mocked(loadContract);

describe("runBranchProtect", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("GITHUB_TOKEN", "");
		vi.stubEnv("GITHUB_PERSONAL_ACCESS_TOKEN", "");
		mockLoadContract.mockReturnValue({
			version: "1.0",
			riskTierRules: {},
			branchProtection: {
				requiredChecks: [
					"pr-template",
					"linear-gate",
					"risk-policy-gate",
					"dependency-review",
					"actions-pinning",
					"consistency-drift-health",
					"lint",
					"typecheck",
					"test",
					"audit",
					"check",
					"memory",
					"security-scan",
					"Greptile Review",
				],
			},
		});
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("returns validation error when token is missing", async () => {
		const result = await runBranchProtect({
			owner: "octo",
			repo: "harness",
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("VALIDATION_ERROR");
			expect(result.error.message).toContain("Missing GitHub token");
		}
	});

	it("creates a ruleset when none exists", async () => {
		const listRulesets = vi.fn(async () => [] as RulesetSummary[]);
		const updateRepositoryMergeSettings = vi.fn(async () => undefined);
		const createRuleset = vi.fn(
			async (payload: RulesetPayload) =>
				({
					id: 123,
					name: payload.name,
					target: payload.target,
					enforcement: payload.enforcement,
					bypass_actors: payload.bypass_actors,
					conditions: payload.conditions,
					rules: payload.rules,
				}) as Ruleset,
		);

		mockGitHubClient.mockImplementation(
			() =>
				({
					listRulesets,
					createRuleset,
					updateRepositoryMergeSettings,
				}) as unknown as GitHubClient,
		);

		const result = await runBranchProtect({
			token: "token",
			owner: "octo",
			repo: "harness",
			branch: "main",
			requiredChecks: ["Greptile Review"],
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.action).toBe("created");
			expect(result.output.rulesetId).toBe(123);
		}

		expect(listRulesets).toHaveBeenCalledTimes(1);
		expect(createRuleset).toHaveBeenCalledTimes(1);
		expect(updateRepositoryMergeSettings).toHaveBeenCalledWith({
			allowMergeCommit: true,
			allowSquashMerge: true,
			allowRebaseMerge: true,
		});
		expect(createRuleset.mock.calls[0]?.[0]).toMatchObject({
			name: "protect",
			target: "branch",
			enforcement: "active",
		});
		const pullRequestRule = createRuleset.mock.calls[0]?.[0].rules.find(
			(rule) => rule.type === "pull_request",
		);
		expect(pullRequestRule?.parameters).toMatchObject({
			required_approving_review_count: 1,
			require_code_owner_review: false,
			require_last_push_approval: false,
			required_review_thread_resolution: true,
		});
		expect(
			createRuleset.mock.calls[0]?.[0].rules.some(
				(rule) => rule.type === "required_linear_history",
			),
		).toBe(true);
		expect(
			createRuleset.mock.calls[0]?.[0].rules.find(
				(rule) => rule.type === "code_quality",
			)?.parameters,
		).toMatchObject({
			severity: "all",
		});
	});

	it("reports a partial failure when merge settings fail after ruleset creation", async () => {
		const listRulesets = vi.fn(async () => [] as RulesetSummary[]);
		const createRuleset = vi.fn(
			async (payload: RulesetPayload) =>
				({
					id: 124,
					name: payload.name,
					target: payload.target,
					enforcement: payload.enforcement,
					bypass_actors: payload.bypass_actors,
					conditions: payload.conditions,
					rules: payload.rules,
				}) as Ruleset,
		);
		const updateRepositoryMergeSettings = vi.fn(async () => {
			throw new Error("merge settings denied");
		});

		mockGitHubClient.mockImplementation(
			() =>
				({
					listRulesets,
					createRuleset,
					updateRepositoryMergeSettings,
				}) as unknown as GitHubClient,
		);

		const result = await runBranchProtect({
			token: "token",
			owner: "octo",
			repo: "harness",
			branch: "main",
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("SYSTEM_ERROR");
			expect(result.error.message).toContain(
				"Configured branch protection ruleset, but failed to apply repository merge settings",
			);
			expect(result.error.message).toContain("merge settings denied");
		}
		expect(createRuleset).toHaveBeenCalledTimes(1);
		expect(updateRepositoryMergeSettings).toHaveBeenCalledTimes(1);
	});

	it("updates existing ruleset and preserves unrelated rules", async () => {
		const listRulesets = vi.fn(
			async () =>
				[
					{
						id: 7,
						name: "protect",
						target: "branch",
						enforcement: "active",
						conditions: {
							ref_name: {
								include: ["refs/heads/main"],
								exclude: [],
							},
						},
					},
				] as RulesetSummary[],
		);

		const getRuleset = vi.fn(
			async () =>
				({
					id: 7,
					name: "protect",
					target: "branch",
					enforcement: "active",
					bypass_actors: [],
					conditions: {
						ref_name: {
							include: ["refs/heads/main"],
							exclude: [],
						},
					},
					rules: [
						{
							type: "required_status_checks",
							parameters: {
								required_status_checks: [{ context: "existing-check" }],
							},
						},
						{
							type: "copilot_code_review",
						},
					],
				}) as Ruleset,
		);

		const updateRuleset = vi.fn(
			async (_id: number, payload: RulesetPayload) =>
				({
					id: 7,
					name: payload.name,
					target: payload.target,
					enforcement: payload.enforcement,
					bypass_actors: payload.bypass_actors,
					conditions: payload.conditions,
					rules: payload.rules,
				}) as Ruleset,
		);

		mockGitHubClient.mockImplementation(
			() =>
				({
					listRulesets,
					getRuleset,
					updateRuleset,
				}) as unknown as GitHubClient,
		);

		const result = await runBranchProtect({
			token: "token",
			owner: "octo",
			repo: "harness",
			requiredChecks: ["Greptile Review"],
		});

		expect(result.ok).toBe(true);
		expect(updateRuleset).toHaveBeenCalledTimes(1);
		const payload = updateRuleset.mock.calls[0]?.[1];
		expect(
			payload?.rules.some((rule) => rule.type === "copilot_code_review"),
		).toBe(true);
		const requiredRule = payload?.rules.find(
			(rule) => rule.type === "required_status_checks",
		);
		expect(requiredRule).toBeDefined();
		expect(requiredRule?.parameters).toMatchObject({
			required_status_checks: [
				{ context: "existing-check" },
				{ context: "Greptile Review" },
			],
		});
		expect(payload?.conditions?.ref_name?.include).toEqual(["refs/heads/main"]);
	});

	it("adds public CodeQL code scanning requirements for public repositories", async () => {
		const listRulesets = vi.fn(async () => [] as RulesetSummary[]);
		const createRuleset = vi.fn(
			async (payload: RulesetPayload) =>
				({
					id: 88,
					name: payload.name,
					target: payload.target,
					enforcement: payload.enforcement,
					bypass_actors: payload.bypass_actors,
					conditions: payload.conditions,
					rules: payload.rules,
				}) as Ruleset,
		);
		const getRepositoryVisibility = vi.fn(async () => "public");

		mockGitHubClient.mockImplementation(
			() =>
				({
					listRulesets,
					createRuleset,
					getRepositoryVisibility,
				}) as unknown as GitHubClient,
		);

		const result = await runBranchProtect({
			token: "token",
			owner: "octo",
			repo: "harness",
		});

		expect(result.ok).toBe(true);
		const payload = createRuleset.mock.calls[0]?.[0];
		expect(
			payload?.rules.find((rule) => rule.type === "code_scanning")?.parameters,
		).toMatchObject({
			code_scanning_tools: [
				{
					tool: "CodeQL",
					alerts_threshold: "errors",
					security_alerts_threshold: "high_or_higher",
				},
			],
		});
	});

	it("removes managed code scanning rules for non-public repositories", async () => {
		const listRulesets = vi.fn(
			async () =>
				[
					{
						id: 89,
						name: "protect",
						target: "branch",
						enforcement: "active",
						conditions: {
							ref_name: {
								include: ["refs/heads/main"],
								exclude: [],
							},
						},
					},
				] as RulesetSummary[],
		);
		const getRuleset = vi.fn(
			async () =>
				({
					id: 89,
					name: "protect",
					target: "branch",
					enforcement: "active",
					bypass_actors: [],
					conditions: {
						ref_name: {
							include: ["refs/heads/main"],
							exclude: [],
						},
					},
					rules: [
						{
							type: "code_scanning",
							parameters: {
								code_scanning_tools: [
									{
										tool: "CodeQL",
										alerts_threshold: "errors",
										security_alerts_threshold: "high_or_higher",
									},
								],
							},
						},
					],
				}) as Ruleset,
		);
		const updateRuleset = vi.fn(
			async (_id: number, payload: RulesetPayload) =>
				({
					id: 89,
					name: payload.name,
					target: payload.target,
					enforcement: payload.enforcement,
					bypass_actors: payload.bypass_actors,
					conditions: payload.conditions,
					rules: payload.rules,
				}) as Ruleset,
		);
		const getRepositoryVisibility = vi.fn(async () => "private");

		mockGitHubClient.mockImplementation(
			() =>
				({
					listRulesets,
					getRuleset,
					updateRuleset,
					getRepositoryVisibility,
				}) as unknown as GitHubClient,
		);

		const result = await runBranchProtect({
			token: "token",
			owner: "octo",
			repo: "harness",
		});

		expect(result.ok).toBe(true);
		const payload = updateRuleset.mock.calls[0]?.[1];
		expect(payload?.rules.some((rule) => rule.type === "code_scanning")).toBe(
			false,
		);
	});

	it("uses branchProtection.requiredChecks from contract by default", async () => {
		const listRulesets = vi.fn(async () => [] as RulesetSummary[]);
		const createRuleset = vi.fn(
			async (payload: RulesetPayload) =>
				({
					id: 55,
					name: payload.name,
					target: payload.target,
					enforcement: payload.enforcement,
					bypass_actors: payload.bypass_actors,
					conditions: payload.conditions,
					rules: payload.rules,
				}) as Ruleset,
		);

		mockGitHubClient.mockImplementation(
			() =>
				({
					listRulesets,
					createRuleset,
				}) as unknown as GitHubClient,
		);

		const result = await runBranchProtect({
			token: "token",
			owner: "octo",
			repo: "harness",
		});

		expect(result.ok).toBe(true);
		expect(mockLoadContract).toHaveBeenCalledWith("harness.contract.json");
		const payload = createRuleset.mock.calls[0]?.[0];
		const requiredRule = payload?.rules.find(
			(rule) => rule.type === "required_status_checks",
		);
		expect(requiredRule?.parameters).toMatchObject({
			required_status_checks: [
				{ context: "pr-template" },
				{ context: "linear-gate" },
				{ context: "risk-policy-gate" },
				{ context: "dependency-review" },
				{ context: "actions-pinning" },
				{ context: "consistency-drift-health" },
				{ context: "lint" },
				{ context: "typecheck" },
				{ context: "test" },
				{ context: "audit" },
				{ context: "check" },
				{ context: "memory" },
				{ context: "security-scan" },
				{ context: "Greptile Review" },
			],
		});
	});

	it("falls back to legacy reviewPolicy.requiredChecks when branchProtection is absent", async () => {
		mockLoadContract.mockReturnValue({
			version: "1.0",
			riskTierRules: {},
			reviewPolicy: {
				timeoutSeconds: 600,
				timeoutAction: "fail",
				requiredChecks: ["security-scan", "dependency-review"],
			},
		});

		const listRulesets = vi.fn(async () => [] as RulesetSummary[]);
		const createRuleset = vi.fn(
			async (payload: RulesetPayload) =>
				({
					id: 56,
					name: payload.name,
					target: payload.target,
					enforcement: payload.enforcement,
					bypass_actors: payload.bypass_actors,
					conditions: payload.conditions,
					rules: payload.rules,
				}) as Ruleset,
		);

		mockGitHubClient.mockImplementation(
			() =>
				({
					listRulesets,
					createRuleset,
				}) as unknown as GitHubClient,
		);

		const result = await runBranchProtect({
			token: "token",
			owner: "octo",
			repo: "harness",
		});

		expect(result.ok).toBe(true);
		const payload = createRuleset.mock.calls[0]?.[0];
		const requiredRule = payload?.rules.find(
			(rule) => rule.type === "required_status_checks",
		);
		expect(requiredRule?.parameters).toMatchObject({
			required_status_checks: [
				{ context: "security-scan" },
				{ context: "dependency-review" },
			],
		});
	});

	it("falls back to harness baseline checks when contract loading fails", async () => {
		mockLoadContract.mockImplementation(() => {
			throw new Error("contract missing");
		});

		const listRulesets = vi.fn(async () => [] as RulesetSummary[]);
		const createRuleset = vi.fn(
			async (payload: RulesetPayload) =>
				({
					id: 57,
					name: payload.name,
					target: payload.target,
					enforcement: payload.enforcement,
					bypass_actors: payload.bypass_actors,
					conditions: payload.conditions,
					rules: payload.rules,
				}) as Ruleset,
		);

		mockGitHubClient.mockImplementation(
			() =>
				({
					listRulesets,
					createRuleset,
				}) as unknown as GitHubClient,
		);

		const result = await runBranchProtect({
			token: "token",
			owner: "octo",
			repo: "harness",
		});

		expect(result.ok).toBe(true);
		const payload = createRuleset.mock.calls[0]?.[0];
		const requiredRule = payload?.rules.find(
			(rule) => rule.type === "required_status_checks",
		);
		expect(requiredRule?.parameters).toMatchObject({
			required_status_checks: [
				{ context: "pr-template" },
				{ context: "linear-gate" },
				{ context: "risk-policy-gate" },
				{ context: "dependency-review" },
				{ context: "actions-pinning" },
				{ context: "consistency-drift-health" },
				{ context: "docs-gate" },
				{ context: "lint" },
				{ context: "typecheck" },
				{ context: "test" },
				{ context: "audit" },
				{ context: "check" },
				{ context: "memory" },
				{ context: "security-scan" },
				{ context: "Greptile Review" },
			],
		});
	});

	it("supports dry-run without applying changes", async () => {
		const listRulesets = vi.fn(async () => [] as RulesetSummary[]);
		const createRuleset = vi.fn();
		const getRepositoryVisibility = vi.fn(async () => "public");

		mockGitHubClient.mockImplementation(
			() =>
				({
					listRulesets,
					createRuleset,
					getRepositoryVisibility,
				}) as unknown as GitHubClient,
		);

		const result = await runBranchProtect({
			token: "token",
			owner: "octo",
			repo: "harness",
			dryRun: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.action).toBe("dry_run");
			expect(result.output.repositoryVisibility).toBe("public");
			expect(result.output.managedPolicy).toMatchObject({
				requiredApprovingReviewCount: 1,
				restrictDeletions: true,
				blockForcePushes: true,
				requireLinearHistory: true,
				requirePullRequest: true,
				dismissStaleReviewsOnPush: true,
				requireConversationResolution: true,
				requireCodeOwnerReview: false,
				requireLastPushApproval: false,
				requireBranchesUpToDate: true,
				allowedMergeMethods: {
					mergeCommit: true,
					squash: true,
					rebase: true,
				},
				codeQuality: {
					required: true,
					severity: "all",
				},
				publicCodeScanning: {
					required: true,
					publicOnly: true,
					tool: "CodeQL",
					alertsThreshold: "errors",
					securityAlertsThreshold: "high_or_higher",
				},
			});
		}
		expect(createRuleset).not.toHaveBeenCalled();
	});

	it("emits dry-run JSON with managed policy snapshot", async () => {
		const listRulesets = vi.fn(async () => [] as RulesetSummary[]);
		const getRepositoryVisibility = vi.fn(async () => "public");
		const consoleInfo = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		mockGitHubClient.mockImplementation(
			() =>
				({
					listRulesets,
					getRepositoryVisibility,
				}) as unknown as GitHubClient,
		);

		const exitCode = await runBranchProtectCLI({
			token: "token",
			owner: "octo",
			repo: "harness",
			dryRun: true,
			json: true,
		});

		expect(exitCode).toBe(0);
		expect(consoleInfo).toHaveBeenCalledTimes(1);

		const payload = JSON.parse(consoleInfo.mock.calls[0]?.[0] as string) as {
			action: string;
			repositoryVisibility?: string;
			managedPolicy: {
				requiredApprovingReviewCount: number;
				requireLinearHistory: boolean;
				requireCodeOwnerReview: boolean;
				requireLastPushApproval: boolean;
				requireBranchesUpToDate: boolean;
				allowedMergeMethods: {
					mergeCommit: boolean;
					squash: boolean;
					rebase: boolean;
				};
				codeQuality?: { severity: string };
				publicCodeScanning?: {
					tool: string;
					securityAlertsThreshold: string;
				};
			};
		};

		expect(payload.action).toBe("dry_run");
		expect(payload.repositoryVisibility).toBe("public");
		expect(payload.managedPolicy).toMatchObject({
			requiredApprovingReviewCount: 1,
			requireLinearHistory: true,
			requireCodeOwnerReview: false,
			requireLastPushApproval: false,
			requireBranchesUpToDate: true,
			allowedMergeMethods: {
				mergeCommit: true,
				squash: true,
				rebase: true,
			},
			codeQuality: { severity: "all" },
			publicCodeScanning: {
				tool: "CodeQL",
				securityAlertsThreshold: "high_or_higher",
			},
		});
	});

	it("matches existing ruleset when summary conditions are omitted", async () => {
		const listRulesets = vi.fn(
			async () =>
				[
					{
						id: 9,
						name: "protect",
						target: "branch",
						enforcement: "active",
					},
				] as RulesetSummary[],
		);

		const getRuleset = vi.fn(
			async () =>
				({
					id: 9,
					name: "protect",
					target: "branch",
					enforcement: "active",
					bypass_actors: [],
					conditions: {
						ref_name: {
							include: ["refs/heads/main"],
							exclude: [],
						},
					},
					rules: [],
				}) as Ruleset,
		);
		const updateRuleset = vi.fn(
			async (_id: number, payload: RulesetPayload) =>
				({
					id: 9,
					name: payload.name,
					target: payload.target,
					enforcement: payload.enforcement,
					bypass_actors: payload.bypass_actors,
					conditions: payload.conditions,
					rules: payload.rules,
				}) as Ruleset,
		);
		const createRuleset = vi.fn();

		mockGitHubClient.mockImplementation(
			() =>
				({
					listRulesets,
					getRuleset,
					updateRuleset,
					createRuleset,
				}) as unknown as GitHubClient,
		);

		const result = await runBranchProtect({
			token: "token",
			owner: "octo",
			repo: "harness",
		});

		expect(result.ok).toBe(true);
		expect(getRuleset).toHaveBeenCalledWith(9);
		expect(updateRuleset).toHaveBeenCalledTimes(1);
		expect(createRuleset).not.toHaveBeenCalled();
	});

	it("matches existing ruleset when include selector uses wildcard patterns", async () => {
		const listRulesets = vi.fn(
			async () =>
				[
					{
						id: 15,
						name: "protect",
						target: "branch",
						enforcement: "active",
						conditions: {
							ref_name: {
								include: ["refs/heads/*"],
								exclude: [],
							},
						},
					},
				] as RulesetSummary[],
		);
		const getRuleset = vi.fn(
			async () =>
				({
					id: 15,
					name: "protect",
					target: "branch",
					enforcement: "active",
					bypass_actors: [],
					conditions: {
						ref_name: {
							include: ["refs/heads/*"],
							exclude: [],
						},
					},
					rules: [],
				}) as Ruleset,
		);
		const updateRuleset = vi.fn(
			async (_id: number, payload: RulesetPayload) =>
				({
					id: 15,
					name: payload.name,
					target: payload.target,
					enforcement: payload.enforcement,
					bypass_actors: payload.bypass_actors,
					conditions: payload.conditions,
					rules: payload.rules,
				}) as Ruleset,
		);
		const createRuleset = vi.fn();

		mockGitHubClient.mockImplementation(
			() =>
				({
					listRulesets,
					getRuleset,
					updateRuleset,
					createRuleset,
				}) as unknown as GitHubClient,
		);

		const result = await runBranchProtect({
			token: "token",
			owner: "octo",
			repo: "harness",
			branch: "main",
		});

		expect(result.ok).toBe(true);
		expect(getRuleset).toHaveBeenCalledWith(15);
		expect(updateRuleset).toHaveBeenCalledTimes(1);
		expect(createRuleset).not.toHaveBeenCalled();
	});

	it("does not match an existing ruleset when target branch is excluded", async () => {
		const listRulesets = vi.fn(
			async () =>
				[
					{
						id: 16,
						name: "protect",
						target: "branch",
						enforcement: "active",
						conditions: {
							ref_name: {
								include: ["refs/heads/*"],
								exclude: ["refs/heads/main"],
							},
						},
					},
				] as RulesetSummary[],
		);
		const createRuleset = vi.fn(
			async (payload: RulesetPayload) =>
				({
					id: 160,
					name: payload.name,
					target: payload.target,
					enforcement: payload.enforcement,
					bypass_actors: payload.bypass_actors,
					conditions: payload.conditions,
					rules: payload.rules,
				}) as Ruleset,
		);
		const updateRuleset = vi.fn();

		mockGitHubClient.mockImplementation(
			() =>
				({
					listRulesets,
					createRuleset,
					updateRuleset,
				}) as unknown as GitHubClient,
		);

		const result = await runBranchProtect({
			token: "token",
			owner: "octo",
			repo: "harness",
			branch: "main",
		});

		expect(result.ok).toBe(true);
		expect(createRuleset).toHaveBeenCalledTimes(1);
		expect(updateRuleset).not.toHaveBeenCalled();
	});

	it("matches ~DEFAULT_BRANCH selectors using repository default branch", async () => {
		const listRulesets = vi.fn(
			async () =>
				[
					{
						id: 17,
						name: "protect",
						target: "branch",
						enforcement: "active",
						conditions: {
							ref_name: {
								include: ["~DEFAULT_BRANCH"],
								exclude: [],
							},
						},
					},
				] as RulesetSummary[],
		);
		const getRuleset = vi.fn(
			async () =>
				({
					id: 17,
					name: "protect",
					target: "branch",
					enforcement: "active",
					bypass_actors: [],
					conditions: {
						ref_name: {
							include: ["~DEFAULT_BRANCH"],
							exclude: [],
						},
					},
					rules: [],
				}) as Ruleset,
		);
		const getDefaultBranch = vi.fn(async () => "master");
		const updateRuleset = vi.fn(
			async (_id: number, payload: RulesetPayload) =>
				({
					id: 17,
					name: payload.name,
					target: payload.target,
					enforcement: payload.enforcement,
					bypass_actors: payload.bypass_actors,
					conditions: payload.conditions,
					rules: payload.rules,
				}) as Ruleset,
		);
		const createRuleset = vi.fn();

		mockGitHubClient.mockImplementation(
			() =>
				({
					getDefaultBranch,
					listRulesets,
					getRuleset,
					updateRuleset,
					createRuleset,
				}) as unknown as GitHubClient,
		);

		const result = await runBranchProtect({
			token: "token",
			owner: "octo",
			repo: "harness",
			branch: "master",
		});

		expect(result.ok).toBe(true);
		expect(getDefaultBranch).toHaveBeenCalledTimes(1);
		expect(updateRuleset).toHaveBeenCalledTimes(1);
		expect(createRuleset).not.toHaveBeenCalled();
	});

	it("preserves stricter existing pull request protections", async () => {
		const listRulesets = vi.fn(
			async () =>
				[
					{
						id: 19,
						name: "protect",
						target: "branch",
						enforcement: "active",
						conditions: {
							ref_name: {
								include: ["refs/heads/main"],
								exclude: [],
							},
						},
					},
				] as RulesetSummary[],
		);
		const getRuleset = vi.fn(
			async () =>
				({
					id: 19,
					name: "protect",
					target: "branch",
					enforcement: "active",
					bypass_actors: [],
					conditions: {
						ref_name: {
							include: ["refs/heads/main"],
							exclude: [],
						},
					},
					rules: [
						{
							type: "pull_request",
							parameters: {
								required_approving_review_count: 2,
								require_code_owner_review: true,
								require_last_push_approval: true,
							},
						},
					],
				}) as Ruleset,
		);
		const updateRuleset = vi.fn(
			async (_id: number, payload: RulesetPayload) =>
				({
					id: 19,
					name: payload.name,
					target: payload.target,
					enforcement: payload.enforcement,
					bypass_actors: payload.bypass_actors,
					conditions: payload.conditions,
					rules: payload.rules,
				}) as Ruleset,
		);

		mockGitHubClient.mockImplementation(
			() =>
				({
					listRulesets,
					getRuleset,
					updateRuleset,
				}) as unknown as GitHubClient,
		);

		const result = await runBranchProtect({
			token: "token",
			owner: "octo",
			repo: "harness",
			requiredApprovingReviewCount: 1,
		});

		expect(result.ok).toBe(true);
		const payload = updateRuleset.mock.calls[0]?.[1];
		const pullRequestRule = payload?.rules.find(
			(rule) => rule.type === "pull_request",
		);
		expect(pullRequestRule?.parameters).toMatchObject({
			required_approving_review_count: 2,
			require_code_owner_review: false,
			require_last_push_approval: false,
		});
	});

	it("preserves existing multi-ref include scope when updating", async () => {
		const listRulesets = vi.fn(
			async () =>
				[
					{
						id: 29,
						name: "protect",
						target: "branch",
						enforcement: "active",
						conditions: {
							ref_name: {
								include: ["refs/heads/main", "refs/heads/release/*"],
								exclude: [],
							},
						},
					},
				] as RulesetSummary[],
		);
		const getRuleset = vi.fn(
			async () =>
				({
					id: 29,
					name: "protect",
					target: "branch",
					enforcement: "active",
					bypass_actors: [],
					conditions: {
						ref_name: {
							include: ["refs/heads/main", "refs/heads/release/*"],
							exclude: [],
						},
					},
					rules: [],
				}) as Ruleset,
		);
		const updateRuleset = vi.fn(
			async (_id: number, payload: RulesetPayload) =>
				({
					id: 29,
					name: payload.name,
					target: payload.target,
					enforcement: payload.enforcement,
					bypass_actors: payload.bypass_actors,
					conditions: payload.conditions,
					rules: payload.rules,
				}) as Ruleset,
		);

		mockGitHubClient.mockImplementation(
			() =>
				({
					listRulesets,
					getRuleset,
					updateRuleset,
				}) as unknown as GitHubClient,
		);

		const result = await runBranchProtect({
			token: "token",
			owner: "octo",
			repo: "harness",
			branch: "main",
		});

		expect(result.ok).toBe(true);
		const payload = updateRuleset.mock.calls[0]?.[1];
		expect(payload?.conditions?.ref_name?.include).toEqual([
			"refs/heads/main",
			"refs/heads/release/*",
		]);
	});

	it("preserves existing required status check metadata entries", async () => {
		const listRulesets = vi.fn(
			async () =>
				[
					{
						id: 32,
						name: "protect",
						target: "branch",
						enforcement: "active",
						conditions: {
							ref_name: {
								include: ["refs/heads/main"],
								exclude: [],
							},
						},
					},
				] as RulesetSummary[],
		);
		const getRuleset = vi.fn(
			async () =>
				({
					id: 32,
					name: "protect",
					target: "branch",
					enforcement: "active",
					bypass_actors: [],
					conditions: {
						ref_name: {
							include: ["refs/heads/main"],
							exclude: [],
						},
					},
					rules: [
						{
							type: "required_status_checks",
							parameters: {
								required_status_checks: [
									{
										context: "existing-check",
										integration_id: 1234,
									},
								],
							},
						},
					],
				}) as Ruleset,
		);
		const updateRuleset = vi.fn(
			async (_id: number, payload: RulesetPayload) =>
				({
					id: 32,
					name: payload.name,
					target: payload.target,
					enforcement: payload.enforcement,
					bypass_actors: payload.bypass_actors,
					conditions: payload.conditions,
					rules: payload.rules,
				}) as Ruleset,
		);

		mockGitHubClient.mockImplementation(
			() =>
				({
					listRulesets,
					getRuleset,
					updateRuleset,
				}) as unknown as GitHubClient,
		);

		const result = await runBranchProtect({
			token: "token",
			owner: "octo",
			repo: "harness",
			requiredChecks: ["check"],
		});

		expect(result.ok).toBe(true);
		const payload = updateRuleset.mock.calls[0]?.[1];
		const requiredRule = payload?.rules.find(
			(rule) => rule.type === "required_status_checks",
		);
		expect(requiredRule?.parameters).toMatchObject({
			required_status_checks: [
				{ context: "existing-check", integration_id: 1234 },
				{ context: "check" },
			],
		});
	});

	it("preserves global scope when existing includes are empty", async () => {
		const listRulesets = vi.fn(
			async () =>
				[
					{
						id: 31,
						name: "protect",
						target: "branch",
						enforcement: "active",
						conditions: {
							ref_name: {
								include: [],
								exclude: [],
							},
						},
					},
				] as RulesetSummary[],
		);
		const getRuleset = vi.fn(
			async () =>
				({
					id: 31,
					name: "protect",
					target: "branch",
					enforcement: "active",
					bypass_actors: [],
					conditions: {
						ref_name: {
							include: [],
							exclude: [],
						},
					},
					rules: [],
				}) as Ruleset,
		);
		const updateRuleset = vi.fn(
			async (_id: number, payload: RulesetPayload) =>
				({
					id: 31,
					name: payload.name,
					target: payload.target,
					enforcement: payload.enforcement,
					bypass_actors: payload.bypass_actors,
					conditions: payload.conditions,
					rules: payload.rules,
				}) as Ruleset,
		);

		mockGitHubClient.mockImplementation(
			() =>
				({
					listRulesets,
					getRuleset,
					updateRuleset,
				}) as unknown as GitHubClient,
		);

		const result = await runBranchProtect({
			token: "token",
			owner: "octo",
			repo: "harness",
			branch: "main",
		});

		expect(result.ok).toBe(true);
		const payload = updateRuleset.mock.calls[0]?.[1];
		expect(payload?.conditions?.ref_name?.include).toEqual([]);
	});

	describe("ecosystem profiles", () => {
		it("uses typescript ecosystem profile", async () => {
			const listRulesets = vi.fn(async () => [] as RulesetSummary[]);
			const createRuleset = vi.fn(
				async (payload: RulesetPayload) =>
					({
						id: 100,
						name: payload.name,
						target: payload.target,
						enforcement: payload.enforcement,
						bypass_actors: payload.bypass_actors,
						conditions: payload.conditions,
						rules: payload.rules,
					}) as Ruleset,
			);

			mockGitHubClient.mockImplementation(
				() =>
					({
						listRulesets,
						createRuleset,
					}) as unknown as GitHubClient,
			);

			const result = await runBranchProtect({
				token: "token",
				owner: "octo",
				repo: "my-typescript-app",
				ecosystem: "typescript",
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.ecosystem).toBe("typescript");
				expect(result.output.requiredChecks).toEqual(
					expect.arrayContaining([
						"lint",
						"typecheck",
						"test",
						"audit",
						"security-scan",
						"dependency-review",
					]),
				);
			}
		});

		it("uses python ecosystem profile", async () => {
			const listRulesets = vi.fn(async () => [] as RulesetSummary[]);
			const createRuleset = vi.fn(
				async (payload: RulesetPayload) =>
					({
						id: 101,
						name: payload.name,
						target: payload.target,
						enforcement: payload.enforcement,
						bypass_actors: payload.bypass_actors,
						conditions: payload.conditions,
						rules: payload.rules,
					}) as Ruleset,
			);

			mockGitHubClient.mockImplementation(
				() =>
					({
						listRulesets,
						createRuleset,
					}) as unknown as GitHubClient,
			);

			const result = await runBranchProtect({
				token: "token",
				owner: "octo",
				repo: "my-python-app",
				ecosystem: "python",
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.ecosystem).toBe("python");
				expect(result.output.requiredChecks).toEqual(
					expect.arrayContaining([
						"lint",
						"test",
						"security-scan",
						"dependency-review",
					]),
				);
			}
		});

		it("uses rust ecosystem profile", async () => {
			const listRulesets = vi.fn(async () => [] as RulesetSummary[]);
			const createRuleset = vi.fn(
				async (payload: RulesetPayload) =>
					({
						id: 102,
						name: payload.name,
						target: payload.target,
						enforcement: payload.enforcement,
						bypass_actors: payload.bypass_actors,
						conditions: payload.conditions,
						rules: payload.rules,
					}) as Ruleset,
			);

			mockGitHubClient.mockImplementation(
				() =>
					({
						listRulesets,
						createRuleset,
					}) as unknown as GitHubClient,
			);

			const result = await runBranchProtect({
				token: "token",
				owner: "octo",
				repo: "my-rust-app",
				ecosystem: "rust",
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.ecosystem).toBe("rust");
				expect(result.output.requiredChecks).toEqual(
					expect.arrayContaining(["lint", "test", "security-scan"]),
				);
			}
		});

		it("uses minimal ecosystem profile", async () => {
			const listRulesets = vi.fn(async () => [] as RulesetSummary[]);
			const createRuleset = vi.fn(
				async (payload: RulesetPayload) =>
					({
						id: 103,
						name: payload.name,
						target: payload.target,
						enforcement: payload.enforcement,
						bypass_actors: payload.bypass_actors,
						conditions: payload.conditions,
						rules: payload.rules,
					}) as Ruleset,
			);

			mockGitHubClient.mockImplementation(
				() =>
					({
						listRulesets,
						createRuleset,
					}) as unknown as GitHubClient,
			);

			const result = await runBranchProtect({
				token: "token",
				owner: "octo",
				repo: "my-minimal-app",
				ecosystem: "minimal",
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.ecosystem).toBe("minimal");
				expect(result.output.requiredChecks).toEqual(["security-scan"]);
			}
		});

		it("returns error for invalid ecosystem", async () => {
			const result = await runBranchProtect({
				token: "token",
				owner: "octo",
				repo: "my-app",
				ecosystem: "invalid-ecosystem",
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("VALIDATION_ERROR");
				expect(result.error.message).toContain(
					'Invalid ecosystem "invalid-ecosystem"',
				);
				expect(result.error.message).toContain("Available:");
			}
		});

		it("explicit requiredChecks overrides ecosystem", async () => {
			const listRulesets = vi.fn(async () => [] as RulesetSummary[]);
			const createRuleset = vi.fn(
				async (payload: RulesetPayload) =>
					({
						id: 104,
						name: payload.name,
						target: payload.target,
						enforcement: payload.enforcement,
						bypass_actors: payload.bypass_actors,
						conditions: payload.conditions,
						rules: payload.rules,
					}) as Ruleset,
			);

			mockGitHubClient.mockImplementation(
				() =>
					({
						listRulesets,
						createRuleset,
					}) as unknown as GitHubClient,
			);

			const result = await runBranchProtect({
				token: "token",
				owner: "octo",
				repo: "my-app",
				ecosystem: "typescript",
				requiredChecks: ["custom-check-1", "custom-check-2"],
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				// ecosystem should not be set when explicit checks are provided
				expect(result.output.ecosystem).toBeUndefined();
				expect(result.output.requiredChecks).toEqual([
					"custom-check-1",
					"custom-check-2",
				]);
			}
		});
	});
});
