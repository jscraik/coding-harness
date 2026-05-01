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

const sensitiveCsv = `Repository,File,Pull Request,URL,Usage,Learning,Created By,Last Used,Created At,Updated At
coding-harness,/Users/jamiecraik/Downloads/private.md,148,https://github.com/jscraik/coding-harness/pull/148,516,"Use token=github_pat_abcdefghijklmnopqrstuvwxyz123456 from /Users/jamiecraik/.config.",jscraik,Never,created,updated
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

	it("writes sanitized snapshot output without leaking diagnostics", () => {
		const dir = mkdtempSync(join(tmpdir(), "learnings-command-snapshot-"));
		cleanup.push(dir);
		const sourcePath = join(dir, "learnings.csv");
		const outputPath = join(dir, ".harness/learnings/coderabbit.snapshot.json");
		writeFileSync(sourcePath, sensitiveCsv, "utf-8");
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
		const output = String(infoSpy.mock.calls[0]?.[0]);
		const snapshot = readFileSync(outputPath, "utf-8");
		expect(output).not.toContain("github_pat_abcdefghijklmnopqrstuvwxyz123456");
		expect(output).not.toContain("/Users/jamiecraik/Downloads/private.md");
		expect(snapshot).not.toContain(
			"github_pat_abcdefghijklmnopqrstuvwxyz123456",
		);
		expect(snapshot).not.toContain("/Users/jamiecraik");
		expect(snapshot).toContain("[REDACTED]");
	});

	it("attaches live companion metadata without replacing row-level CSV evidence", () => {
		const dir = mkdtempSync(join(tmpdir(), "learnings-command-live-"));
		cleanup.push(dir);
		const sourcePath = join(dir, "learnings.csv");
		const companionPath = join(dir, "companion.json");
		const outputPath = join(dir, ".harness/learnings/coderabbit.local.json");
		writeFileSync(sourcePath, csv, "utf-8");
		writeFileSync(
			companionPath,
			JSON.stringify({
				schemaVersion: "live-companion/v1",
				provider: "coderabbit",
				evidenceLevel: "coarse_provider_metadata",
				rowLevelEvidence: false,
				sourceLabel: "coderabbit stats",
				stats: { totalLearnings: 1 },
			}),
			"utf-8",
		);
		vi.spyOn(console, "info").mockImplementation(() => undefined);

		const exitCode = runLearningsCLI([
			"import",
			"--provider",
			"coderabbit-csv",
			"--source",
			sourcePath,
			"--repo",
			"coding-harness",
			"--live-companion",
			companionPath,
			"--output",
			outputPath,
			"--json",
		]);

		expect(exitCode).toBe(0);
		const artifact = JSON.parse(readFileSync(outputPath, "utf-8"));
		expect(artifact.source.kind).toBe("coderabbit_csv");
		expect(artifact.items[0].source.kind).toBe("coderabbit_csv");
		expect(artifact.liveCompanion).toMatchObject({
			schemaVersion: "live-companion/v1",
			provider: "coderabbit",
			evidenceLevel: "coarse_provider_metadata",
			rowLevelEvidence: false,
		});
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

	it("accepts multiple --files tokens without dropping later paths", () => {
		const dir = mkdtempSync(join(tmpdir(), "learnings-gate-multi-"));
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
			"README.md",
			"docs/ai-assistant-security-policy.md",
			"--json",
		]);

		expect(exitCode).toBe(1);
		const gateResult = JSON.parse(String(infoSpy.mock.calls.at(-1)?.[0]));
		expect(gateResult.findings[0]).toMatchObject({
			severity: "error",
			path: "docs/ai-assistant-security-policy.md",
		});
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
		const dir = mkdtempSync(join(tmpdir(), "learnings-gate-missing-"));
		cleanup.push(dir);
		const infoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		const exitCode = runLearningsCLI([
			"gate",
			"--source",
			join(dir, "missing-coderabbit.local.json"),
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
			"--enforcement-status",
			join(dir, ".harness/learnings/enforcement-status.empty.json"),
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
			excluded: 1,
			belowThreshold: 1,
			enforcedExcluded: 0,
			explicitlyDeferred: 0,
			enforced: 0,
		});
		expect(result.promotionCandidates[0]).toMatchObject({
			usage: 516,
			promotionStatus: "candidate",
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
		const dir = mkdtempSync(join(tmpdir(), "learnings-import-missing-"));
		cleanup.push(dir);
		vi.spyOn(console, "error").mockImplementation(() => undefined);

		const exitCode = runLearningsCLI([
			"import",
			"--provider",
			"coderabbit-csv",
			"--source",
			join(dir, "not-present-coderabbit.csv"),
			"--repo",
			"coding-harness",
		]);

		expect(exitCode).toBe(1);
	});
});
