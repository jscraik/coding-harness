/**
 * Script scaffold template inventory for harness init.
 *
 * This module groups generated `scripts/**` files so the root scaffold registry
 * can stay focused on high-level inventory order.
 *
 * @module lib/init/scaffold-script-template-registry
 */

import { renderCheckEnvironmentScript } from "./scaffold-environment-templates.js";
import {
	renderCheckHookCriticalConfigSyncScript,
	renderCheckStagedSecretsScript,
	renderSetupGitHooksScript,
	renderValidateCommitMsgScript,
} from "./scaffold-hook-templates.js";
import { AGENT_BRANCH_PREFIX } from "./scaffold-root-command-templates.js";
import {
	renderCheckCodestyleParityScript,
	renderCheckDocStyleScript,
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
	renderCodexEnforcedTemplate,
	renderCodexLearnTemplate,
	renderCodexPreflightLegacyLocalMemoryTemplate,
	renderCodexPreflightTemplate,
	renderHarnessCliWrapper,
	renderHarnessGateRunner,
	renderVerifyWorkScript,
} from "./scaffold-shell-templates.js";
import {
	renderNewTaskScript,
	renderPrepareWorktreeScript,
} from "./scaffold-worktree-templates.js";
import type { Template } from "./types.js";

/**
 * Hook, quality, and Semgrep scripts emitted before config/codestyle templates.
 */
export const QUALITY_AND_HOOK_SCRIPT_TEMPLATES: readonly Template[] = [
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
];

/**
 * Codex, verification, worktree, and environment scripts emitted after codestyle templates.
 */
export const CODEX_AND_WORKFLOW_SCRIPT_TEMPLATES: readonly Template[] = [
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
];
