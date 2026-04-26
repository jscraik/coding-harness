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

const AGENT_BRANCH_PREFIX = "codex";

/**
 * Builds the shell command to invoke a package script using the given package manager.
 *
 * @param packageManager - Package manager identifier; when `"npm"` the returned command uses `npm run`.
 * @param script - The script name to execute as defined in `package.json`.
 * @returns The shell command string that runs the specified script.
 */
function renderScriptCommand(packageManager: string, script: string): string {
	if (packageManager === "npm") {
		return `npm run ${script}`;
	}
	return `${packageManager} ${script}`;
}

/**
 * Constructs a package-manager-specific install command used during workflow bootstrap.
 *
 * @param packageManager - Package manager identifier.
 * @returns The install command string for the selected package manager.
 */
function renderWorkflowBootstrapInstallCommand(packageManager: string): string {
	if (packageManager === "npm") {
		return "npm ci";
	}
	return `${renderInstallCommand(packageManager)} --frozen-lockfile`;
}

function renderMemoryValidateCommand(): string {
	return `test -f memory.json && jq -e '.meta.version == "1.0" and (.preamble.bootstrap | type == "boolean") and (.preamble.search | type == "boolean") and (.entries | type == "array")' memory.json >/dev/null`;
}

/**
 * Produce the repository-level `.npmrc` contents used by generated projects.
 *
 * @returns The `.npmrc` file contents to write into the scaffolded repository.
 */
function renderDefaultNpmrc(): string {
	return `@brainwav:registry=https://registry.npmjs.org/
ignore-scripts=true
strict-peer-dependencies=false
auto-install-peers=false
shamefully-hoist=false
# Keep pnpm's isolated linker default; enable hoisted linker only for legacy-compat repos.
# node-linker=hoisted

# Auth should come from user-level ~/.npmrc or CI-injected ~/.npmrc, not this repo.
# Do not add //registry.npmjs.org/:_authToken=... here, because it can override
# a valid npm login and break local installs.
`;
}

