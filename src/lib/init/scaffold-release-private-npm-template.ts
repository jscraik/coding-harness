import { renderCiTemplate } from "./scaffold-ci-template-utils.js";
import { renderGitHubActionsPnpmSetupStep } from "./scaffold-github-actions-pr-pipeline-template.js";

/**
 * Package-manager-specific command inputs for the private npm release workflow.
 */
export interface ReleasePrivateNpmWorkflowRenderInput {
	packageManager: string;
	installCommand: string;
	checkCommand: string;
	buildCommand: string;
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
