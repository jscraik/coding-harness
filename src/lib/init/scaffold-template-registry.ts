/**
 * Scaffold template registry for harness init.
 *
 * This module owns the list of files emitted by `harness init` and the
 * provider/option filtering rules that select the active scaffold surface.
 *
 * @module lib/init/scaffold-template-registry
 */

import { formatRequiredChecksBulleted } from "../policy/required-checks.js";
import { PROJECT_BRAIN_TEMPLATES } from "./project-brain-templates.js";
import {
	DEFAULT_CI_PROVIDER,
	getNormalizedRequiredChecks,
	isTemplateEnabledForProvider,
	renderCircleCIConfig,
	renderGitHubActionsPrPipelineWorkflow,
	renderReleasePrivateNpmWorkflow,
	renderRequiredChecksManifest,
	renderSecurityScanWorkflow,
	renderTransitionStatusArtifact,
} from "./scaffold-ci-templates.js";
import { renderCodexEnvironmentTemplate } from "./scaffold-codex-environment-templates.js";
import {
	renderBiomeConfigTemplate,
	renderGitleaksConfigTemplate,
	renderMiseConfigTemplate,
} from "./scaffold-config-templates.js";
import { renderHarnessContractTemplate } from "./scaffold-contract-template.js";
import {
	renderCheckDiagramFreshnessScript,
	renderDiagramRcTemplate,
	renderInitialDiagramContextTemplate,
	renderRefreshDiagramContextScript,
} from "./scaffold-diagram-templates.js";
import {
	renderContributingTemplate,
	renderPrekConfigTemplate,
	renderPullRequestTemplate,
} from "./scaffold-doc-templates.js";
import { renderCheckEnvironmentScript } from "./scaffold-environment-templates.js";
import {
	renderChangelogTemplate,
	renderCodeRabbitTemplate,
	renderCodeownersTemplate,
	renderIssueTemplateConfig,
} from "./scaffold-governance-templates.js";
import {
	renderCheckHookCriticalConfigSyncScript,
	renderCheckStagedSecretsScript,
	renderSetupGitHooksScript,
	renderValidateCommitMsgScript,
} from "./scaffold-hook-templates.js";
import {
	AGENT_BRANCH_PREFIX,
	renderDefaultNpmrc,
	renderMakefileTemplate,
	renderMemoryValidateCommand,
	renderScriptCommand,
	renderWorkflowBootstrapInstallCommand,
} from "./scaffold-root-command-templates.js";
import {
	CODESTYLE_PACK_TEMPLATE_FILES,
	renderCheckCodestyleParityScript,
	renderCheckDocStyleScript,
	renderCodestylePackTemplate,
	renderCodestyleTemplate,
	renderPackagedRootFile,
	renderValidateCodestyleScript,
} from "./scaffold-root-templates.js";
import {
	renderSemgrepBootstrapScript,
	renderSemgrepChangedScript,
	renderSemgrepFullScript,
	renderSemgrepPrePushRules,
} from "./scaffold-semgrep-templates.js";
import {
	renderAddPackageCommand,
	renderCodexEnforcedTemplate,
	renderCodexLearnTemplate,
	renderCodexPreflightLegacyLocalMemoryTemplate,
	renderCodexPreflightTemplate,
	renderHarnessCliWrapper,
	renderHarnessGateRunner,
	renderInstallCommand,
	renderLocalHarnessExecCommand,
	renderVerifyWorkScript,
} from "./scaffold-shell-templates.js";
import { selectTemplatesForProvider } from "./scaffold-template-selection.js";
import { renderWorkflowTemplate } from "./scaffold-workflow-template.js";
import {
	renderNewTaskScript,
	renderPrepareWorktreeScript,
} from "./scaffold-worktree-templates.js";
import {
	type CIProvider,
	CODEX_ENVIRONMENT_TEMPLATE_PATH,
	type InitOptions,
	type Template,
} from "./types.js";

export { isTemplateEnabledForProvider };

