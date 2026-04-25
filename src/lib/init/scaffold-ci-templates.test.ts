import { describe, expect, it } from "vitest";
import {
	DEFAULT_CI_PROVIDER,
	getBranchProtectionRequiredChecks,
	getNormalizedRequiredChecks,
	isTemplateEnabledForProvider,
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
