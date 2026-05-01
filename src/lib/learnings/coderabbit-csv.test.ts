import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseCodeRabbitCsv } from "./coderabbit-csv.js";

const fixturePath = fileURLToPath(
	new URL("./__fixtures__/coderabbit-learnings.csv", import.meta.url),
);

describe("parseCodeRabbitCsv", () => {
	it("normalizes CodeRabbit CSV rows for the requested repository", () => {
		const result = parseCodeRabbitCsv(readFileSync(fixturePath, "utf-8"), {
			repository: "coding-harness",
		});

		expect(result.rows).toHaveLength(4);
		expect(result.skipped).toBe(1);
		expect(result.invalid).toBe(0);
		expect(result.warnings).toEqual([]);
		expect(result.rows[0]).toMatchObject({
			row: 2,
			repository: "coding-harness",
			file: "docs/ai-assistant-security-policy.md",
			pullRequest: "148",
			usage: 516,
		});
	});

	it("accepts UTF-8 BOM-prefixed CodeRabbit CSV headers", () => {
		const result = parseCodeRabbitCsv(
			"\uFEFFRepository,Usage,Learning\ncoding-harness,1,Keep evidence local\n",
			{
				repository: "coding-harness",
			},
		);

		expect(result.rows).toHaveLength(1);
		expect(result.warnings).toEqual([]);
		expect(result.rows[0]?.learning).toBe("Keep evidence local");
	});

	it("normalizes Last Used=Never to null and blank Usage to zero", () => {
		const result = parseCodeRabbitCsv(readFileSync(fixturePath, "utf-8"), {
			repository: "coding-harness",
		});
		const validationRow = result.rows.find(
			(row) => row.file === "docs/agents/04-validation.md",
		);

		expect(validationRow?.usage).toBe(0);
		expect(validationRow?.lastUsed).toBeNull();
	});

	it("extracts deterministic target patterns from Applies to prefixes", () => {
		const result = parseCodeRabbitCsv(readFileSync(fixturePath, "utf-8"), {
			repository: "coding-harness",
		});
		const generatedRow = result.rows.find(
			(row) => row.file === "scripts/codex-preflight.sh",
		);

		expect(generatedRow?.targetPatterns).toEqual(["scripts/**"]);
		expect(generatedRow?.learning).toBe(
			"Generated runtime mirrors should be fixed at the generator and then synced.",
		);
	});

	it("returns a header warning when required CodeRabbit columns are missing", () => {
		const result = parseCodeRabbitCsv(
			"Repository,Learning\ncoding-harness,x\n",
			{
				repository: "coding-harness",
			},
		);

		expect(result.rows).toHaveLength(0);
		expect(result.warnings[0]?.code).toBe("learnings.csv.missing_headers");
	});

	it("does not match owner-qualified repository aliases across owners", () => {
		const result = parseCodeRabbitCsv(
			"Repository,Usage,Learning\nother-owner/coding-harness,1,Wrong repo\ncoding-harness,2,Local repo\n",
			{
				repository: "jscraik/coding-harness",
			},
		);

		expect(result.rows).toHaveLength(1);
		expect(result.rows[0]?.learning).toBe("Local repo");
		expect(result.skipped).toBe(1);
	});

	it("matches ownerless CSV rows when the requested repository includes an owner", () => {
		const result = parseCodeRabbitCsv(
			"Repository,Usage,Learning\ncoding-harness,1,Local repo\n",
			{
				repository: "jscraik/coding-harness",
			},
		);

		expect(result.rows).toHaveLength(1);
		expect(result.rows[0]?.repository).toBe("jscraik/coding-harness");
		expect(result.skipped).toBe(0);
	});

	it("rejects blank target repositories before parsing rows", () => {
		expect(() =>
			parseCodeRabbitCsv(
				"Repository,Usage,Learning\ncoding-harness,1,Learning",
				{ repository: " " },
			),
		).toThrow("CodeRabbit CSV import requires a target repository.");
	});

	it("matches owner-qualified CSV rows when the requested repository is ownerless", () => {
		const result = parseCodeRabbitCsv(
			"Repository,Usage,Learning\njscraik/coding-harness,1,Qualified repo\n",
			{
				repository: "coding-harness",
			},
		);

		expect(result.rows).toHaveLength(1);
		expect(result.rows[0]?.repository).toBe("coding-harness");
		expect(result.rows[0]?.learning).toBe("Qualified repo");
		expect(result.skipped).toBe(0);
	});
});
