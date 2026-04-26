import { deriveRequiredCheckMetadata } from "../ci/required-check-metadata.js";
import { BRANCH_PROTECTION_REQUIRED_CHECKS } from "../policy/required-checks.js";
import { renderCiTemplate } from "./scaffold-ci-template-utils.js";
import type { CIProvider, TemplateRenderContext } from "./types.js";

export { renderCircleCIConfig } from "./scaffold-circleci-config-template.js";
export type { CircleCIConfigRenderInput } from "./scaffold-circleci-config-template.js";
export {
	renderGitHubActionsPnpmSetupStep,
	renderGitHubActionsPrPipelineWorkflow,
} from "./scaffold-github-actions-pr-pipeline-template.js";
export type { GitHubActionsPrPipelineRenderInput } from "./scaffold-github-actions-pr-pipeline-template.js";
export { renderReleasePrivateNpmWorkflow } from "./scaffold-release-private-npm-template.js";
export type { ReleasePrivateNpmWorkflowRenderInput } from "./scaffold-release-private-npm-template.js";

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

function escapeRegexLiteral(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
