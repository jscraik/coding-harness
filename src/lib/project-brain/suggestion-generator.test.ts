import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
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
	let tempDir: string | null = null;

	afterEach(() => {
		if (tempDir) {
			rmSync(tempDir, { recursive: true, force: true });
			tempDir = null;
		}
	});

	it("returns empty report when artifacts directory does not exist", () => {
		const report = generateSuggestions("/nonexistent/path");
		expect(report.total).toBe(0);
		expect(report.suggestions).toEqual([]);
		expect(report.deduplicatedCount).toBe(0);
	});

	it("returns empty report when consistency-gate directory is empty", () => {
		tempDir = createTempArtifacts();
		mkdirSync(join(tempDir, "consistency-gate"), { recursive: true });
		const report = generateSuggestions(tempDir);
		expect(report.total).toBe(0);
	});

	it("extracts findings from gate reports", () => {
		tempDir = createTempArtifacts();
		writeGateReport(tempDir, "gate-001.json", {
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

		const report = generateSuggestions(tempDir);
		expect(report.total).toBe(1);
		const [first] = report.suggestions;
		expect(first).toBeDefined();
		expect(first?.type).toBe("rule_promotion_candidate");
		expect(first?.source).toBe("gate_failure");
		expect(first?.domain).toBe("cli");
		expect(first?.confidence).toBe("high");
		expect(first?.title).toContain("security: Missing input validation");
		expect(first?.body).toContain("**Path:** src/commands/run.ts");
		expect(first?.evidenceRef).toBe("gate-001.json");
	});

	it("classifies warnings as gate_warning source", () => {
		tempDir = createTempArtifacts();
		writeGateReport(tempDir, "gate-warn.json", {
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

		const report = generateSuggestions(tempDir);
		expect(report.total).toBe(1);
		const [first] = report.suggestions;
		expect(first).toBeDefined();
		expect(first?.source).toBe("gate_warning");
		expect(first?.type).toBe("learning");
		expect(first?.domain).toBe("governance");
	});

	it("deduplicates identical findings across reports", () => {
		tempDir = createTempArtifacts();
		const finding = {
			category: "security",
			severity: "error",
			message: "Missing input validation",
			path: "src/commands/run.ts",
		};

		writeGateReport(tempDir, "gate-a.json", {
			status: "fail",
			findings: [finding],
		});
		writeGateReport(tempDir, "gate-b.json", {
			status: "fail",
			findings: [finding],
		});

		const report = generateSuggestions(tempDir);
		expect(report.total).toBe(1);
		expect(report.deduplicatedCount).toBe(1);
	});

	it("does not deduplicate distinct file paths", () => {
		tempDir = createTempArtifacts();
		writeGateReport(tempDir, "gate-a.json", {
			status: "fail",
			findings: [
				{
					category: "security",
					severity: "error",
					message: "Missing input validation",
					path: "src/commands/run.ts",
				},
				{
					category: "security",
					severity: "error",
					message: "Missing input validation",
					path: "src/commands/build.ts",
				},
			],
		});

		const report = generateSuggestions(tempDir);
		expect(report.total).toBe(2);
		expect(report.deduplicatedCount).toBe(0);
	});

	it("handles reports with no findings array", () => {
		tempDir = createTempArtifacts();
		writeGateReport(tempDir, "empty.json", { status: "pass" });

		const report = generateSuggestions(tempDir);
		expect(report.total).toBe(0);
	});

	it("handles malformed JSON gracefully", () => {
		tempDir = createTempArtifacts();
		const gateDir = join(tempDir, "consistency-gate");
		mkdirSync(gateDir, { recursive: true });
		writeFileSync(join(gateDir, "bad.json"), "not valid json{", "utf-8");

		const report = generateSuggestions(tempDir);
		expect(report.total).toBe(0);
	});

	it("ignores non-JSON files in consistency-gate", () => {
		tempDir = createTempArtifacts();
		const gateDir = join(tempDir, "consistency-gate");
		mkdirSync(gateDir, { recursive: true });
		writeFileSync(join(gateDir, "report.txt"), "text file", "utf-8");

		const report = generateSuggestions(tempDir);
		expect(report.total).toBe(0);
	});

	it("aggregates byType and bySource counts", () => {
		tempDir = createTempArtifacts();
		writeGateReport(tempDir, "gate.json", {
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

		const report = generateSuggestions(tempDir);
		expect(report.total).toBe(2);
		expect(report.byType.rule_promotion_candidate).toBe(1);
		expect(report.byType.learning).toBe(1);
		expect(report.bySource.gate_failure).toBe(1);
		expect(report.bySource.gate_warning).toBe(1);
	});

	it("classifies domains from paths", () => {
		tempDir = createTempArtifacts();
		writeGateReport(tempDir, "domains.json", {
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
				{
					severity: "warning",
					message: "D",
					path: "src/lib/workflow-contract/run.ts",
				},
				{ severity: "warning", message: "E", path: "docs/readme.md" },
				{ severity: "warning", message: "F" },
			],
		});

		const report = generateSuggestions(tempDir);
		const domains = report.suggestions.map((s) => s.domain);
		expect(domains).toContain("cli");
		expect(domains).toContain("tooling");
		expect(domains).toContain("ci");
		expect(domains).toContain("workflow");
		expect(domains).toContain("docs");
		expect(domains).toContain("general");
	});

	it("uses description as fallback when message is missing", () => {
		tempDir = createTempArtifacts();
		writeGateReport(tempDir, "desc.json", {
			status: "fail",
			findings: [
				{
					severity: "warning",
					description: "Fallback description text",
					path: "src/commands/cmd.ts",
				},
			],
		});

		const report = generateSuggestions(tempDir);
		expect(report.total).toBe(1);
		const [first] = report.suggestions;
		expect(first).toBeDefined();
		expect(first?.body).toContain("Fallback description text");
	});

	it("supports deterministic ID generation via idFactory", () => {
		tempDir = createTempArtifacts();
		writeGateReport(tempDir, "deterministic.json", {
			status: "fail",
			findings: [
				{
					severity: "warning",
					category: "style",
					message: "Deterministic",
					path: "src/commands/cmd.ts",
				},
			],
		});

		const report = generateSuggestions(tempDir, {
			idFactory: ({ index }) => `fixed-${index}`,
		});
		expect(report.total).toBe(1);
		const [first] = report.suggestions;
		expect(first).toBeDefined();
		expect(first?.id).toBe("fixed-0");
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
