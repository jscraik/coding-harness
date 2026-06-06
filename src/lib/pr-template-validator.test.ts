import { describe, expect, it } from "vitest";
import { validatePrTemplateBody } from "./pr-template-validator.js";

const VALID_BODY = `## Motivation

- Motivation: PR bodies need to explain the decision pressure behind the work, not only list changed files.
- Reasoning: Maintainers can review intent faster when motivation is captured near the top of the PR.
- Chosen approach: Add a required Motivation section to the template and validator instead of relying on optional prose in Summary.

## Summary

- Problem: PR bodies could omit required validation evidence.
- Why now: CI should catch incomplete PR templates before review.
- Intended outcome: PR-template gate rejects incomplete evidence.
- Out of scope: Changing GitHub branch protection.
- Reviewer focus: Validator behavior and fixture coverage.
- Risk and rollback: Revert the command and docs updates.

## Behavior Proof

- Behavior or issue addressed: PR-template validation rejects incomplete PR bodies.
- Real environment tested: local source-repo validator path through Vitest.
- Exact steps or command run after this patch: pnpm vitest run src/lib/pr-template-validator.test.ts.
- Evidence after fix: Command output recorded in Testing.
- Observed result after fix: Complete PR body fixture passed validation.
- What was not tested: live GitHub PR submission is n.a. because this fixture tests local validator behavior.
- Proof limitations or environment constraints: none for the local validator path.
- Before evidence, if available: n.a. because this fixture describes the valid after state.

## Work performed

- Plan IDs: JSC-999; .harness/plan/example-plan.md
- Linear reference: Refs JSC-999.
- Linked issue relationship: implementation closure for JSC-999; completed acceptance IDs: SA-999-001.
- Phase / slice: PU-001 PR evidence ledger
- Session IDs: codex-session-019c-example
- Trace IDs: circleci-workflow-123; harness-gate-pr-template
- AI session / traceability: codex-session-019c-example supports the validator and PR-template-gate implementation changes.
- Completed work: Added pr-template-gate command and docs update with evidence refs.
- Affected surfaces: code, tests, and PR template.
- Documentation impact: PR template and validator fixtures updated; README.md, SECURITY.md, CONTRIBUTING.md, AGENTS.md, ARCHITECTURE.md, governance docs, and deep-module READMEs are n.a. because this fixture only proves PR body validation.
- Documentation lifecycle impact: updated canonical PR template and validator fixtures; distribution remains source-only.
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
- CodeRabbit mode coverage: validation.
- Closeout state: local branch clean, checks passed, Linear linked, no remaining blocker.
- Learning / reinforcement: none; no durable learning promoted.
- Deferred work: none

## Checklist

- [x] I did not push directly to \`main\`; this PR is from a dedicated branch.

## Testing

- verification_commands: \`pnpm lint\`; \`pnpm typecheck\`; \`pnpm test\`; \`pnpm audit\`; \`pnpm check\`
- verification_outcomes: \`pass\`; \`pass\`; \`pass\`; \`pass\`; \`pass\`
- blocked_steps_reason: none
- Command: \`pnpm lint\` -> \`pass\`
- Command: \`pnpm typecheck\` -> \`pass\`
- Command: \`pnpm test\` -> \`pass\`
- Command: \`pnpm audit\` -> \`pass\`
- Command: \`pnpm check\` -> \`pass\`
- Command: \`harness docs-gate --mode advisory\` -> \`n.a.\` (advisory docs gate not required for this fixture)
- Any other command(s): none

## Review artifacts

- CodeRabbit: https://example.com/coderabbit
- Independent reviewer evidence: N/A (solo mode)
- Codex: https://example.com/codex
- Additional evidence (if any): none

## Notes

This change adds local PR-template validation so template failures are caught before PR updates.
`;

