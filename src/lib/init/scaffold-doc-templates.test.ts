// biome-ignore-all lint/suspicious/noTemplateCurlyInString: tests assert literal GitHub workflow placeholders.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validatePrTemplateBody } from "../pr-template-validator.js";
import {
	renderContributingTemplate,
	renderPrekConfigTemplate,
	renderPullRequestTemplate,
} from "./scaffold-doc-templates.js";
import {
	REQUIRED_BEHAVIOR_PROOF_FIELDS,
	REQUIRED_MOTIVATION_FIELDS,
	REQUIRED_WORK_FIELDS,
} from "../pr-template-validator-rules.js";

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
	"Documentation lifecycle impact",
	"SemVer impact",
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
		"Documentation lifecycle impact",
		"updated downstream-template PR contract fixture; canon class is supporting downstream scaffold.",
	],
	[
		"SemVer impact",
		"minor because downstream PR template requirements changed.",
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

const completedBehaviorProofValues = new Map<string, string>([
	[
		"Behavior or issue addressed",
		"Generated PR templates include the behavior-proof contract.",
	],
	[
		"Real environment tested",
		"local source-repo scaffold renderer through Vitest.",
	],
	[
		"Exact steps or command run after this patch",
		"pnpm vitest run src/lib/init/scaffold-doc-templates.test.ts.",
	],
	["Evidence after fix", "Generated template fixture passed validation."],
	[
		"Observed result after fix",
		"Rendered template satisfied validatePrTemplateBody.",
	],
	[
		"What was not tested",
		"live GitHub PR submission is n.a. because this fixture validates local rendering.",
	],
	["Proof limitations or environment constraints", "none for local rendering."],
	[
		"Behavior before fix",
		"generated PR templates did not require an explicit regression test plan.",
	],
]);

const completedMotivationValues = new Map<string, string>([
	[
		"Motivation",
		"Generated PR templates need to explain why a change exists before listing what changed.",
	],
	[
		"Reasoning",
		"Maintainers can review generated PR bodies faster when intent and decision pressure are explicit near the top.",
	],
	[
		"Chosen approach",
		"Add a required Motivation section to the scaffolded template and validator contract instead of relying on optional Summary prose.",
	],
]);

function fillRenderedPullRequestTemplate(template: string): string {
	let body = template
		.replace(
			"- Motivation:",
			`- Motivation: ${completedMotivationValues.get("Motivation")}`,
		)
		.replace(
			"- Reasoning:",
			`- Reasoning: ${completedMotivationValues.get("Reasoning")}`,
		)
		.replace(
			"- Chosen approach:",
			`- Chosen approach: ${completedMotivationValues.get("Chosen approach")}`,
		)
		.replace(
			"- Problem:",
			"- Problem: Generated PR templates could drift from validator contracts.",
		)
		.replace(
			"- Why now:",
			"- Why now: Prevent scaffold drift from bypassing PR-template validation.",
		)
		.replace(
			"- Intended outcome:",
			"- Intended outcome: Generated templates stay validator-compatible.",
		)
		.replace(
			"- Out of scope:",
			"- Out of scope: Changing downstream branch protection.",
		)
		.replace(
			"- Reviewer focus:",
			"- Reviewer focus: Template clarity and validator compatibility.",
		)
		.replace(
			"- Risk and rollback:",
			"- Risk and rollback: Revert the template change and invariant test.",
		)
		.replaceAll("- [ ]", "- [x]")
		.replace(
			"- CodeRabbit:\n",
			"- CodeRabbit: https://example.com/review-artifact\n",
		)
		.replace(
			"- Independent reviewer evidence:\n",
			"- Independent reviewer evidence: Codex https://example.com/independent-review\n",
		)
		.replace("- Codex:\n", "- Codex: https://example.com/review-artifact\n")
		.replace(
			"- CodeRabbit Semgrep:\n",
			"- CodeRabbit Semgrep: n.a. because this fixture does not run Semgrep.\n",
		)
		.replace(
			"<!-- Add one-paragraph merge rationale before requesting review. -->",
			"Generated PR templates must remain compatible with the validator they ask downstream users to satisfy.",
		);

	for (const [label, value] of completedWorkPerformedValues) {
		body = body.replace(
			new RegExp(`^- ${label}:.*$`, "m"),
			`- ${label}: ${value}`,
		);
	}

	for (const [label, value] of completedBehaviorProofValues) {
		body = body.replace(
			new RegExp(`^- ${label}:.*$`, "m"),
			`- ${label}: ${value}`,
		);
	}

	body = body
		.replace(
			"- verification_commands:",
			"- verification_commands: pnpm vitest run src/lib/init/scaffold-doc-templates.test.ts",
		)
		.replace("- verification_outcomes:", "- verification_outcomes: pass")
		.replace("- blocked_steps_reason:", "- blocked_steps_reason: none")
		.replace(
			"<!-- Add one or more evidence lines such as:\n- Command: `bash scripts/validate-codestyle.sh` -> pass\n- Command: `pnpm check` -> blocked (reason)\n- Command: `test -f memory.json` -> n.a. (reason)\n-->",
			"- Command: `pnpm vitest run src/lib/init/scaffold-doc-templates.test.ts` -> pass",
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
		expect(template).toContain(
			"This change is user-facing and I added a changelog entry.",
		);
		expect(template).toContain("This change is not user-facing.");
		expect(template).toContain("## What Problem This Solves");
		for (const field of REQUIRED_MOTIVATION_FIELDS) {
			expect(template).toContain(`- ${field.label}:`);
		}
		expect(template).toContain("## Behavior Proof");
		expect(template).toContain("Behavior proof is separate from unit tests");
		expect(template).toContain("regression_test_plan");
		expect(template).toContain("verification_commands");
		expect(template).toContain("blocked_steps_reason");
		for (const label of requiredWorkPerformedLabels) {
			expect(template).toContain(`- ${label}:`);
		}
		for (const field of REQUIRED_WORK_FIELDS) {
			expect(template).toContain(`- ${field.label}:`);
			expect(template).not.toContain(`- ${field.label}: ${field.placeholder}`);
		}
		for (const field of REQUIRED_BEHAVIOR_PROOF_FIELDS) {
			expect(template).toContain(`- ${field.label}:`);
			expect(template).not.toContain(`- ${field.label}: ${field.placeholder}`);
		}
		expect(template).not.toContain("pass/fail");
		expect(template).not.toContain("<link / artifact path / comment ID>");
		expect(template).not.toContain("<reviewer + link>");
		expect(template).not.toContain("Add one-paragraph merge rationale here.");
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
