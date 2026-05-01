import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runLearningsCLI } from "./learnings.js";
import { runValidationPlanCLI } from "./validation-plan.js";

const validationCsv = `Repository,File,Pull Request,URL,Usage,Learning,Created By,Last Used,Created At,Updated At
coding-harness,,201,,47,"Applies to src/**: Use pnpm test:ci for CircleCI parity.",jscraik,Never,created,updated
coding-harness,,202,,31,"Applies to src/**: Use pnpm test:deep for runtime or artifact behavior changes.",jscraik,Never,created,updated
coding-harness,,203,,12,"Applies to package.json: Run pnpm audit when dependency surfaces change.",jscraik,Never,created,updated
`;
const sensitiveValidationCsv = `Repository,File,Pull Request,URL,Usage,Learning,Created By,Last Used,Created At,Updated At
coding-harness,,204,,12,"Applies to package.json: Run audit with token=supersecret123 before publishing.",jscraik,Never,created,updated
`;

describe("runValidationPlanCLI", () => {
	const cleanup: string[] = [];
	afterEach(() => {
		for (const path of cleanup.splice(0))
			rmSync(path, { recursive: true, force: true });
		vi.restoreAllMocks();
	});

	it("recommends repo-canonical commands from files and validation learnings", () => {
		const dir = mkdtempSync(join(tmpdir(), "validation-plan-"));
		cleanup.push(dir);
		const sourcePath = join(dir, "learnings.csv");
		const outputPath = join(dir, ".harness/learnings/coderabbit.local.json");
		writeFileSync(sourcePath, validationCsv, "utf-8");
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

		const exitCode = runValidationPlanCLI([
			"--source",
			outputPath,
			"--files",
			"src/cli.ts,package.json",
			"--json",
		]);

		expect(exitCode).toBe(0);
		const result = JSON.parse(String(infoSpy.mock.calls.at(-1)?.[0]));
		expect(result.schemaVersion).toBe("validation-plan/v1");
		expect(
			result.commands.map((entry: { command: string }) => entry.command),
		).toEqual(
			expect.arrayContaining([
				"bash scripts/validate-codestyle.sh --fast",
				"pnpm test:ci",
				"pnpm test:deep",
				"pnpm typecheck",
			]),
		);
		expect(result.networkRequired).toEqual([
			expect.objectContaining({
				command: "pnpm audit",
				learningIds: expect.arrayContaining([
					"coderabbit.coding-harness.learning-run-pnpm-audit-when",
				]),
			}),
		]);
	});

	it("accepts multiple --files tokens without dropping later paths", () => {
		const dir = mkdtempSync(join(tmpdir(), "validation-plan-multi-"));
		cleanup.push(dir);
		const sourcePath = join(dir, "learnings.csv");
		const outputPath = join(dir, ".harness/learnings/coderabbit.local.json");
		writeFileSync(sourcePath, validationCsv, "utf-8");
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

		const exitCode = runValidationPlanCLI([
			"--source",
			outputPath,
			"--files",
			"README.md",
			"src/cli.ts",
			"package.json",
			"--json",
		]);

		expect(exitCode).toBe(0);
		const result = JSON.parse(String(infoSpy.mock.calls.at(-1)?.[0]));
		expect(result.changedFiles).toEqual([
			"README.md",
			"package.json",
			"src/cli.ts",
		]);
		expect(
			result.commands.map((entry: { command: string }) => entry.command),
		).toContain("pnpm test:ci");
		expect(result.networkRequired).toEqual([
			expect.objectContaining({ command: "pnpm audit" }),
		]);
	});

	it("returns usage when files are missing", () => {
		const infoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		expect(runValidationPlanCLI(["--json"])).toBe(2);

		const result = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
		expect(result.error.code).toBe("validation-plan.files_required");
	});

	it("returns usage when an optional source flag is missing its value", () => {
		const infoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		expect(
			runValidationPlanCLI(["--json", "--source", "--files", "src/cli.ts"]),
		).toBe(2);

		const result = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
		expect(result.error.code).toBe("validation-plan.flag_value_required");
	});

	it("redacts learning text in validation reasons and keeps pnpm audit canonical", () => {
		const dir = mkdtempSync(join(tmpdir(), "validation-plan-sensitive-"));
		cleanup.push(dir);
		const sourcePath = join(dir, "learnings.csv");
		const outputPath = join(dir, ".harness/learnings/coderabbit.local.json");
		writeFileSync(sourcePath, sensitiveValidationCsv, "utf-8");
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
			runValidationPlanCLI([
				"--source",
				outputPath,
				"--files",
				"package.json",
				"--json",
			]),
		).toBe(0);

		const result = JSON.parse(String(infoSpy.mock.calls.at(-1)?.[0]));
		expect(JSON.stringify(result)).not.toContain("supersecret123");
		expect(result.networkRequired).toEqual([
			expect.objectContaining({ command: "pnpm audit" }),
		]);
	});
});
