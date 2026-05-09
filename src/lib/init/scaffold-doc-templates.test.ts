import { describe, expect, it } from "vitest";
import {
	renderContributingTemplate,
	renderPrekConfigTemplate,
	renderPullRequestTemplate,
} from "./scaffold-doc-templates.js";

const baseContributingOptions = {
	addCommand: "pnpm add -D @brainwav/coding-harness",
	agentBranchPrefix: "jscraik/feature",
	checkCommand: "pnpm check",
	codestyleCommand: "bash scripts/validate-codestyle.sh",
	installCommand: "pnpm install",
	isCircleCI: false,
	localExecCommand: "pnpm exec harness",
	memoryValidateCommand: "test -f memory.json",
	requiredChecksList: "  - lint\n  - test-run\n  - typecheck",
};

describe("document scaffold templates", () => {
	it("renders the downstream contributing guide with core workflow policy", () => {
		const contributing = renderContributingTemplate(baseContributingOptions);

		expect(contributing).toContain("# Contributing");
		expect(contributing).toContain(
			"Agent-created branch: `git switch -c jscraik/feature/",
		);
		expect(contributing).toContain("- bash scripts/validate-codestyle.sh");
		expect(contributing).toContain("- pnpm check");
		expect(contributing).toContain("- test -f memory.json");
		expect(contributing).toContain("pnpm add -D @brainwav/coding-harness");
		expect(contributing).toContain("pnpm exec harness <command>");
		expect(contributing).toContain("  - lint\n  - test-run\n  - typecheck");
	});

	it("includes CircleCI test artifact guidance only for CircleCI projects", () => {
		const githubActionsContributing = renderContributingTemplate(
			baseContributingOptions,
		);
		const circleCiContributing = renderContributingTemplate({
			...baseContributingOptions,
			isCircleCI: true,
		});

		expect(githubActionsContributing).not.toContain(
			"Test runner artifact configuration",
		);
		expect(circleCiContributing).toContain(
			"Test runner artifact configuration",
		);
		expect(circleCiContributing).toContain("artifacts/test-results/junit.xml");
	});

	it("renders the pull request template with required review evidence", () => {
		const template = renderPullRequestTemplate({
			agentBranchPrefix: "jscraik/feature",
			checkCommand: "pnpm check",
			codestyleCommand: "bash scripts/validate-codestyle.sh",
			memoryValidateCommand: "test -f memory.json",
		});

		expect(template).toContain("# Pull request checklist");
		expect(template).toContain(
			"Branch name follows policy (`jscraik/feature/*` for agent-created branches).",
		);
		expect(template).toContain(
			"Required local gates run: `bash scripts/validate-codestyle.sh`, `pnpm check`, `test -f memory.json`.",
		);
		expect(template).toContain("CodeRabbit review completed");
		expect(template).toContain("Codex review completed");
		expect(template).toContain("verification_commands");
		expect(template).toContain("blocked_steps_reason");
	});

	it("renders prek hook config from the required tooling baseline", () => {
		const config = renderPrekConfigTemplate();

		expect(config).toContain("default_install_hook_types");
		expect(config).toContain('id = "pre-commit"');
		expect(config).toContain('id = "pre-push"');
		expect(config).toContain("pass_filenames = false");
		expect(config).toContain('stages = ["pre-push"]');
	});
});
