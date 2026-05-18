import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	buildPatternScopeArtifact,
	runPatternScopeCLI,
} from "./pattern-scope.js";

describe("pattern-scope command", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const tempDir of tempDirs.splice(0)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
		vi.restoreAllMocks();
	});

	function makeRepo(): string {
		const repoRoot = mkdtempSync(join(tmpdir(), "pattern-scope-"));
		tempDirs.push(repoRoot);
		mkdirSync(join(repoRoot, "src/commands"), { recursive: true });
		mkdirSync(join(repoRoot, "docs"), { recursive: true });
		mkdirSync(join(repoRoot, ".harness/knowledge"), { recursive: true });
		writeFileSync(
			join(repoRoot, "src/commands/widget.ts"),
			"export const widget = true;\n",
			"utf8",
		);
		writeFileSync(
			join(repoRoot, "src/commands/widget.test.ts"),
			"import { widget } from './widget';\n",
			"utf8",
		);
		writeFileSync(
			join(repoRoot, "src/commands/gadget.ts"),
			"export const gadget = true;\n",
			"utf8",
		);
		writeFileSync(
			join(repoRoot, "docs/widget.md"),
			"The widget command mirrors the implementation.\n",
			"utf8",
		);
		writeFileSync(
			join(repoRoot, ".harness/knowledge/widget.md"),
			"The ignored knowledge snapshot mentions widget.\n",
			"utf8",
		);
		return repoRoot;
	}

	it("builds a pattern-scope artifact with sibling candidates", () => {
		const repoRoot = makeRepo();

		const artifact = buildPatternScopeArtifact({
			repoRoot,
			files: ["src/commands/widget.ts"],
			feedback:
				"Codex should consider the larger perspective and apply the same things in multiple places.",
		});

		expect(artifact.status).toBe("success");
		if (artifact.status !== "success") throw new Error("expected success");
		expect(artifact.schemaVersion).toBe("pattern-scope/v1");
		expect(artifact.triggered).toBe(true);
		expect(artifact.triggerPhrases).toContain("same things in multiple places");
		expect(artifact.triggerPhrases).toContain("larger perspective");
		expect(artifact.scanningTruncated).toBe(false);
		expect(artifact.totalFilesScanned).toBeGreaterThan(0);
		expect(artifact.candidateSiblings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					file: "src/commands/widget.test.ts",
				}),
				expect.objectContaining({
					file: "docs/widget.md",
				}),
			]),
		);
		expect(artifact.candidateSiblings).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					file: ".harness/knowledge/widget.md",
				}),
			]),
		);
		expect(artifact.searchCommands.join("\n")).toContain("rg -n");
	});

	it("reports when sibling discovery reached the scan limit", () => {
		const repoRoot = makeRepo();
		mkdirSync(join(repoRoot, "src/many"), { recursive: true });
		for (let index = 0; index < 3000; index += 1) {
			writeFileSync(
				join(repoRoot, "src/many", `candidate-${index}.ts`),
				"export const candidate = true;\n",
				"utf8",
			);
		}

		const artifact = buildPatternScopeArtifact({
			repoRoot,
			files: ["src/commands/widget.ts"],
			feedback: "apply this everywhere relevant",
		});

		expect(artifact.status).toBe("success");
		if (artifact.status !== "success") throw new Error("expected success");
		expect(artifact.scanningTruncated).toBe(true);
		expect(artifact.totalFilesScanned).toBe(3000);
	});

	it("treats PR-template pattern-scope phrases as trigger signals", () => {
		const repoRoot = makeRepo();

		const artifact = buildPatternScopeArtifact({
			repoRoot,
			files: ["src/commands/widget.ts"],
			feedback:
				"This is a class of misbehavior with similar misbehavior and line-level design feedback.",
		});

		expect(artifact.status).toBe("success");
		if (artifact.status !== "success") throw new Error("expected success");
		expect(artifact.triggered).toBe(true);
		expect(artifact.triggerPhrases).toEqual(
			expect.arrayContaining([
				"class of misbehavior",
				"similar misbehavior",
				"line-level design feedback",
			]),
		);
		expect(
			artifact.searchCommands.some((command) =>
				command.startsWith('rg -F -n "This is a class of misbehavior'),
			),
		).toBe(true);
	});

	it("writes the artifact when --output is provided", () => {
		const repoRoot = makeRepo();
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runPatternScopeCLI([
			"--repo-root",
			repoRoot,
			"--files",
			"src/commands/widget.ts",
			"--feedback",
			"apply this everywhere relevant",
			"--output",
			"artifacts/pattern-scope/pattern-scope.json",
			"--json",
		]);

		expect(exitCode).toBe(0);
		const outputPath = join(
			repoRoot,
			"artifacts/pattern-scope/pattern-scope.json",
		);
		const written = JSON.parse(readFileSync(outputPath, "utf8")) as {
			schemaVersion: string;
			outputPath: string;
		};
		expect(written.schemaVersion).toBe("pattern-scope/v1");
		expect(written.outputPath).toBe(
			"artifacts/pattern-scope/pattern-scope.json",
		);
		expect(String(infoSpy.mock.calls[0]?.[0])).toContain(
			'"schemaVersion": "pattern-scope/v1"',
		);
	});

	it("rejects output paths outside the repo root", () => {
		const repoRoot = makeRepo();

		const artifact = buildPatternScopeArtifact({
			repoRoot,
			files: ["src/commands/widget.ts"],
			feedback: "apply this everywhere relevant",
			output: "../escaped.json",
		});

		expect(artifact).toEqual({
			schemaVersion: "pattern-scope/v1",
			status: "error",
			error: {
				code: "pattern-scope.output_outside_repo",
				message: "Output path must stay inside repo root: ../escaped.json",
			},
		});
	});

	it("returns usage errors when optional flags are missing values", () => {
		const flagCases = ["--feedback", "--output", "--repo-root"];

		for (const flag of flagCases) {
			const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

			const exitCode = runPatternScopeCLI([
				"--files",
				"src/commands/widget.ts",
				flag,
				"--json",
			]);

			expect(exitCode).toBe(2);
			expect(String(infoSpy.mock.calls[0]?.[0])).toContain(
				"pattern-scope.flag_value_required",
			);
			expect(String(infoSpy.mock.calls[0]?.[0])).toContain(flag);
			infoSpy.mockRestore();
		}
	});

	it("returns failure when CLI artifact output escapes the repo root", () => {
		const repoRoot = makeRepo();
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runPatternScopeCLI([
			"--repo-root",
			repoRoot,
			"--files",
			"src/commands/widget.ts",
			"--feedback",
			"apply this everywhere relevant",
			"--output",
			"../escaped.json",
			"--json",
		]);

		expect(exitCode).toBe(1);
		expect(String(infoSpy.mock.calls[0]?.[0])).toContain(
			"pattern-scope.output_outside_repo",
		);
	});

	it("prints human-readable errors for CLI artifact build failures", () => {
		const repoRoot = makeRepo();
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const exitCode = runPatternScopeCLI([
			"--repo-root",
			repoRoot,
			"--files",
			"src/commands/widget.ts",
			"--feedback",
			"apply this everywhere relevant",
			"--output",
			"../escaped.json",
		]);

		expect(exitCode).toBe(1);
		expect(String(errorSpy.mock.calls[0]?.[0])).toContain(
			"Output path must stay inside repo root",
		);
	});

	it("rejects changed files outside the repo root", () => {
		const repoRoot = makeRepo();

		const artifact = buildPatternScopeArtifact({
			repoRoot,
			files: ["../outside.ts"],
			feedback: "apply this everywhere relevant",
		});

		expect(artifact).toEqual({
			schemaVersion: "pattern-scope/v1",
			status: "error",
			error: {
				code: "pattern-scope.file_outside_repo",
				message: "Changed files must stay inside repo root: ../outside.ts",
			},
		});
	});

	it("returns a structured error when repo root is a file", () => {
		const repoRoot = makeRepo();
		const filePath = join(repoRoot, "src/commands/widget.ts");

		const artifact = buildPatternScopeArtifact({
			repoRoot: filePath,
			files: ["src/commands/widget.ts"],
			feedback: "apply this everywhere relevant",
		});

		expect(artifact).toEqual({
			schemaVersion: "pattern-scope/v1",
			status: "error",
			error: {
				code: "pattern-scope.repo_not_directory",
				message: `Repo root must be a directory: ${filePath}`,
			},
		});
	});

	it("returns usage error when files are missing", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runPatternScopeCLI(["--json"]);

		expect(exitCode).toBe(2);
		expect(String(infoSpy.mock.calls[0]?.[0])).toContain(
			"pattern-scope.files_required",
		);
	});
});
