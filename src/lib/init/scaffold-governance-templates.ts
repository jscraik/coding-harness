/**
 * Repository-governance scaffold template rendering for downstream repositories.
 *
 * This module owns issue-intake, review-tool, changelog, and ownership templates
 * emitted by `harness init`.
 *
 * @module lib/init/scaffold-governance-templates
 */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { TemplateRenderContext } from "./types.js";

/**
 * Render the GitHub issue-template config that routes intake to the configured tracker.
 *
 * @param context - Template render context used to derive tracker, docs, and security links.
 * @returns YAML contents for `.github/ISSUE_TEMPLATE/config.yml`.
 */
export function renderIssueTemplateConfig(
	context: TemplateRenderContext,
): string {
	const securityEmail = context.securityEmail ?? "security@example.com";
	const repoDocsUrl = context.repoUrl
		? `${context.repoUrl.replace(/\.git$/, "")}#readme`
		: undefined;
	const contactLinks = [];

	if (context.issueTracker !== "github" && context.issueTracker !== "none") {
		const linearUrl = context.issueTrackingUrl ?? "https://linear.app/";
		contactLinks.push(
			`  - name: Linear work intake
    url: ${linearUrl}
    about: Create or update bugs, features, policy gaps, automation work, and release follow-ups in Linear.`,
		);
	}

	if (repoDocsUrl) {
		contactLinks.push(
			`  - name: Repository docs
    url: ${repoDocsUrl}
    about: Review setup, workflow, and command documentation before opening new work.`,
		);
	}
	contactLinks.push(
		`  - name: Private security disclosure
    url: mailto:${securityEmail}
    about: Report security vulnerabilities privately instead of using public issue flows.`,
	);
	return `# Issue template configuration
blank_issues_enabled: false
contact_links:
${contactLinks.join("\n")}
`;
}

/**
 * Load the CodeRabbit configuration template.
 *
 * @returns The UTF-8 contents of the packaged `.coderabbit.yaml` template.
 */
export function renderCodeRabbitTemplate(): string {
	const packagedTemplatePath = fileURLToPath(
		new URL("../../templates/coderabbit.yaml", import.meta.url),
	);
	if (existsSync(packagedTemplatePath)) {
		return readFileSync(packagedTemplatePath, "utf-8");
	}
	const repoTemplatePath = fileURLToPath(
		new URL("../../../.coderabbit.yaml", import.meta.url),
	);
	return readFileSync(repoTemplatePath, "utf-8");
}

/**
 * Render the initial changelog scaffold.
 *
 * @returns Markdown contents for `CHANGELOG.md`.
 */
export function renderChangelogTemplate(): string {
	return `# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Bootstrap release/changelog pipeline scaffolding via \`harness init\`.
`;
}

/**
 * Render the default CODEOWNERS scaffold for governance-sensitive surfaces.
 *
 * @returns CODEOWNERS contents for `.github/CODEOWNERS`.
 */
export function renderCodeownersTemplate(): string {
	return `# Governance-sensitive surfaces
/.github/workflows/** @jscraik
/harness.contract.json @jscraik
/CONTRIBUTING.md @jscraik
/AGENTS.md @jscraik
/scripts/codex-preflight.sh @jscraik
/scripts/verify-work.sh @jscraik
/scripts/validate-codestyle.sh @jscraik
/scripts/check-related-tests.sh @jscraik
/scripts/check-public-api-docs.mjs @jscraik
/scripts/check-code-size.mjs @jscraik
/scripts/lib/changed-files.mjs @jscraik
/scripts/check-codestyle-parity.sh @jscraik
/scripts/prepare-worktree.sh @jscraik
/scripts/new-task.sh @jscraik
/scripts/harness-cli.sh @jscraik
/scripts/check-environment.sh @jscraik
/codestyle/** @jscraik
`;
}
