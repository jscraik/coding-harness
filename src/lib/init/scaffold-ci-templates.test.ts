import { describe, expect, it } from "vitest";
import {
	DEFAULT_CI_PROVIDER,
	getBranchProtectionRequiredChecks,
	getNormalizedRequiredChecks,
	isTemplateEnabledForProvider,
	renderRequiredChecksManifest,
	renderSecurityScanWorkflow,
	renderTransitionStatusArtifact,
} from "./scaffold-ci-templates.js";

describe("scaffold CI templates", () => {
	it("uses CircleCI as the default scaffold provider", () => {
		expect(DEFAULT_CI_PROVIDER).toBe("circleci");
	});

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

	it("renders deterministic transition status", () => {
		expect(JSON.parse(renderTransitionStatusArtifact())).toEqual({
			schemaVersion: "ci-provider-transition-status/v1",
			nextGateComplete: false,
			updatedAt: "2026-03-14T00:00:00.000Z",
		});
	});

	it("renders the GitHub Actions security scan workflow", () => {
		const workflow = renderSecurityScanWorkflow();

		expect(workflow).toContain("name: security-scan");
		expect(workflow).toContain("gitleaks/gitleaks-action@");
		expect(workflow).toContain("aquasecurity/trivy-action@");
		expect(workflow).toContain("semgrep==1.153.1");
		expect(workflow).toContain("--config p/security-audit");
		expect(workflow).toContain("GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}");
	});

	it("selects provider-specific workflow templates", () => {
		expect(
			isTemplateEnabledForProvider(
				".github/workflows/release-private-npm.yml",
				"circleci",
			),
		).toBe(true);
		expect(
			isTemplateEnabledForProvider(
				".github/workflows/pr-pipeline.yml",
				"circleci",
			),
		).toBe(false);
		expect(
			isTemplateEnabledForProvider(
				".github/workflows/pr-pipeline.yml",
				"github-actions",
			),
		).toBe(true);
		expect(
			isTemplateEnabledForProvider(".circleci/config.yml", "circleci"),
		).toBe(true);
	});
});
