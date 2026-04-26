import {
	renderCiTemplate,
	replaceTemplateTokens,
} from "./scaffold-ci-template-utils.js";

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
