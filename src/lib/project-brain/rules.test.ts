import { describe, expect, it } from "vitest";
import { formatBrainRuleEntry, parseBrainRules } from "./rules.js";

describe("Project Brain rules", () => {
	it("parses numeric and auto-generated rule identifiers", () => {
		const rules = parseBrainRules(`
# CLI Rules

- **R-001**: Existing numeric rule
  - Severity: must
- **R-auto**: Added rule from brain add
  - Severity: should
- **not-a-rule**: Ignored entry
`);

		expect(rules).toEqual([
			{ id: "R-001", text: "Existing numeric rule" },
			{ id: "R-auto", text: "Added rule from brain add" },
		]);
	});

	it("formats rule entries with the shared markdown contract", () => {
		expect(
			formatBrainRuleEntry({
				id: "R-auto",
				text: "All command help must render before validation",
			}),
		).toBe("- **R-auto**: All command help must render before validation");
	});

	it("parses the documented Project Brain rules document shape", () => {
		const content = `
# CLI Rules

## Rules

- **R-cli-help**: Help output renders before subcommand validation.
- **R-runtime_card**: Runtime-card evidence stays advisory unless a verifier consumes it.
`;

		expect(parseBrainRules(content)).toEqual([
			{
				id: "R-cli-help",
				text: "Help output renders before subcommand validation.",
			},
			{
				id: "R-runtime_card",
				text: "Runtime-card evidence stays advisory unless a verifier consumes it.",
			},
		]);
	});
});
