import { spawnSync } from "node:child_process";
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT_PATH = join(process.cwd(), "scripts/check-goal-board.py");
const GOAL_PATH = "docs/goals/codex-runtime-evidence-verifier-cockpit";

const tempRoots: string[] = [];

function createTempRoot(prefix: string) {
	const root = mkdtempSync(join(tmpdir(), prefix));
	tempRoots.push(root);
	return root;
}

function writeValidator(path: string) {
	mkdirSync(join(path, ".."), { recursive: true });
	writeFileSync(
		path,
		[
			"#!/usr/bin/env python3",
			"from __future__ import annotations",
			"import sys",
			'print("goal-board:" + sys.argv[1])',
			"",
		].join("\n"),
	);
}

function writeActiveArtifacts(repo: string) {
	const harnessDir = join(repo, ".harness");
	const goalDir = join(repo, GOAL_PATH);
	const scriptsDir = join(repo, "scripts");
	mkdirSync(harnessDir, { recursive: true });
	mkdirSync(goalDir, { recursive: true });
	writeFileSync(
		join(harnessDir, "active-artifacts.md"),
		[
			"# Active Harness Specs And Plans",
			"",
			"## Current Active Route",
			"",
			"| Route | Linear Key | Canonical Artifacts |",
			"| --- | --- | --- |",
			"| Codex runtime evidence verifier cockpit | JSC-363 | .harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md plus .harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md plus docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md plus .harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md plus latest route head current-pr-head |",
			"",
		].join("\n"),
	);
	writeFileSync(
		join(goalDir, "state.yaml"),
		[
			"version: 2",
			"thin_execution_tracker:",
			"  active_route:",
			'    kind: "external_tracker_decision"',
			'    active_branch: ""',
			"    open_pr_count: 0",
			"",
		].join("\n"),
	);
	writeFileSync(
		join(scriptsDir, "check-goal-audit-freshness.py"),
		[
			"#!/usr/bin/env python3",
			"from __future__ import annotations",
			"raise SystemExit(0)",
			"",
		].join("\n"),
	);
	writeFileSync(
		join(scriptsDir, "check-goal-review-backfill.py"),
		[
			"#!/usr/bin/env python3",
			"from __future__ import annotations",
			"raise SystemExit(0)",
			"",
		].join("\n"),
	);
	mkdirSync(join(goalDir, "notes"), { recursive: true });
	writeFileSync(join(goalDir, "notes/review-coverage-backfill.json"), "{}");
}

function writeReceipts(repo: string, receipts: Record<string, unknown>[]) {
	const goalDir = join(repo, GOAL_PATH);
	writeFileSync(
		join(goalDir, "receipts.jsonl"),
		[...receipts.map((receipt) => JSON.stringify(receipt)), ""].join("\n"),
	);
	const latestReceipt = receipts.at(-1) ?? {};
	writeFileSync(
		join(goalDir, "current-route.json"),
		JSON.stringify(
			{
				schemaVersion: "goal-current-route/v1",
				goalSlug: "codex-runtime-evidence-verifier-cockpit",
				issueKey: "JSC-363",
				status: "blocked",
				activeRoute: "fixture route",
				currentSlice: "fixture slice",
				currentHeadSha:
					typeof latestReceipt.head_sha === "string"
						? latestReceipt.head_sha
						: "current-pr-head",
				lastReceipt:
					typeof latestReceipt.id === "string" ? latestReceipt.id : "R999",
				blockers: [{ code: "fixture_blocker" }],
				claimBoundaries: ["fixture claim boundary"],
				canonicalRefs: [
					".harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md",
					".harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md",
					"docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md",
					".harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md",
				],
			},
			null,
			2,
		),
	);
}

function createFixture(prefix: string, receipts: Record<string, unknown>[]) {
	const root = createTempRoot(prefix);
	const repo = join(root, "coding-harness");
	const scriptsDir = join(repo, "scripts");
	const goalDir = join(repo, GOAL_PATH);
	const validatorPath = join(root, "check_goal_board.py");
	mkdirSync(scriptsDir, { recursive: true });
	mkdirSync(goalDir, { recursive: true });
	copyFileSync(SCRIPT_PATH, join(scriptsDir, "check-goal-board.py"));
	writeValidator(validatorPath);
	writeActiveArtifacts(repo);
	writeReceipts(repo, receipts);
	return { goalDir, repo, validatorPath };
}

