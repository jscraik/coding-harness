import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	EXIT_CODES,
	runPromptGate,
	runPromptGateCLI,
	validatePrompt,
} from "./prompt-gate.js";

describe("prompt-gate", () => {
	describe("validatePrompt", () => {
		it("counts checked items within required sections", () => {
			const baseDir = mkdtempSync(join(tmpdir(), "prompt-gate-"));
			try {
				writeFileSync(
					join(baseDir, "feature.md"),
					[
						"# Feature",
						"",
						"## Required Inputs",
						"- [x] Target repository identified",
						"- [ ] Base branch specified",
						"- [x] Scope boundaries defined",
						"",
						"## Constraints",
						"- [x] Keep changes focused",
						"",
						"## Acceptance Criteria",
						"- [x] Behavior is verified",
						"",
						"## Expected Outputs",
						"- [x] Implementation",
						"",
						"## Do Not Do",
						"- [x] Skip tests",
						"",
					].join("\n"),
				);

				const result = validatePrompt({
					type: "feature",
					file: "feature.md",
					baseDir,
				});

				expect(result.passed).toBe(true);
				expect(
					result.checks.find((check) => check.section === "Required Inputs")
						?.itemsFound,
				).toBe(2);
			} finally {
				rmSync(baseDir, { recursive: true, force: true });
			}
		});

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
		it("returns system error for unreadable prompt paths", () => {
			const baseDir = mkdtempSync(join(tmpdir(), "prompt-gate-"));
			try {
				mkdirSync(join(baseDir, "prompt-dir"));

				const result = runPromptGate({
					type: "feature",
					file: "prompt-dir",
					baseDir,
				});

				expect(result.ok).toBe(false);
				if (!result.ok) {
					expect(result.error.code).toBe("SYSTEM_ERROR");
					expect(result.error.message).toContain("Failed to read file");
				}
			} finally {
				rmSync(baseDir, { recursive: true, force: true });
			}
		});

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
