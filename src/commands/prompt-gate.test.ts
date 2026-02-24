import { describe, expect, it } from "vitest";
import {
	EXIT_CODES,
	runPromptGate,
	runPromptGateCLI,
	validatePrompt,
} from "./prompt-gate.js";

describe("prompt-gate", () => {
	describe("validatePrompt", () => {
		it("returns failure for non-existent file", () => {
			const result = validatePrompt({
				type: "feature",
				file: "non-existent.md",
			});

			expect(result.passed).toBe(false);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain("not found");
		});

		it("detects missing sections in feature template", () => {
			const result = validatePrompt({
				type: "feature",
				file: "test-fixtures/empty.md",
			});

			expect(result.passed).toBe(false);
			expect(result.missing.length).toBeGreaterThan(0);
		});
	});

	describe("runPromptGate", () => {
		it("returns error for missing file", () => {
			const result = runPromptGate({
				type: "feature",
				file: "non-existent.md",
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("FILE_NOT_FOUND");
			}
		});
	});

	describe("runPromptGateCLI", () => {
		it("returns SUCCESS for valid feature document", () => {
			const exitCode = runPromptGateCLI({
				type: "feature",
				file: "docs/prompts/feature_template.md",
				json: true,
			});

			expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		});

		it("returns VALIDATION_ERROR for missing file", () => {
			const exitCode = runPromptGateCLI({
				type: "feature",
				file: "non-existent.md",
				json: true,
			});

			expect(exitCode).toBe(EXIT_CODES.TEMPLATE_MISSING);
		});

		it("validates all prompt template types", () => {
			const types = ["feature", "bugfix", "refactor", "release"] as const;

			for (const type of types) {
				const exitCode = runPromptGateCLI({
					type,
					file: `docs/prompts/${type}_template.md`,
					json: true,
				});

				expect(exitCode).toBe(EXIT_CODES.SUCCESS);
			}
		});
	});
});
