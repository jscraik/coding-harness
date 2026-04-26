import { describe, expect, it } from "vitest";
import {
	getBranchProtectionRequiredChecks,
	getNormalizedRequiredChecks,
	renderRequiredChecksManifest,
} from "./scaffold-required-checks-manifest-template.js";

describe("scaffold required-checks manifest template", () => {
	it("omits Linear checks when issue tracking is not Linear-backed", () => {
		expect(
			getBranchProtectionRequiredChecks({ issueTracker: "github" }),
		).not.toContain("linear-gate");
		expect(
			getBranchProtectionRequiredChecks({ issueTracker: "none" }),
		).not.toContain("linear-gate");
	});

	it("injects external security checks around CodeRabbit for CircleCI checks", () => {
		const checks = getNormalizedRequiredChecks("circleci");
		const securityScanIndex = checks.indexOf("security-scan");
		const codeRabbitIndex = checks.indexOf("CodeRabbit");
		const semgrepCloudIndex = checks.indexOf("semgrep-cloud-platform/scan");

		expect(securityScanIndex).toBeGreaterThanOrEqual(0);
		expect(codeRabbitIndex).toBeGreaterThanOrEqual(0);
		expect(semgrepCloudIndex).toBeGreaterThanOrEqual(0);
		expect(securityScanIndex).toBe(codeRabbitIndex - 1);
		expect(semgrepCloudIndex).toBe(codeRabbitIndex + 1);
	});

	it("renders provider metadata into required-check manifest", () => {
		const manifest = JSON.parse(renderRequiredChecksManifest("circleci"));

		expect(manifest.activeProvider).toBe("circleci");
		expect(manifest.requiredChecks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					displayName: "security-scan",
					githubCheckName: "security-scan",
					requiredOnEvents: ["pull_request", "merge_group"],
				}),
				expect.objectContaining({
					displayName: "semgrep-cloud-platform/scan",
					sourceAppSlug: "semgrep-cloud-platform",
					githubCheckName: "semgrep-cloud-platform/scan",
					requiredOnEvents: ["pull_request", "merge_group"],
				}),
			]),
		);
	});
});
