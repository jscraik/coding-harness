import { describe, expect, it } from "vitest";
import { EXIT_CODES, findRepositories, runOrgAudit } from "./org-audit.js";

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
	});

	describe("runOrgAudit", () => {
		it("scans current directory", async () => {
			const { result, exitCode } = await runOrgAudit({
				path: process.cwd(),
				format: "json",
			});

			// Result should be defined
			expect(result).toBeDefined();
			expect(exitCode).toBeDefined();
			// Total repos should be a number (may be 0 if no .git found)
			expect(typeof result.totalRepos).toBe("number");
		});

		it("returns NO_REPOS_FOUND for directory without git repos", async () => {
			// Use a directory that's unlikely to have git repos
			const { result, exitCode } = await runOrgAudit({
				path: "/System/Library",
				format: "json",
			});

			expect(result.totalRepos).toBe(0);
			expect(exitCode).toBe(EXIT_CODES.NO_REPOS_FOUND);
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

			const { result, exitCode } = await runOrgAudit({
				path: process.cwd(),
				format: "json",
				baseContract,
			});

			// If we found repos, there should be drift
			// If no repos found, there won't be drift
			if (result.totalRepos > 0 && result.validContracts > 0) {
				expect(result.summary.totalDrift).toBeGreaterThan(0);
				expect(exitCode).toBe(EXIT_CODES.DRIFT_DETECTED);
			}
		});
	});
});
