// biome-ignore-all lint/suspicious/noTemplateCurlyInString: tests assert literal GitHub workflow placeholders.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validatePrTemplateBody } from "../pr-template-validator.js";
import {
	renderContributingTemplate,
	renderPrekConfigTemplate,
	renderPullRequestTemplate,
} from "./scaffold-doc-templates.js";
import { REQUIRED_WORK_FIELDS } from "../pr-template-validator-rules.js";

const requiredWorkPerformedLabels = [
	"Plan IDs",
	"Linear reference",
	"Linked issue relationship",
	"Phase / slice",
	"Session IDs",
	"Trace IDs",
	"AI session / traceability",
	"Completed work",
	"Affected surfaces",
	"Documentation impact",
	"Expected outcome alignment",
	"Pattern scope inventory",
	"Meta-behavior proof",
	"Repeated-error research",
	"Acceptance trace",
	"Validation evidence",
	"Review artifacts",
	"Durable evidence map",
	"Runtime impact",
	"CodeRabbit mode coverage",
	"Closeout state",
	"Learning / reinforcement",
	"Deferred work",
] as const;

const completedWorkPerformedValues = new Map<string, string>([
	["Plan IDs", "JSC-999; .harness/plan/generated-template.md"],
	["Linear reference", "Refs JSC-999."],
	[
		"Linked issue relationship",
		"implementation closure for JSC-999; completed acceptance IDs: SA-999-001.",
	],
	["Phase / slice", "Generated template parity"],
	["Session IDs", "codex-session-generated-template-test"],
	["Trace IDs", "harness-run-generated-template-test"],
	[
		"AI session / traceability",
		"codex-session-generated-template-test supports the generated template invariant.",
	],
	["Completed work", "Rendered scaffolded PR template and validated it."],
	["Affected surfaces", "docs, PR template, workflow config, and tests."],
	[
		"Documentation impact",
		"PR template and scaffold fixtures updated; README.md, SECURITY.md, CONTRIBUTING.md, AGENTS.md, ARCHITECTURE.md, governance docs, and deep-module READMEs are n.a. because this fixture only proves generated PR template validation.",
	],
	[
		"Expected outcome alignment",
		"Keeps PR evidence portable and machine-checkable for greenfield and brownfield repos.",
	],
	[
		"Pattern scope inventory",
		"Principle: generated governance templates must match validator contracts; scaffold and workflow template checked; unchanged siblings not applicable because this fixture does not admit pattern-bearing feedback.",
	],
	[
		"Meta-behavior proof",
		"n.a. (no repeated steering or high-signal correction admitted in this fixture).",
	],
	[
		"Repeated-error research",
		"n.a. (no same-error-twice troubleshooting trigger in this fixture).",
	],
	["Acceptance trace", "JSC-999 SA-999-001 -> scaffold-doc-templates.test.ts."],
	[
		"Validation evidence",
		"Command: pnpm vitest run src/lib/init/scaffold-doc-templates.test.ts -> pass.",
	],
	["Review artifacts", "Codex review artifact captured in test fixture."],
	[
		"Durable evidence map",
		"n.a. because review artifacts are represented by PR body links rather than local-only artifact paths.",
	],
	["Runtime impact", "CI-only."],
	["CodeRabbit mode coverage", "validation."],
	[
		"Closeout state",
		"PR state n.a.; merge or auto-merge state n.a.; branch/worktree state test fixture; Linear state n.a.; next-lane routing n.a.; no remaining blocker.",
	],
	["Learning / reinforcement", "none; no durable learning promoted."],
	["Deferred work", "none."],
]);

function fillRenderedPullRequestTemplate(template: string): string {
	let body = template
		.replace(
			"- What changed (brief):",
			"- What changed (brief): Validated generated PR template parity.",
		)
		.replace(
			"- Why this change was needed:",
			"- Why this change was needed: Prevent scaffold drift from bypassing PR-template validation.",
		)
		.replace(
			"- Risk and rollback plan:",
			"- Risk and rollback plan: Revert the template change and invariant test.",
		)
		.replaceAll("- [ ]", "- [x]")
		.replaceAll("pass/fail", "pass")
		.replaceAll(
			"<link / artifact path / comment ID>",
			"https://example.com/review-artifact",
		)
		.replaceAll(
			"<reviewer + link>",
			"Codex https://example.com/independent-review",
		)
		.replace(
			"Add one-paragraph merge rationale here.",
			"Generated PR templates must remain compatible with the validator they ask downstream users to satisfy.",
		);

	for (const [label, value] of completedWorkPerformedValues) {
		body = body.replace(
			new RegExp(`^- ${label}: .*$`, "m"),
			`- ${label}: ${value}`,
		);
	}

	body = body
		.replace(
			"- verification_commands: list exact commands run here",
			"- verification_commands: pnpm vitest run src/lib/init/scaffold-doc-templates.test.ts",
		)
		.replace(
			"- verification_outcomes: record pass/blocked for each command here",
			"- verification_outcomes: pass",
		)
		.replace(
			"- blocked_steps_reason: none if all planned steps ran",
			"- blocked_steps_reason: none",
		)
		.replace("- Any other command(s):", "- Any other command(s): none");

	return body;
}

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
		for (const label of requiredWorkPerformedLabels) {
			expect(template).toContain(`- ${label}:`);
		}
		for (const field of REQUIRED_WORK_FIELDS) {
			expect(template).toContain(`- ${field.label}: ${field.placeholder}`);
		}
	});

	it("renders a pull request template that can satisfy the validator contract", () => {
		const template = renderPullRequestTemplate({
			agentBranchPrefix: "jscraik/feature",
			checkCommand: "pnpm check",
			codestyleCommand: "bash scripts/validate-codestyle.sh",
			memoryValidateCommand: "test -f memory.json",
		});

		expect(
			validatePrTemplateBody(fillRenderedPullRequestTemplate(template)),
		).toEqual([]);
	});

	it("keeps the generated PR pipeline delegated to the shared PR template gate", () => {
		const pipelineTemplate = readFileSync(
			"src/templates/pr-pipeline.yml",
			"utf8",
		);

		expect(pipelineTemplate).toContain(
			"node --import tsx src/cli.ts pr-template-gate --json",
		);
		expect(pipelineTemplate).toContain(
			"PR_TEMPLATE_BODY: ${{ github.event.pull_request.body }}",
		);
		expect(pipelineTemplate).not.toContain("const requiredWorkFields = [");
		expect(pipelineTemplate).not.toContain(
			"const body = context.payload.pull_request?.body",
		);
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
