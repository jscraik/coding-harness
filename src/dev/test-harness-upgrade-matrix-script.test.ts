import { spawnSync } from "node:child_process";
import {
	cpSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sanitizeGitEnv } from "../lib/workflow-contract/test-harness.js";

const SCRIPT_PATH = resolve("scripts/test-harness-upgrade-matrix.mjs");
const CODESTYLE_SOURCE_DIR = resolve("codestyle");
const CODESTYLE_SOURCE_FILE = resolve("CODESTYLE.md");
const VALID_DRY_RUN_RESULT = {
	packageManager: "npm",
	updated: [
		"harness.contract.json",
		".coderabbit.yaml",
		".circleci/config.yml",
		".harness/ci-required-checks.json",
		"scripts/check-semgrep-changed.sh",
		".harness/knowledge/INDEX.md",
		"CODESTYLE.md",
		"codestyle/CHECKSUMS.sha256",
	],
	created: [
		"harness.contract.json",
		".coderabbit.yaml",
		".circleci/config.yml",
		".harness/ci-required-checks.json",
		"scripts/check-semgrep-changed.sh",
		".harness/knowledge/INDEX.md",
		"CODESTYLE.md",
		"codestyle/CHECKSUMS.sha256",
	],
	skipped: [],
	updateMode: "adoption-preview",
	trackedManifest: false,
};

function runGit(repo: string, args: string[]): void {
	const result = spawnSync("git", args, {
		cwd: repo,
		encoding: "utf8",
		env: sanitizeGitEnv(),
	});
	if (result.status !== 0) {
		throw new Error(result.stderr || result.stdout);
	}
}

function writeFakeCli(path: string, body: string): void {
	writeFileSync(path, `#!/usr/bin/env node\n${body}\n`);
}

function writeValidDryRunFakeCli(path: string, prefix = ""): void {
	writeFakeCli(
		path,
		`${prefix}console.log(JSON.stringify(${JSON.stringify(VALID_DRY_RUN_RESULT)}));`,
	);
}

function installCanonicalCodestyle(repo: string): void {
	writeFileSync(
		join(repo, "CODESTYLE.md"),
		readFileSync(CODESTYLE_SOURCE_FILE, "utf8"),
	);
	cpSync(CODESTYLE_SOURCE_DIR, join(repo, "codestyle"), { recursive: true });
}

