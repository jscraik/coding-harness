import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runLearningsCLI } from "./learnings.js";

const csv = `Repository,File,Pull Request,URL,Usage,Learning,Created By,Last Used,Created At,Updated At
coding-harness,docs/ai-assistant-security-policy.md,148,,516,"YAML frontmatter fields are machine-readable metadata.",jscraik,Never,created,updated
`;

const targetPatternCsv = `Repository,File,Pull Request,URL,Usage,Learning,Created By,Last Used,Created At,Updated At
coding-harness,,149,,45,"Applies to scripts/**: generated runtime mirrors should be fixed at the generator.",jscraik,Never,created,updated
`;

const promotionCsv = `Repository,File,Pull Request,URL,Usage,Learning,Created By,Last Used,Created At,Updated At
coding-harness,docs/ai-assistant-security-policy.md,148,,516,"YAML frontmatter fields are machine-readable metadata.",jscraik,Never,created,updated
coding-harness,,149,,45,"Applies to scripts/**: generated runtime mirrors should be fixed at the generator.",jscraik,Never,created,updated
coding-harness,docs/low-signal.md,150,,4,"Low signal note.",jscraik,Never,created,updated
`;

describe("runLearningsCLI", () => {
	const cleanup: string[] = [];
	afterEach(() => {
		for (const path of cleanup.splice(0))
			rmSync(path, { recursive: true, force: true });
		vi.restoreAllMocks();
	});

	it("imports CodeRabbit CSV and emits JSON result", () => {
		const dir = mkdtempSync(join(tmpdir(), "learnings-command-"));
		cleanup.push(dir);
		const sourcePath = join(dir, "learnings.csv");
		const outputPath = join(dir, ".harness/learnings/coderabbit.local.json");
		writeFileSync(sourcePath, csv, "utf-8");
		const infoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		const exitCode = runLearningsCLI([
			"import",
			"--provider",
			"coderabbit-csv",
			"--source",
			sourcePath,
			"--repo",
			"coding-harness",
			"--output",
			outputPath,
			"--json",
		]);

		expect(exitCode).toBe(0);
		const result = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
		expect(result.schemaVersion).toBe("learnings-import-result/v1");
		expect(result.summary.imported).toBe(1);
		expect(
			JSON.parse(readFileSync(outputPath, "utf-8")).items[0].lastUsed,
		).toBeNull();
	});

	it("returns usage for missing subcommands", () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);

		expect(runLearningsCLI([])).toBe(2);
	});

	it("emits GateResult JSON for exact-file learning matches", () => {
		const dir = mkdtempSync(join(tmpdir(), "learnings-gate-"));
		cleanup.push(dir);
		const sourcePath = join(dir, "learnings.csv");
		const outputPath = join(dir, ".harness/learnings/coderabbit.local.json");
		writeFileSync(sourcePath, csv, "utf-8");
		expect(
			runLearningsCLI([
				"import",
				"--provider",
				"coderabbit-csv",
				"--source",
				sourcePath,
				"--repo",
				"coding-harness",
				"--output",
				outputPath,
				"--json",
			]),
		).toBe(0);
		const infoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		const exitCode = runLearningsCLI([
			"gate",
			"--source",
			outputPath,
			"--files",
			"docs/ai-assistant-security-policy.md",
			"--json",
		]);

		expect(exitCode).toBe(1);
		const gateResult = JSON.parse(String(infoSpy.mock.calls.at(-1)?.[0]));
		expect(gateResult.gate).toBe("learnings-gate");
		expect(gateResult.status).toBe("fail");
		expect(gateResult.findings[0]).toMatchObject({
			severity: "error",
			path: "docs/ai-assistant-security-policy.md",
		});
		expect(gateResult.evidence_ref[0]).toContain("#row=2");
	});

	it("emits warning GateResult JSON for target path-prefix learning matches", () => {
		const dir = mkdtempSync(join(tmpdir(), "learnings-gate-prefix-"));
		cleanup.push(dir);
		const sourcePath = join(dir, "learnings.csv");
		const outputPath = join(dir, ".harness/learnings/coderabbit.local.json");
		writeFileSync(sourcePath, targetPatternCsv, "utf-8");
		expect(
			runLearningsCLI([
				"import",
				"--provider",
				"coderabbit-csv",
				"--source",
				sourcePath,
				"--repo",
				"coding-harness",
				"--output",
				outputPath,
				"--json",
			]),
		).toBe(0);
		const infoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		const exitCode = runLearningsCLI([
			"gate",
			"--source",
			outputPath,
			"--files",
			"scripts/codex-preflight.sh",
			"--json",
		]);

		expect(exitCode).toBe(0);
		const gateResult = JSON.parse(String(infoSpy.mock.calls.at(-1)?.[0]));
		expect(gateResult.status).toBe("warn");
		expect(gateResult.findings[0]).toMatchObject({
			severity: "warning",
			path: "scripts/codex-preflight.sh",
		});
		expect(gateResult.evidence_ref[0]).toContain("#row=2");
	});

	it("returns a clear GateResult error when the learning artifact is missing", () => {
		const infoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		const exitCode = runLearningsCLI([
			"gate",
			"--source",
			"/tmp/missing-coderabbit.local.json",
			"--files",
			"docs/ai-assistant-security-policy.md",
			"--json",
		]);

		expect(exitCode).toBe(1);
		const gateResult = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
		expect(gateResult.status).toBe("fail");
		expect(gateResult.findings[0].id).toBe("learnings-gate.artifact.missing");
		expect(gateResult.action_now[0]).toContain("harness learnings import");
	});

	it("emits promotion candidates for high-usage imported learnings", () => {
		const dir = mkdtempSync(join(tmpdir(), "learnings-promote-"));
		cleanup.push(dir);
		const sourcePath = join(dir, "learnings.csv");
		const outputPath = join(dir, ".harness/learnings/coderabbit.local.json");
		writeFileSync(sourcePath, promotionCsv, "utf-8");
		expect(
			runLearningsCLI([
				"import",
				"--provider",
				"coderabbit-csv",
				"--source",
				sourcePath,
				"--repo",
				"coding-harness",
				"--output",
				outputPath,
				"--json",
			]),
		).toBe(0);
		const infoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		const exitCode = runLearningsCLI([
			"promote",
			"--source",
			outputPath,
			"--min-usage",
			"25",
			"--json",
		]);

		expect(exitCode).toBe(0);
		const result = JSON.parse(String(infoSpy.mock.calls.at(-1)?.[0]));
		expect(result.schemaVersion).toBe("learnings-promote-result/v1");
		expect(result.summary).toMatchObject({
			total: 3,
			eligible: 2,
			deferred: 1,
		});
		expect(result.promotionCandidates[0]).toMatchObject({
			usage: 516,
			promotionStatus: "enforced",
			recommendedTarget: "docs-gate",
			recommendedSeverity: "error",
		});
		expect(result.promotionCandidates[1]).toMatchObject({
			usage: 45,
			recommendedTarget: "artifact-provenance-gate",
			recommendedSeverity: "warning",
		});
	});

	it("returns usage for invalid promotion thresholds", () => {
		const infoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		const exitCode = runLearningsCLI([
			"promote",
			"--min-usage",
			"abc",
			"--json",
		]);

		expect(exitCode).toBe(2);
		const result = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
		expect(result.errorCode).toBe("learnings.min_usage_invalid");
	});

	it("returns usage for unsupported providers", () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);

		const exitCode = runLearningsCLI([
			"import",
			"--provider",
			"coderabbit-live",
			"--source",
			"x.csv",
			"--repo",
			"coding-harness",
		]);

		expect(exitCode).toBe(2);
	});

	it("returns failure for missing source files", () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);

		const exitCode = runLearningsCLI([
			"import",
			"--provider",
			"coderabbit-csv",
			"--source",
			"/tmp/not-present-coderabbit.csv",
			"--repo",
			"coding-harness",
		]);

		expect(exitCode).toBe(1);
	});
});
