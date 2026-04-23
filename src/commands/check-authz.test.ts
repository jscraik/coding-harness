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

	it("uses the contract directory for gitignore validation when cwd differs", async () => {
		writeFileSync(
			contractPath,
			JSON.stringify({ version: "1.0", riskTierRules: {} }),
		);

		const originalCwd = process.cwd();
		const isolatedCwd = join(testDir, "isolated-cwd");
		mkdirSync(isolatedCwd, { recursive: true });
		process.chdir(isolatedCwd);

		try {
			const result = await runCheckAuthz({
				contractPath,
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.passed).toBe(true);
				expect(result.output.violations).toEqual([]);
			}
		} finally {
			process.chdir(originalCwd);
		}
	});
});