describe("validatePrTemplateBody", () => {
	it("passes a complete PR body", () => {
		expect(validatePrTemplateBody(VALID_BODY)).toEqual([]);
	});

	it("fails when the Motivation section is missing", () => {
		const MISSING_MOTIVATION_BODY = VALID_BODY.replace(
			/## Motivation\n[\s\S]*?(?=## )/g,
			"",
		);
		const errors = validatePrTemplateBody(MISSING_MOTIVATION_BODY);
		expect(errors).toContain("Missing required section: ## Motivation");
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

	it("accepts template-documented n.a. command outcomes without a reason", () => {
		const body = VALID_BODY.replace(
			"- Command: `harness docs-gate --mode advisory` -> `n.a.` (advisory docs gate not required for this fixture)",
			"- Command: `harness docs-gate --mode advisory` -> `n.a.`",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("fails when Testing has no Command evidence lines", () => {
		const body = VALID_BODY.replace(/^- Command: .*\n/gm, "");
		const errors = validatePrTemplateBody(body);
		expect(errors).toContain(
			"Testing section must include at least one Command evidence line.",
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
					"Command evidence must use `Command: <exact command> -> pass|fail`, `-> n.a.|n/a` (optional reason), or `-> blocked (<required reason>)` format",
				),
			),
		).toBe(true);
	});

	it("fails blocked Command evidence without a reason", () => {
		const body = VALID_BODY.replace(
			"- Command: `pnpm lint` -> `pass`",
			"- Command: `pnpm lint` -> blocked",
		);
		const errors = validatePrTemplateBody(body);

		expect(
			errors.some((error) => error.includes("Command evidence must use")),
		).toBe(true);
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

	it("does not treat heading names in prose as section starts", () => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			"Added the required `## Work performed` ledger to the PR body.",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("fails when required sections are missing", () => {
		const errors = validatePrTemplateBody("## Summary\n\nOnly summary.");
		expect(errors).toContain("Missing required section: ## Behavior Proof");
		expect(errors).toContain("Missing required section: ## Work performed");
		expect(errors).toContain("Missing required section: ## Checklist");
		expect(errors).toContain("Missing required section: ## Testing");
		expect(errors).toContain("Missing required section: ## Review artifacts");
		expect(errors).toContain("Missing required section: ## Notes");
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

	it("fails local-only validation evidence without a durable evidence mirror", () => {
		const body = VALID_BODY.replace(
			"- Validation evidence: pnpm vitest run src/lib/pr-template-validator.test.ts -> pass.",
			"- Validation evidence: pnpm vitest run src/lib/pr-template-validator.test.ts -> pass; artifacts/reviews/codex-review.md.",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Durable evidence map cannot be n.a. when PR evidence fields cite ignored local artifact paths.",
		);
	});

	it("fails local absolute paths in PR bodies", () => {
		const body = VALID_BODY.replace(
			"This change adds local PR-template validation so template failures are caught before PR updates.",
			"This change was validated from /Users/jamiecraik/dev/coding-harness/artifacts/reviews/codex-review.md.",
		);

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
			"- Durable evidence map: ignored-local artifacts/reviews/codex-review.md -> tracked receipt docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl#R113.",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("accepts multiline durable evidence map entries without flattening pairing boundaries", () => {
		const body = VALID_BODY.replace(
			"- Review artifacts: CodeRabbit pending; Codex self-review recorded in PR body.",
			"- Review artifacts: Codex: artifacts/reviews/codex-review.md",
		).replace(
			"- Durable evidence map: n.a. because review artifacts are represented by PR body links rather than local-only artifact paths.",
			"- Durable evidence map:\n  - ignored-local artifacts/reviews/codex-review.md -> tracked receipt docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl#R113.",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
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
		const body = `## Summary

This PR addresses the Work performed: field, the Checklist: items, Testing: outcomes, Review artifacts: links, and Notes: section.`;
		const errors = validatePrTemplateBody(body);
		expect(errors).toContain("Missing required section: ## Behavior Proof");
		expect(errors).toContain("Missing required section: ## Work performed");
		expect(errors).toContain("Missing required section: ## Checklist");
		expect(errors).toContain("Missing required section: ## Testing");
		expect(errors).toContain("Missing required section: ## Review artifacts");
		expect(errors).toContain("Missing required section: ## Notes");
	});

	it("fails missing or placeholder work performed fields", () => {
		const body = VALID_BODY.replace(
			"- Completed work: Added pr-template-gate command and docs update with evidence refs.",
			"- Completed work: list implementation units, docs/config changes, or evidence-only work completed in this PR",
		)
			.replace(
				"- Trace IDs: circleci-workflow-123; harness-gate-pr-template",
				"- Trace IDs: list CI workflow/job URLs, harness/eval/runtime trace IDs, runtime-card/evidence bundle artifact paths, review trace IDs, or `n.a.` with reason. For traced or evaluated work, include the trace or artifact reference used to verify the claim.",
			)
			.replace("- Session IDs: codex-session-019c-example\n", "")
			.replace(
				"- Meta-behavior proof: n.a. (no repeated steering or high-signal correction admitted in this PR body).\n",
				"",
			)
			.replace(
				"- Repeated-error research: n.a. (no same-error-twice troubleshooting trigger in this PR body).\n",
				"",
			)
			.replace("- Deferred work: none\n", "");

		const errors = validatePrTemplateBody(body);
		expect(errors).toContain(
			"Missing required work performed field: Session IDs",
		);
		expect(errors).toContain(
			"Replace work performed field placeholder: Trace IDs",
		);
		expect(errors).toContain(
			"Replace work performed field placeholder: Completed work",
		);
		expect(errors).toContain(
			"Missing required work performed field: Meta-behavior proof",
		);
		expect(errors).toContain(
			"Missing required work performed field: Repeated-error research",
		);
		expect(errors).toContain(
			"Missing required work performed field: Deferred work",
		);
	});

	it("fails missing linked issue relationship evidence", () => {
		const body = VALID_BODY.replace(
			"- Linked issue relationship: implementation closure for JSC-999; completed acceptance IDs: SA-999-001.\n",
			"",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Missing required work performed field: Linked issue relationship",
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
			"The same error happened twice while fixing CI.",
		).replace(
			"- Repeated-error research: n.a. (no same-error-twice troubleshooting trigger in this PR body).",
			"- Repeated-error research: n.a. (fixed locally)",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Repeated-error research must include Source, 3-5 numbered Candidate/Fix/Option entries, Chosen, and Implemented evidence when PR text admits the same error happened twice.",
		);
	});

	it("accepts repeated error admission with researched options and implementation evidence", () => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			"The same error happened twice while fixing CI.",
		).replace(
			"- Repeated-error research: n.a. (no same-error-twice troubleshooting trigger in this PR body).",
			"- Repeated-error research: Source: upstream docs and local validator contract checked; Candidate 1: tighten regex terms only; Candidate 2: require structured PR body subsections; Candidate 3: require countable evidence entries in the field; Chosen: Candidate 3 as the smallest validator-compatible fix; Implemented: updated src/lib/pr-template-validator.ts and regression tests.",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("fails repeated error admission with keyword-only research evidence", () => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			"The same error happened twice while fixing CI.",
		).replace(
			"- Repeated-error research: n.a. (no same-error-twice troubleshooting trigger in this PR body).",
			"- Repeated-error research: candidate implemented.",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Repeated-error research must include Source, 3-5 numbered Candidate/Fix/Option entries, Chosen, and Implemented evidence when PR text admits the same error happened twice.",
		);
	});

	it("fails line-level design correction without pattern scope evidence", () => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			"A line-level correction changed one success/failure boolean to a named sentinel error, exposing API design generally.",
		).replace(
			"- Pattern scope inventory: Principle: PR evidence fields must be validator-backed; sibling tests and command fixtures updated; unchanged siblings not applicable because this fixture does not admit pattern-bearing feedback.",
			"- Pattern scope inventory: fixed the requested line.",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Pattern scope inventory must name the inferred principle, sibling patterns searched, siblings changed, and siblings intentionally unchanged with reasons when PR text admits line-level or design-pattern correction.",
		);
	});

	it("accepts line-level design correction with generalized pattern inventory", () => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			"A line-level correction changed one success/failure boolean to a named sentinel error, exposing API design generally.",
		).replace(
			"- Pattern scope inventory: Principle: PR evidence fields must be validator-backed; sibling tests and command fixtures updated; unchanged siblings not applicable because this fixture does not admit pattern-bearing feedback.",
			"- Pattern scope inventory: Principle: API design should use named sentinel errors instead of ambiguous boolean success/failure contracts; sibling command-result patterns searched; changed matching command-core helpers; left unrelated UI booleans unchanged with reason and deferred adapter cleanup to tracked issue JSC-999.",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it.each([
		"This was example-based feedback about similar classes of misbehavior across everything we do.",
		"A concrete correction in one function exposed the user's design model generally.",
		"Do not just fix that line; search the same pattern across related adapters.",
		"Codex should apply the same things in multiple places and consider the larger perspective.",
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
		"The same failure twice blocked the fix.",
		"The command failed again with the same stack trace.",
		"The same exception appeared twice in a row.",
	])("fails repeated troubleshooting trigger '%s' without research evidence", (trigger) => {
		const body = VALID_BODY.replace(
			"PR bodies could omit required validation evidence.",
			trigger,
		).replace(
			"- Repeated-error research: n.a. (no same-error-twice troubleshooting trigger in this PR body).",
			"- Repeated-error research: fixed locally.",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Repeated-error research must include Source, 3-5 numbered Candidate/Fix/Option entries, Chosen, and Implemented evidence when PR text admits the same error happened twice.",
		);
	});

	it.each([
		"This change reduces repeated failures in CI without changing policy.",
		"This PR compares possible ways to fix validation ergonomics.",
		"The team researched fixes for the broader workflow.",
		"Tests failed twice while iterating on unrelated docs.",
		"Reran checks twice in a row to confirm a flaky test.",
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
			"Do not just fix that line; search the same pattern across related adapters.",
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
		)
			.replace(
				"- Meta-behavior proof: n.a. (no repeated steering or high-signal correction admitted in this PR body).",
				"- Meta-behavior proof: n.a. (not needed)",
			)
			.replace(
				"- Learning / reinforcement: none; no durable learning promoted.",
				"- Learning / reinforcement: none; no durable learning promoted.",
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
		)
			.replace(
				"- Meta-behavior proof: n.a. (no repeated steering or high-signal correction admitted in this PR body).",
				"- Meta-behavior proof: n.a. (not needed)",
			)
			.replace(
				"- Learning / reinforcement: none; no durable learning promoted.",
				"- Learning / reinforcement: none; no durable learning promoted.",
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
		)
			.replace(
				"- Meta-behavior proof: n.a. (no repeated steering or high-signal correction admitted in this PR body).",
				"- Meta-behavior proof: n.a. (not needed)",
			)
			.replace(
				"- Learning / reinforcement: none; no durable learning promoted.",
				"- Learning / reinforcement: none; no durable learning promoted.",
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

	it("fails testing placeholders wrapped in markdown code", () => {
		const body = VALID_BODY.replace(
			"- verification_commands: `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm audit`; `pnpm check`",
			"- verification_commands: ``` list exact commands run here ```",
		).replace(
			"- blocked_steps_reason: none",
			"- blocked_steps_reason: `none if all planned steps ran`",
		);
		const errors = validatePrTemplateBody(body);
		expect(errors).toContain(
			"Replace testing field placeholder: verification_commands",
		);
		expect(errors).toContain(
			"Replace testing field placeholder: blocked_steps_reason",
		);
	});
});
