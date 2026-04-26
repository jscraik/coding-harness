import { renderCiTemplate } from "./scaffold-ci-template-utils.js";
import type { CIProvider } from "./types.js";

export { renderCircleCIConfig } from "./scaffold-circleci-config-template.js";
export type { CircleCIConfigRenderInput } from "./scaffold-circleci-config-template.js";
export {
	renderGitHubActionsPnpmSetupStep,
	renderGitHubActionsPrPipelineWorkflow,
} from "./scaffold-github-actions-pr-pipeline-template.js";
export type { GitHubActionsPrPipelineRenderInput } from "./scaffold-github-actions-pr-pipeline-template.js";
export { renderReleasePrivateNpmWorkflow } from "./scaffold-release-private-npm-template.js";
export type { ReleasePrivateNpmWorkflowRenderInput } from "./scaffold-release-private-npm-template.js";
export {
	getBranchProtectionRequiredChecks,
	getNormalizedRequiredChecks,
	renderRequiredChecksManifest,
} from "./scaffold-required-checks-manifest-template.js";

/**
 * Default CI provider used when scaffold render context does not specify one.
 */
export const DEFAULT_CI_PROVIDER: CIProvider = "circleci";

const DEFAULT_TRANSITION_STATUS_UPDATED_AT = "2026-03-14T00:00:00.000Z";

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
 * Render the scaffolded GitHub Actions security scan workflow.
 *
 * @returns The YAML contents for `.github/workflows/secret-scan.yml`.
 */
export function renderSecurityScanWorkflow(): string {
	return renderCiTemplate("secret-scan.yml");
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