describe("test-harness-upgrade-matrix", () => {
	let tempDir: string;
	let repoDir: string;
	let fakeCliPath: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "harness-upgrade-matrix-"));
		repoDir = join(tempDir, "repo");
		fakeCliPath = join(tempDir, "fake-cli.js");
		mkdirSync(repoDir, { recursive: true });
		runGit(repoDir, ["init"]);
		installCanonicalCodestyle(repoDir);
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("passes when update dry-run emits valid JSON and leaves git status unchanged", () => {
		writeValidDryRunFakeCli(fakeCliPath);

		const result = spawnSync(
			process.execPath,
			[SCRIPT_PATH, "--cli", fakeCliPath, "--json", repoDir],
			{ encoding: "utf8" },
		);

		expect(result.status).toBe(0);
		const report = JSON.parse(result.stdout) as {
			pass: boolean;
			results: Array<{
				createdAliasMatchesUpdated: boolean;
				updateMode: string;
				trackedManifest: boolean;
				missingCriticalGroups: string[];
				criticalSurfaces: Record<string, string>;
			}>;
		};
		expect(report.pass).toBe(true);
		expect(report.results[0]?.createdAliasMatchesUpdated).toBe(true);
		expect(report.results[0]?.updateMode).toBe("adoption-preview");
		expect(report.results[0]?.trackedManifest).toBe(false);
		expect(report.results[0]?.missingCriticalGroups).toEqual([]);
		expect(report.results[0]?.criticalSurfaces[".coderabbit.yaml"]).toBe(
			"updated",
		);
	});

	it("fails when dry-run mutates the target repository", () => {
		writeValidDryRunFakeCli(
			fakeCliPath,
			`const fs = require("node:fs");
			const path = require("node:path");
			const repo = process.argv[3];
			fs.writeFileSync(path.join(repo, "mutated.txt"), "changed");`,
		);

		const result = spawnSync(
			process.execPath,
			[SCRIPT_PATH, "--cli", fakeCliPath, "--json", repoDir],
			{ encoding: "utf8" },
		);

		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout) as {
			pass: boolean;
			results: Array<{
				statusChangedByDryRun: boolean;
				errors: string[];
			}>;
		};
		expect(report.pass).toBe(false);
		expect(report.results[0]?.statusChangedByDryRun).toBe(true);
		expect(report.results[0]?.errors).toContain(
			"git status changed during dry-run",
		);
		expect(readFileSync(join(repoDir, "mutated.txt"), "utf8")).toBe("changed");
	});

	it("materializes non-git fixtures before checking dry-run status", () => {
		const fixtureDir = join(tempDir, "fixture");
		mkdirSync(fixtureDir, { recursive: true });
		writeFileSync(join(fixtureDir, "package.json"), '{"name":"fixture"}');
		installCanonicalCodestyle(fixtureDir);
		writeValidDryRunFakeCli(fakeCliPath);

		const result = spawnSync(
			process.execPath,
			[SCRIPT_PATH, "--cli", fakeCliPath, "--json", fixtureDir],
			{ encoding: "utf8" },
		);

		expect(result.status).toBe(0);
		const report = JSON.parse(result.stdout) as {
			pass: boolean;
			results: Array<{
				materializedFixture: boolean;
				repo: string;
				executionRepo: string;
			}>;
		};
		expect(report.pass).toBe(true);
		expect(report.results[0]?.materializedFixture).toBe(true);
		expect(report.results[0]?.repo).toBe(resolve(fixtureDir));
		expect(report.results[0]?.executionRepo).not.toBe(resolve(fixtureDir));
	});

	it("fails when dry-run JSON omits critical governance surface groups", () => {
		writeFakeCli(
			fakeCliPath,
			`console.log(JSON.stringify({
				packageManager: "npm",
				updated: ["harness.contract.json"],
				created: ["harness.contract.json"],
				skipped: [],
				updateMode: "tracked-update",
				trackedManifest: true
			}));`,
		);

		const result = spawnSync(
			process.execPath,
			[SCRIPT_PATH, "--cli", fakeCliPath, "--json", repoDir],
			{ encoding: "utf8" },
		);

		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout) as {
			pass: boolean;
			results: Array<{
				missingCriticalGroups: string[];
				errors: string[];
			}>;
		};
		expect(report.pass).toBe(false);
		expect(report.results[0]?.missingCriticalGroups).toEqual(
			expect.arrayContaining(["code-review", "ci", "project-brain"]),
		);
		expect(report.results[0]?.errors).toEqual(
			expect.arrayContaining([
				"JSON output missing critical governance surface group: code-review",
			]),
		);
	});

	it("returns usage error when no repository paths are provided", () => {
		const result = spawnSync(process.execPath, [SCRIPT_PATH, "--json"], {
			encoding: "utf8",
		});

		expect(result.status).toBe(2);
		expect(result.stderr).toContain("At least one repository path is required");
	});

	it("accepts the package-script argument separator", () => {
		writeFakeCli(
			fakeCliPath,
			`console.log(JSON.stringify({
				packageManager: "npm",
				updated: [
					"harness.contract.json",
					".coderabbit.yaml",
					".circleci/config.yml",
					".harness/ci-required-checks.json",
					"scripts/check-semgrep-changed.sh",
					".harness/knowledge/INDEX.md",
					"CODESTYLE.md",
					"codestyle/CHECKSUMS.sha256"
				],
				created: [
					"harness.contract.json",
					".coderabbit.yaml",
					".circleci/config.yml",
					".harness/ci-required-checks.json",
					"scripts/check-semgrep-changed.sh",
					".harness/knowledge/INDEX.md",
					"CODESTYLE.md",
					"codestyle/CHECKSUMS.sha256"
				],
				skipped: [],
				updateMode: "tracked-update",
				trackedManifest: true
			}));`,
		);

		const result = spawnSync(
			process.execPath,
			[SCRIPT_PATH, "--", "--cli", fakeCliPath, "--json", repoDir],
			{ encoding: "utf8" },
		);

		expect(result.status).toBe(0);
	});

	it("fails when the dry-run reports GitHub Actions but not CircleCI", () => {
		writeFakeCli(
			fakeCliPath,
			`console.log(JSON.stringify({
				packageManager: "npm",
				updated: [
					"harness.contract.json",
					".coderabbit.yaml",
					".github/workflows/pr-pipeline.yml",
					".harness/ci-required-checks.json",
					"scripts/check-semgrep-changed.sh",
					".harness/knowledge/INDEX.md",
					"CODESTYLE.md",
					"codestyle/CHECKSUMS.sha256"
				],
				created: [
					"harness.contract.json",
					".coderabbit.yaml",
					".github/workflows/pr-pipeline.yml",
					".harness/ci-required-checks.json",
					"scripts/check-semgrep-changed.sh",
					".harness/knowledge/INDEX.md",
					"CODESTYLE.md",
					"codestyle/CHECKSUMS.sha256"
				],
				skipped: [],
				updateMode: "tracked-update",
				trackedManifest: true
			}));`,
		);

		const result = spawnSync(
			process.execPath,
			[SCRIPT_PATH, "--cli", fakeCliPath, "--json", repoDir],
			{ encoding: "utf8" },
		);

		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout) as {
			pass: boolean;
			results: Array<{
				missingFleetContractSurfaces: Array<{
					group: string;
					path: string;
				}>;
				errors: string[];
			}>;
		};
		expect(report.pass).toBe(false);
		expect(report.results[0]?.missingFleetContractSurfaces).toContainEqual({
			group: "circleci",
			path: ".circleci/config.yml",
			fix: expect.any(String),
		});
		expect(report.results[0]?.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining(
					"fleet contract missing circleci surface .circleci/config.yml",
				),
			]),
		);
		expect(report.results[0]?.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining("harness ci-migrate prepare <repo>"),
			]),
		);
	});

	it("recommends first adoption when an untracked repo is missing CircleCI", () => {
		writeFakeCli(
			fakeCliPath,
			`console.log(JSON.stringify({
				packageManager: "npm",
				updated: [],
				created: [],
				skipped: [],
				updateMode: "adoption-preview",
				trackedManifest: false
			}));`,
		);

		const result = spawnSync(
			process.execPath,
			[SCRIPT_PATH, "--cli", fakeCliPath, "--json", repoDir],
			{ encoding: "utf8" },
		);

		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout) as {
			pass: boolean;
			results: Array<{
				missingFleetContractSurfaces: Array<{
					group: string;
					path: string;
					fix: string;
				}>;
			}>;
		};
		expect(report.pass).toBe(false);
		expect(report.results[0]?.missingFleetContractSurfaces).toContainEqual({
			group: "circleci",
			path: ".circleci/config.yml",
			fix: expect.stringContaining("harness init <repo> --dry-run --json"),
		});
	});

	it("fails when CODESTYLE pack surfaces are absent", () => {
		writeFakeCli(
			fakeCliPath,
			`console.log(JSON.stringify({
				packageManager: "npm",
				updated: [
					"harness.contract.json",
					".coderabbit.yaml",
					".circleci/config.yml",
					".harness/ci-required-checks.json",
					"scripts/check-semgrep-changed.sh",
					".harness/knowledge/INDEX.md"
				],
				created: [
					"harness.contract.json",
					".coderabbit.yaml",
					".circleci/config.yml",
					".harness/ci-required-checks.json",
					"scripts/check-semgrep-changed.sh",
					".harness/knowledge/INDEX.md"
				],
				skipped: [],
				updateMode: "tracked-update",
				trackedManifest: true
			}));`,
		);

		const result = spawnSync(
			process.execPath,
			[SCRIPT_PATH, "--cli", fakeCliPath, "--json", repoDir],
			{ encoding: "utf8" },
		);

		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout) as {
			pass: boolean;
			results: Array<{
				missingFleetContractSurfaces: Array<{
					group: string;
					path: string;
				}>;
				errors: string[];
			}>;
		};
		expect(report.pass).toBe(false);
		expect(report.results[0]?.missingFleetContractSurfaces).toEqual(
			expect.arrayContaining([
				{
					group: "codestyle",
					path: "CODESTYLE.md",
					fix: expect.any(String),
				},
				{
					group: "codestyle",
					path: "codestyle/CHECKSUMS.sha256",
					fix: expect.any(String),
				},
			]),
		);
		expect(report.results[0]?.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining(
					"fleet contract missing codestyle surface CODESTYLE.md",
				),
			]),
		);
	});

	it("fails when CODESTYLE pack is present but stale", () => {
		writeFileSync(join(repoDir, "codestyle/17-testing.md"), "stale guidance\n");
		writeValidDryRunFakeCli(fakeCliPath);

		const result = spawnSync(
			process.execPath,
			[SCRIPT_PATH, "--cli", fakeCliPath, "--json", repoDir],
			{ encoding: "utf8" },
		);

		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout) as {
			pass: boolean;
			results: Array<{
				codestyleParityFailures: Array<{
					path: string;
					reason: string;
					actualSha256: string | null;
				}>;
				errors: string[];
			}>;
		};
		expect(report.pass).toBe(false);
		expect(report.results[0]?.codestyleParityFailures).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "codestyle/17-testing.md",
					reason: "hash-mismatch",
					actualSha256: expect.any(String),
				}),
			]),
		);
		expect(report.results[0]?.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining(
					"codestyle parity mismatch: 1 file(s) (0 missing, 1 hash-mismatch)",
				),
			]),
		);
	});

	it("fails when legacy Greptile artifacts are present", () => {
		mkdirSync(join(repoDir, ".github/workflows"), { recursive: true });
		writeFileSync(join(repoDir, ".github/workflows/greptile-review.yml"), "");
		writeValidDryRunFakeCli(fakeCliPath);

		const result = spawnSync(
			process.execPath,
			[SCRIPT_PATH, "--cli", fakeCliPath, "--json", repoDir],
			{ encoding: "utf8" },
		);

		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout) as {
			pass: boolean;
			results: Array<{
				legacyGreptilePaths: string[];
				errors: string[];
			}>;
		};
		expect(report.pass).toBe(false);
		expect(report.results[0]?.legacyGreptilePaths).toContain(
			".github/workflows/greptile-review.yml",
		);
		expect(report.results[0]?.errors).toContain(
			"legacy Greptile artifact still present: .github/workflows/greptile-review.yml; remove via harness-managed migration/eject cleanup before live upgrade",
		);
	});
});
