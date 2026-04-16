import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	type SuggestionReport,
	formatSuggestionsForReview,
	generateSuggestions,
} from "./suggestion-generator.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempArtifacts(): string {
	return mkdtempSync(join(tmpdir(), "suggestion-gen-test-"));
}

function writeGateReport(
	artifactsDir: string,
	filename: string,
	report: Record<string, unknown>,
): void {
	const dir = join(artifactsDir, "consistency-gate");
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, filename), JSON.stringify(report), "utf-8");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateSuggestions", () => {
	it("returns empty report when artifacts directory does not exist", () => {
		const report = generateSuggestions("/nonexistent/path");
		expect(report.total).toBe(0);
		expect(report.suggestions).toEqual([]);
		expect(report.deduplicatedCount).toBe(0);
	});

	it("returns empty report when consistency-gate directory is empty", () => {
		const dir = createTempArtifacts();
		try {
			mkdirSync(join(dir, "consistency-gate"), { recursive: true });
			const report = generateSuggestions(dir);
			expect(report.total).toBe(0);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("extracts findings from gate reports", () => {
		const dir = createTempArtifacts();
		try {
			writeGateReport(dir, "gate-001.json", {
				status: "fail",
				findings: [
					{
						category: "security",
						severity: "error",
						message: "Missing input validation",
						path: "src/commands/run.ts",
					},
				],
			});

			const report = generateSuggestions(dir);
			expect(report.total).toBe(1);
			expect(report.suggestions[0]!.type).toBe("rule_promotion_candidate");
			expect(report.suggestions[0]!.source).toBe("gate_failure");
			expect(report.suggestions[0]!.domain).toBe("cli");
			expect(report.suggestions[0]!.confidence).toBe("high");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("classifies warnings as gate_warning source", () => {
		const dir = createTempArtifacts();
		try {
			writeGateReport(dir, "gate-warn.json", {
				status: "warn",
				findings: [
					{
						category: "style",
						severity: "warning",
						message: "Inconsistent naming",
						path: "src/lib/policy/checks.ts",
					},
				],
			});

			const report = generateSuggestions(dir);
			expect(report.total).toBe(1);
			expect(report.suggestions[0]!.source).toBe("gate_warning");
			expect(report.suggestions[0]!.type).toBe("learning");
			expect(report.suggestions[0]!.domain).toBe("governance");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("deduplicates identical findings across reports", () => {
		const dir = createTempArtifacts();
		try {
			const finding = {
				category: "security",
				severity: "error",
				message: "Missing input validation",
				path: "src/commands/run.ts",
			};

			writeGateReport(dir, "gate-a.json", {
				status: "fail",
				findings: [finding],
			});
			writeGateReport(dir, "gate-b.json", {
				status: "fail",
				findings: [finding],
			});

			const report = generateSuggestions(dir);
			expect(report.total).toBe(1);
			expect(report.deduplicatedCount).toBe(1);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("handles reports with no findings array", () => {
		const dir = createTempArtifacts();
		try {
			writeGateReport(dir, "empty.json", { status: "pass" });

			const report = generateSuggestions(dir);
			expect(report.total).toBe(0);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("handles malformed JSON gracefully", () => {
		const dir = createTempArtifacts();
		try {
			const gateDir = join(dir, "consistency-gate");
			mkdirSync(gateDir, { recursive: true });
			writeFileSync(join(gateDir, "bad.json"), "not valid json{", "utf-8");

			const report = generateSuggestions(dir);
			expect(report.total).toBe(0);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("ignores non-JSON files in consistency-gate", () => {
		const dir = createTempArtifacts();
		try {
			const gateDir = join(dir, "consistency-gate");
			mkdirSync(gateDir, { recursive: true });
			writeFileSync(join(gateDir, "report.txt"), "text file", "utf-8");

			const report = generateSuggestions(dir);
			expect(report.total).toBe(0);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("aggregates byType and bySource counts", () => {
		const dir = createTempArtifacts();
		try {
			writeGateReport(dir, "gate.json", {
				status: "fail",
				findings: [
					{
						category: "security",
						severity: "error",
						message: "Issue A",
						path: "src/lib/policy/a.ts",
					},
					{
						category: "style",
						severity: "warning",
						message: "Issue B",
						path: "src/commands/b.ts",
					},
				],
			});

			const report = generateSuggestions(dir);
			expect(report.total).toBe(2);
			expect(report.byType.rule_promotion_candidate).toBe(1);
			expect(report.byType.learning).toBe(1);
			expect(report.bySource.gate_failure).toBe(1);
			expect(report.bySource.gate_warning).toBe(1);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("classifies domains from paths", () => {
		const dir = createTempArtifacts();
		try {
			writeGateReport(dir, "domains.json", {
				status: "fail",
				findings: [
					{ severity: "warning", message: "A", path: "src/commands/x.ts" },
					{
						severity: "warning",
						message: "B",
						path: "src/lib/context-compound/y.ts",
					},
					{
						severity: "warning",
						message: "C",
						path: ".github/workflows/ci.yml",
					},
					{ severity: "warning", message: "D", path: "docs/readme.md" },
					{ severity: "warning", message: "E" },
				],
			});

			const report = generateSuggestions(dir);
			const domains = report.suggestions.map((s) => s.domain);
			expect(domains).toContain("cli");
			expect(domains).toContain("tooling");
			expect(domains).toContain("ci");
			expect(domains).toContain("docs");
			expect(domains).toContain("general");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("uses description as fallback when message is missing", () => {
		const dir = createTempArtifacts();
		try {
			writeGateReport(dir, "desc.json", {
				status: "fail",
				findings: [
					{
						severity: "warning",
						description: "Fallback description text",
						path: "src/commands/cmd.ts",
					},
				],
			});

			const report = generateSuggestions(dir);
			expect(report.total).toBe(1);
			expect(report.suggestions[0]!.body).toContain(
				"Fallback description text",
			);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("formatSuggestionsForReview", () => {
	it("returns no-suggestions message for empty report", () => {
		const report = generateSuggestions("/nonexistent");
		const output = formatSuggestionsForReview(report);
		expect(output).toBe("No suggestions found from run artifacts.");
	});

	it("formats suggestions with markdown headers", () => {
		const report: SuggestionReport = {
			total: 1,
			byType: { learning: 1 },
			bySource: { gate_warning: 1 },
			deduplicatedCount: 0,
			suggestions: [
				{
					id: "sug-test-1",
					type: "learning",
					source: "gate_warning",
					domain: "cli",
					title: "style: Inconsistent naming",
					body: "**Finding:** Inconsistent naming\n\n**Path:** src/cmd.ts",
					evidenceRef: "gate-001.json",
					deduplicated: false,
					confidence: "medium",
				},
			],
		};

		const output = formatSuggestionsForReview(report);
		expect(output).toContain("## Project Brain Suggestions (1)");
		expect(output).toContain("### learning: style: Inconsistent naming");
		expect(output).toContain("**Domain:** cli");
		expect(output).toContain("**Confidence:** medium");
		expect(output).toContain("**Finding:** Inconsistent naming");
	});

	it("includes deduplication note when duplicates were removed", () => {
		const report: SuggestionReport = {
			total: 1,
			byType: { learning: 1 },
			bySource: { gate_warning: 1 },
			deduplicatedCount: 2,
			suggestions: [
				{
					id: "sug-test-2",
					type: "learning",
					source: "gate_warning",
					domain: "general",
					title: "test: something",
					body: "body",
					evidenceRef: "gate.json",
					deduplicated: true,
					confidence: "medium",
				},
			],
		};

		const output = formatSuggestionsForReview(report);
		expect(output).toContain("2 duplicate suggestion(s) removed");
	});
});
