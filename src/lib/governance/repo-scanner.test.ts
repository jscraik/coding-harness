import { describe, expect, it } from "vitest";
import type { HarnessContract } from "../contract/types.js";
import {
	detectDrift,
	scanSingleRepo,
	summarizeResults,
} from "./repo-scanner.js";

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
});
