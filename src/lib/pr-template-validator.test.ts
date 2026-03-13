import { describe, expect, it } from "vitest";
import { validatePrTemplateBody } from "./pr-template-validator.js";

const VALID_BODY = `## Summary

- Linear issue: JSC-999
- Plan IDs: plan-2026-03-12
- What changed (brief): Added local PR-template gate command.
- Why this change was needed: Prevent incomplete PR templates before CI.
- Risk and rollback plan: Revert the command and docs updates.

## Checklist

- [x] I did not push directly to \`main\`; this PR is from a dedicated branch.

## Testing

- Command: \`pnpm lint\` -> \`pass\`
- Command: \`pnpm typecheck\` -> \`pass\`
- Command: \`pnpm test\` -> \`pass\`
- Command: \`pnpm audit\` -> \`pass\`
- Command: \`pnpm check\` -> \`pass\`
- Command: \`harness docs-gate --mode advisory\` -> \`n/a\`
- Any other command(s): none

## Review artifacts

- Greptile: https://example.com/greptile
- Greptile confidence score: 4/5
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

	it("fails when required sections are missing", () => {
		const errors = validatePrTemplateBody("## Summary\n\nOnly summary.");
		expect(errors).toContain("Missing required section: ## Checklist");
		expect(errors).toContain("Missing required section: ## Testing");
		expect(errors).toContain("Missing required section: ## Review artifacts");
		expect(errors).toContain("Missing required section: ## Notes");
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
			"Greptile: https://example.com/greptile",
			"Greptile: <link / artifact path / comment ID>",
		).replace(
			"Greptile confidence score: 4/5",
			"Greptile confidence score: <0-5>",
		);
		const errors = validatePrTemplateBody(body);
		expect(errors).toContain(
			"Replace template placeholder: <link / artifact path / comment ID>",
		);
		expect(errors).toContain("Replace template placeholder: <0-5>");
	});
});
