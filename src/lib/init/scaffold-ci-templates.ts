import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deriveRequiredCheckMetadata } from "../ci/required-check-metadata.js";
import { BRANCH_PROTECTION_REQUIRED_CHECKS } from "../policy/required-checks.js";
import type { CIProvider, TemplateRenderContext } from "./types.js";

/**
 * Default CI provider used when scaffold render context does not specify one.
 */
export const DEFAULT_CI_PROVIDER: CIProvider = "circleci";

const DEFAULT_TRANSITION_STATUS_UPDATED_AT = "2026-03-14T00:00:00.000Z";

/**
 * Determine which branch-protection required check identifiers apply for a render context.
 *
 * @param context - Optional render context subset; only `issueTracker` is consulted.
 * @returns Required check identifiers with `linear-gate` removed when Linear tracking is disabled.
 */
export function getBranchProtectionRequiredChecks(
	context?: Pick<TemplateRenderContext, "issueTracker">,
): readonly string[] {
	if (context?.issueTracker === "github" || context?.issueTracker === "none") {
		return BRANCH_PROTECTION_REQUIRED_CHECKS.filter(
			(check) => check !== "linear-gate",
		);
	}

	return BRANCH_PROTECTION_REQUIRED_CHECKS;
}

/**
 * Get the canonical list of required branch-check identifiers for a CI provider and context.
 *
 * @param ciProvider - CI provider used to normalize required checks.
 * @param context - Optional render context whose `issueTracker` can alter check selection.
 * @returns Normalized, ordered required-check identifiers for scaffold outputs.
 */
export function getNormalizedRequiredChecks(
	ciProvider: CIProvider,
	context?: Pick<TemplateRenderContext, "issueTracker">,
): readonly string[] {
	const baseChecks = getBranchProtectionRequiredChecks(context);
	return ciProvider === "circleci"
		? insertSecurityScanBeforeCodeRabbit(baseChecks)
		: baseChecks;
}

function insertSecurityScanBeforeCodeRabbit(
	checks: readonly string[],
): readonly string[] {
	if (checks.includes("security-scan")) {
		return checks;
	}
	const codeRabbitIndex = checks.indexOf("CodeRabbit");
	if (codeRabbitIndex === -1) {
		return [...checks, "security-scan"];
	}
	return [
		...checks.slice(0, codeRabbitIndex),
		"security-scan",
		...checks.slice(codeRabbitIndex),
	];
}

/**
 * Generate the JSON manifest describing required CI checks for branch protection.
 *
 * @param ciProvider - Target CI provider for provider-specific check metadata.
 * @param context - Optional render context; only `issueTracker` is consulted for check selection.
 * @returns Pretty-printed JSON manifest with provider metadata and required checks.
 */
export function renderRequiredChecksManifest(
	ciProvider: CIProvider,
	context?: Pick<TemplateRenderContext, "issueTracker">,
): string {
	const checksWithSecurityScan = getNormalizedRequiredChecks(
		ciProvider,
		context,
	);

	const requiredChecks = checksWithSecurityScan.map((displayName, index) => {
		const metadata = deriveRequiredCheckMetadata(ciProvider, displayName);
		return {
			policyId: `required-check-${index + 1}`,
			displayName,
			sourceAppSlug: metadata.sourceAppSlug,
			sourceAppId: metadata.sourceAppId,
			externalIdPattern: `^${escapeRegexLiteral(metadata.githubCheckName)}$`,
			requiredOnEvents: ["pull_request", "merge_group"] as const,
			freshnessWindowDays: 7,
			class: metadata.class,
			enabled: metadata.enabled,
			githubCheckName: metadata.githubCheckName,
		};
	});

	return JSON.stringify(
		{
			version: 1,
			activeProvider: ciProvider,
			requiredChecks,
		},
		null,
		2,
	);
}

/**
 * Render the CI provider transition status artifact used by scaffolded repos.
 *
 * @returns Pretty-printed transition status JSON with deterministic timestamp.
 */
export function renderTransitionStatusArtifact(): string {
	return JSON.stringify(
		{
			schemaVersion: "ci-provider-transition-status/v1",
			nextGateComplete: false,
			updatedAt: DEFAULT_TRANSITION_STATUS_UPDATED_AT,
		},
		null,
		2,
	);
}

/**
 * Package-manager-specific command inputs for the GitHub Actions PR pipeline renderer.
 */
export interface GitHubActionsPrPipelineRenderInput {
	installCommand: string;
	lintCommand: string;
	typecheckCommand: string;
	testCommand: string;
	auditCommand: string;
	checkCommand: string;
	memoryValidateCommand: string;
	linearTrackingEnabled: boolean;
}

