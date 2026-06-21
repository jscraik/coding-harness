import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach } from "vitest";
import { describe, expect, it } from "vitest";

describe("validate-prompt-context-drift script", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const tempDir of tempDirs.splice(0)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("validates the checked-in example through the public script wrapper", () => {
		const result = spawnSync(
			process.execPath,
			[
				"scripts/validate-prompt-context-drift.cjs",
				"contracts/examples/prompt-context-drift-report.example.json",
				"--repo-root",
				".",
			],
			{ encoding: "utf8" },
		);
		const output = JSON.parse(result.stdout) as {
			schemaVersion: string;
			status: string;
			errors: string[];
		};

		expect(result.status).toBe(0);
		expect(output).toEqual({
			schemaVersion: "prompt-context-drift-validation/v1",
			status: "pass",
			errors: [],
		});
	});

	it("returns structured usage JSON when --repo-root has no value", () => {
		const result = spawnSync(
			process.execPath,
			[
				"scripts/validate-prompt-context-drift.cjs",
				"contracts/examples/prompt-context-drift-report.example.json",
				"--repo-root",
			],
			{ encoding: "utf8" },
		);
		const output = JSON.parse(result.stdout) as {
			schemaVersion: string;
			status: string;
			errors: string[];
		};

		expect(result.status).toBe(2);
		expect(output).toEqual({
			schemaVersion: "prompt-context-drift-validation/v1",
			status: "fail",
			errors: ["--repo-root: requires a value"],
		});
	});

	it("returns structured usage JSON for extra positional arguments", () => {
		const result = spawnSync(
			process.execPath,
			[
				"scripts/validate-prompt-context-drift.cjs",
				"contracts/examples/prompt-context-drift-report.example.json",
				"unexpected.json",
			],
			{ encoding: "utf8" },
		);
		const output = JSON.parse(result.stdout) as {
			schemaVersion: string;
			status: string;
			errors: string[];
		};

		expect(result.status).toBe(2);
		expect(output).toEqual({
			schemaVersion: "prompt-context-drift-validation/v1",
			status: "fail",
			errors: ["unexpected.json: unexpected positional argument"],
		});
	});

	it("writes a current prompt-context drift report through the public wrapper", () => {
		const repoRoot = makePromptContextRepo(tempDirs);
		const outputPath =
			"artifacts/context-integrity/prompt-context-drift-report.json";
		const writeResult = spawnSync(
			process.execPath,
			[
				"scripts/write-prompt-context-drift-report.cjs",
				"--repo-root",
				repoRoot,
				"--output",
				outputPath,
			],
			{ encoding: "utf8" },
		);
		const writeOutput = JSON.parse(writeResult.stdout) as {
			schemaVersion: string;
			status: string;
			outputPath: string;
			errors: string[];
		};

		expect(writeResult.status).toBe(0);
		expect(writeOutput).toEqual({
			schemaVersion: "prompt-context-drift-write/v1",
			status: "pass",
			outputPath,
			errors: [],
		});

		const generatedReport = JSON.parse(
			readFileSync(join(repoRoot, outputPath), "utf8"),
		) as {
			schemaVersion: string;
			overallStatus: string;
			surfaces: unknown[];
		};
		expect(generatedReport).toMatchObject({
			schemaVersion: "prompt-context-drift-report/v1",
			overallStatus: "pass",
		});
		expect(generatedReport.surfaces).toHaveLength(7);

		const validateResult = spawnSync(
			process.execPath,
			[
				"scripts/validate-prompt-context-drift.cjs",
				outputPath,
				"--repo-root",
				repoRoot,
			],
			{ encoding: "utf8" },
		);
		const validateOutput = JSON.parse(validateResult.stdout) as {
			schemaVersion: string;
			status: string;
			errors: string[];
		};

		expect(validateResult.status).toBe(0);
		expect(validateOutput).toEqual({
			schemaVersion: "prompt-context-drift-validation/v1",
			status: "pass",
			errors: [],
		});
	});

	it("rejects output symlinks before writing the drift report", () => {
		const repoRoot = makePromptContextRepo(tempDirs);
		const outsideDir = mkdtempSync(
			join(tmpdir(), "prompt-context-drift-outside-"),
		);
		tempDirs.push(outsideDir);
		const outsideFile = join(outsideDir, "outside-report.json");
		writeFileSync(outsideFile, "outside\n", "utf8");
		const outputPath =
			"artifacts/context-integrity/prompt-context-drift-report.json";
		const symlinkPath = join(repoRoot, outputPath);
		mkdirSync(dirname(symlinkPath), { recursive: true });
		symlinkSync(outsideFile, symlinkPath);

		const writeResult = spawnSync(
			process.execPath,
			[
				"scripts/write-prompt-context-drift-report.cjs",
				"--repo-root",
				repoRoot,
				"--output",
				outputPath,
			],
			{ encoding: "utf8" },
		);
		const writeOutput = JSON.parse(writeResult.stdout) as {
			schemaVersion: string;
			status: string;
			outputPath: string;
			errors: string[];
		};

		expect(writeResult.status).toBe(2);
		expect(writeOutput).toEqual({
			schemaVersion: "prompt-context-drift-write/v1",
			status: "fail",
			outputPath,
			errors: ["--output: must not be a symbolic link"],
		});
		expect(readFileSync(outsideFile, "utf8")).toBe("outside\n");
	});
});

function makePromptContextRepo(tempDirs: string[]): string {
	const repoRoot = mkdtempSync(join(tmpdir(), "prompt-context-drift-write-"));
	tempDirs.push(repoRoot);
	spawnSync("git", ["init"], { cwd: repoRoot, encoding: "utf8" });
	spawnSync("git", ["config", "user.name", "Codex"], {
		cwd: repoRoot,
		encoding: "utf8",
	});
	spawnSync("git", ["config", "user.email", "codex@example.invalid"], {
		cwd: repoRoot,
		encoding: "utf8",
	});
	writeRepoFile(repoRoot, "AGENTS.md", "# Agents\n");
	writeRepoFile(repoRoot, ".harness/active-artifacts.md", "# Active\n");
	writeRepoFile(
		repoRoot,
		"docs/goals/codex-runtime-evidence-verifier-cockpit/current-route.json",
		"{}\n",
	);
	writeRepoFile(repoRoot, ".harness/memory/LEARNINGS.md", "# Learnings\n");
	writeRepoFile(repoRoot, ".harness/knowledge/INDEX.md", "# Knowledge\n");
	writeRepoFile(repoRoot, "artifacts/runtime-card.json", "{}\n");
	writeRepoFile(repoRoot, "harness.contract.json", "{}\n");
	spawnSync("git", ["add", "."], { cwd: repoRoot, encoding: "utf8" });
	spawnSync("git", ["commit", "-m", "seed"], {
		cwd: repoRoot,
		encoding: "utf8",
	});
	return repoRoot;
}

function writeRepoFile(
	repoRoot: string,
	relativePath: string,
	content: string,
) {
	const fullPath = join(repoRoot, relativePath);
	mkdirSync(dirname(fullPath), { recursive: true });
	writeFileSync(fullPath, content, "utf8");
}