function runGoalBoard(fixture: ReturnType<typeof createFixture>) {
	return spawnSync(
		"python3",
		["scripts/check-goal-board.py", fixture.goalDir],
		{
			cwd: fixture.repo,
			encoding: "utf8",
			env: {
				...process.env,
				GOAL_GOVERNOR_CHECK_BOARD: fixture.validatorPath,
				GOAL_GOVERNOR_CHECK_GOAL_BOARD: "",
				PYTHONDONTWRITEBYTECODE: "1",
			},
		},
	);
}

describe("check-goal-board.py local path receipt guard", () => {
	afterEach(() => {
		for (const root of tempRoots.splice(0)) {
			rmSync(root, { force: true, recursive: true });
		}
	});

	it("fails when the current runtime evidence receipt contains a local home path", () => {
		const result = runGoalBoard(
			createFixture("goal-board-local-path-", [
				{
					id: "R150",
					head_sha: "current-pr-head",
					lifecycle_unit: "pre-cutover-latest-receipt",
					memory_surfaces_read: ["/Users/jamiecraik/.codex/memories/MEMORY.md"],
					pr_state_snapshot: { pr: 309, head_sha: "current-pr-head" },
				},
			]),
		);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("local home path");
		expect(result.stderr).toContain("receipt R150");
		expect(result.stderr).toContain("$.memory_surfaces_read[0]");
		expect(result.stderr).not.toContain("/Users/jamiecraik");
	});

	it("fails when runtime evidence receipt ids are duplicated", () => {
		const result = runGoalBoard(
			createFixture("goal-board-duplicate-receipt-", [
				{
					id: "R151",
					head_sha: "current-pr-head",
					lifecycle_unit: "first-route-refresh",
					pr_state_snapshot: { pr: 309, head_sha: "current-pr-head" },
				},
				{
					id: "R151",
					head_sha: "current-pr-head",
					lifecycle_unit: "duplicate-route-refresh",
					pr_state_snapshot: { pr: 309, head_sha: "current-pr-head" },
				},
			]),
		);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("receipt id must be unique");
		expect(result.stderr).toContain("R151");
		expect(result.stderr).toContain("lines 1 and 2");
	});

	it("does not fail on historical local paths once the cutover receipt exists", () => {
		const fixture = createFixture("goal-board-historical-local-path-", [
			{
				id: "R150",
				head_sha: "old-pr-head",
				lifecycle_unit: "pre-cutover-historical-receipt",
				memory_surfaces_read: ["/Users/jamiecraik/.codex/memories/MEMORY.md"],
				pr_state_snapshot: { pr: 309, head_sha: "old-pr-head" },
			},
			{
				id: "R151",
				head_sha: "current-pr-head",
				lifecycle_unit: "receipt-local-path-guard",
				memory_surfaces_read: ["<REDACTED_HOME_PATH>/memories/MEMORY.md"],
				pr_state_snapshot: { pr: 309, head_sha: "current-pr-head" },
			},
		]);
		const result = runGoalBoard(fixture);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain(`goal-board:${fixture.goalDir}`);
	});

	it("fails on post-cutover local paths even when a later receipt is clean", () => {
		const result = runGoalBoard(
			createFixture("goal-board-hidden-local-path-", [
				{
					id: "R151",
					head_sha: "old-pr-head",
					lifecycle_unit: "receipt-local-path-guard",
					evidence: {
						source: "file:///Users/jamie/.codex/memories/MEMORY.md",
					},
					pr_state_snapshot: { pr: 309, head_sha: "old-pr-head" },
				},
				{
					id: "R152",
					head_sha: "current-pr-head",
					lifecycle_unit: "clean-later-receipt",
					evidence: { source: "docs/goals/current-receipt.md" },
					pr_state_snapshot: { pr: 309, head_sha: "current-pr-head" },
				},
			]),
		);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("receipt R151");
		expect(result.stderr).toContain("$.evidence.source");
		expect(result.stderr).not.toContain("file:///Users/jamie");
	});

	it("fails on malformed post-cutover receipt IDs with local paths", () => {
		const result = runGoalBoard(
			createFixture("goal-board-malformed-cutover-id-", [
				{
					id: "R151a",
					head_sha: "old-pr-head",
					lifecycle_unit: "malformed-cutover-receipt",
					evidence: {
						source: "file:///Users/jamie/.codex/memories/MEMORY.md",
					},
					pr_state_snapshot: { pr: 309, head_sha: "old-pr-head" },
				},
				{
					id: "R152",
					head_sha: "current-pr-head",
					lifecycle_unit: "clean-later-receipt",
					evidence: { source: "docs/goals/current-receipt.md" },
					pr_state_snapshot: { pr: 309, head_sha: "current-pr-head" },
				},
			]),
		);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("receipt R151a");
		expect(result.stderr).toContain("$.evidence.source");
		expect(result.stderr).not.toContain("file:///Users/jamie");
	});

	it("redacts local paths stored in malformed receipt IDs", () => {
		const result = runGoalBoard(
			createFixture("goal-board-local-path-receipt-id-", [
				{
					id: "R151-/Users/jamie/.codex/memories/MEMORY.md",
					head_sha: "current-pr-head",
					lifecycle_unit: "receipt-local-path-guard",
					pr_state_snapshot: { pr: 309, head_sha: "current-pr-head" },
				},
			]),
		);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("receipt line 1");
		expect(result.stderr).toContain("$.id");
		expect(result.stderr).not.toContain("/Users/jamie");
		expect(result.stderr).not.toContain("R151-/Users");
	});

	it("fails on post-cutover local paths stored as JSON object keys", () => {
		const result = runGoalBoard(
			createFixture("goal-board-local-path-key-", [
				{
					id: "R151",
					head_sha: "current-pr-head",
					lifecycle_unit: "receipt-local-path-guard",
					evidence: {
						"/Users/jamie/.codex/memories/MEMORY.md": "memory-index",
						"C:/Users/Jamie/.codex/memories/MEMORY.md": "windows-index",
						"~/.codex/memories/MEMORY.md": "tilde-index",
					},
					pr_state_snapshot: { pr: 309, head_sha: "current-pr-head" },
				},
			]),
		);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("receipt R151");
		expect(result.stderr).toContain("$.evidence[<key>]");
		expect(result.stderr).toContain("Unix or macOS home path");
		expect(result.stderr).toContain("Windows user profile path");
		expect(result.stderr).toContain("tilde home path");
		expect(result.stderr).not.toContain("/Users/jamie");
		expect(result.stderr).not.toContain("C:/Users/Jamie");
		expect(result.stderr).not.toContain("~/.codex");
	});

	it("rejects Unix and Windows user-profile paths in nested post-cutover receipts", () => {
		const result = runGoalBoard(
			createFixture("goal-board-cross-platform-paths-", [
				{
					id: "R151",
					head_sha: "current-pr-head",
					lifecycle_unit: "receipt-local-path-guard",
					evidence: {
						unixHome: "/home/jamie/.codex/memories/MEMORY.md",
						varHome: "/var/home/jamie/.codex/memories/MEMORY.md",
						windowsForward: "C:/Users/Jamie/.codex/memories/MEMORY.md",
						windowsBackslash: "C:\\Users\\Jamie\\.codex\\memories\\MEMORY.md",
						wslHome: "/mnt/c/Users/Jamie/.codex/memories/MEMORY.md",
						tildeHome: "~/.codex/memories/MEMORY.md",
					},
					pr_state_snapshot: { pr: 309, head_sha: "current-pr-head" },
				},
			]),
		);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("receipt R151");
		expect(result.stderr).toContain("$.evidence.unixHome");
		expect(result.stderr).toContain("$.evidence.varHome");
		expect(result.stderr).toContain("$.evidence.windowsForward");
		expect(result.stderr).toContain("$.evidence.windowsBackslash");
		expect(result.stderr).toContain("$.evidence.wslHome");
		expect(result.stderr).toContain("$.evidence.tildeHome");
		expect(result.stderr).toContain("Unix or macOS home path");
		expect(result.stderr).toContain("Windows user profile path");
		expect(result.stderr).toContain("WSL user profile path");
		expect(result.stderr).toContain("tilde home path");
		expect(result.stderr).not.toContain("/home/jamie");
		expect(result.stderr).not.toContain("C:/Users/Jamie");
		expect(result.stderr).not.toContain("~/.codex");
	});
});
