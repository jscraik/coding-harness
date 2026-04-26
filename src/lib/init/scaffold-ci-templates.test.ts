import { describe, expect, it } from "vitest";
import {
	DEFAULT_CI_PROVIDER,
	getBranchProtectionRequiredChecks,
	getNormalizedRequiredChecks,
	isTemplateEnabledForProvider,
	renderCircleCIConfig,
	renderReleasePrivateNpmWorkflow,
	renderRequiredChecksManifest,
	renderSecurityScanWorkflow,
	renderTransitionStatusArtifact,
} from "./scaffold-ci-templates.js";

describe("scaffold CI templates", () => {
	const circleCiConfigInput = {
		packageManager: "pnpm",
		installCommand: "pnpm install --frozen-lockfile --prefer-offline",
		lintCommand: "pnpm lint",
		typecheckCommand: "pnpm typecheck",
		testCommand: "pnpm test:ci",
		auditCommand: "pnpm audit",
		checkCommand: "pnpm check",
		dependencyAuditCommand: "pnpm audit:strict",
		memoryValidateCommand: "pnpm memory:validate",
		linearTrackingEnabled: true,
	};

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

	it("renders the private npm release workflow for pnpm", () => {
		const workflow = renderReleasePrivateNpmWorkflow({
			packageManager: "pnpm",
			installCommand: "pnpm install --frozen-lockfile",
			checkCommand: "pnpm check",
			buildCommand: "pnpm build",
		});

		expect(workflow).toContain("name: Release to private npm");
		expect(workflow).toContain('required_pnpm_version="10.33.0"');
		expect(workflow).toContain("run: pnpm install --frozen-lockfile");
		expect(workflow).toContain("run: pnpm check");
		expect(workflow).toContain("run: pnpm build");
		expect(workflow).toContain(
			"pnpm publish --no-git-checks --access restricted\n",
		);
		expect(workflow).toContain(
			"pnpm publish --no-git-checks --access restricted --provenance",
		);
		expect(workflow).not.toMatch(/__[A-Z_]+__/);
	});

	it("renders the private npm release workflow for npm without pnpm setup", () => {
		const workflow = renderReleasePrivateNpmWorkflow({
			packageManager: "npm",
			installCommand: "npm ci",
			checkCommand: "npm run check",
			buildCommand: "npm run build",
		});

		expect(workflow).not.toContain('required_pnpm_version="10.33.0"');
		expect(workflow).toContain("run: npm ci");
		expect(workflow).toContain("run: npm run check");
		expect(workflow).toContain("run: npm run build");
		expect(workflow).toContain("npm publish --access restricted\n");
		expect(workflow).toContain("npm publish --access restricted --provenance");
		expect(workflow).not.toContain("pnpm publish");
		expect(workflow).not.toMatch(/__[A-Z_]+__/);
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

	it("renders the CircleCI PR pipeline with Linear gating enabled", () => {
		const config = renderCircleCIConfig(circleCiConfigInput);

		expect(config).toContain("version: 2.1");
		expect(config).toContain("name: linear-gate");
		expect(config).toContain("bash scripts/run-harness-gate.sh linear-gate");
		expect(config).toContain("name: risk-policy-gate");
		expect(config).toContain("            - linear-gate");
		expect(config).toContain(
			"command: pnpm install --frozen-lockfile --prefer-offline",
		);
		expect(config).toContain("command: pnpm audit:strict");
		expect(config).toContain("command: pnpm lint");
		expect(config).toContain("command: pnpm typecheck");
		expect(config).toContain("command: pnpm test:ci");
		expect(config).toContain("command: pnpm audit");
		expect(config).toContain("command: pnpm check");
		expect(config).toContain("command: pnpm memory:validate");
		expect(config).toContain("name: Configure pnpm store");
		expect(config).toContain("v2-pnpm-store-{{ arch }}-");
		expect(config).toContain("name: security-scan");
		expect(config).not.toMatch(/{{[a-zA-Z]+}}/);
	});

	it("renders the CircleCI PR pipeline without Linear gating", () => {
		const config = renderCircleCIConfig({
			...circleCiConfigInput,
			packageManager: "npm",
			installCommand: "npm ci",
			linearTrackingEnabled: false,
		});

		expect(config).not.toContain("name: linear-gate");
		expect(config).not.toContain("linear-gate \\");
		expect(config).toContain("            - pr-template\n");
		expect(config).not.toContain("            - linear-gate");
		expect(config).not.toContain("name: Configure pnpm store");
		expect(config).toContain("command: npm ci");
		expect(config).not.toMatch(/{{[a-zA-Z]+}}/);
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
