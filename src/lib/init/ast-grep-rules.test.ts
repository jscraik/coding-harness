/**
 * Tests for CodeRabbit ast-grep rules defined under rules/.
 *
 * These checks validate the structure and regex logic of the YAML rule files
 * without requiring the ast-grep binary (which may not be available in CI).
 * They serve as a static guardrail to prevent rule regressions.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RULES_DIR = join(process.cwd(), "rules");

function loadRuleFile(filename: string): string {
	return readFileSync(join(RULES_DIR, filename), "utf-8");
}

// ─── require-relative-import-js-extension rule ────────────────────────────────

describe("rules/require-relative-import-js-extension.yml", () => {
	const RAW = loadRuleFile("require-relative-import-js-extension.yml");

	it("exists and is non-empty", () => {
		expect(RAW.length).toBeGreaterThan(0);
	});

	it("has required top-level fields: id, language, message, severity, rule", () => {
		expect(RAW).toMatch(/^id:/m);
		expect(RAW).toMatch(/^language:/m);
		expect(RAW).toMatch(/^message:/m);
		expect(RAW).toMatch(/^severity:/m);
		expect(RAW).toMatch(/^rule:/m);
	});

	it("id matches the filename (without .yml)", () => {
		const idMatch = RAW.match(/^id:\s*(.+)$/m);
		expect(idMatch).not.toBeNull();
		expect(idMatch![1]!.trim()).toBe("require-relative-import-js-extension");
	});

	it("targets TypeScript language", () => {
		const langMatch = RAW.match(/^language:\s*(.+)$/m);
		expect(langMatch).not.toBeNull();
		expect(langMatch![1]!.trim()).toBe("TypeScript");
	});

	it("severity is warning (advisory, not blocking)", () => {
		const severityMatch = RAW.match(/^severity:\s*(.+)$/m);
		expect(severityMatch).not.toBeNull();
		expect(severityMatch![1]!.trim()).toBe("warning");
	});

	it("message explains the requirement", () => {
		expect(RAW).toContain(".js extension");
	});

	// ─── Regex pattern validation ─────────────────────────────────────────────

	describe("relative path detection regex (^\\.{1,2}/)", () => {
		/**
		 * The rule uses ast-grep regex patterns against string_fragment nodes.
		 * We test that the intent of the pattern is correct by checking it
		 * against sample import path strings directly.
		 */
		const relativePathPattern = /^\.{1,2}\//;

		it("matches single-dot relative paths (./)", () => {
			expect(relativePathPattern.test("./utils")).toBe(true);
			expect(relativePathPattern.test("./components/Button")).toBe(true);
			expect(relativePathPattern.test("./index")).toBe(true);
		});

		it("matches double-dot relative paths (../)", () => {
			expect(relativePathPattern.test("../lib/helpers")).toBe(true);
			expect(relativePathPattern.test("../index")).toBe(true);
			// "../../utils" starts with ".." then "/" so it still matches
			expect(relativePathPattern.test("../../utils")).toBe(true);
		});

		it("does not match bare module imports", () => {
			expect(relativePathPattern.test("vitest")).toBe(false);
			expect(relativePathPattern.test("@company/pkg")).toBe(false);
			expect(relativePathPattern.test("node:fs")).toBe(false);
		});

		it("does not match absolute paths", () => {
			expect(relativePathPattern.test("/absolute/path")).toBe(false);
		});

		// The rule now positively requires a .js suffix for relative ESM imports.
		const jsExtensionPattern = /\.js$/;

		it("extension pattern matches paths that already have a .js extension", () => {
			expect(jsExtensionPattern.test("./utils.js")).toBe(true);
			expect(jsExtensionPattern.test("./components/Button.js")).toBe(true);
			expect(jsExtensionPattern.test("../helpers.js")).toBe(true);
		});

		it("extension pattern does not match paths without a .js extension", () => {
			expect(jsExtensionPattern.test("./utils")).toBe(false);
			expect(jsExtensionPattern.test("../helpers")).toBe(false);
			expect(jsExtensionPattern.test("./index")).toBe(false);
			expect(jsExtensionPattern.test("./data.json")).toBe(false);
			expect(jsExtensionPattern.test("./helper.mjs")).toBe(false);
		});

		it("extension pattern does not match directory-like paths ending with /", () => {
			// Paths ending with "/" have no extension
			expect(jsExtensionPattern.test("./components/")).toBe(false);
		});
	});

	describe("rule logic: which imports would be flagged", () => {
		/**
		 * Simulates the rule's combined condition:
		 * - IS relative (starts with ./ or ../)
		 * - ends with .js
		 */
		function wouldBeFlagged(importPath: string): boolean {
			const isRelative = /^\.{1,2}\//.test(importPath);
			const hasJsExtension = /\.js$/.test(importPath);
			return isRelative && !hasJsExtension;
		}

		it("flags bare relative imports without extension", () => {
			expect(wouldBeFlagged("./utils")).toBe(true);
			expect(wouldBeFlagged("./commands/init")).toBe(true);
			expect(wouldBeFlagged("../lib/helpers")).toBe(true);
			expect(wouldBeFlagged("./index")).toBe(true);
		});

		it("does not flag relative imports that already have .js extension", () => {
			expect(wouldBeFlagged("./utils.js")).toBe(false);
			expect(wouldBeFlagged("./commands/init.js")).toBe(false);
			expect(wouldBeFlagged("../lib/helpers.js")).toBe(false);
		});

		it("flags relative imports with non-.js extensions", () => {
			expect(wouldBeFlagged("./data.json")).toBe(true);
			expect(wouldBeFlagged("./styles.css")).toBe(true);
			expect(wouldBeFlagged("./helper.mjs")).toBe(true);
			expect(wouldBeFlagged("./types.d")).toBe(true);
		});

		it("does not flag bare package imports (non-relative)", () => {
			expect(wouldBeFlagged("vitest")).toBe(false);
			expect(wouldBeFlagged("node:fs")).toBe(false);
			expect(wouldBeFlagged("@company/pkg")).toBe(false);
		});

		it("does not flag absolute imports", () => {
			expect(wouldBeFlagged("/absolute/path")).toBe(false);
		});
	});

	// ─── Rule structure validation ─────────────────────────────────────────────

	it("rule uses 'all' combinator at the top level", () => {
		expect(RAW).toContain("all:");
	});

	it("rule checks string_fragment kind (import path node type)", () => {
		expect(RAW).toContain("kind: string_fragment");
	});

	it("rule scopes to import_statement, export_statement, and call_expression", () => {
		expect(RAW).toContain("kind: import_statement");
		expect(RAW).toContain("kind: export_statement");
		expect(RAW).toContain("kind: call_expression");
	});

	it("rule includes a positive .js suffix requirement", () => {
		expect(RAW).toContain('regex: "\\\\.js$"');
	});

	it("rule uses 'any' to match both static and dynamic imports", () => {
		expect(RAW).toContain("any:");
	});

	it("rule targets dynamic import() calls via field: function regex", () => {
		expect(RAW).toContain("field: function");
		expect(RAW).toContain("^import$");
	});
});
