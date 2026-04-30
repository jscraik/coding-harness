import { describe, expect, it } from "vitest";
import { normalizeLearningRows } from "./normalise.js";
import type { ParsedCodeRabbitLearningRow } from "./types.js";

const sourceUri = "file:///tmp/learnings.csv";

describe("normalizeLearningRows", () => {
	it("generates the deterministic frontmatter learning ID", () => {
		const result = normalizeLearningRows(
			[
				{
					row: 2,
					repository: "coding-harness",
					file: "docs/ai-assistant-security-policy.md",
					pullRequest: "148",
					usage: 516,
					learning:
						"YAML frontmatter fields are machine-readable metadata and must not be represented as prose sections.",
				},
			],
			{ sourceUri },
		);

		expect(result.items[0]?.id).toBe(
			"coderabbit.coding-harness.docs-frontmatter-machine-readable",
		);
		expect(result.items[0]?.githubUrl).toBe(
			"https://github.com/jscraik/coding-harness/pull/148",
		);
		expect(result.items[0]?.enforcement).toBe("error");
		expect(result.items[0]?.promotionStatus).toBe("candidate");
	});

	it("adds stable short hashes when IDs collide", () => {
		const rows: ParsedCodeRabbitLearningRow[] = [
			{
				row: 2,
				repository: "coding-harness",
				file: "docs/a.md",
				usage: 10,
				learning: "Repeated topic for docs surface.",
			},
			{
				row: 3,
				repository: "coding-harness",
				file: "docs/a.md",
				usage: 10,
				learning: "Repeated topic for docs surface.",
			},
		];

		const first = normalizeLearningRows(rows, { sourceUri });
		const second = normalizeLearningRows(rows, { sourceUri });

		expect(first.items[0]?.id).toBe(
			"coderabbit.coding-harness.docs-repeated-topic-docs-surface",
		);
		expect(first.items[1]?.id).toMatch(
			/^coderabbit\.coding-harness\.docs-repeated-topic-docs-surface-[a-f0-9]{8}$/,
		);
		expect(first.items[1]?.id).toBe(second.items[1]?.id);
	});

	it("sorts items by repository, file, usage descending, then ID", () => {
		const result = normalizeLearningRows(
			[
				{
					row: 2,
					repository: "coding-harness",
					file: "src/b.ts",
					usage: 1,
					learning: "Beta learning.",
				},
				{
					row: 3,
					repository: "coding-harness",
					file: "src/a.ts",
					usage: 10,
					learning: "Alpha learning.",
				},
			],
			{ sourceUri },
		);

		expect(result.items.map((item) => item.file)).toEqual([
			"src/a.ts",
			"src/b.ts",
		]);
	});
});
