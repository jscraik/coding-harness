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
- Pattern scope inventory: Principle: PR evidence fields must be validator-backed; sibling tests and command fixtures updated.
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
			"Missing required work performed field: Deferred work",
		);
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