/**
 * Package-manager-specific command inputs for the CircleCI PR pipeline renderer.
 */
export interface CircleCIConfigRenderInput {
	packageManager: string;
	installCommand: string;
	lintCommand: string;
	typecheckCommand: string;
	testCommand: string;
	auditCommand: string;
	checkCommand: string;
	dependencyAuditCommand: string;
	memoryValidateCommand: string;
	linearTrackingEnabled: boolean;
}

/**
 * Package-manager-specific command inputs for the private npm release workflow.
 */
export interface ReleasePrivateNpmWorkflowRenderInput {
	packageManager: string;
	installCommand: string;
	checkCommand: string;
	buildCommand: string;
}

function renderCiTemplate(relativePath: string): string {
	const templatePath = fileURLToPath(
		new URL(`../../templates/${relativePath}`, import.meta.url),
	);
	return readFileSync(templatePath, "utf-8");
}

function renderPrivateNpmPublishCommand(
	packageManager: string,
	withProvenance: boolean,
): string {
	if (packageManager === "pnpm") {
		return withProvenance
			? "pnpm publish --no-git-checks --access restricted --provenance"
			: "pnpm publish --no-git-checks --access restricted";
	}
	const provenanceFlag = withProvenance ? " --provenance" : "";
	return `npm publish --access restricted${provenanceFlag}`;
}

function replaceTemplateTokens(
	template: string,
	tokens: Record<string, string>,
): string {
	let rendered = template;
	for (const [name, value] of Object.entries(tokens)) {
		rendered = rendered.replaceAll(`{{${name}}}`, value);
	}
	return rendered;
}

function renderGitHubActionsLinearGateJob(
	input: Pick<GitHubActionsPrPipelineRenderInput, "installCommand">,
	pnpmSetupStep: string,
): string {
	return replaceTemplateTokens(
		renderCiTemplate("pr-pipeline-linear-gate.yml"),
		{
			installCommand: input.installCommand,
			pnpmSetupStep,
		},
	);
}

/**
 * Render the scaffolded GitHub Actions PR pipeline workflow.
 *
 * @param input - Pre-resolved package-manager commands and issue-tracker mode.
 * @returns The YAML contents for `.github/workflows/pr-pipeline.yml`.
 */
export function renderGitHubActionsPrPipelineWorkflow(
	input: GitHubActionsPrPipelineRenderInput,
): string {
	const pnpmSetupStep = renderGitHubActionsPnpmSetupStep();
	const riskPolicyNeeds = input.linearTrackingEnabled
		? "[pr-template, linear-gate]"
		: "[pr-template]";
	const riskPolicyIf = input.linearTrackingEnabled
		? "${{ always() && (github.event_name == 'merge_group' || (needs.pr-template.result == 'success' && needs.linear-gate.result == 'success')) }}"
		: "${{ always() && (github.event_name == 'merge_group' || needs.pr-template.result == 'success') }}";

	return replaceTemplateTokens(renderCiTemplate("pr-pipeline.yml"), {
		auditCommand: input.auditCommand,
		checkCommand: input.checkCommand,
		installCommand: input.installCommand,
		linearGateJob: input.linearTrackingEnabled
			? renderGitHubActionsLinearGateJob(input, pnpmSetupStep)
			: "",
		lintCommand: input.lintCommand,
		memoryValidateCommand: input.memoryValidateCommand,
		pnpmSetupStep,
		riskPolicyIf,
		riskPolicyNeeds,
		testCommand: input.testCommand,
		typecheckCommand: input.typecheckCommand,
	});
}

/**
 * Render the scaffolded GitHub Actions workflow for private npm releases.
 *
 * @param input - Pre-resolved package-manager commands and package manager name.
 * @returns The YAML contents for `.github/workflows/release-private-npm.yml`.
 */
export function renderReleasePrivateNpmWorkflow(
	input: ReleasePrivateNpmWorkflowRenderInput,
): string {
	const packageManagerSetupStep =
		input.packageManager === "pnpm"
			? `${renderGitHubActionsPnpmSetupStep()}\n`
			: "";

	return renderCiTemplate("release-private-npm.yml")
		.replace("__PACKAGE_MANAGER_SETUP_STEP__", packageManagerSetupStep)
		.replace("__INSTALL_COMMAND__", input.installCommand)
		.replace("__CHECK_COMMAND__", input.checkCommand)
		.replace("__BUILD_COMMAND__", input.buildCommand)
		.replace(
			"__PUBLISH_TOKEN_COMMAND__",
			renderPrivateNpmPublishCommand(input.packageManager, false),
		)
		.replace(
			"__PUBLISH_OIDC_COMMAND__",
			renderPrivateNpmPublishCommand(input.packageManager, true),
		);
}

