import {
	renderCiTemplate,
	replaceTemplateTokens,
} from "./scaffold-ci-template-utils.js";
import type { GitHubActionsPrPipelineRenderInput } from "./scaffold-github-actions-pr-pipeline-template.js";

/**
 * Encapsulates risk-policy dependency wiring for the PR pipeline workflow.
 */
interface RiskPolicyTokens {
	riskPolicyNeeds: string;
	riskPolicyIf: string;
}

function resolveRiskPolicyTokens(
	linearTrackingEnabled: boolean,
): RiskPolicyTokens {
	if (linearTrackingEnabled) {
		return {
			riskPolicyNeeds: "[pr-template, linear-gate]",
			riskPolicyIf:
				"${{ always() && (github.event_name == 'merge_group' || (needs.pr-template.result == 'success' && needs.linear-gate.result == 'success')) }}",
		};
	}

	return {
		riskPolicyNeeds: "[pr-template]",
		riskPolicyIf:
			"${{ always() && (github.event_name == 'merge_group' || needs.pr-template.result == 'success') }}",
	};
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
 * Render the scaffolded GitHub Actions PR pipeline workflow from command tokens.
 *
 * @param input - Pre-resolved package-manager commands and issue-tracker mode.
 * @param pnpmSetupStep - YAML snippet that ensures pnpm is installed at runtime.
 * @returns The YAML contents for `.github/workflows/pr-pipeline.yml`.
 */
export function renderGitHubActionsPrPipelineWorkflowTemplate(
	input: GitHubActionsPrPipelineRenderInput,
	pnpmSetupStep: string,
): string {
	const { riskPolicyIf, riskPolicyNeeds } = resolveRiskPolicyTokens(
		input.linearTrackingEnabled,
	);

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
