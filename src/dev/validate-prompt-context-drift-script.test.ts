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

const REPO_ROOT = process.cwd();
const VALIDATE_SCRIPT = join(
	REPO_ROOT,
	"scripts/validate-prompt-context-drift.cjs",
);
const WRITE_SCRIPT = join(
	REPO_ROOT,
	"scripts/write-prompt-context-drift-report.cjs",
);

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
			errors: ["unexpected positional argument"],
		});
	});

	it("rejects report paths outside the repository", () => {
		const repoRoot = makePromptContextRepo(tempDirs);
		const outsideDir = mkdtempSync(
			join(tmpdir(), "prompt-context-drift-report-outside-"),
		);
		tempDirs.push(outsideDir);
		const outsideReport = join(outsideDir, "report.json");
		writeFileSync(outsideReport, "{}\n", "utf8");

		const result = spawnSync(
			process.execPath,
			[VALIDATE_SCRIPT, outsideReport, "--repo-root", "."],
			{ cwd: repoRoot, encoding: "utf8" },
		);
		const output = JSON.parse(result.stdout) as {
			schemaVersion: string;
			status: string;
			errors: string[];
		};

		expect(result.status).toBe(1);
		expect(output).toEqual({
			schemaVersion: "prompt-context-drift-validation/v1",
			status: "fail",
			errors: ["reportPath: must stay inside the repository"],
		});
	});

	it("accepts absolute report paths that stay inside the repository", () => {
		const result = spawnSync(
			process.execPath,
			[
				VALIDATE_SCRIPT,
				join(
					REPO_ROOT,
					"contracts/examples/prompt-context-drift-report.example.json",
				),
				"--repo-root",
				REPO_ROOT,
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

	it("rejects invalid relative validator repo roots instead of falling back", () => {
		const repoRoot = makePromptContextRepo(tempDirs);

		const result = spawnSync(
			process.execPath,
			[
				VALIDATE_SCRIPT,
				"artifacts/context-integrity/prompt-context-drift-report.json",
				"--repo-root",
				"..",
			],
			{ cwd: repoRoot, encoding: "utf8" },
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
			errors: ["repoRoot: must stay inside the current working directory"],
		});
	});

	it("rejects report symlinks before validating the drift report", () => {
		const repoRoot = makePromptContextRepo(tempDirs);
		const outsideDir = mkdtempSync(
			join(tmpdir(), "prompt-context-drift-report-symlink-"),
		);
		tempDirs.push(outsideDir);
		const outsideReport = join(outsideDir, "report.json");
		writeFileSync(outsideReport, "{}\n", "utf8");
		const reportPath = "artifacts/context-integrity/external-report.json";
		const symlinkPath = join(repoRoot, reportPath);
		mkdirSync(dirname(symlinkPath), { recursive: true });
		symlinkSync(outsideReport, symlinkPath);

		const result = spawnSync(
			process.execPath,
			[VALIDATE_SCRIPT, reportPath, "--repo-root", "."],
			{ cwd: repoRoot, encoding: "utf8" },
		);
		const output = JSON.parse(result.stdout) as {
			schemaVersion: string;
			status: string;
			errors: string[];
		};

		expect(result.status).toBe(1);
		expect(output).toEqual({
			schemaVersion: "prompt-context-drift-validation/v1",
			status: "fail",
			errors: ["reportPath: must not be a symbolic link"],
		});
	});

	it("writes a current prompt-context drift report through the public wrapper", () => {
		const repoRoot = makePromptContextRepo(tempDirs);
		const outputPath =
			"artifacts/context-integrity/prompt-context-drift-report.json";
		const writeResult = spawnSync(
			process.execPath,
			[WRITE_SCRIPT, "--repo-root", ".", "--output", outputPath],
			{ cwd: repoRoot, encoding: "utf8" },
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
			[VALIDATE_SCRIPT, outputPath, "--repo-root", "."],
			{ cwd: repoRoot, encoding: "utf8" },
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

		writeRepoFile(repoRoot, "unreferenced-change.txt", "new head\n");
		runGit(repoRoot, ["add", "unreferenced-change.txt"]);
		runGit(repoRoot, ["commit", "-m", "advance head"]);

		const staleValidateResult = spawnSync(
			process.execPath,
			[VALIDATE_SCRIPT, outputPath, "--repo-root", "."],
			{ cwd: repoRoot, encoding: "utf8" },
		);
		const staleValidateOutput = JSON.parse(staleValidateResult.stdout) as {
			schemaVersion: string;
			status: string;
			errors: string[];
		};

		expect(staleValidateResult.status).toBe(1);
		expect(staleValidateOutput).toEqual({
			schemaVersion: "prompt-context-drift-validation/v1",
			status: "fail",
			errors: ["currentHeadSha: must match live repository HEAD"],
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
			[WRITE_SCRIPT, "--repo-root", ".", "--output", outputPath],
			{ cwd: repoRoot, encoding: "utf8" },
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

	it("rejects invalid relative writer repo roots instead of falling back", () => {
		const repoRoot = makePromptContextRepo(tempDirs);
		const outputPath =
			"artifacts/context-integrity/prompt-context-drift-report.json";
		rmSync(join(repoRoot, outputPath), { force: true });

		const writeResult = spawnSync(
			process.execPath,
			[WRITE_SCRIPT, "--repo-root", "..", "--output", outputPath],
			{ cwd: repoRoot, encoding: "utf8" },
		);
		const writeOutput = JSON.parse(writeResult.stdout) as {
			schemaVersion: string;
			status: string;
			outputPath: string;
			errors: string[];
		};

		expect(writeResult.status).toBe(1);
		expect(writeOutput).toEqual({
			schemaVersion: "prompt-context-drift-write/v1",
			status: "fail",
			outputPath,
			errors: ["writer: setup failed before report generation"],
		});
		expect(() => readFileSync(join(repoRoot, outputPath), "utf8")).toThrow();
	});

	it("returns structured write JSON when setup fails", () => {
		const repoRoot = join(tmpdir(), "prompt-context-drift-missing-repo");
		rmSync(repoRoot, { recursive: true, force: true });

		const writeResult = spawnSync(
			process.execPath,
			[WRITE_SCRIPT, "--repo-root", repoRoot],
			{ encoding: "utf8" },
		);
		const writeOutput = JSON.parse(writeResult.stdout) as {
			schemaVersion: string;
			status: string;
			outputPath: string;
			errors: string[];
		};

		expect(writeResult.status).toBe(1);
		expect(writeOutput).toEqual({
			schemaVersion: "prompt-context-drift-write/v1",
			status: "fail",
			outputPath:
				"artifacts/context-integrity/prompt-context-drift-report.json",
			errors: ["writer: setup failed before report generation"],
		});
	});
});

function makePromptContextRepo(tempDirs: string[]): string {
	const repoRoot = mkdtempSync(join(tmpdir(), "prompt-context-drift-write-"));
	tempDirs.push(repoRoot);
	runGit(repoRoot, ["init"]);
	runGit(repoRoot, ["config", "user.name", "Codex"]);
	runGit(repoRoot, ["config", "user.email", "codex@example.invalid"]);
	writeRepoFile(repoRoot, "AGENTS.md", "# Agents\n");
	writeRepoFile(
		repoRoot,
		".harness/active-artifacts.md",
		[
			"# Active Artifacts",
			"",
			"## Current Active Route",
			"| Status | Artifact | Notes |",
			"| --- | --- | --- |",
			"| Current | `docs/goals/codex-runtime-evidence-verifier-cockpit/current-route.json` | Current active route |",
			"",
			"## Artifact Index",
			"| Artifact | Notes |",
			"| --- | --- |",
			"| `artifacts/runtime-card.json` | Runtime card |",
			"",
		].join("\n"),
	);
	writeRepoFile(
		repoRoot,
		"docs/goals/codex-runtime-evidence-verifier-cockpit/current-route.json",
		"{}\n",
	);
	writeRepoFile(repoRoot, ".harness/memory/LEARNINGS.md", "# Learnings\n");
	writeRepoFile(repoRoot, ".harness/knowledge/INDEX.md", "# Knowledge\n");
	writeRepoFile(repoRoot, "artifacts/runtime-card.json", "{}\n");
	writeRepoFile(repoRoot, "harness.contract.json", "{}\n");
	runGit(repoRoot, ["add", "."]);
	runGit(repoRoot, ["commit", "-m", "seed"]);
	return repoRoot;
}

function runGit(repoRoot: string, args: string[]): void {
	const result = spawnSync("git", args, {
		cwd: repoRoot,
		encoding: "utf8",
	});
	if (result.status !== 0) {
		throw new Error(
			`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`,
		);
	}
}

function writeRepoFile(
	repoRoot: string,
	relativePath: string,
	content: string,
) {
	if (
		relativePath.trim().length === 0 ||
		relativePath.startsWith("/") ||
		relativePath.split(/[\\/]+/).includes("..")
	) {
		throw new Error("Fixture path must stay inside the temporary repository.");
	}
	const fullPath = join(repoRoot, relativePath);
	mkdirSync(dirname(fullPath), { recursive: true });
	writeFileSync(fullPath, content, "utf8");
}
