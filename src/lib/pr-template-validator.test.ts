import { describe, expect, it } from "vitest";
import { validatePrTemplateBody } from "./pr-template-validator.js";

const VALID_BODY = `## Summary

- Problem: PR bodies need to explain the decision pressure behind the work, not only list changed files.
- Change: Maintainers can review intent faster when motivation is captured near the top of the PR.
- Why this approach: Add a required Motivation section to the template and validator instead of relying on optional prose in Summary.
- Intended outcome: PR-template validation rejects incomplete evidence.
- Out of scope: Changing GitHub branch protection.
- Reviewer focus: PR bodies could omit required validation evidence.
- Risk and rollback: Revert the validator and template changes.

## Release boundary

- Release mode: Harness
- Completion condition: PR-template validation rejects incomplete evidence while keeping the release scope bounded.
- Deferred work: none; fixture-only validation change.
- Stronger-proof condition: New validators or adjacent workflow changes require a follow-up issue unless required for this gate to stay truthful.

## Behavior proof

- Before: PR-template validation accepted bodies without an explicit regression test plan.
- After: PR-template validation rejects incomplete PR bodies.
- Environment or operator path: local source-repo validator path through Vitest.
- Verification steps: pnpm vitest run src/lib/pr-template-validator.test.ts.
- Evidence after fix: Command output recorded in Testing.
- Untested paths and limitations: live GitHub PR submission is n.a. because this fixture tests local validator behavior.

## Change details

- Plan IDs: JSC-999; .harness/plan/example-plan.md
- Linear reference: Refs JSC-999.
- Linked issue relationship: implementation closure for JSC-999; completed acceptance IDs: SA-999-001.
- Session IDs: codex-session-019c-example
- Trace IDs: circleci-workflow-123; harness-gate-pr-template
- AI session / traceability: codex-session-019c-example supports the validator and PR-template-gate implementation changes.
- Completed work: Added pr-template-gate command and docs update with evidence refs.
- Affected surfaces: code, tests, and PR template.
- Documentation impact: PR template and validator fixtures updated; README.md, SECURITY.md, CONTRIBUTING.md, AGENTS.md, ARCHITECTURE.md, governance docs, and deep-module READMEs are n.a. because this fixture only proves PR body validation.
- SemVer impact: none; validation-only fixture and PR-template contract change does not alter the packaged CLI runtime.
- Expected outcome alignment: Keeps PR evidence portable and machine-checkable for greenfield and brownfield repos.
- Pattern scope inventory: Principle: PR evidence fields must be validator-backed; sibling tests and command fixtures updated; unchanged siblings not applicable because this fixture does not admit pattern-bearing feedback.
- Meta-behavior proof: n.a. (no repeated steering or high-signal correction admitted in this PR body).
- Repeated-error research: n.a. (no same-error-twice troubleshooting trigger in this PR body).
- Acceptance trace: JSC-999 SA-999-001 -> src/lib/pr-template-validator.test.ts.
- Validation evidence: pnpm vitest run src/lib/pr-template-validator.test.ts -> pass.
- Review artifacts: CodeRabbit pending; Codex self-review recorded in PR body.
- Durable evidence map: n.a. because review artifacts are represented by PR body links rather than local-only artifact paths.
- Runtime impact: CI-only.
- Closeout state: local branch clean, checks passed, Linear linked, no remaining blocker.
- Learning / reinforcement: none; no durable learning promoted.

## Checklist

- [x] I did not push directly to \`main\`; this PR is from a dedicated branch.

## Validation

- Regression coverage: Unit fixture coverage validates the PR-template gate accepts complete bodies and rejects incomplete bodies.
- Untested or blocked paths: none
- Command: \`pnpm lint\` -> \`pass\`
- Command: \`pnpm typecheck\` -> \`pass\`
- Command: \`pnpm test\` -> \`pass\`
- Command: \`pnpm audit\` -> \`pass\`
- Command: \`pnpm check\` -> \`pass\`
- Command: \`harness docs-gate --mode advisory\` -> blocked (advisory docs gate not run in this fixture)
- Any other command(s): none

## Review and closeout

- CodeRabbit: https://example.com/coderabbit
- Independent reviewer evidence: https://example.com/independent-review
- Codex: https://example.com/codex
- Additional evidence (if any): none

`;

