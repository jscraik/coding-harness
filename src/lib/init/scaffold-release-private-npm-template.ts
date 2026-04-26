import {
	renderCiTemplate,
	replaceTemplateTokens,
} from "./scaffold-ci-template-utils.js";
import { renderGitHubActionsPnpmSetupStep } from "./scaffold-github-actions-pr-pipeline-template.js";
import type { PackageManager } from "./types.js";

/** Package-manager-specific command inputs for the private npm release workflow. */
export interface ReleasePrivateNpmWorkflowRenderInput {
	/** Detected supported package manager. */
	packageManager: PackageManager;
	/** Dependency installation command rendered for the scaffolded workflow. */
	installCommand: string;
	/** Validation command rendered before publish. */
	checkCommand: string;
	/** Build command rendered before publish. */
	buildCommand: string;
}

function renderPrivateNpmPublishCommand(
	packageManager: PackageManager,
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

	return replaceTemplateTokens(renderCiTemplate("release-private-npm.yml"), {
		buildCommand: input.buildCommand,
		checkCommand: input.checkCommand,
		installCommand: input.installCommand,
		packageManagerSetupStep,
		publishOidcCommand: renderPrivateNpmPublishCommand(
			input.packageManager,
			true,
		),
		publishTokenCommand: renderPrivateNpmPublishCommand(
			input.packageManager,
			false,
		),
	});
}
