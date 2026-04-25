import { describe, expect, it } from "vitest";
import {
	DEFAULT_CI_PROVIDER,
	getBranchProtectionRequiredChecks,
	getNormalizedRequiredChecks,
	isTemplateEnabledForProvider,
	renderCircleCIConfig,
	renderGitHubActionsPnpmSetupStep,
	renderGitHubActionsPrPipelineWorkflow,
	renderRequiredChecksManifest,
	renderTransitionStatusArtifact,
} from "./scaffold-ci-templates.js";

describe("scaffold CI templates", () => {
	const githubActionsPipelineInput = {
		installCommand: "pnpm install",
		lintCommand: "pnpm lint",
		typecheckCommand: "pnpm typecheck",
		testCommand: "pnpm test:ci",
		auditCommand: "pnpm audit",
		checkCommand: "pnpm check",
		memoryValidateCommand: "pnpm memory:validate",
		linearTrackingEnabled: true,
	};
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

	it("injects security-scan before CodeRabbit for CircleCI checks", () => {
		const checks = getNormalizedRequiredChecks("circleci");
		const securityScanIndex = checks.indexOf("security-scan");
		const codeRabbitIndex = checks.indexOf("CodeRabbit");

		expect(securityScanIndex).toBeGreaterThanOrEqual(0);
		expect(codeRabbitIndex).toBeGreaterThanOrEqual(0);
		expect(securityScanIndex).toBe(codeRabbitIndex - 1);
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

	it("renders pnpm setup with the required package-manager version guard", () => {
		const setupStep = renderGitHubActionsPnpmSetupStep();

		expect(setupStep).toContain('required_pnpm_version="10.33.0"');
		expect(setupStep).toContain(
			'current_pnpm_version="$(pnpm --version || true)"',
		);
		expect(setupStep).toContain(
			'npm install --global --prefix "$NPM_CONFIG_PREFIX" "pnpm@${required_pnpm_version}"',
		);
	});

	it("renders the GitHub Actions PR pipeline with Linear gating enabled", () => {
		const workflow = renderGitHubActionsPrPipelineWorkflow(
			githubActionsPipelineInput,
		);

		expect(workflow).toContain("linear-gate:");
		expect(workflow).toContain("pnpm exec tsx src/cli.ts linear-gate");
		expect(workflow).toContain("needs: [pr-template, linear-gate]");
		expect(workflow).toContain("needs.linear-gate.result == 'success'");
		expect(workflow).toContain("run: pnpm lint");
		expect(workflow).toContain("run: pnpm typecheck");
		expect(workflow).toContain("run: pnpm test:ci");
		expect(workflow).toContain("run: pnpm audit");
		expect(workflow).toContain("run: pnpm check");
		expect(workflow).toContain("run: pnpm memory:validate");
		expect(workflow).not.toMatch(/{{[a-zA-Z]+}}/);
		expect(workflow).toContain(
			'done < <(rg -n "^[[:space:]]*(-[[:space:]]*)?uses:[[:space:]]*[^[:space:]]+" .github/workflows/*.yml)',
		);
	});

	it("renders the GitHub Actions PR pipeline without Linear gating", () => {
		const workflow = renderGitHubActionsPrPipelineWorkflow({
			...githubActionsPipelineInput,
			linearTrackingEnabled: false,
		});

		expect(workflow).not.toContain("linear-gate:");
		expect(workflow).not.toContain("pnpm exec tsx src/cli.ts linear-gate");
		expect(workflow).toContain("needs: [pr-template]");
		expect(workflow).toContain("needs.pr-template.result == 'success'");
		expect(workflow).not.toContain("needs.linear-gate");
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
