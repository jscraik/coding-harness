import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearContractCache } from "../lib/contract/loader.js";
import { runCheckAuthz } from "../lib/review-gate/authz.js";

describe("check-authz", () => {
	let testDir: string;
	let contractPath: string;

	beforeEach(() => {
		// Clear contract cache to prevent stale contract data between tests
		clearContractCache();
		const baseDir = resolve("artifacts");
		mkdirSync(baseDir, { recursive: true });
		testDir = join(baseDir, `check-authz-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		contractPath = join(testDir, "harness.contract.json");
		writeFileSync(join(testDir, ".gitignore"), "artifacts/pilot/\n", "utf-8");
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	// Regression test for: "check-authz fails closed for empty branch allowlist"
	// The default policy documents branchAllowlist: [] = deny all, but the old
	// guard `length > 0 && !matchesPattern(...)` skipped the check entirely when
	// the list was empty, producing passed: true for any non-protected branch.
	it("fails closed when branch allowlist is empty (default policy)", async () => {
		writeFileSync(
			contractPath,
			JSON.stringify({ version: "1.0", riskTierRules: {} }),
		);

		const result = await runCheckAuthz({
			contractPath,
			branch: "feature/test",
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.passed).toBe(false);
			expect(result.output.violations).toContainEqual(
				expect.objectContaining({
					type: "branch_not_allowed",
					message: expect.stringContaining("allowlist is empty"),
				}),
			);
		}
	});

	it("fails closed when branch allowlist is explicitly set to empty", async () => {
		writeFileSync(
			contractPath,
			JSON.stringify({
				version: "1.0",
				riskTierRules: {},
				pilotAuthzPolicy: {
					githubScopeAllowlist: ["pull_requests:write"],
					repoAllowlist: ["acme/*"],
					branchAllowlist: [],
					protectedBranchDenylist: ["main", "master"],
					enforceBranchProtection: false,
				},
			}),
		);

		const result = await runCheckAuthz({
			contractPath,
			branch: "feature/sneaky",
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.passed).toBe(false);
			expect(result.output.violations).toContainEqual(
				expect.objectContaining({ type: "branch_not_allowed" }),
			);
		}
	});

	it("passes when branch matches configured allowlist", async () => {
		writeFileSync(
			contractPath,
			JSON.stringify({
				version: "1.0",
				riskTierRules: {},
				pilotAuthzPolicy: {
					githubScopeAllowlist: [
						"pull_requests:write",
						"contents:read",
						"issues:write",
					],
					repoAllowlist: ["jscraik/coding-harness"],
					branchAllowlist: ["feature/*"],
					protectedBranchDenylist: ["main", "master", "release/*"],
					enforceBranchProtection: false,
				},
			}),
		);

		const result = await runCheckAuthz({
			contractPath,
			branch: "feature/test",
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.passed).toBe(true);
			expect(result.output.violations).toHaveLength(0);
		}
	});

	it("blocks protected branches even when they match the allowlist pattern", async () => {
		writeFileSync(
			contractPath,
			JSON.stringify({
				version: "1.0",
				riskTierRules: {},
				pilotAuthzPolicy: {
					githubScopeAllowlist: ["contents:write"],
					repoAllowlist: ["acme/*"],
					branchAllowlist: ["main", "feature/*"],
					protectedBranchDenylist: ["main", "master", "release/*"],
					enforceBranchProtection: false,
				},
			}),
		);

		const result = await runCheckAuthz({
			contractPath,
			branch: "main",
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.passed).toBe(false);
			expect(result.output.violations).toContainEqual(
				expect.objectContaining({ type: "branch_protected" }),
			);
			// Should NOT also emit branch_not_allowed — main is in the allowlist
			expect(result.output.violations.map((v) => v.type)).not.toContain(
				"branch_not_allowed",
			);
		}
	});

	it("treats regex metacharacters in allowlist patterns as literals", async () => {
		writeFileSync(
			contractPath,
			JSON.stringify({
				version: "1.0",
				riskTierRules: {},
				pilotAuthzPolicy: {
					githubScopeAllowlist: ["contents:write"],
					repoAllowlist: ["acme/repo.v2"],
					branchAllowlist: ["feature/*"],
					protectedBranchDenylist: ["main", "master"],
					enforceBranchProtection: false,
				},
			}),
		);

		const mismatchResult = await runCheckAuthz({
			contractPath,
			repo: "acme/repoXv2",
			branch: "feature/test",
		});

		expect(mismatchResult.ok).toBe(true);
		if (mismatchResult.ok) {
			expect(mismatchResult.output.passed).toBe(false);
			expect(mismatchResult.output.violations).toContainEqual(
				expect.objectContaining({
					type: "repo_not_allowed",
				}),
			);
		}

		const exactMatchResult = await runCheckAuthz({
			contractPath,
			repo: "acme/repo.v2",
			branch: "feature/test",
		});

		expect(exactMatchResult.ok).toBe(true);
		if (exactMatchResult.ok) {
			expect(exactMatchResult.output.passed).toBe(true);
			expect(exactMatchResult.output.violations).toHaveLength(0);
		}
	});

	it("resolves .gitignore relative to the contract root when invoked from another cwd", async () => {
		writeFileSync(
			contractPath,
			JSON.stringify({
				version: "1.0",
				riskTierRules: {},
				pilotAuthzPolicy: {
					githubScopeAllowlist: ["contents:write"],
					repoAllowlist: ["acme/*"],
					branchAllowlist: ["feature/*"],
					protectedBranchDenylist: ["main", "master"],
					enforceBranchProtection: false,
				},
			}),
		);

		const callerCwd = join(testDir, "caller-cwd");
		mkdirSync(callerCwd, { recursive: true });
		const originalCwd = process.cwd();
		process.chdir(callerCwd);
		try {
			const result = await runCheckAuthz({
				contractPath,
				branch: "feature/test",
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.passed).toBe(true);
				expect(
					result.output.violations.some(
						(violation) => violation.type === "gitignore_missing",
					),
				).toBe(false);
			}
		} finally {
			process.chdir(originalCwd);
		}
	});

	it("fails closed when contract root is missing .gitignore even if caller cwd has one", async () => {
		writeFileSync(
			contractPath,
			JSON.stringify({
				version: "1.0",
				riskTierRules: {},
				pilotAuthzPolicy: {
					githubScopeAllowlist: ["contents:write"],
					repoAllowlist: ["acme/*"],
					branchAllowlist: ["feature/*"],
					protectedBranchDenylist: ["main", "master"],
					enforceBranchProtection: false,
				},
			}),
		);
		rmSync(join(testDir, ".gitignore"), { force: true });

		const callerCwd = join(testDir, "caller-cwd-with-gitignore");
		mkdirSync(callerCwd, { recursive: true });
		writeFileSync(join(callerCwd, ".gitignore"), "artifacts/pilot/\n", "utf-8");
		const originalCwd = process.cwd();
		process.chdir(callerCwd);
		try {
			const result = await runCheckAuthz({
				contractPath,
				branch: "feature/test",
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.passed).toBe(false);
				expect(
					result.output.violations.some(
						(violation) => violation.type === "gitignore_missing",
					),
				).toBe(true);
			}
		} finally {
			process.chdir(originalCwd);
		}
	});
});
