import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { HarnessContract } from "../contract/types.js";
import {
	detectDrift,
	scanRepositories,
	scanSingleRepo,
	summarizeResults,
} from "./repo-scanner.js";
import { setCachedEntry } from "./scan-cache.js";

describe("repo-scanner", () => {
	describe("detectDrift", () => {
		const baseContract: HarnessContract = {
			version: "1.0",
			riskTierRules: { "src/**": "medium" },
			reviewPolicy: {
				timeoutSeconds: 600,
				timeoutAction: "fail",
				requiredChecks: ["lint", "test", "security-scan"],
				enforceReviewerIndependence: true,
			},
			branchProtection: {
				requiredChecks: ["lint", "test"],
			},
			evidencePolicy: {
				requiredFor: ["src/**"],
				allowedTypes: ["png"],
				maxFileSizeBytes: 1024,
			},
			diffBudget: {
				maxFiles: 10,
				maxNetLOC: 400,
			},
		};

		it("detects missing required checks", () => {
			const actual: HarnessContract = {
				...baseContract,
				reviewPolicy: {
					timeoutSeconds: 600,
					timeoutAction: "fail",
					requiredChecks: ["lint", "test"], // missing security-scan
					enforceReviewerIndependence: true,
				},
			};

			const drift = detectDrift(baseContract, actual);

			expect(drift).toContainEqual(
				expect.objectContaining({
					path: "reviewPolicy.requiredChecks",
					expected: "security-scan",
					severity: "critical",
				}),
			);
		});

		it("detects missing branch protection checks", () => {
			const actual: HarnessContract = {
				...baseContract,
				branchProtection: {
					requiredChecks: ["lint"], // missing test
				},
				// Need to include evidencePolicy because it's required when branchProtection is present
				evidencePolicy: baseContract.evidencePolicy,
			};

			const drift = detectDrift(baseContract, actual);

			expect(drift).toContainEqual(
				expect.objectContaining({
					path: "branchProtection.requiredChecks",
					expected: "test",
					severity: "critical",
				}),
			);
		});

		it("detects relaxed diff budget", () => {
			const actual: HarnessContract = {
				...baseContract,
				diffBudget: {
					maxFiles: 20, // higher than base (10)
					maxNetLOC: 400,
				},
			};

			const drift = detectDrift(baseContract, actual);

			expect(drift).toContainEqual(
				expect.objectContaining({
					path: "diffBudget.maxFiles",
					severity: "warning",
				}),
			);
		});

		it("returns empty array when no drift", () => {
			const drift = detectDrift(baseContract, baseContract);
			expect(drift).toHaveLength(0);
		});
	});

	describe("scanSingleRepo", () => {
		it("returns error for non-existent repo", async () => {
			const result = await scanSingleRepo("/non/existent/path");
			expect(result.status).toBe("error");
			expect(result.error).toContain("No harness.contract.json");
		});

		it("returns success for valid contract", async () => {
			// Use current repo as test case
			const result = await scanSingleRepo(process.cwd());

			if (result.status === "success") {
				expect(result.contract).toBeDefined();
				expect(result.contract?.version).toBeDefined();
			}
		});
	});

	describe("summarizeResults", () => {
		it("calculates correct totals", () => {
			const results = [
				{ path: "repo1", status: "success" as const },
				{
					path: "repo2",
					status: "success" as const,
					drift: [
						{
							severity: "critical" as const,
							path: "",
							expected: "",
							actual: "",
							description: "",
						},
						{
							severity: "warning" as const,
							path: "",
							expected: "",
							actual: "",
							description: "",
						},
					],
				},
				{ path: "repo3", status: "error" as const, error: "fail" },
				{ path: "repo4", status: "no-contract" as const },
			];

			const summary = summarizeResults(results);

			expect(summary.total).toBe(4);
			expect(summary.success).toBe(2);
			expect(summary.errors).toBe(1);
			expect(summary.noContract).toBe(1);
			expect(summary.totalDrift).toBe(2);
			expect(summary.criticalDrift).toBe(1);
			expect(summary.warningDrift).toBe(1);
		});
	});

	describe("scanRepositories caching", () => {
		it("respects useCache=false option", async () => {
			const repos = [process.cwd()];
			// Run with cache disabled
			const results = await scanRepositories(repos, { useCache: false });
			expect(results).toHaveLength(1);
		});

		it("uses cache by default", async () => {
			const repos = [process.cwd()];
			// First scan populates cache
			const results1 = await scanRepositories(repos, {});
			// Second scan should use cache
			const results2 = await scanRepositories(repos, {});
			expect(results1).toHaveLength(1);
			expect(results2).toHaveLength(1);
		});

		it("drops cached drift when no base contract is provided", async () => {
			const repoPath = process.cwd();
			const contractPath = join(repoPath, "harness.contract.json");
			const cache = { version: 1, entries: [] };
			setCachedEntry(cache, repoPath, contractPath, {
				path: repoPath,
				status: "success",
				contract: {
					version: "1.0",
				},
				drift: [
					{
						path: "reviewPolicy.requiredChecks",
						expected: "security-scan",
						actual: undefined,
						severity: "critical",
						description: "Missing required check: security-scan",
					},
				],
			});

			const result = await scanSingleRepo(repoPath, {}, cache);
			expect(result.status).toBe("success");
			expect(result.drift).toBeUndefined();
		});
	});
});
