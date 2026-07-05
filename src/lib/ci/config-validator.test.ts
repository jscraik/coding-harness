import {
	existsSync,
	mkdtempSync,
	mkdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { validateCIConfigSyntax } from "./config-validator.js";

function makeTmpDir(): string {
	return mkdtempSync(join(tmpdir(), "ci-config-validator-test-"));
}

describe("validateCIConfigSyntax", () => {
	let dir: string;

	beforeEach(() => {
		dir = makeTmpDir();
	});

	afterEach(() => {
		if (existsSync(dir)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	// ─── CircleCI ────────────────────────────────────────────────────────────

	describe("circleci provider", () => {
		it("returns no violations for a valid minimal CircleCI config", () => {
			const circlePath = join(dir, ".circleci");
			mkdirSync(circlePath, { recursive: true });
			writeFileSync(
				join(circlePath, "config.yml"),
				[
					"version: 2.1",
					"",
					"jobs:",
					"  build:",
					"    machine: true",
					"    steps:",
					"      - run: echo hello",
				].join("\n"),
			);

			const violations = validateCIConfigSyntax(dir, "circleci");
			expect(violations).toHaveLength(0);
		});

		it("returns violation when CircleCI config is missing entirely", () => {
			const violations = validateCIConfigSyntax(dir, "circleci");
			expect(violations).toHaveLength(1);
			expect(violations[0]!.message).toContain("not found");
		});

		it("returns violation when config uses forbidden 'defaults:' top-level key (trace-narrative bug)", () => {
			// This is the exact bug that caused silent CircleCI failures
			const circlePath = join(dir, ".circleci");
			mkdirSync(circlePath, { recursive: true });
			writeFileSync(
				join(circlePath, "config.yml"),
				[
					"defaults: &defaults",
					"  working_directory: /app",
					"",
					"version: 2.1",
					"",
					"jobs:",
					"  build:",
					"    machine: true",
				].join("\n"),
			);

			const violations = validateCIConfigSyntax(dir, "circleci");
			expect(violations.length).toBeGreaterThan(0);
			const defaultsViolation = violations.find((v) =>
				v.message.includes("defaults"),
			);
			expect(defaultsViolation).toBeDefined();
			expect(defaultsViolation!.message).toContain("invalid top-level key");
		});

		it("returns violation when 'version:' key is missing", () => {
			const circlePath = join(dir, ".circleci");
			mkdirSync(circlePath, { recursive: true });
			writeFileSync(
				join(circlePath, "config.yml"),
				["jobs:", "  build:", "    machine: true"].join("\n"),
			);

			const violations = validateCIConfigSyntax(dir, "circleci");
			const versionViolation = violations.find((v) =>
				v.message.includes("version"),
			);
			expect(versionViolation).toBeDefined();
		});

		it("returns violation when no content section (jobs/workflows/orbs) is present", () => {
			const circlePath = join(dir, ".circleci");
			mkdirSync(circlePath, { recursive: true });
			writeFileSync(
				join(circlePath, "config.yml"),
				["version: 2.1", "executors:", "  default:", "    machine: true"].join(
					"\n",
				),
			);

			const violations = validateCIConfigSyntax(dir, "circleci");
			const contentViolation = violations.find(
				(v) => v.message.includes("jobs") || v.message.includes("workflows"),
			);
			expect(contentViolation).toBeDefined();
		});

		it("returns no violations for a config using 'orbs:' as content section", () => {
			const circlePath = join(dir, ".circleci");
			mkdirSync(circlePath, { recursive: true });
			writeFileSync(
				join(circlePath, "config.yml"),
				[
					"version: 2.1",
					"",
					"orbs:",
					"  node: circleci/node@5",
					"",
					"workflows:",
					"  main:",
					"    jobs:",
					"      - node/test",
				].join("\n"),
			);

			const violations = validateCIConfigSyntax(dir, "circleci");
			expect(violations).toHaveLength(0);
		});

		it("ignores comments and blank lines when parsing top-level keys", () => {
			const circlePath = join(dir, ".circleci");
			mkdirSync(circlePath, { recursive: true });
			writeFileSync(
				join(circlePath, "config.yml"),
				[
					"# This is a CircleCI config",
					"",
					"# Version comment",
					"version: 2.1",
					"",
					"# Jobs section",
					"jobs:",
					"  build:",
					"    machine: true",
				].join("\n"),
			);

			const violations = validateCIConfigSyntax(dir, "circleci");
			expect(violations).toHaveLength(0);
		});

		it("detects GitHub Actions 'on:' key as invalid in CircleCI context", () => {
			const circlePath = join(dir, ".circleci");
			mkdirSync(circlePath, { recursive: true });
			writeFileSync(
				join(circlePath, "config.yml"),
				[
					"on:",
					"  push:",
					"    branches: [main]",
					"",
					"version: 2.1",
					"jobs:",
					"  build:",
					"    machine: true",
				].join("\n"),
			);

			const violations = validateCIConfigSyntax(dir, "circleci");
			const onViolation = violations.find((v) => v.message.includes("'on:'"));
			expect(onViolation).toBeDefined();
		});
	});

	// ─── GitHub Actions ──────────────────────────────────────────────────────

	describe("github-actions provider", () => {
		it("returns no violations for a valid minimal GHA workflow", () => {
			const workflowsPath = join(dir, ".github", "workflows");
			mkdirSync(workflowsPath, { recursive: true });
			writeFileSync(
				join(workflowsPath, "ci.yml"),
				[
					"name: CI",
					"on:",
					"  push:",
					"    branches: [main]",
					"",
					"jobs:",
					"  build:",
					"    runs-on: ubuntu-latest",
					"    steps:",
					"      - uses: actions/checkout@v4",
				].join("\n"),
			);

			const violations = validateCIConfigSyntax(dir, "github-actions");
			expect(violations).toHaveLength(0);
		});

		it("returns violation when workflows directory does not exist", () => {
			const violations = validateCIConfigSyntax(dir, "github-actions");
			expect(violations).toHaveLength(1);
			expect(violations[0]!.message).toContain("not found");
		});

		it("returns violation when workflows directory is empty", () => {
			const workflowsPath = join(dir, ".github", "workflows");
			mkdirSync(workflowsPath, { recursive: true });

			const violations = validateCIConfigSyntax(dir, "github-actions");
			expect(violations).toHaveLength(1);
			expect(violations[0]!.message).toContain("No .yml/.yaml");
		});

		it("returns violation when GHA workflow is missing 'on:' trigger", () => {
			const workflowsPath = join(dir, ".github", "workflows");
			mkdirSync(workflowsPath, { recursive: true });
			writeFileSync(
				join(workflowsPath, "ci.yml"),
				["name: CI", "jobs:", "  build:", "    runs-on: ubuntu-latest"].join(
					"\n",
				),
			);

			const violations = validateCIConfigSyntax(dir, "github-actions");
			const onViolation = violations.find((v) => v.message.includes("'on:'"));
			expect(onViolation).toBeDefined();
		});

		it("returns violation when GHA workflow is missing 'jobs:'", () => {
			const workflowsPath = join(dir, ".github", "workflows");
			mkdirSync(workflowsPath, { recursive: true });
			writeFileSync(
				join(workflowsPath, "ci.yml"),
				["name: CI", "on:", "  push:", "    branches: [main]"].join("\n"),
			);

			const violations = validateCIConfigSyntax(dir, "github-actions");
			const jobsViolation = violations.find((v) =>
				v.message.includes("'jobs:'"),
			);
			expect(jobsViolation).toBeDefined();
		});

		it("validates all workflow files in the directory", () => {
			const workflowsPath = join(dir, ".github", "workflows");
			mkdirSync(workflowsPath, { recursive: true });
			// One valid, one with missing 'jobs:'
			writeFileSync(
				join(workflowsPath, "ci.yml"),
				[
					"name: CI",
					"on:",
					"  push:",
					"",
					"jobs:",
					"  build:",
					"    runs-on: ubuntu-latest",
				].join("\n"),
			);
			writeFileSync(
				join(workflowsPath, "release.yml"),
				["name: Release", "on:", "  push:", "    tags: ['v*']"].join("\n"),
			);

			const violations = validateCIConfigSyntax(dir, "github-actions");
			// release.yml should have a jobs violation
			const releaseViolation = violations.find(
				(v) =>
					v.configPath.includes("release") && v.message.includes("'jobs:'"),
			);
			expect(releaseViolation).toBeDefined();
		});
	});
});
