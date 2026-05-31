import { describe, expect, it } from "vitest";
import { parseBrainRules } from "./rules.js";

describe("parseBrainRules", () => {
	it("parses the Project Brain active-rule markdown grammar", () => {
		const rules = parseBrainRules(
			[
				"# Rules",
				"",
				"## Active rules",
				"- **R-1**: Prefer current repo evidence over memory.",
				"- **R-closeout-truth**: Keep PR, CI, review, and tracker lanes separate.",
			].join("\n"),
		);

		expect(rules).toEqual([
			{ id: "R-1", text: "Prefer current repo evidence over memory." },
			{
				id: "R-closeout-truth",
				text: "Keep PR, CI, review, and tracker lanes separate.",
			},
		]);
	});

	it("skips near-miss rule entries instead of silently inventing ids", () => {
		expect(parseBrainRules("- **Rule 1**: wrong prefix")).toEqual([]);
	});
});