describe("validatePrTemplateBody", () => {
	it("passes a complete PR body", () => {
		expect(validatePrTemplateBody(VALID_BODY)).toEqual([]);
	});

	it.each([
		"CodeRabbit",
		"Independent reviewer evidence",
		"Codex",
	])("fails when the required %s review field is missing", (label) => {
		const body = VALID_BODY.replace(
			new RegExp(`^- ${label}:.*(?:\\n|$)`, "m"),
			"",
		);

		expect(validatePrTemplateBody(body)).toContain(
			`Missing required review and closeout field: ${label}`,
		);

		const pendingBody = VALID_BODY.replace(
			new RegExp(`^- ${label}:.*$`, "m"),
			`- ${label}: https://example.com/request requested; final artifact pending`,
		);
		expect(validatePrTemplateBody(pendingBody)).toEqual([]);
	});

	it("fails when the problem section is missing", () => {
		const MISSING_MOTIVATION_BODY = VALID_BODY.replace(
			/## Summary\n[\s\S]*?(?=## )/g,
			"",
		);
		const errors = validatePrTemplateBody(MISSING_MOTIVATION_BODY);
		expect(errors).toContain("Missing required section: ## Summary");
	});

	it("fails when the release boundary section is missing", () => {
		const body = VALID_BODY.replace(
			/## Release boundary\n[\s\S]*?(?=## )/g,
			"",
		);
		const errors = validatePrTemplateBody(body);
		expect(errors).toContain("Missing required section: ## Release boundary");
		expect(errors).toContain("Missing release boundary block.");
	});

	it("fails when release mode is left as the template option list", () => {
		const body = VALID_BODY.replace(
			"- Release mode: Harness",
			"- Release mode: Prototype / Portfolio / Product / Harness / n.a. because reason",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Release mode must be Prototype, Portfolio, Product, Harness, or `n.a. because <reason>`.",
		);
	});

	it("accepts release mode n.a. when it includes a concrete reason", () => {
		const body = VALID_BODY.replace(
			"- Release mode: Harness",
			"- Release mode: n.a. because this is a mechanical lockfile-only refresh",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("fails when release mode n.a. keeps the placeholder reason", () => {
		const body = VALID_BODY.replace(
			"- Release mode: Harness",
			"- Release mode: n.a. because reason",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Release mode must be Prototype, Portfolio, Product, Harness, or `n.a. because <reason>`.",
		);
	});

	it("fails when release-boundary fields are blank before guidance comments", () => {
		const body = VALID_BODY.replace(
			`- Completion condition: PR-template validation rejects incomplete evidence while keeping the release scope bounded.
- Deferred work: none; fixture-only validation change.
- Stronger-proof condition: New validators or adjacent workflow changes require a follow-up issue unless required for this gate to stay truthful.`,
			`- Completion condition:
- Deferred work:
- Stronger-proof condition:

<!-- Guidance comment that must not satisfy blank release-boundary fields. -->`,
		);

		expect(validatePrTemplateBody(body)).toEqual(
			expect.arrayContaining([
				"Replace release boundary field placeholder: Completion condition",
				"Replace release boundary field placeholder: Deferred work",
				"Replace release boundary field placeholder: Stronger-proof condition",
			]),
		);
	});

	it("fails linked issue bodies without acceptance IDs or preparatory relationship", () => {
		const body = VALID_BODY.replace(
			"- Acceptance trace: JSC-999 SA-999-001 -> src/lib/pr-template-validator.test.ts.",
			"- Acceptance trace: Tool-promotion threshold present and enforced by pnpm run docs:steering:guard.",
		);

		expect(validatePrTemplateBody(body)).toEqual(
			expect.arrayContaining([
				expect.stringContaining(
					"Acceptance trace for linked issue JSC-999 must list specific acceptance IDs",
				),
			]),
		);
	});

	it("fails preparatory linked issue bodies that do not state no acceptance IDs were completed", () => {
		const body = VALID_BODY.replace(
			"- Acceptance trace: JSC-999 SA-999-001 -> src/lib/pr-template-validator.test.ts.",
			"- Acceptance trace: Preparatory relationship: supports JSC-999 by adding a governance guard; this PR does not complete the issue acceptance criteria.",
		);

		expect(validatePrTemplateBody(body)).toEqual(
			expect.arrayContaining([
				expect.stringContaining("completed issue acceptance IDs are none"),
			]),
		);
	});

	it("accepts linked issue bodies that explicitly mark preparatory relationship", () => {
		const body = VALID_BODY.replace(
			"- Acceptance trace: JSC-999 SA-999-001 -> src/lib/pr-template-validator.test.ts.",
			"- Acceptance trace: Preparatory relationship: supports JSC-999 by adding a governance guard; this PR does not complete the issue acceptance criteria. Completed JSC-999 acceptance IDs: none.",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("fails multi-issue bodies when one acceptance ID masks unmapped linked issues", () => {
		const body = VALID_BODY.replace(
			"- Plan IDs: JSC-999; .harness/plan/example-plan.md",
			"- Plan IDs: JSC-999 and JSC-1000; .harness/plan/example-plan.md",
		).replace(
			"- Acceptance trace: JSC-999 SA-999-001 -> src/lib/pr-template-validator.test.ts.",
			"- Acceptance trace: JSC-999 SA-999-001 -> src/lib/pr-template-validator.test.ts; JSC-1000 is preparatory support.",
		);

		expect(validatePrTemplateBody(body)).toEqual(
			expect.arrayContaining([
				expect.stringContaining("When multiple linked issues are listed"),
			]),
		);
	});

	it("fails single-issue bodies when acceptance IDs are bound to another issue", () => {
		const body = VALID_BODY.replace(
			"- Acceptance trace: JSC-999 SA-999-001 -> src/lib/pr-template-validator.test.ts.",
			"- Acceptance trace: JSC-1000 SA-1000-001 -> src/lib/pr-template-validator.test.ts.",
		);

		expect(validatePrTemplateBody(body)).toEqual(
			expect.arrayContaining([
				expect.stringContaining(
					"Acceptance trace for linked issue JSC-999 must list specific acceptance IDs",
				),
			]),
		);
	});

	it("fails single-issue preparatory bodies that omit the linked issue key", () => {
		const body = VALID_BODY.replace(
			"- Acceptance trace: JSC-999 SA-999-001 -> src/lib/pr-template-validator.test.ts.",
			"- Acceptance trace: Preparatory relationship: adds a governance guard; this PR does not complete the issue acceptance criteria. Completed linked issue acceptance IDs: none.",
		);

		expect(validatePrTemplateBody(body)).toEqual(
			expect.arrayContaining([
				expect.stringContaining(
					"Acceptance trace for linked issue JSC-999 must list specific acceptance IDs",
				),
			]),
		);
	});

	it("rejects n.a. command outcomes", () => {
		const body = VALID_BODY.replace(
			"- Command: `harness docs-gate --mode advisory` -> blocked (advisory docs gate not run in this fixture)",
			"- Command: `harness docs-gate --mode advisory` -> `n.a.`",
		);

		expect(validatePrTemplateBody(body)).toContainEqual(
			expect.stringContaining("Command evidence must use"),
		);
	});

	it("accepts pass and fail with optional parenthetical context", () => {
		const withNote = VALID_BODY.replace(
			"- Command: `pnpm lint` -> `pass`",
			"- Command: `pnpm lint` -> pass (208 tests)",
		);
		expect(validatePrTemplateBody(withNote)).toEqual([]);

		const withNoteAndPeriod = VALID_BODY.replace(
			"- Command: `pnpm lint` -> `pass`",
			"- Command: `pnpm lint` -> pass (208 tests).",
		);
		expect(validatePrTemplateBody(withNoteAndPeriod)).toEqual([]);

		const failWithNote = VALID_BODY.replace(
			"- Command: `pnpm lint` -> `pass`",
			"- Command: `pnpm lint` -> fail (type error at line 42)",
		);
		expect(validatePrTemplateBody(failWithNote)).toEqual([]);
	});

	it.each([
		"pass.",
		"fail.",
		"blocked (service unavailable).",
	])("rejects command evidence outcome %s with a bare trailing period", (outcome) => {
		const body = VALID_BODY.replace(
			"- Command: `pnpm lint` -> `pass`",
			`- Command: \`pnpm lint\` -> ${outcome}`,
		);

		expect(validatePrTemplateBody(body)).toEqual(
			expect.arrayContaining([
				expect.stringContaining("Command evidence must use"),
			]),
		);
	});

	it.each([
		"`pass (208 tests)",
		"pass` (208 tests)",
		"`n.a. (not applicable)",
		"n/a` (not applicable)",
		"`blocked (service unavailable)",
		"blocked` (service unavailable)",
	])("rejects command evidence outcome %s with unbalanced backticks", (outcome) => {
		const body = VALID_BODY.replace(
			"- Command: `pnpm lint` -> `pass`",
			`- Command: \`pnpm lint\` -> ${outcome}`,
		);

		expect(validatePrTemplateBody(body)).toEqual(
			expect.arrayContaining([
				expect.stringContaining("Command evidence must use"),
			]),
		);
	});

	it("fails when Testing has no Command evidence lines", () => {
		const body = VALID_BODY.replace(/^- Command: .*\n/gm, "");
		const errors = validatePrTemplateBody(body);
		expect(errors).toContain(
			"Validation section must include at least one Command evidence line.",
		);
	});

	it("fails malformed Command evidence format", () => {
		const body = VALID_BODY.replace(
			"- Command: `pnpm lint` -> `pass`",
			"- Command: `pnpm lint` => ok",
		);

		expect(
			validatePrTemplateBody(body).some((error) =>
				error.includes(
					"Command evidence must use `Command: <exact command> -> pass|fail` or `-> blocked (<required reason>)` format",
				),
			),
		).toBe(true);
	});

	it.each([
		"blocked",
		"blocked ( )",
	])("fails incomplete blocked Command evidence: %s", (outcome) => {
		const body = VALID_BODY.replace(
			"- Command: `pnpm lint` -> `pass`",
			`- Command: \`pnpm lint\` -> ${outcome}`,
		);
		const errors = validatePrTemplateBody(body);

		expect(
			errors.some((error) => error.includes("Command evidence must use")),
		).toBe(true);
	});

	it.each([
		["ordinary", "<!--\n- Command: `pnpm test` -> pass\n-->"],
		["nested", "<!-- outer <!--\n- Command: `pnpm test` -> pass\n-->"],
	])("does not count %s comments as command evidence", (_kind, comment) => {
		const body = VALID_BODY.replace(/^- Command: .*$/gm, "").replace(
			"- Untested or blocked paths: none",
			`- Untested or blocked paths: none\n${comment}`,
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Validation section must include at least one Command evidence line.",
		);
	});

	it("requires durable mapping for local-only closeout review artifacts", () => {
		const body = VALID_BODY.replace(
			"- CodeRabbit: https://example.com/coderabbit",
			"- CodeRabbit: artifacts/reviews/coderabbit.md",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Durable evidence map cannot be n.a. when PR evidence fields cite ignored local artifact paths.",
		);
	});

	it("fails invalid Command evidence outcomes", () => {
		const body = VALID_BODY.replace(
			"- Command: `pnpm lint` -> `pass`",
			"- Command: `pnpm lint` -> skipped",
		);
		const errors = validatePrTemplateBody(body);

		expect(
			errors.some((error) => error.includes("Command evidence must use")),
		).toBe(true);
	});

	it("fails empty or whitespace-only Command evidence", () => {
		const emptyBody = VALID_BODY.replace(
			"- Command: `pnpm lint` -> `pass`",
			"- Command: -> pass",
		);
		const emptyErrors = validatePrTemplateBody(emptyBody);

		expect(
			emptyErrors.some((error) => error.includes("Command evidence must use")),
		).toBe(true);

		const whitespaceBody = VALID_BODY.replace(
			"- Command: `pnpm lint` -> `pass`",
			"- Command:   -> pass",
		);
		const whitespaceErrors = validatePrTemplateBody(whitespaceBody);

		expect(
			whitespaceErrors.some((error) =>
				error.includes("Command evidence must use"),
			),
		).toBe(true);
	});

	it("does not treat heading names in prose as section starts", () => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			"Added the required `## Change details` ledger to the PR body.",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("fails when required sections are missing", () => {
		const errors = validatePrTemplateBody(
			"## Change rationale\n\nOnly summary.",
		);
		expect(errors).toContain("Missing required section: ## Behavior proof");
		expect(errors).toContain("Missing required section: ## Change details");
		expect(errors).toContain("Missing required section: ## Checklist");
		expect(errors).toContain("Missing required section: ## Validation");
		expect(errors).toContain(
			"Missing required section: ## Review and closeout",
		);
	});

	it("fails local-only review artifacts without a durable evidence mirror", () => {
		const body = VALID_BODY.replace(
			"- Review artifacts: CodeRabbit pending; Codex self-review recorded in PR body.",
			"- Review artifacts: Codex: artifacts/reviews/codex-review.md",
		).replace(
			"- Durable evidence map: n.a. because review artifacts are represented by PR body links rather than local-only artifact paths.",
			"- Durable evidence map: n.a. because no durable mirror was captured.",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Durable evidence map cannot be n.a. when PR evidence fields cite ignored local artifact paths.",
		);
	});

	it("fails local-only command evidence without a durable evidence mirror", () => {
		const body = VALID_BODY.replace(
			"- Command: `pnpm lint` -> `pass`",
			"- Command: `pnpm lint` -> pass (details: artifacts/test.log)",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Durable evidence map cannot be n.a. when PR evidence fields cite ignored local artifact paths.",
		);
	});

	it("fails local absolute paths in PR bodies", () => {
		const body = `${VALID_BODY}\nThis change was validated from /Users/jamiecraik/dev/coding-harness/artifacts/reviews/codex-review.md.`;

		expect(validatePrTemplateBody(body)).toContain(
			"Replace local absolute path in PR body with a repo-relative path, PR comment, CI artifact URL, runtime-card ref, or tracked receipt: /Users/jamiecraik/dev/coding-harness/artifacts/reviews/codex-review.md",
		);
	});

	it("accepts local-only review artifacts when the durable evidence map names a tracked receipt", () => {
		const body = VALID_BODY.replace(
			"- Review artifacts: CodeRabbit pending; Codex self-review recorded in PR body.",
			"- Review artifacts: Codex: artifacts/reviews/codex-review.md",
		).replace(
			"- Durable evidence map: n.a. because review artifacts are represented by PR body links rather than local-only artifact paths.",
			"- Durable evidence map: artifact artifacts/reviews/codex-review.md; schema/version review-artifact/v1; producer command `codex review`; digest sha256:0123456789abcdef; replay command n.a. retained reviewer context; authority retained context; tracked receipt docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl#R113.",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("accepts multiline durable evidence map entries without flattening pairing boundaries", () => {
		const body = VALID_BODY.replace(
			"- Review artifacts: CodeRabbit pending; Codex self-review recorded in PR body.",
			"- Review artifacts: Codex: artifacts/reviews/codex-review.md",
		).replace(
			"- Durable evidence map: n.a. because review artifacts are represented by PR body links rather than local-only artifact paths.",
			"- Durable evidence map:\n  - artifact artifacts/reviews/codex-review.md; schema/version review-artifact/v1; producer command `codex review`; digest sha256:0123456789abcdef; replay command n.a. retained reviewer context; authority retained context; tracked receipt docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl#R113.",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("fails local-only durable evidence map entries without compact index metadata", () => {
		const body = VALID_BODY.replace(
			"- Review artifacts: CodeRabbit pending; Codex self-review recorded in PR body.",
			"- Review artifacts: Codex: artifacts/reviews/codex-review.md",
		).replace(
			"- Durable evidence map: n.a. because review artifacts are represented by PR body links rather than local-only artifact paths.",
			"- Durable evidence map: artifacts/reviews/codex-review.md -> tracked receipt docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl#R113.",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Durable evidence map entry for artifacts/reviews/codex-review.md must include schema/version, producer command, digest, replay command, and authority (`source-of-truth` or `retained context`); missing: schema/version, producer command, digest, replay command, authority.",
		);
	});

	it("fails when durable evidence map aliases the local artifact path", () => {
		const body = VALID_BODY.replace(
			"- Review artifacts: CodeRabbit pending; Codex self-review recorded in PR body.",
			"- Review artifacts: Codex: artifacts/reviews/codex-review.md",
		).replace(
			"- Durable evidence map: n.a. because review artifacts are represented by PR body links rather than local-only artifact paths.",
			"- Durable evidence map: ignored-local artifacts/reviews/codex-review.md.old -> tracked receipt docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl#R113.",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Durable evidence map must pair local-only artifact reference artifacts/reviews/codex-review.md with durable evidence on the same map entry.",
		);
	});

	it("fails when headings appear only in prose without markdown headers", () => {
		const body = `## Change rationale

This PR addresses the Work performed: field, the Checklist: items, Testing: outcomes, Review artifacts: links, and Notes: section.`;
		const errors = validatePrTemplateBody(body);
		expect(errors).toContain("Missing required section: ## Behavior proof");
		expect(errors).toContain("Missing required section: ## Change details");
		expect(errors).toContain("Missing required section: ## Checklist");
		expect(errors).toContain("Missing required section: ## Validation");
		expect(errors).toContain(
			"Missing required section: ## Review and closeout",
		);
	});

	it("fails missing or placeholder change detail fields", () => {
		const body = VALID_BODY.replace(
			"- Completed work: Added pr-template-gate command and docs update with evidence refs.",
			"- Completed work: list implementation units, docs/config changes, or evidence-only work completed in this PR",
		)
			.replace(
				"- Trace IDs: circleci-workflow-123; harness-gate-pr-template",
				"- Trace IDs: list CI workflow/job URLs, harness/eval/runtime trace IDs, runtime-card/evidence bundle artifact paths, review trace IDs, or `n.a.` with reason. For traced or evaluated work, include the trace or artifact reference used to verify the claim.",
			)
			.replace("- Plan IDs: JSC-999; .harness/plan/example-plan.md\n", "")
			.replace(
				"- Meta-behavior proof: n.a. (no repeated steering or high-signal correction admitted in this PR body).\n",
				"",
			)
			.replace(
				"- Repeated-error research: n.a. (no same-error-twice troubleshooting trigger in this PR body).\n",
				"",
			);

		const errors = validatePrTemplateBody(body);
		expect(errors).toContain("Missing required change details field: Plan IDs");
		expect(errors).toContain(
			"Replace change details field placeholder: Completed work",
		);
	});

	it("fails missing linked issue relationship evidence", () => {
		const body = VALID_BODY.replace(
			"- Linked issue relationship: implementation closure for JSC-999; completed acceptance IDs: SA-999-001.\n",
			"",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Missing required change details field: Linked issue relationship",
		);
	});

	it("fails unknown linked issue relationship classifications", () => {
		const body = VALID_BODY.replace(
			"- Linked issue relationship: implementation closure for JSC-999; completed acceptance IDs: SA-999-001.",
			"- Linked issue relationship: related to JSC-999.",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Linked issue relationship must classify the PR as implementation closure, preparatory/enabling work, standalone/untracked work, or n.a. with reason.",
		);
	});

	it("fails preparatory linked issue relationship without explicit non-closure evidence", () => {
		const body = VALID_BODY.replace(
			"- Linked issue relationship: implementation closure for JSC-999; completed acceptance IDs: SA-999-001.",
			"- Linked issue relationship: preparatory/enabling work for JSC-999.",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Preparatory/enabling linked issue relationship must state completed acceptance IDs are none or explicitly say it does not close the linked acceptance scope.",
		);
	});

	it("fails URL-only Linear references that linear-gate cannot count", () => {
		const body = VALID_BODY.replace(
			"- Linear reference: Refs JSC-999.",
			"- Linear reference: https://linear.app/jscraik/issue/JSC-999/example.",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Linear reference must use Refs, Fixes, or Closes with a Linear issue key, or n.a. with reason; URL-only references do not satisfy linear-gate.",
		);
	});

	it("accepts preparatory linked issue relationship with completed acceptance IDs none", () => {
		const body = VALID_BODY.replace(
			"- Linked issue relationship: implementation closure for JSC-999; completed acceptance IDs: SA-999-001.",
			"- Linked issue relationship: preparatory/enabling work for JSC-999; completed JSC-999 acceptance IDs: none; does not close SA-001 through SA-018.",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("fails closing linear references when linked issue relationship is preparatory", () => {
		const body = VALID_BODY.replace(
			"- Linear reference: Refs JSC-999.",
			"- Linear reference: Closes JSC-999.",
		).replace(
			"- Linked issue relationship: implementation closure for JSC-999; completed acceptance IDs: SA-999-001.",
			"- Linked issue relationship: preparatory/enabling work for JSC-999; completed JSC-999 acceptance IDs: none; does not close SA-001 through SA-018.",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Linear reference uses a closure token, so Linked issue relationship must be implementation closure with completed acceptance IDs; use Refs for preparatory/enabling or standalone work.",
		);
	});

	it("fails singular Fix linear references when linked issue relationship is preparatory", () => {
		const body = VALID_BODY.replace(
			"- Linear reference: Refs JSC-999.",
			"- Linear reference: Fix JSC-999.",
		).replace(
			"- Linked issue relationship: implementation closure for JSC-999; completed acceptance IDs: SA-999-001.",
			"- Linked issue relationship: preparatory/enabling work for JSC-999; completed JSC-999 acceptance IDs: none; does not close SA-001 through SA-018.",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Linear reference uses a closure token, so Linked issue relationship must be implementation closure with completed acceptance IDs; use Refs for preparatory/enabling or standalone work.",
		);
	});

	it("fails closing linear references without completed acceptance IDs", () => {
		const body = VALID_BODY.replace(
			"- Linear reference: Refs JSC-999.",
			"- Linear reference: Closes JSC-999.",
		).replace(
			"- Linked issue relationship: implementation closure for JSC-999; completed acceptance IDs: SA-999-001.",
			"- Linked issue relationship: implementation closure for JSC-999; completed acceptance IDs: none.",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Linear reference uses a closure token, so Linked issue relationship must be implementation closure with completed acceptance IDs; use Refs for preparatory/enabling or standalone work.",
		);
	});

	it("accepts closing linear references with implementation closure and completed acceptance IDs", () => {
		const body = VALID_BODY.replace(
			"- Linear reference: Refs JSC-999.",
			"- Linear reference: Closes JSC-999.",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("accepts singular Fix linear references with implementation closure and completed acceptance IDs", () => {
		const body = VALID_BODY.replace(
			"- Linear reference: Refs JSC-999.",
			"- Linear reference: Fix JSC-999.",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("fails repeated error admission without research options and chosen fix", () => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			"The same error happened twice across independent tasks while fixing CI.",
		).replace(
			"- Repeated-error research: n.a. (no same-error-twice troubleshooting trigger in this PR body).",
			"- Repeated-error research: n.a. (fixed locally)",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Repeated-error research must include Source, 3-5 numbered Candidate/Fix/Option entries, Chosen, and Implemented evidence when PR text admits recurrence across independent work, a contradictory contract, or a safety boundary.",
		);
	});

	it("accepts repeated error admission with researched options and implementation evidence", () => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			"The same error happened twice across independent tasks while fixing CI.",
		).replace(
			"- Repeated-error research: n.a. (no same-error-twice troubleshooting trigger in this PR body).",
			"- Repeated-error research: Source: upstream docs and local validator contract checked; Candidate 1: tighten regex terms only; Candidate 2: require structured PR body subsections; Candidate 3: require countable evidence entries in the field; Chosen: Candidate 3 as the smallest validator-compatible fix; Implemented: updated src/lib/pr-template-validator.ts and regression tests.",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it.each([
		"Across independent tasks, the same error happened twice while fixing CI.",
		"Because the contract is contradictory, the same error happened twice while fixing CI.",
		"The same error happened twice and a safety boundary is implicated.",
	])("requires research when the qualifying context precedes the repeated error: %s", (trigger) => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			trigger,
		).replace(
			"- Repeated-error research: n.a. (no same-error-twice troubleshooting trigger in this PR body).",
			"- Repeated-error research: n.a. (bounded local recovery only).",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Repeated-error research must include Source, 3-5 numbered Candidate/Fix/Option entries, Chosen, and Implemented evidence when PR text admits recurrence across independent work, a contradictory contract, or a safety boundary.",
		);
	});

	it("fails repeated error admission with keyword-only research evidence", () => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			"The same error happened twice across independent tasks while fixing CI.",
		).replace(
			"- Repeated-error research: n.a. (no same-error-twice troubleshooting trigger in this PR body).",
			"- Repeated-error research: candidate implemented.",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Repeated-error research must include Source, 3-5 numbered Candidate/Fix/Option entries, Chosen, and Implemented evidence when PR text admits recurrence across independent work, a contradictory contract, or a safety boundary.",
		);
	});

	it("requires local no_system_change details for an isolated repeated error", () => {
		const base = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			"The same error happened twice while fixing this bounded local task.",
		);
		const validBody = base.replace(
			"- Repeated-error research: n.a. (no same-error-twice troubleshooting trigger in this PR body).",
			"- Repeated-error research: n.a. because this was local; checked scope was the touched validator fixture; no-durable-destination decision was to close locally.",
		);
		const invalidBody = base.replace(
			"- Repeated-error research: n.a. (no same-error-twice troubleshooting trigger in this PR body).",
			"- Repeated-error research: n.a. (fixed locally).",
		);

		expect(validatePrTemplateBody(validBody)).toEqual([]);
		expect(validatePrTemplateBody(invalidBody)).toContain(
			"Repeated-error research for an isolated local repeat must include a reason, checked scope, and no-durable-destination decision when no research pass is required.",
		);
	});

	it("keeps same-feedback wording local when the task is explicitly bounded", () => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			"The same feedback twice happened during one bounded local task.",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("fails line-level design correction without pattern scope evidence", () => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			"A line-level correction changed one success/failure boolean to a named sentinel error while a shared pattern contract remained contradictory.",
		).replace(
			"- Pattern scope inventory: Principle: PR evidence fields must be validator-backed; sibling tests and command fixtures updated; unchanged siblings not applicable because this fixture does not admit pattern-bearing feedback.",
			"- Pattern scope inventory: fixed the requested line.",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Pattern scope inventory must name the inferred principle, sibling patterns searched, siblings changed, and siblings intentionally unchanged with reasons when PR text admits line-level or design-pattern correction.",
		);
	});

	it("keeps isolated line-level corrections on the local-repair path", () => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			"A line-level correction fixed one bounded local behavior without a shared contract or safety boundary.",
		).replace(
			"- Pattern scope inventory: Principle: PR evidence fields must be validator-backed; sibling tests and command fixtures updated; unchanged siblings not applicable because this fixture does not admit pattern-bearing feedback.",
			"- Pattern scope inventory: n.a. (bounded local correction; reason: no shared contract, checked scope: one behavior; no-durable-destination decision: close locally).",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("requires pattern scope when a named current consumer requires it", () => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			"A named current consumer requires a pattern-generalization pass.",
		).replace(
			"- Pattern scope inventory: Principle: PR evidence fields must be validator-backed; sibling tests and command fixtures updated; unchanged siblings not applicable because this fixture does not admit pattern-bearing feedback.",
			"- Pattern scope inventory: n.a. (not reviewed).",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Pattern scope inventory must name the inferred principle, sibling patterns searched, siblings changed, and siblings intentionally unchanged with reasons when PR text admits line-level or design-pattern correction.",
		);
	});

	it("does not promote a negated safety-boundary phrase", () => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			"A bounded local correction proceeds without a shared contract or safety boundary.",
		).replace(
			"- Pattern scope inventory: Principle: PR evidence fields must be validator-backed; sibling tests and command fixtures updated; unchanged siblings not applicable because this fixture does not admit pattern-bearing feedback.",
			"- Pattern scope inventory: n.a. (bounded local correction; reason: no shared contract, checked scope: one behavior; no-durable-destination decision: close locally).",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("requires local no_system_change details for an n.a. pattern inventory", () => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			"A line-level correction fixed one bounded local behavior without a shared contract or safety boundary.",
		).replace(
			"- Pattern scope inventory: Principle: PR evidence fields must be validator-backed; sibling tests and command fixtures updated; unchanged siblings not applicable because this fixture does not admit pattern-bearing feedback.",
			"- Pattern scope inventory: n.a.",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Pattern scope inventory marked n.a. must include a reason, checked scope, and no-durable-destination decision for the local closeout.",
		);
	});

	it("rejects placeholder-only no_system_change details", () => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			"A bounded local correction fixed one local behavior without a shared contract or safety boundary.",
		).replace(
			"- Pattern scope inventory: Principle: PR evidence fields must be validator-backed; sibling tests and command fixtures updated; unchanged siblings not applicable because this fixture does not admit pattern-bearing feedback.",
			"- Pattern scope inventory: n.a. (reason: -; checked scope: -; no-durable-destination decision: -).",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Pattern scope inventory marked n.a. must include a reason, checked scope, and no-durable-destination decision for the local closeout.",
		);
	});

	it("accepts equivalent prose for local no_system_change details", () => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			"A bounded local correction fixed one local behavior without a shared contract or safety boundary.",
		).replace(
			"- Pattern scope inventory: Principle: PR evidence fields must be validator-backed; sibling tests and command fixtures updated; unchanged siblings not applicable because this fixture does not admit pattern-bearing feedback.",
			"- Pattern scope inventory: n.a. because this was local; checked scope was the touched fixture; no-durable-destination decision was to close locally.",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("accepts negated pattern-scope guidance below the shared threshold", () => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			"No pattern-generalization pass is required because this is local and below the shared threshold.",
		).replace(
			"- Pattern scope inventory: Principle: PR evidence fields must be validator-backed; sibling tests and command fixtures updated; unchanged siblings not applicable because this fixture does not admit pattern-bearing feedback.",
			"- Pattern scope inventory: n.a. because this was local; checked scope was the touched fixture; no-durable-destination decision was to close locally.",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("accepts line-level design correction with generalized pattern inventory", () => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			"A line-level correction changed one success/failure boolean to a named sentinel error while a shared pattern contract remained contradictory.",
		).replace(
			"- Pattern scope inventory: Principle: PR evidence fields must be validator-backed; sibling tests and command fixtures updated; unchanged siblings not applicable because this fixture does not admit pattern-bearing feedback.",
			"- Pattern scope inventory: Principle: API design should use named sentinel errors instead of ambiguous boolean success/failure contracts; sibling command-result patterns searched; changed matching command-core helpers; left unrelated UI booleans unchanged with reason and deferred adapter cleanup to tracked issue JSC-999.",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it.each([
		"This was example-based feedback about a shared pattern after recurrence across independent work.",
		"A concrete correction in one function exposed a contradictory shared contract; the shared pattern requires sibling review.",
		"The current contract is contradictory, so a line-level correction changed one API.",
		"A line-level correction revealed that an existing contract conflicts with the required behavior.",
		"A line-level correction revealed that the current contract is contradictory.",
		"Do not just fix that line; a safety boundary requires a shared pattern search across related adapters.",
		"Codex should apply the same shared pattern in multiple places after the shared threshold is met.",
		"A line-level correction changed one API and a safety boundary is implicated.",
		"A line-level correction changed one API and failure recurs across independent work.",
	])("fails generalized pattern trigger '%s' without full inventory", (trigger) => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			trigger,
		).replace(
			"- Pattern scope inventory: Principle: PR evidence fields must be validator-backed; sibling tests and command fixtures updated; unchanged siblings not applicable because this fixture does not admit pattern-bearing feedback.",
			"- Pattern scope inventory: Principle named; sibling search mentioned; changed one file; unchanged n.a.",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Pattern scope inventory must name the inferred principle, sibling patterns searched, siblings changed, and siblings intentionally unchanged with reasons when PR text admits line-level or design-pattern correction.",
		);
	});

	it.each([
		"Every bit of steering showed the agent was failing to operate effectively.",
		"This is high signal feedback and the user should never give the same feedback twice.",
		"Feedback recurs across independent tasks and the durable destination must be checked.",
		"Jamie gave the same feedback twice across independent tasks while fixing docs.",
	])("fails broad steering trigger '%s' without meta proof", (trigger) => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			trigger,
		).replace(
			"- Meta-behavior proof: n.a. (no repeated steering or high-signal correction admitted in this PR body).",
			"- Meta-behavior proof: n.a. (not needed)",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Meta-behavior proof must name a durable destination and concrete repo path, command, or issue ID when PR text admits steering feedback or repeated user correction.",
		);
	});

	it.each([
		"The same failure twice recurred across independent tasks and blocked the fix.",
		"The command failed again with the same stack trace across independent work.",
		"The same exception appeared twice across independent tasks.",
		"The same error happened twice because an existing contract conflicts with the required behavior.",
		"The same error happened twice; no safety boundary is implicated, but the failure recurs across independent work.",
		"The command failure implicated a safety boundary.",
		"The test failure happened because the current contract is contradictory.",
	])("fails repeated troubleshooting trigger '%s' without research evidence", (trigger) => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			trigger,
		).replace(
			"- Repeated-error research: n.a. (no same-error-twice troubleshooting trigger in this PR body).",
			"- Repeated-error research: fixed locally.",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Repeated-error research must include Source, 3-5 numbered Candidate/Fix/Option entries, Chosen, and Implemented evidence when PR text admits recurrence across independent work, a contradictory contract, or a safety boundary.",
		);
	});

	it.each([
		"This change reduces repeated failures in CI without changing policy.",
		"This PR compares possible ways to fix validation ergonomics.",
		"The team researched fixes for the broader workflow.",
		"Tests failed twice while iterating on unrelated docs.",
		"Reran checks twice in a row to confirm a flaky test.",
		"The same error happened twice while no recurrence across independent work and no safety boundary is implicated.",
	])("does not require repeated-error research for broad phrase '%s'", (phrase) => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			phrase,
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("does not require pattern inventory for ordinary generally prose", () => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			"This generally improves docs without admitting a line-level correction.",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("does not require pattern inventory for ordinary one-function prose", () => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			"Refactored one function to reduce duplication without admitting design feedback.",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("rejects generic slash phrases as durable meta references", () => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			"Admitted repeated steering feedback into PR metadata.",
		)
			.replace(
				"- Meta-behavior proof: n.a. (no repeated steering or high-signal correction admitted in this PR body).",
				"- Meta-behavior proof: Added guard for design/API consistency.",
			)
			.replace(
				"- Learning / reinforcement: none; no durable learning promoted.",
				"- Learning / reinforcement: Added memory update for api/v1 workflow.",
			);

		expect(validatePrTemplateBody(body)).toContain(
			"Meta-behavior proof must name a durable destination and concrete repo path, command, or issue ID when PR text admits steering feedback or repeated user correction.",
		);
	});

	it("accepts dot-prefixed repo paths as durable meta references", () => {
		const body = VALID_BODY.replace(
			"- Meta-behavior proof: n.a. (no repeated steering or high-signal correction admitted in this PR body).",
			"- Meta-behavior proof: Added guard at ./src/lib/pr-template-validator.ts.",
		).replace(
			"- Learning / reinforcement: none; no durable learning promoted.",
			"- Learning / reinforcement: Promoted repo learning in ./.harness/memory/LEARNINGS.md.",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("accepts punctuated repo paths as durable meta references", () => {
		const body = VALID_BODY.replace(
			"- Meta-behavior proof: n.a. (no repeated steering or high-signal correction admitted in this PR body).",
			"- Meta-behavior proof: Added validator guard in (src/lib/pr-template-validator.ts).",
		).replace(
			"- Learning / reinforcement: none; no durable learning promoted.",
			"- Learning / reinforcement: Promoted guard coverage in 'docs/agents/04-validation.md'.",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("accepts root-level docs as durable meta references", () => {
		const body = VALID_BODY.replace(
			"- Meta-behavior proof: n.a. (no repeated steering or high-signal correction admitted in this PR body).",
			"- Meta-behavior proof: Added guard guidance in README.md.",
		).replace(
			"- Learning / reinforcement: none; no durable learning promoted.",
			"- Learning / reinforcement: Promoted handoff guidance in CONTRIBUTING.md.",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("counts newline-separated repeated-error candidates independently", () => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			"The same failure twice exposed a validator edge case.",
		).replace(
			"- Repeated-error research: n.a. (no same-error-twice troubleshooting trigger in this PR body).",
			"- Repeated-error research: Source: docs/agents/04-validation.md reviewed the same-error evidence.\n\tCandidate 1: tighten the parser boundary around candidate entries.\n\tCandidate 2: split candidate evidence by newline boundaries.\n\tCandidate 3: require authors to use semicolons only.\n\tChosen: split newline-separated candidate entries in the regex.\n\tImplemented: updated CANDIDATE_FIX_PATTERN and regression coverage.",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("requires explicit changed-sibling evidence for pattern scope inventory", () => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			"Do not just fix that line; a safety boundary requires a shared pattern search across related adapters.",
		).replace(
			"- Pattern scope inventory: Principle: PR evidence fields must be validator-backed; sibling tests and command fixtures updated; unchanged siblings not applicable because this fixture does not admit pattern-bearing feedback.",
			"- Pattern scope inventory: Principle: PR evidence fields must be validator-backed; sibling patterns searched; siblings left unchanged because no matching production adapters exist.",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Pattern scope inventory must name the inferred principle, sibling patterns searched, siblings changed, and siblings intentionally unchanged with reasons when PR text admits line-level or design-pattern correction.",
		);
	});

	it.each([
		"not permitted to proceed",
		"current-session steering admission",
		"same correction across sessions",
		"user had to restate correction",
	])("fails steering trigger '%s' without durable meta-behavior proof", (trigger) => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			`Jamie reported ${trigger} before the agent updated its operating system.`,
		).replace(
			"- Meta-behavior proof: n.a. (no repeated steering or high-signal correction admitted in this PR body).",
			"- Meta-behavior proof: n.a. (not needed)",
		);

		const errors = validatePrTemplateBody(body);
		expect(errors).toContain(
			"Meta-behavior proof must name a durable destination and concrete repo path, command, or issue ID when PR text admits steering feedback or repeated user correction.",
		);
		expect(errors).toContain(
			"Learning / reinforcement must name the promoted learning, memory update, guard, or tracked exception with a concrete repo path, command, or issue ID when PR text admits steering feedback or repeated user correction.",
		);
	});

	it("fails steering feedback admission without durable meta-behavior proof", () => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			"Admitted repeated steering feedback into PR metadata.",
		).replace(
			"- Meta-behavior proof: n.a. (no repeated steering or high-signal correction admitted in this PR body).",
			"- Meta-behavior proof: n.a. (not needed)",
		);

		const errors = validatePrTemplateBody(body);
		expect(errors).toContain(
			"Meta-behavior proof must name a durable destination and concrete repo path, command, or issue ID when PR text admits steering feedback or repeated user correction.",
		);
		expect(errors).toContain(
			"Learning / reinforcement must name the promoted learning, memory update, guard, or tracked exception with a concrete repo path, command, or issue ID when PR text admits steering feedback or repeated user correction.",
		);
	});

	it("fails current-session stop language without durable meta-behavior proof", () => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			"Jamie said the agent is not permitted to proceed until this becomes a durable control.",
		).replace(
			"- Meta-behavior proof: n.a. (no repeated steering or high-signal correction admitted in this PR body).",
			"- Meta-behavior proof: n.a. (not needed)",
		);

		const errors = validatePrTemplateBody(body);
		expect(errors).toContain(
			"Meta-behavior proof must name a durable destination and concrete repo path, command, or issue ID when PR text admits steering feedback or repeated user correction.",
		);
		expect(errors).toContain(
			"Learning / reinforcement must name the promoted learning, memory update, guard, or tracked exception with a concrete repo path, command, or issue ID when PR text admits steering feedback or repeated user correction.",
		);
	});

	it("accepts steering admission n.a. only when it names a tracked exception", () => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			"Admitted repeated steering feedback into PR metadata.",
		)
			.replace(
				"- Meta-behavior proof: n.a. (no repeated steering or high-signal correction admitted in this PR body).",
				"- Meta-behavior proof: n.a.; tracked issue JSC-999 carries the durable exception.",
			)
			.replace(
				"- Learning / reinforcement: none; no durable learning promoted.",
				"- Learning / reinforcement: n.a.; tracked issue JSC-999 records the explicit exception.",
			);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("accepts steering feedback admission with durable guard evidence", () => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			"Admitted repeated steering feedback into PR metadata.",
		)
			.replace(
				"- Meta-behavior proof: n.a. (no repeated steering or high-signal correction admitted in this PR body).",
				"- Meta-behavior proof: Added validator guard in src/lib/pr-template-validator.ts and PR template field in .github/PULL_REQUEST_TEMPLATE.md for repeated steering admission.",
			)
			.replace(
				"- Learning / reinforcement: none; no durable learning promoted.",
				"- Learning / reinforcement: Promoted solution record docs/solutions/integration-issues/2026-05-17-steering-feedback-admission.md and guard scripts/check-steering-feedback-contract.cjs.",
			);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("fails unchecked checklist items without explicit Pending or N/A marker", () => {
		const body = VALID_BODY.replace(
			"- [x] I did not push directly to `main`; this PR is from a dedicated branch.",
			"- [ ] I did not push directly to `main`; this PR is from a dedicated branch.",
		);
		const errors = validatePrTemplateBody(body);
		expect(
			errors.some((error) =>
				error.includes(
					"Checklist has unchecked item(s) without explicit status marker",
				),
			),
		).toBe(true);
	});

	it("fails unresolved placeholders", () => {
		const body = VALID_BODY.replace(
			"CodeRabbit: https://example.com/coderabbit",
			"CodeRabbit: <link / artifact path / comment ID>",
		);
		const errors = validatePrTemplateBody(body);
		expect(errors).toContain(
			"Replace template placeholder: <link / artifact path / comment ID>",
		);
	});

	it("fails validation placeholders wrapped in markdown code", () => {
		const body = VALID_BODY.replace(
			"- Regression coverage: Unit fixture coverage validates the PR-template gate accepts complete bodies and rejects incomplete bodies.",
			"- Regression coverage: ``` describe unit, integration, contract, operator, or n.a. regression coverage ```",
		);
		const errors = validatePrTemplateBody(body);
		expect(errors).toContain(
			"Replace validation field placeholder: Regression coverage",
		);
	});
});
