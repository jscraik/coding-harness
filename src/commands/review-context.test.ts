import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runLearningsCLI } from "./learnings.js";
import { runReviewContextCLI } from "./review-context.js";

const contextCsv = `Repository,File,Pull Request,URL,Usage,Learning,Created By,Last Used,Created At,Updated At
coding-harness,docs/ai-assistant-security-policy.md,148,,516,"YAML frontmatter fields are machine-readable metadata.",jscraik,Never,created,updated
coding-harness,,201,,47,"Applies to docs/**: Use pnpm test:ci for CircleCI parity when policy docs change.",jscraik,Never,created,updated
`;

describe("runReviewContextCLI", () => {
	const cleanup: string[] = [];
	afterEach(() => {
		for (const path of cleanup.splice(0))
			rmSync(path, { recursive: true, force: true });
		vi.restoreAllMocks();
	});

	it("emits applicable learnings with validation-plan entries and writes output", () => {
		const dir = mkdtempSync(join(tmpdir(), "review-context-"));
		cleanup.push(dir);
		const sourcePath = join(dir, "learnings.csv");
		const outputPath = join(dir, ".harness/learnings/coderabbit.local.json");
		const enforcementStatusPath = join(
			dir,
			".harness/learnings/enforcement-status.json",
		);
		const reviewContextPath = join(
			dir,
			"artifacts/review-context/pr-context.json",
		);
		writeFileSync(sourcePath, contextCsv, "utf-8");
		mkdirSync(join(dir, ".harness/learnings"), { recursive: true });
		writeFileSync(
			enforcementStatusPath,
			JSON.stringify(
				{
					schemaVersion: "learning-enforcement-status/v1",
					items: [
						{
							learningId:
								"coderabbit.coding-harness.docs-frontmatter-machine-readable",
							promotionStatus: "enforced",
							enforcedBy: [
								"src/lib/docs-surface/frontmatter-metadata-gate.ts",
								"src/lib/docs-surface/frontmatter-metadata-gate.test.ts",
							],
							reason: "Promoted to validator.",
						},
					],
				},
				null,
				2,
			),
			"utf-8",
		);
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

		const exitCode = runReviewContextCLI([
			"--source",
			outputPath,
			"--repo-root",
			dir,
			"--enforcement-status",
			".harness/learnings/enforcement-status.json",
			"--files",
			"docs/ai-assistant-security-policy.md",
			"--output",
			reviewContextPath,
			"--json",
		]);

		expect(exitCode).toBe(0);
		expect(existsSync(reviewContextPath)).toBe(true);
		const result = JSON.parse(String(infoSpy.mock.calls.at(-1)?.[0]));
		expect(result.schemaVersion).toBe("review-context/v1");
		expect(result.outputPath).toBe(reviewContextPath);
		const frontmatterLearning = result.applicableLearnings.find(
			(learning: { id: string }) =>
				learning.id ===
				"coderabbit.coding-harness.docs-frontmatter-machine-readable",
		);
		expect(frontmatterLearning).toMatchObject({
			id: "coderabbit.coding-harness.docs-frontmatter-machine-readable",
			usage: 516,
			promotionStatus: "enforced",
			matchedFiles: ["docs/ai-assistant-security-policy.md"],
		});
		expect(
			result.validationPlan.map((entry: { command: string }) => entry.command),
		).toEqual(
			expect.arrayContaining([
				"bash scripts/run-harness-gate.sh docs-gate --mode required --json",
				"pnpm test:ci",
			]),
		);
		expect(JSON.parse(readFileSync(reviewContextPath, "utf-8"))).toMatchObject({
			schemaVersion: "review-context/v1",
			summary: {
				applicableLearnings: 2,
			},
		});
	});

	it("accepts repeated --files tokens without dropping later paths", () => {
		const dir = mkdtempSync(join(tmpdir(), "review-context-multi-"));
		cleanup.push(dir);
		const sourcePath = join(dir, "learnings.csv");
		const outputPath = join(dir, ".harness/learnings/coderabbit.local.json");
		writeFileSync(sourcePath, contextCsv, "utf-8");
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

		const exitCode = runReviewContextCLI([
			"--source",
			outputPath,
			"--files",
			"README.md",
			"--files",
			"docs/ai-assistant-security-policy.md",
			"--json",
		]);

		expect(exitCode).toBe(0);
		const result = JSON.parse(String(infoSpy.mock.calls.at(-1)?.[0]));
		expect(result.changedFiles).toEqual([
			"README.md",
			"docs/ai-assistant-security-policy.md",
		]);
		expect(
			result.applicableLearnings.map((learning: { id: string }) => learning.id),
		).toContain("coderabbit.coding-harness.docs-frontmatter-machine-readable");
	});

	it("rejects output paths that escape repoRoot", () => {
		const dir = mkdtempSync(join(tmpdir(), "review-context-output-"));
		cleanup.push(dir);
		const sourcePath = join(dir, "learnings.csv");
		const outputPath = join(dir, ".harness/learnings/coderabbit.local.json");
		const outsideFile = `review-context-${basename(dir)}.json`;
		const outsideTarget = join(dir, "..", outsideFile);
		cleanup.push(outsideTarget);
		rmSync(outsideTarget, { force: true });
		writeFileSync(sourcePath, contextCsv, "utf-8");
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

		expect(
			runReviewContextCLI([
				"--source",
				outputPath,
				"--repo-root",
				dir,
				"--files",
				"docs/ai-assistant-security-policy.md",
				"--output",
				`../${outsideFile}`,
				"--json",
			]),
		).toBe(1);

		const result = JSON.parse(String(infoSpy.mock.calls.at(-1)?.[0]));
		expect(result.status).toBe("error");
		expect(result.error).toMatchObject({
			code: "review-context.write_failed",
			message:
				"Failed to write review context: output must stay within repoRoot.",
		});
		expect(existsSync(outsideTarget)).toBe(false);
	});

	it("rejects output paths that escape repoRoot through symlinked ancestors", () => {
		const dir = mkdtempSync(join(tmpdir(), "review-context-symlink-"));
		const outsideDir = mkdtempSync(join(tmpdir(), "review-context-outside-"));
		cleanup.push(dir, outsideDir);
		const sourcePath = join(dir, "learnings.csv");
		const outputPath = join(dir, ".harness/learnings/coderabbit.local.json");
		writeFileSync(sourcePath, contextCsv, "utf-8");
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
		symlinkSync(outsideDir, join(dir, "artifacts"), "dir");
		const infoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		expect(
			runReviewContextCLI([
				"--source",
				outputPath,
				"--repo-root",
				dir,
				"--files",
				"docs/ai-assistant-security-policy.md",
				"--output",
				"artifacts/review-context/pr-context.json",
				"--json",
			]),
		).toBe(1);

		const result = JSON.parse(String(infoSpy.mock.calls.at(-1)?.[0]));
		expect(result.status).toBe("error");
		expect(result.error).toMatchObject({
			code: "review-context.write_failed",
			message:
				"Failed to write review context: output must stay within repoRoot.",
		});
		expect(existsSync(join(outsideDir, "review-context/pr-context.json"))).toBe(
			false,
		);
	});

	it("returns usage when files are missing", () => {
		const infoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		expect(runReviewContextCLI(["--json"])).toBe(2);

		const result = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
		expect(result.error.code).toBe("review-context.files_required");
	});

	it("returns usage when files are blank", () => {
		const infoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		expect(runReviewContextCLI(["--json", "--files", " ,  "])).toBe(2);

		const result = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
		expect(result.error.code).toBe("review-context.files_required");
	});

	it("returns usage when an optional flag is missing its value", () => {
		const infoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		expect(
			runReviewContextCLI(["--json", "--source", "--files", "docs/policy.md"]),
		).toBe(2);

		const result = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
		expect(result.error.code).toBe("review-context.flag_value_required");
	});

	it("propagates validation-plan failures instead of emitting success context", () => {
		const infoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		expect(
			runReviewContextCLI([
				"--source",
				join(tmpdir(), "missing-coderabbit.local.json"),
				"--files",
				"docs/policy.md",
				"--json",
			]),
		).toBe(1);

		const result = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
		expect(result.status).toBe("error");
		expect(result.validationPlan).toEqual([]);
	});
});
