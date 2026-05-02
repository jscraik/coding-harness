import { describe, expect, it } from "vitest";
import { matchLearningToFile, patternMatchesFile } from "./fuzzy-match.js";
import type { LearningItem } from "./types.js";

describe("matchLearningToFile", () => {
	it("reports exact-file matches with blocking-safe confidence", () => {
		const match = matchLearningToFile(
			learning({ file: "docs/policy.md", learning: "Keep policy exact." }),
			"docs/policy.md",
		);

		expect(match).toMatchObject({
			kind: "exact_file",
			confidence: 1,
			advisoryOnly: false,
			falsePositiveCandidate: false,
		});
	});

	it("reports keyword-only matches as advisory measurement candidates", () => {
		const match = matchLearningToFile(
			learning({
				learning:
					"Generated runtime mirror files should be fixed at the generator.",
				usage: 516,
				enforcement: "error",
			}),
			"scripts/generated-runtime-mirror.ts",
		);

		expect(match).toMatchObject({
			kind: "keyword",
			advisoryOnly: true,
		});
		expect(match?.confidence).toBeLessThan(1);
		expect(match?.reason).toContain("generated");
	});

	it("marks low-confidence keyword-only matches as false-positive candidates", () => {
		const match = matchLearningToFile(
			learning({
				learning: "Frontmatter fields are machine-readable metadata.",
				usage: 516,
				enforcement: "error",
			}),
			"docs/frontmatter.md",
		);

		expect(match).toMatchObject({
			kind: "keyword",
			confidence: 0.5,
			advisoryOnly: true,
			falsePositiveCandidate: true,
		});
	});

	it("documents path pattern glob semantics", () => {
		expect(patternMatchesFile("src/**", "src")).toBe(true);
		expect(patternMatchesFile("src/**", "src/lib/index.ts")).toBe(true);
		expect(patternMatchesFile("src/*", "src")).toBe(false);
		expect(patternMatchesFile("src/*", "src/index.ts")).toBe(true);
		expect(patternMatchesFile("src/*", "src/lib/index.ts")).toBe(false);
		expect(patternMatchesFile("./src/index.ts", "src/index.ts")).toBe(true);
		expect(patternMatchesFile("src/**", "./src\\lib\\index.ts")).toBe(true);
	});
});

function learning(overrides: Partial<LearningItem>): LearningItem {
	return {
		id: "coderabbit.coding-harness.test-learning",
		provider: "coderabbit",
		source: {
			kind: "coderabbit_csv",
			uri: "file:///tmp/learnings.csv",
			row: 2,
			live: false,
		},
		repository: "coding-harness",
		usage: 25,
		learning: "Test learning.",
		classification: "review_context",
		enforcement: "warning",
		promotionStatus: "candidate",
		...overrides,
	};
}
