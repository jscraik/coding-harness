import { describe, expect, it } from "vitest";
import { validatePrTemplateBody } from "./pr-template-validator.js";

const VALID_BODY = `## Summary

- Linear issue: JSC-999
- Plan IDs: plan-2026-03-12
- What changed (brief): Added local PR-template gate command.
- Why this change was needed: Prevent incomplete PR templates before CI.
- Risk and rollback plan: Revert the command and docs updates.

## Work performed

- Plan IDs: JSC-999; .harness/plan/example-plan.md
- Phase / slice: PU-001 PR evidence ledger
- Session IDs: codex-session-019c-example
- Trace IDs: circleci-workflow-123; harness-gate-pr-template
- AI session / traceability: codex-session-019c-example supports the validator and PR-template-gate implementation changes.
- Completed work: Added pr-template-gate command and docs update with evidence refs.
- Affected surfaces: code, tests, and PR template.
- Expected outcome alignment: Keeps PR evidence portable and machine-checkable for greenfield and brownfield repos.
- Pattern scope inventory: Principle: PR evidence fields must be validator-backed; sibling tests and command fixtures updated; unchanged siblings not applicable because this fixture does not admit pattern-bearing feedback.
- Meta-behavior proof: n.a. (no repeated steering or high-signal correction admitted in this PR body).
- Repeated-error research: n.a. (no same-error-twice troubleshooting trigger in this PR body).
- Acceptance trace: SA-999-001 -> src/lib/pr-template-validator.test.ts.
- Validation evidence: pnpm vitest run src/lib/pr-template-validator.test.ts -> pass.
- Review artifacts: CodeRabbit pending; Codex self-review recorded in PR body.
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
			"Added local PR-template gate command.",
			"Added the required `## Work performed` ledger to the PR body.",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("fails when required sections are missing", () => {
		const errors = validatePrTemplateBody("## Summary\n\nOnly summary.");
		expect(errors).toContain("Missing required section: ## Work performed");
		expect(errors).toContain("Missing required section: ## Checklist");
		expect(errors).toContain("Missing required section: ## Testing");
		expect(errors).toContain("Missing required section: ## Review artifacts");
		expect(errors).toContain("Missing required section: ## Notes");
	});

	it("fails when headings appear only in prose without markdown headers", () => {
		const body = `## Summary

This PR addresses the Work performed: field, the Checklist: items, Testing: outcomes, Review artifacts: links, and Notes: section.`;
		const errors = validatePrTemplateBody(body);
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

	it("fails repeated error admission without research options and chosen fix", () => {
		const body = VALID_BODY.replace(
			"Added local PR-template gate command.",
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
			"Added local PR-template gate command.",
			"The same error happened twice while fixing CI.",
		).replace(
			"- Repeated-error research: n.a. (no same-error-twice troubleshooting trigger in this PR body).",
			"- Repeated-error research: Source: upstream docs and local validator contract checked; Candidate 1: tighten regex terms only; Candidate 2: require structured PR body subsections; Candidate 3: require countable evidence entries in the field; Chosen: Candidate 3 as the smallest validator-compatible fix; Implemented: updated src/lib/pr-template-validator.ts and regression tests.",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("fails repeated error admission with keyword-only research evidence", () => {
		const body = VALID_BODY.replace(
			"Added local PR-template gate command.",
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
			"Added local PR-template gate command.",
			"A line-level correction changed one success/failure boolean to a named sentinel error, exposing API design generally.",
		).replace(
			"- Pattern scope inventory: Principle: PR evidence fields must be validator-backed; sibling tests and command fixtures updated; unchanged siblings not applicable because this fixture does not admit pattern-bearing feedback.",
			"- Pattern scope inventory: fixed the requested line.",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Pattern scope inventory must name the inferred principle, sibling patterns searched, siblings changed, and siblings left unchanged or deferred with reasons when PR text admits line-level or design-pattern correction.",
		);
	});

	it("accepts line-level design correction with generalized pattern inventory", () => {
		const body = VALID_BODY.replace(
			"Added local PR-template gate command.",
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
	])("fails generalized pattern trigger '%s' without full inventory", (trigger) => {
		const body = VALID_BODY.replace(
			"Added local PR-template gate command.",
			trigger,
		).replace(
			"- Pattern scope inventory: Principle: PR evidence fields must be validator-backed; sibling tests and command fixtures updated; unchanged siblings not applicable because this fixture does not admit pattern-bearing feedback.",
			"- Pattern scope inventory: Principle named; sibling search mentioned; changed one file; unchanged n.a.",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Pattern scope inventory must name the inferred principle, sibling patterns searched, siblings changed, and siblings left unchanged or deferred with reasons when PR text admits line-level or design-pattern correction.",
		);
	});

	it.each([
		"Every bit of steering showed the agent was failing to operate effectively.",
		"This is high signal feedback and the user should never give the same feedback twice.",
	])("fails broad steering trigger '%s' without meta proof", (trigger) => {
		const body = VALID_BODY.replace(
			"Added local PR-template gate command.",
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
			"Added local PR-template gate command.",
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
	])("does not require repeated-error research for broad phrase '%s'", (phrase) => {
		const body = VALID_BODY.replace(
			"Added local PR-template gate command.",
			phrase,
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("does not require pattern inventory for ordinary generally prose", () => {
		const body = VALID_BODY.replace(
			"Added local PR-template gate command.",
			"This generally improves docs without admitting a line-level correction.",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("does not require pattern inventory for ordinary one-function prose", () => {
		const body = VALID_BODY.replace(
			"Added local PR-template gate command.",
			"Refactored one function to reduce duplication without admitting design feedback.",
		);

		expect(validatePrTemplateBody(body)).toEqual([]);
	});

	it("rejects generic slash phrases as durable meta references", () => {
		const body = VALID_BODY.replace(
			"Added local PR-template gate command.",
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

	it("requires explicit changed-sibling evidence for pattern scope inventory", () => {
		const body = VALID_BODY.replace(
			"Added local PR-template gate command.",
			"Do not just fix that line; search the same pattern across related adapters.",
		).replace(
			"- Pattern scope inventory: Principle: PR evidence fields must be validator-backed; sibling tests and command fixtures updated; unchanged siblings not applicable because this fixture does not admit pattern-bearing feedback.",
			"- Pattern scope inventory: Principle: PR evidence fields must be validator-backed; sibling patterns searched; siblings left unchanged because no matching production adapters exist.",
		);

		expect(validatePrTemplateBody(body)).toContain(
			"Pattern scope inventory must name the inferred principle, sibling patterns searched, siblings changed, and siblings left unchanged or deferred with reasons when PR text admits line-level or design-pattern correction.",
		);
	});

	it.each([
		"not permitted to proceed",
		"current-session steering admission",
		"same correction across sessions",
		"user had to restate correction",
	])("fails steering trigger '%s' without durable meta-behavior proof", (trigger) => {
		const body = VALID_BODY.replace(
			"Added local PR-template gate command.",
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
			"Added local PR-template gate command.",
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
			"Added local PR-template gate command.",
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
			"Added local PR-template gate command.",
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
			"Added local PR-template gate command.",
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
