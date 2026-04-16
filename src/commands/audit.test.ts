import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXIT_CODES, runAudit, runAuditCLI } from "./audit.js";

function createTestRepo(): string {
	const dir = mkdtempSync(join("/tmp", "audit-test-"));

	// Minimal valid setup
	writeFileSync(
		join(dir, "package.json"),
		'{"name":"test","scripts":{"check":"harness check","lint":"biome check","test":"vitest run"}}',
	);
	writeFileSync(join(dir, "biome.json"), '{"linter":{}}');
	mkdirSync(join(dir, ".circleci"), { recursive: true });
	writeFileSync(join(dir, ".circleci", "config.yml"), "version: 2.1\n");
	mkdirSync(join(dir, ".harness"), { recursive: true });
	mkdirSync(join(dir, ".harness", "knowledge"), { recursive: true });
	mkdirSync(join(dir, ".harness", "quality"), { recursive: true });
	writeFileSync(
		join(dir, ".harness", "ci-required-checks.json"),
		'["pr-pipeline"]',
	);
	writeFileSync(
		join(dir, ".harness", "knowledge", "INDEX.md"),
		"# Knowledge Index\n",
	);
	writeFileSync(
		join(dir, ".harness", "quality", "criteria.md"),
		"# Quality Criteria\n\n| Q-001 | Test | must |\n",
	);
	writeFileSync(join(dir, ".harness", "review-log.md"), "# Review Log\n");
	writeFileSync(join(dir, "harness.contract.json"), '{"version":"0.13.0"}');
	writeFileSync(join(dir, ".coderabbit.yaml"), "reviews:\n  profile: chill\n");
	writeFileSync(join(dir, "CONTRIBUTING.md"), "# Contributing\n");

	// Git hooks
	mkdirSync(join(dir, ".git", "hooks"), { recursive: true });
	writeFileSync(join(dir, ".git", "hooks", "pre-push"), "#!/bin/sh\n");
	writeFileSync(join(dir, ".git", "hooks", "commit-msg"), "#!/bin/sh\n");

	return dir;
}

describe("runAudit", () => {
	it("checks a well-configured repo", () => {
		const dir = createTestRepo();
		try {
			const result = runAudit(dir);
			expect(result.summary.total).toBeGreaterThan(0);
			expect(result.summary.ok).toBeGreaterThan(0);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("detects missing contract file", () => {
		const dir = createTestRepo();
		try {
			const { unlinkSync } = require("node:fs");
			unlinkSync(join(dir, "harness.contract.json"));
			const result = runAudit(dir);
			const contractFinding = result.findings.find(
				(f) => f.check === "harness.contract.json",
			);
			expect(contractFinding).toBeDefined();
			expect(contractFinding?.severity).toBe("missing");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("detects missing CI config", () => {
		const dir = createTestRepo();
		try {
			const { unlinkSync } = require("node:fs");
			unlinkSync(join(dir, ".circleci", "config.yml"));
			const result = runAudit(dir);
			const ciFinding = result.findings.find(
				(f) => f.check === "CircleCI config",
			);
			expect(ciFinding).toBeDefined();
			expect(ciFinding?.severity).toBe("missing");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("generates recommendations from warnings", () => {
		const dir = mkdtempSync(join("/tmp", "audit-test-"));
		try {
			// Empty dir — should have many warnings
			const result = runAudit(dir);
			expect(result.recommendations.length).toBeGreaterThan(0);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("groups findings by category", () => {
		const dir = createTestRepo();
		try {
			const result = runAudit(dir);
			const categories = new Set(result.findings.map((f) => f.category));
			expect(categories.has("core")).toBe(true);
			expect(categories.has("ci")).toBe(true);
			expect(categories.has("review")).toBe(true);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("handles empty directory gracefully", () => {
		const dir = mkdtempSync(join("/tmp", "audit-test-"));
		try {
			const result = runAudit(dir);
			expect(result.summary.missing).toBeGreaterThan(0);
			expect(result.summary.warnings).toBeGreaterThan(0);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("runAuditCLI", () => {
	it("shows help and returns success", () => {
		const exitCode = runAuditCLI(["--help"], () => "0.13.0");
		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
	});

	it("returns warnings for incomplete setup", () => {
		const dir = mkdtempSync(join("/tmp", "audit-test-"));
		try {
			const exitCode = runAuditCLI(["--dir", dir, "--json"], () => "0.13.0");
			expect([EXIT_CODES.WARNINGS, EXIT_CODES.ERRORS]).toContain(exitCode);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
