import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
/**
 * Tests for branch-protect-sync (JSC-60)
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	CIRCLECI_APP_ID,
	CIRCLECI_PRIMARY_CHECK,
	buildBranchProtectSyncPlan,
	detectOrphanedChecks,
	extractGHAJobNames,
	formatBranchProtectSyncWarning,
	getActiveGHAJobNames,
} from "./branch-protect-sync.js";

// ─── extractGHAJobNames ────────────────────────────────────────────────────────

describe("extractGHAJobNames", () => {
	it("extracts single job name", () => {
		const yaml = `
on: [push]
jobs:
  quality-gates:
    runs-on: ubuntu-latest
`;
		expect(extractGHAJobNames(yaml)).toEqual(["quality-gates"]);
	});

	it("extracts multiple job names", () => {
		const yaml = `
jobs:
  lint:
    runs-on: ubuntu-latest
  test:
    runs-on: ubuntu-latest
  build:
    runs-on: ubuntu-latest
`;
		const names = extractGHAJobNames(yaml);
		expect(names).toContain("lint");
		expect(names).toContain("test");
		expect(names).toContain("build");
	});

	it("returns empty array for yaml with no jobs block", () => {
		expect(extractGHAJobNames("name: my-workflow\non: push\n")).toEqual([]);
	});

	it("stops collecting at next top-level key after jobs", () => {
		const yaml = `
jobs:
  ci:
    runs-on: ubuntu-latest
env:
  FOO: bar
permissions:
  pull-requests: read
`;
		const names = extractGHAJobNames(yaml);
		expect(names).toEqual(["ci"]);
	});

	it("deduplicates job names", () => {
		const yaml = `
jobs:
  ci:
    runs-on: ubuntu-latest
  ci:
    runs-on: ubuntu-22.04
`;
		const names = extractGHAJobNames(yaml);
		expect(names.filter((n) => n === "ci").length).toBe(1);
	});

	it("handles job names with dashes and underscores", () => {
		const yaml = `
jobs:
  build-and_test:
    runs-on: ubuntu-latest
`;
		expect(extractGHAJobNames(yaml)).toContain("build-and_test");
	});
});

// ─── getActiveGHAJobNames ──────────────────────────────────────────────────────

describe("getActiveGHAJobNames", () => {
	let dir: string;

	beforeEach(() => {
		dir = join(tmpdir(), `bprox-test-${Date.now()}`);
		mkdirSync(join(dir, ".github", "workflows"), { recursive: true });
	});

	afterEach(() => {
		if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
	});

	it("returns empty array when .github/workflows does not exist", () => {
		const noDir = join(tmpdir(), `no-workflows-${Date.now()}`);
		expect(getActiveGHAJobNames(noDir)).toEqual([]);
	});

	it("reads job names from single workflow file", () => {
		writeFileSync(
			join(dir, ".github", "workflows", "ci.yml"),
			"jobs:\n  build:\n    runs-on: ubuntu-latest\n",
		);
		expect(getActiveGHAJobNames(dir)).toContain("build");
	});

	it("unions job names from multiple workflow files", () => {
		writeFileSync(
			join(dir, ".github", "workflows", "ci.yml"),
			"jobs:\n  test:\n    runs-on: ubuntu-latest\n",
		);
		writeFileSync(
			join(dir, ".github", "workflows", "security.yml"),
			"jobs:\n  security-scan:\n    runs-on: ubuntu-latest\n",
		);
		const names = getActiveGHAJobNames(dir);
		expect(names).toContain("test");
		expect(names).toContain("security-scan");
	});

	it("ignores non-yaml files", () => {
		writeFileSync(join(dir, ".github", "workflows", "README.md"), "# CI");
		expect(getActiveGHAJobNames(dir)).toEqual([]);
	});
});

// ─── detectOrphanedChecks ─────────────────────────────────────────────────────

describe("detectOrphanedChecks", () => {
	it("returns empty when all checks are active", () => {
		const orphaned = detectOrphanedChecks({
			currentChecks: [{ context: "ci" }, { context: "test" }],
			activeJobNames: ["ci", "test"],
			targetProviderChecks: [],
		});
		expect(orphaned).toHaveLength(0);
	});

	it("detects checks with no backing job and not in target provider", () => {
		const orphaned = detectOrphanedChecks({
			currentChecks: [{ context: "quality-gates" }, { context: "pr-pipeline" }],
			activeJobNames: ["pr-pipeline"],
			targetProviderChecks: ["pr-pipeline"],
		});
		expect(orphaned).toHaveLength(1);
		expect(orphaned[0]?.context).toBe("quality-gates");
	});

	it("does NOT orphan checks that match targetProviderChecks", () => {
		const orphaned = detectOrphanedChecks({
			currentChecks: [{ context: "pr-pipeline" }],
			activeJobNames: [],
			targetProviderChecks: ["pr-pipeline"],
		});
		expect(orphaned).toHaveLength(0);
	});

	it("comparison is case-insensitive", () => {
		const orphaned = detectOrphanedChecks({
			currentChecks: [{ context: "Quality-Gates" }],
			activeJobNames: ["quality-gates"],
			targetProviderChecks: [],
		});
		expect(orphaned).toHaveLength(0);
	});

	it("returns all current checks as orphaned when nothing is active", () => {
		const orphaned = detectOrphanedChecks({
			currentChecks: [{ context: "old-check-1" }, { context: "old-check-2" }],
			activeJobNames: [],
			targetProviderChecks: [],
		});
		expect(orphaned).toHaveLength(2);
	});
});

// ─── buildBranchProtectSyncPlan ────────────────────────────────────────────────

describe("buildBranchProtectSyncPlan — circleci target", () => {
	it("detects orphaned GHA checks and recommends pr-pipeline", () => {
		const plan = buildBranchProtectSyncPlan({
			currentChecks: [{ context: "quality-gates" }],
			targetProvider: "circleci",
			activeGHAJobNames: [],
		});

		expect(plan.hasDrift).toBe(true);
		expect(plan.orphanedChecks).toHaveLength(1);
		expect(plan.orphanedChecks[0]?.context).toBe("quality-gates");
		expect(plan.recommendedAdditions).toHaveLength(1);
		expect(plan.recommendedAdditions[0]?.context).toBe(CIRCLECI_PRIMARY_CHECK);
		expect(plan.recommendedAdditions[0]?.appId).toBe(CIRCLECI_APP_ID);
	});

	it("no drift when pr-pipeline already in ruleset and no orphans", () => {
		const plan = buildBranchProtectSyncPlan({
			currentChecks: [{ context: "pr-pipeline" }],
			targetProvider: "circleci",
			activeGHAJobNames: [],
		});

		expect(plan.hasDrift).toBe(false);
		expect(plan.orphanedChecks).toHaveLength(0);
		expect(plan.recommendedAdditions).toHaveLength(0);
	});

	it("includes owner/repo in fix command when provided", () => {
		const plan = buildBranchProtectSyncPlan({
			currentChecks: [{ context: "quality-gates" }],
			targetProvider: "circleci",
			activeGHAJobNames: [],
			owner: "acme",
			repo: "my-app",
		});

		expect(plan.fixCommand).toContain("--owner acme --repo my-app");
	});

	it("gh api command includes CIRCLECI_APP_ID", () => {
		const plan = buildBranchProtectSyncPlan({
			currentChecks: [{ context: "quality-gates" }],
			targetProvider: "circleci",
			activeGHAJobNames: [],
			owner: "acme",
			repo: "my-app",
		});

		expect(plan.ghApiCommand).not.toBeNull();
		expect(plan.ghApiCommand).toContain(String(CIRCLECI_APP_ID));
	});

	it("gh api command is null when owner/repo missing", () => {
		const plan = buildBranchProtectSyncPlan({
			currentChecks: [{ context: "quality-gates" }],
			targetProvider: "circleci",
			activeGHAJobNames: [],
		});
		expect(plan.ghApiCommand).toBeNull();
	});

	it("keeps non-orphaned checks in fix command", () => {
		const plan = buildBranchProtectSyncPlan({
			currentChecks: [
				{ context: "Greptile Review" }, // not orphaned — still active / known
				{ context: "quality-gates" }, // orphaned
			],
			targetProvider: "circleci",
			activeGHAJobNames: ["Greptile Review"],
			owner: "acme",
			repo: "my-app",
		});

		expect(plan.fixCommand).toContain("Greptile Review");
		expect(plan.fixCommand).toContain("pr-pipeline");
		expect(plan.fixCommand).not.toContain("quality-gates");
	});
});

// ─── formatBranchProtectSyncWarning ──────────────────────────────────────────

describe("formatBranchProtectSyncWarning", () => {
	it("returns empty string when no drift", () => {
		const plan = buildBranchProtectSyncPlan({
			currentChecks: [{ context: "pr-pipeline" }],
			targetProvider: "circleci",
			activeGHAJobNames: [],
		});
		expect(formatBranchProtectSyncWarning(plan)).toBe("");
	});

	it("includes orphaned check names in warning", () => {
		const plan = buildBranchProtectSyncPlan({
			currentChecks: [{ context: "old-quality-gates" }],
			targetProvider: "circleci",
			activeGHAJobNames: [],
		});
		const warning = formatBranchProtectSyncWarning(plan);
		expect(warning).toContain("old-quality-gates");
		expect(warning).toContain("permanently block PRs");
	});

	it("includes fix command in warning", () => {
		const plan = buildBranchProtectSyncPlan({
			currentChecks: [{ context: "quality-gates" }],
			targetProvider: "circleci",
			activeGHAJobNames: [],
			owner: "acme",
			repo: "my-app",
		});
		const warning = formatBranchProtectSyncWarning(plan);
		expect(warning).toContain("harness branch-protect");
		expect(warning).toContain("harness ci-migrate sync-branch-protection");
	});

	it("includes ⚠️ marker", () => {
		const plan = buildBranchProtectSyncPlan({
			currentChecks: [{ context: "stale-check" }],
			targetProvider: "circleci",
			activeGHAJobNames: [],
		});
		const warning = formatBranchProtectSyncWarning(plan);
		expect(warning).toContain("⚠️");
	});
});
