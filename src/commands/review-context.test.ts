import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
		const reviewContextPath = join(
			dir,
			"artifacts/review-context/pr-context.json",
		);
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
		expect(result.applicableLearnings[0]).toMatchObject({
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

	it("returns usage when files are missing", () => {
		const infoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		expect(runReviewContextCLI(["--json"])).toBe(2);

		const result = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
		expect(result.error.code).toBe("review-context.files_required");
	});
});