const MAKEFILE_TEMPLATE = `# Harness Development Makefile
# Run \`make help\` to see available commands

.PHONY: help install setup preflight worktree-ready verify-work codestyle-parity codestyle hooks hooks-pre-commit hooks-pre-push hooks-commit-msg secrets-staged docs-style-changed related-tests semgrep-changed diagrams-check dev build lint docs-lint fmt typecheck test check audit secrets security clean reset ci diagrams env-check

# Default target
help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\\n", $1, $2}' $(MAKEFILE_LIST)

# === Setup ===

install: ## Install dependencies
	pnpm install

setup: install hooks ## Full setup: install deps and configure git hooks

preflight: ## Run repository preflight checks (required local-memory gate by default)
	@bash ./scripts/codex-preflight.sh

worktree-ready: ## Bootstrap a fresh git worktree before first push
	@bash ./scripts/prepare-worktree.sh

verify-work: ## Run canonical repo-local verification wrapper
	@bash ./scripts/verify-work.sh

codestyle-parity: ## Verify CODESTYLE pack parity checksums
	@bash ./scripts/check-codestyle-parity.sh

codestyle: ## Run fail-closed codestyle validation
	@bash ./scripts/validate-codestyle.sh

hooks: ## Setup git hooks
	node scripts/setup-git-hooks.js

hooks-pre-commit: ## Run local pre-commit gates before creating a commit
	@bash ./scripts/check-hook-critical-config-sync.sh
	$(MAKE) codestyle-parity
	pnpm lint
	pnpm docs:lint
	pnpm typecheck
	pnpm run quality:docstrings
	pnpm run quality:size
	$(MAKE) secrets-staged
	$(MAKE) docs-style-changed
	$(MAKE) related-tests

hooks-pre-push: ## Run local pre-push governance gates before pushing
	pnpm exec tsx src/cli.ts docs-gate --mode required --json
	@bash ./scripts/check-diagram-freshness.sh
	pnpm exec tsx src/cli.ts tooling-audit --path . --json
	@bash ./scripts/check-environment.sh
	$(MAKE) semgrep-changed
	$(MAKE) codestyle
	pnpm build

hooks-commit-msg: ## Validate commit message policy (use HOOK_COMMIT_MSG or MSG_FILE=/path)
	@tmp_file="$(mktemp)"; \
	trap 'rm -f "$tmp_file"' EXIT; \
	if [ -n "$${"${"}HOOK_COMMIT_MSG:-}" ]; then \
		printf '%s\n' "$${"${"}HOOK_COMMIT_MSG}" > "$tmp_file"; \
	elif [ -n "$${"${"}MSG_FILE:-}" ]; then \
		cat "$${"${"}MSG_FILE}" > "$tmp_file"; \
	else \
		echo "Usage: HOOK_COMMIT_MSG=\"feat: test\" make hooks-commit-msg or make hooks-commit-msg MSG_FILE=/path/to/commit-msg" >&2; \
		exit 2; \
	fi; \
	node scripts/validate-commit-msg.js "$tmp_file"

secrets-staged: ## Scan staged content for secrets before committing
	pnpm run secrets:staged

docs-style-changed: ## Run Vale on staged authoritative docs only
	pnpm run docs:style:changed

related-tests: ## Run Vitest related mode for staged src implementation files
	pnpm run test:related

semgrep-changed: ## Run narrow Semgrep rules against changed src implementation files
	pnpm run semgrep:changed

diagrams-check: ## Refresh architecture diagrams when sensitive paths change and fail on drift
	@bash ./scripts/check-diagram-freshness.sh

# === Development ===

dev: ## Start development server
	pnpm dev

build: ## Build for production
	pnpm build

# === Quality ===

lint: ## Run linter
	pnpm lint

docs-lint: ## Lint markdown/docs
	pnpm docs:lint

fmt: ## Format code
	pnpm fmt

typecheck: ## Run TypeScript type checking
	pnpm typecheck

test: ## Run tests
	pnpm test

check: ## Run all required quality gates
	pnpm check

# === Security ===

audit: ## Run security audit
	pnpm audit

secrets: ## Scan for secrets with gitleaks
	@gitleaks detect --source . --verbose || (echo "Install gitleaks: brew install gitleaks" && exit 1)

security: audit secrets ## Run all security checks

# === Maintenance ===

clean: ## Clean build artifacts and caches
	rm -rf dist coverage artifacts .test-traces* .traces
	rm -rf node_modules/.cache

reset: clean ## Full reset: clean and reinstall
	pnpm install

# === CI ===

ci: ## Run CI-equivalent local checks
	pnpm check

# === Diagrams ===

diagrams: ## Generate architecture diagrams
	@bash ./scripts/refresh-diagram-context.sh --force

# === Environment ===

env-check: ## Check environment policy envelope
	@bash ./scripts/check-environment.sh
`;

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
		render: () => MAKEFILE_TEMPLATE,
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
	return TEMPLATES.filter((template) => {
		if (!isTemplateEnabledForProvider(template.path, ciProvider)) {
			return false;
		}

		// Minimal mode skips enterprise governance templates
		if (options?.minimal) {
			const minimalOmit = [
				".github/CODEOWNERS",
				"docs/PRODUCT-PLAN.md",
				".harness/ci-required-checks.json",
			];
			if (minimalOmit.includes(template.path)) {
				return false;
			}
		}

		// Issue tracker skips (linear templates are implicitly skipped in minimal mode)
		if (
			options?.minimal ||
			options?.issueTracker === "none" ||
			options?.issueTracker === "github"
		) {
			if (template.path.startsWith(".linear/")) {
				return false;
			}
		}

		if (options?.issueTracker === "none") {
			if (template.path.includes("ISSUE_TEMPLATE")) {
				return false;
			}
		}

		return true;
	});
}
