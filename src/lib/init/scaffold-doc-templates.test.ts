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
	CONDITIONAL_EVIDENCE_FIELDS,
	REQUIRED_BEHAVIOR_PROOF_FIELDS,
	REQUIRED_SUMMARY_FIELDS,
	REQUIRED_RELEASE_BOUNDARY_FIELDS,
	REQUIRED_REVIEW_FIELDS,
	REQUIRED_VALIDATION_FIELDS,
	REQUIRED_CHANGE_FIELDS,
} from "../pr-template-validator-rules.js";

const completedChangeDetailValues = new Map<string, string>([
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
		"Before",
		"Generated PR templates did not require an explicit regression test plan.",
	],
	["After", "Rendered templates satisfy validatePrTemplateBody."],
	[
		"Environment or operator path",
		"local source-repo scaffold renderer through Vitest.",
	],
	[
		"Verification steps",
		"pnpm vitest run src/lib/init/scaffold-doc-templates.test.ts.",
	],
	["Evidence after fix", "Generated template fixture passed validation."],
	[
		"Untested paths and limitations",
		"Live GitHub submission is n.a. because this fixture validates local rendering only.",
	],
]);

const completedSummaryValues = new Map<string, string>([
	[
		"Problem",
		"Generated PR templates need to explain why a change exists before listing what changed.",
	],
	[
		"Change",
		"Maintainers can review generated PR bodies faster when intent and decision pressure are explicit near the top.",
	],
	[
		"Why this approach",
		"Add a required Problem section to the scaffolded template and validator contract instead of relying on optional Summary prose.",
	],
]);

function fillRenderedPullRequestTemplate(template: string): string {
	let body = template
		.replace(
			"- Problem:",
			`- Problem: ${completedSummaryValues.get("Problem")}`,
		)
		.replace("- Change:", `- Change: ${completedSummaryValues.get("Change")}`)
		.replace(
			"- Why this approach:",
			`- Why this approach: ${completedSummaryValues.get("Why this approach")}`,
		)
		.replace(
			"- Release mode: Prototype / Portfolio / Product / Harness / n.a. because reason",
			"- Release mode: Harness",
		)
		.replace(
			"- Completion condition:",
			"- Completion condition: Generated PR templates satisfy the validator without broadening adjacent workflow gates.",
		)
		.replace("- Deferred work:", "- Deferred work: none for this fixture.")
		.replace(
			"- Stronger-proof condition:",
			"- Stronger-proof condition: New validators or workflow changes require a follow-up issue unless required for template truth.",
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

	for (const [label, value] of completedChangeDetailValues) {
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
			"- Regression coverage:",
			"- Regression coverage: Render the scaffolded PR template and validate the completed fixture against pr-template-gate.",
		)
		.replace(
			"- Untested or blocked paths:",
			"- Untested or blocked paths: none",
		)
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

		expect(template).toContain("# Pull request");
		expect(template).toContain(
			"Branch name follows policy (`jscraik/feature/*` for agent-created branches).",
		);
		expect(template).toContain(
			"I ran the required validation for the changed surfaces and recorded every outcome below.",
		);
		expect(template).toContain("CodeRabbit review completed");
		expect(template).toContain("Codex review completed");
		expect(template).toContain("User-facing impact:");
		expect(template).toContain("## Summary");
		for (const field of REQUIRED_SUMMARY_FIELDS) {
			expect(template).toContain(`- ${field.label}:`);
		}
		expect(template).toContain("## Release boundary");
		for (const field of REQUIRED_RELEASE_BOUNDARY_FIELDS) {
			expect(template).toContain(`- ${field.label}:`);
			if (field.label === "Release mode") {
				expect(template).toContain(`- ${field.label}: ${field.placeholder}`);
			} else {
				expect(template).not.toContain(
					`- ${field.label}: ${field.placeholder}`,
				);
			}
		}
		expect(template).toContain("## Behavior proof");
		expect(template).toContain("Behavior proof is separate from unit tests");
		for (const field of REQUIRED_VALIDATION_FIELDS) {
			expect(template).toContain(`- ${field.label}:`);
		}
		for (const field of REQUIRED_CHANGE_FIELDS) {
			expect(template).toContain(`- ${field.label}:`);
			expect(template).not.toContain(`- ${field.label}: ${field.placeholder}`);
		}
		for (const field of REQUIRED_REVIEW_FIELDS) {
			expect(template).toContain(`- ${field.label}:`);
			expect(template).not.toContain(`- ${field.label}: ${field.placeholder}`);
		}
		for (const field of CONDITIONAL_EVIDENCE_FIELDS) {
			expect(template).toContain(`- ${field.label}:`);
		}
		expect(template).toContain(
			"| Artifact | Durable reference | Schema / version | Producer command | Digest | Replay command | Authority |",
		);
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
		expect(config).toContain('stages = ["pre-commit"]');
		expect(config).toContain('stages = ["pre-push"]');
	});
});