/**
 * Render the scaffolded GitHub Actions security scan workflow.
 *
 * @returns The YAML contents for `.github/workflows/secret-scan.yml`.
 */
export function renderSecurityScanWorkflow(): string {
	return renderCiTemplate("secret-scan.yml");
}

/**
 * Render the scaffolded CircleCI PR pipeline configuration.
 *
 * @param input - Pre-resolved package-manager commands and issue-tracker mode.
 * @returns The YAML contents for `.circleci/config.yml`.
 */
export function renderCircleCIConfig(input: CircleCIConfigRenderInput): string {
	const gitleaksCommand =
		"if [ -f .gitleaks.toml ]; then gitleaks detect --source . --config .gitleaks.toml --redact --no-banner; else gitleaks detect --source . --redact --no-banner; fi";
	const trivyCommand =
		"trivy fs --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 .";
	const semgrepCommand = "bash scripts/check-semgrep-full.sh";
	const configureCacheStep =
		input.packageManager === "pnpm"
			? renderCircleCIPnpmConfigureCacheStep()
			: "";
	const saveCacheStep =
		input.packageManager === "pnpm" ? renderCircleCIPnpmSaveCacheStep() : "";
	const linearGateJob = input.linearTrackingEnabled
		? renderCiTemplate("circleci-linear-gate.yml")
		: "";
	const riskPolicyRequires = input.linearTrackingEnabled
		? `          requires:
            - pr-template
            - linear-gate
`
		: `          requires:
            - pr-template
`;

	return replaceTemplateTokens(renderCiTemplate("circleci-config.yml"), {
		auditCommand: input.auditCommand,
		checkCommand: input.checkCommand,
		configureCacheStep,
		dependencyAuditCommand: input.dependencyAuditCommand,
		gitleaksCommand,
		installCommand: input.installCommand,
		linearGateJob,
		lintCommand: input.lintCommand,
		memoryValidateCommand: input.memoryValidateCommand,
		riskPolicyRequires,
		saveCacheStep,
		semgrepCommand,
		testCommand: input.testCommand,
		trivyCommand,
		typecheckCommand: input.typecheckCommand,
	});
}

function renderCircleCIPnpmConfigureCacheStep(): string {
	return `      - run:
          name: Configure pnpm store
          command: |
            mkdir -p "$HOME/.pnpm-store"
            pnpm config set store-dir "$HOME/.pnpm-store"
            pnpm store path
      - restore_cache:
          keys:
            - v2-pnpm-store-{{ arch }}-{{ checksum "pnpm-lock.yaml" }}
            - v2-pnpm-store-{{ arch }}-
`;
}

function renderCircleCIPnpmSaveCacheStep(): string {
	return `      - save_cache:
          key: v2-pnpm-store-{{ arch }}-{{ checksum "pnpm-lock.yaml" }}
          paths:
            - ~/.pnpm-store
`;
}

/**
 * Produces a GitHub Actions workflow step that ensures a specific pnpm version is present in the runner.
 *
 * @returns The YAML-formatted GitHub Actions step as a string.
 */
export function renderGitHubActionsPnpmSetupStep(): string {
	return `      - name: Ensure pnpm available
        run: |
          required_pnpm_version="10.33.0"
          current_pnpm_version=""
          if command -v pnpm >/dev/null 2>&1; then
            current_pnpm_version="$(pnpm --version || true)"
          fi
          if [[ "$current_pnpm_version" != "$required_pnpm_version" ]]; then
            export NPM_CONFIG_PREFIX="$HOME/.local"
            mkdir -p "$NPM_CONFIG_PREFIX"
            npm install --global --prefix "$NPM_CONFIG_PREFIX" "pnpm@${"${required_pnpm_version}"}"
            echo "$NPM_CONFIG_PREFIX/bin" >> "$GITHUB_PATH"
            export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
          fi
          pnpm --version`;
}

/**
 * Determine whether a scaffold template should be emitted for the specified CI provider.
 *
 * @param templatePath - Relative template path to evaluate.
 * @param ciProvider - Chosen CI provider used to decide template inclusion.
 * @returns `true` if the template applies to the given provider.
 */
export function isTemplateEnabledForProvider(
	templatePath: string,
	ciProvider: CIProvider,
): boolean {
	if (templatePath.startsWith(".github/workflows/")) {
		if (templatePath === ".github/workflows/release-private-npm.yml") {
			return true;
		}
		return ciProvider === "github-actions";
	}
	if (templatePath === ".circleci/config.yml") {
		return ciProvider === "circleci";
	}
	return true;
}

function escapeRegexLiteral(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