/**
 * Root scaffold templates emitted by `harness init`.
 *
 * Keep this list ordered by generated surface area so init output remains
 * predictable and direct registry tests can assert the intended scaffold shape.
 */
export const TEMPLATES: Template[] = [
	{
		path: "harness.contract.json",
		render: (pm, context) =>
			renderHarnessContractTemplate({
				agentBranchPrefix: AGENT_BRANCH_PREFIX,
				context,
				packageManager: pm,
				requiredChecks: getNormalizedRequiredChecks(
					context.ciProvider ?? DEFAULT_CI_PROVIDER,
					context,
				),
			}),
	},
	{
		path: "memory.json",
		render: () =>
			JSON.stringify(
				{
					repo: "replace-with-repo-name",
					session_id: "bootstrap/init",
					preamble: {
						bootstrap: true,
						search: true,
					},
					entries: [
						{
							level: "observation",
							content:
								"Harness memory baseline initialized. Replace with task-specific observations.",
							tags: ["repo:unknown", "area:bootstrap", "type:setup"],
							session_id: "bootstrap/init",
							source: "harness init",
							observed_at: "2026-01-01T00:00:00.000Z",
						},
					],
					closeout: {
						forjamie_updated: false,
						date: "2026-01-01T00:00:00.000Z",
					},
					meta: {
						created_at: "2026-01-01T00:00:00.000Z",
						version: "1.0",
					},
				},
				null,
				2,
			),
	},
	{
		path: ".harness/ci-required-checks.json",
		render: (_pm, context) =>
			renderRequiredChecksManifest(
				context.ciProvider ?? DEFAULT_CI_PROVIDER,
				context,
			),
	},
	{
		path: ".harness/ci-provider-transition-status.json",
		render: () => renderTransitionStatusArtifact(),
	},
	...PROJECT_BRAIN_TEMPLATES,
	{
		path: ".npmrc",
		render: () => renderDefaultNpmrc(),
	},
	{
		path: ".coderabbit.yaml",
		render: () => renderCodeRabbitTemplate(),
	},
	{
		path: "CHANGELOG.md",
		render: () => renderChangelogTemplate(),
	},
	{
		path: ".github/workflows/release-private-npm.yml",
		render: (pm) =>
			renderReleasePrivateNpmWorkflow({
				packageManager: pm,
				installCommand: renderWorkflowBootstrapInstallCommand(pm),
				checkCommand: renderScriptCommand(pm, "check"),
				buildCommand: renderScriptCommand(pm, "build"),
			}),
	},
	{
		path: ".github/workflows/pr-pipeline.yml",
		render: (pm, context) =>
			renderGitHubActionsPrPipelineWorkflow({
				installCommand: renderInstallCommand(pm),
				lintCommand: renderScriptCommand(pm, "lint"),
				typecheckCommand: renderScriptCommand(pm, "typecheck"),
				testCommand: renderScriptCommand(pm, "test:ci"),
				auditCommand: renderScriptCommand(pm, "audit"),
				checkCommand: renderScriptCommand(pm, "check"),
				memoryValidateCommand: renderMemoryValidateCommand(),
				linearTrackingEnabled:
					context.issueTracker !== "github" && context.issueTracker !== "none",
			}),
	},
	{
		path: ".github/workflows/secret-scan.yml",
		render: () => renderSecurityScanWorkflow(),
	},
	{
		path: ".circleci/config.yml",
		render: (pm, context) =>
			renderCircleCIConfig({
				packageManager: pm,
				installCommand:
					pm === "pnpm"
						? "pnpm install --frozen-lockfile --prefer-offline"
						: renderWorkflowBootstrapInstallCommand(pm),
				lintCommand: renderScriptCommand(pm, "lint"),
				typecheckCommand: renderScriptCommand(pm, "typecheck"),
				testCommand: renderScriptCommand(pm, "test:ci"),
				auditCommand: renderScriptCommand(pm, "audit"),
				checkCommand: renderScriptCommand(pm, "check"),
				dependencyAuditCommand: renderScriptCommand(pm, "audit:strict"),
				memoryValidateCommand: renderMemoryValidateCommand(),
				linearTrackingEnabled:
					context.issueTracker !== "github" && context.issueTracker !== "none",
			}),
	},
	{
		path: "CONTRIBUTING.md",
		render: (pm, context) => {
			const checkCommand = renderScriptCommand(pm, "check");
			const codestyleCommand = "bash scripts/validate-codestyle.sh";
			const memoryValidateCommand = renderMemoryValidateCommand();
			const requiredChecksList = formatRequiredChecksBulleted(
				getNormalizedRequiredChecks(
					context.ciProvider ?? DEFAULT_CI_PROVIDER,
					context,
				),
				"  - ",
			);
			const isCircleCI =
				(context.ciProvider ?? DEFAULT_CI_PROVIDER) === "circleci";
			return renderContributingTemplate({
				addCommand: renderAddPackageCommand(pm, "@brainwav/coding-harness"),
				agentBranchPrefix: AGENT_BRANCH_PREFIX,
				checkCommand,
				codestyleCommand,
				installCommand: renderInstallCommand(pm),
				isCircleCI,
				localExecCommand: renderLocalHarnessExecCommand(pm),
				memoryValidateCommand,
				requiredChecksList,
			});
		},
	},
	{
		path: ".github/PULL_REQUEST_TEMPLATE.md",
		render: (pm) => {
			const checkCommand = renderScriptCommand(pm, "check");
			const codestyleCommand = "bash scripts/validate-codestyle.sh";
			const memoryValidateCommand = renderMemoryValidateCommand();
			return renderPullRequestTemplate({
				checkCommand,
				codestyleCommand,
				memoryValidateCommand,
			});
		},
	},
	{
		path: "scripts/validate-commit-msg.js",
		render: () => renderValidateCommitMsgScript(AGENT_BRANCH_PREFIX),
	},
	{
		path: "scripts/setup-git-hooks.js",
		render: () => renderSetupGitHooksScript(),
	},
	{
		path: "scripts/check-staged-secrets.sh",
		render: () => renderCheckStagedSecretsScript(),
	},
	{
		path: "scripts/check-hook-critical-config-sync.sh",
		render: () => renderCheckHookCriticalConfigSyncScript(),
	},
	{
		path: "scripts/check-doc-style.sh",
		render: () => renderCheckDocStyleScript(),
	},
	{
		path: "scripts/check-related-tests.sh",
		render: () => renderPackagedRootFile("scripts/check-related-tests.sh"),
	},
	{
		path: "scripts/check-public-api-docs.mjs",
		render: () => renderPackagedRootFile("scripts/check-public-api-docs.mjs"),
	},
	{
		path: "scripts/check-code-size.mjs",
		render: () => renderPackagedRootFile("scripts/check-code-size.mjs"),
	},
	{
		path: "scripts/lib/changed-files.mjs",
		render: () => renderPackagedRootFile("scripts/lib/changed-files.mjs"),
	},
	{
		path: "scripts/check-semgrep-changed.sh",
		render: () => renderSemgrepChangedScript(),
	},
	{
		path: "scripts/check-semgrep-full.sh",
		render: () => renderSemgrepFullScript(),
	},
	{
		path: "scripts/semgrep-bootstrap.sh",
		render: () => renderSemgrepBootstrapScript(),
	},
	{
		path: "scripts/semgrep-pre-push.yml",
		render: () => renderSemgrepPrePushRules(),
	},
	{
		path: "scripts/refresh-diagram-context.sh",
		render: renderRefreshDiagramContextScript,
	},
	{
		path: "scripts/check-diagram-freshness.sh",
		render: renderCheckDiagramFreshnessScript,
	},
	{
		path: ".diagram/.gitkeep",
		render: () => "",
	},
	{
		path: "AI/context/diagram-context.md",
		render: renderInitialDiagramContextTemplate,
	},
	{
		path: ".diagramrc",
		render: renderDiagramRcTemplate,
	},
	{
		path: "biome.json",
		render: () => renderBiomeConfigTemplate(),
	},
	{
		path: ".gitleaks.toml",
		render: () => renderGitleaksConfigTemplate(),
	},
	{
		path: "prek.toml",
		render: () => renderPrekConfigTemplate(),
	},
	{
		path: ".mise.toml",
		render: () => renderMiseConfigTemplate(),
	},
	{
		path: "CODESTYLE.md",
		render: () => renderCodestyleTemplate(),
	},
	...CODESTYLE_PACK_TEMPLATE_FILES.map((path) => ({
		path,
		render: () => renderCodestylePackTemplate(path),
	})),
	{
		path: "scripts/codex-preflight.sh",
		render: () => renderCodexPreflightTemplate(),
	},
	{
		path: "scripts/codex-preflight-local-memory-legacy.sh",
		render: () => renderCodexPreflightLegacyLocalMemoryTemplate(),
	},
	{
		path: "scripts/codex-learn",
		render: () => renderCodexLearnTemplate(),
	},
	{
		path: "scripts/codex-enforced",
		render: () => renderCodexEnforcedTemplate(),
	},
	{
		path: "scripts/verify-work.sh",
		render: (pm) => renderVerifyWorkScript(pm),
	},
	{
		path: "scripts/validate-codestyle.sh",
		render: () => renderValidateCodestyleScript(),
	},
	{
		path: "scripts/check-codestyle-parity.sh",
		render: () => renderCheckCodestyleParityScript(),
	},
	{
		path: "scripts/prepare-worktree.sh",
		render: (pm) => renderPrepareWorktreeScript(pm),
	},
	{
		path: "scripts/new-task.sh",
		render: () => renderNewTaskScript(),
	},
	{
		path: "scripts/harness-cli.sh",
		render: (pm) => renderHarnessCliWrapper(pm),
	},
	{
		path: "scripts/run-harness-gate.sh",
		render: (pm) => renderHarnessGateRunner(pm),
	},
	{
		path: "scripts/check-environment.sh",
		render: () => renderCheckEnvironmentScript(),
	},
	{
		path: CODEX_ENVIRONMENT_TEMPLATE_PATH,
		render: (pm, context) => renderCodexEnvironmentTemplate(pm, context),
	},
	{
		path: ".github/ISSUE_TEMPLATE/config.yml",
		render: (_pm, context) => renderIssueTemplateConfig(context),
	},
	{
		path: ".github/CODEOWNERS",
		render: () => renderCodeownersTemplate(),
	},
	{
		path: "Makefile",
		render: () => renderMakefileTemplate(),
	},
	{
		path: "WORKFLOW.md",
		render: (pm, context) =>
			renderWorkflowTemplate({
				checkCommand: renderScriptCommand(pm, "check"),
				context,
				installCommand: renderWorkflowBootstrapInstallCommand(pm),
			}),
	},
];

/**
 * Selects scaffold templates applicable to the specified CI provider and init options.
 *
 * Filters the global template list by:
 * - excluding templates not supported by the chosen CI provider;
 * - when `options.minimal` is true, omitting enterprise governance templates (`.github/CODEOWNERS`, `docs/PRODUCT-PLAN.md`, `.harness/ci-required-checks.json`);
 * - skipping all `.linear/` templates when `options.minimal` is true or `options.issueTracker` is `"none"` or `"github"`;
 * - skipping any template whose path contains `ISSUE_TEMPLATE` when `options.issueTracker` is `"none"`.
 *
 * @param ciProvider - The CI provider to target; used to enable/disable provider-specific templates.
 * @param options - Init options that influence template inclusion (`minimal` and `issueTracker`).
 * @returns An array of templates that should be rendered for the given CI provider and options.
 */
export function getTemplatesForProvider(
	ciProvider: CIProvider,
	options?: InitOptions,
): Template[] {
	return selectTemplatesForProvider(TEMPLATES, ciProvider, options);
}
