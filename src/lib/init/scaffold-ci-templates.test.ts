import { describe, expect, it } from "vitest";
import {
	DEFAULT_CI_PROVIDER,
	isTemplateEnabledForProvider,
	renderSecurityScanWorkflow,
} from "./scaffold-ci-templates.js";

describe("scaffold CI templates", () => {
	it("uses CircleCI as the default scaffold provider", () => {
		expect(DEFAULT_CI_PROVIDER).toBe("circleci");
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
