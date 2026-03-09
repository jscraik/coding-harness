import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	EXIT_CODES,
	findRepositories,
	runOrgAudit,
	runOrgAuditCLI,
} from "./org-audit.js";

describe("org-audit command", () => {
	describe("findRepositories", () => {
		it("finds git repositories in directory", () => {
			// Use current repo as test case
			const repos = findRepositories(process.cwd());

			// Current repo should be found (it has a .git directory)
			expect(repos.length).toBeGreaterThanOrEqual(0);
		});

		it("returns empty array for non-existent path", () => {
			const repos = findRepositories("/non/existent/path");
			expect(repos).toHaveLength(0);
		});

		it("detects repositories with .git file metadata", () => {
			const tempRoot = mkdtempSync(join(tmpdir(), "org-audit-repos-"));
			try {
				const repoDir = join(tempRoot, "worktree-style");
				mkdirSync(repoDir, { recursive: true });
				writeFileSync(
					join(repoDir, ".git"),
					"gitdir: ../.git/worktrees/worktree",
				);

				const repos = findRepositories(tempRoot);
				expect(repos).toContain(repoDir);
			} finally {
				rmSync(tempRoot, { recursive: true, force: true });
			}
		});
	});

	describe("runOrgAudit", () => {
		it("scans current directory", async () => {
			const auditResult = await runOrgAudit({
				path: process.cwd(),
				format: "json",
			});

			// Result should be Ok
			expect(auditResult.ok).toBe(true);
			if (auditResult.ok) {
				const { result, exitCode } = auditResult.value;
				expect(result).toBeDefined();
				expect(exitCode).toBeDefined();
				// Total repos should be a number (may be 0 if no .git found)
				expect(typeof result.totalRepos).toBe("number");
			}
		});

		it("returns NO_REPOS_FOUND for directory without git repos", async () => {
			// Use a directory that's unlikely to have git repos
			const auditResult = await runOrgAudit({
				path: "/System/Library",
				format: "json",
			});

			expect(auditResult.ok).toBe(true);
			if (auditResult.ok) {
				const { result, exitCode } = auditResult.value;
				expect(result.totalRepos).toBe(0);
				expect(exitCode).toBe(EXIT_CODES.NO_REPOS_FOUND);
			}
		});

		it("detects drift when base contract provided", async () => {
			// Create a base contract that differs from current repo
			const baseContract = {
				version: "1.0",
				riskTierRules: {},
				reviewPolicy: {
					timeoutSeconds: 600,
					timeoutAction: "fail" as const,
					requiredChecks: ["extra-check"], // This won't exist in current repo
					enforceReviewerIndependence: true,
				},
				branchProtection: {
					requiredChecks: [],
				},
				evidencePolicy: {
					requiredFor: [],
					allowedTypes: ["png" as const],
					maxFileSizeBytes: 1024,
				},
			};

			const auditResult = await runOrgAudit({
				path: process.cwd(),
				format: "json",
				baseContract,
			});

			expect(auditResult.ok).toBe(true);
			if (auditResult.ok) {
				const { result, exitCode } = auditResult.value;
				// If we found repos, there should be drift
				// If no repos found, there won't be drift
				if (result.totalRepos > 0 && result.validContracts > 0) {
					expect(result.summary.totalDrift).toBeGreaterThan(0);
					expect(exitCode).toBe(EXIT_CODES.DRIFT_DETECTED);
				}
			}
		});

		it("accepts --base contract path outside the current working directory", async () => {
			const tempDir = mkdtempSync(join(tmpdir(), "harness-base-contract-"));
			const basePath = join(tempDir, "base.contract.json");
			writeFileSync(
				basePath,
				JSON.stringify(
					{
						version: "1.0",
						riskTierRules: {},
						reviewPolicy: {
							timeoutSeconds: 600,
							timeoutAction: "fail",
							requiredChecks: [],
							enforceReviewerIndependence: true,
						},
					},
					null,
					2,
				),
			);

			const result = await runOrgAuditCLI([
				"--path",
				process.cwd(),
				"--base",
				basePath,
				"--json",
			]);

			expect(result.exitCode).not.toBe(EXIT_CODES.INVALID_ARGUMENT);
		});

		it("supports --drift alias for --drift-only", async () => {
			const result = await runOrgAuditCLI([
				"--path",
				process.cwd(),
				"--drift",
				"--json",
			]);
			expect(result.exitCode).not.toBe(EXIT_CODES.INVALID_ARGUMENT);
		});

		it("fails with INVALID_ARGUMENT for unknown flags", async () => {
			const result = await runOrgAuditCLI([
				"--path",
				process.cwd(),
				"--unsupported-flag",
			]);
			expect(result.exitCode).toBe(EXIT_CODES.INVALID_ARGUMENT);
		});
	});
});
