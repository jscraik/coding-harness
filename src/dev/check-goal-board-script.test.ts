import { execFileSync, spawnSync } from "node:child_process";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT_PATH = join(process.cwd(), "scripts/check-goal-board.py");

const tempRoots: string[] = [];

function createTempRoot(prefix: string) {
	const root = mkdtempSync(join(tmpdir(), prefix));
	tempRoots.push(root);
	return root;
}

function writeValidator(path: string, marker: string) {
	mkdirSync(join(path, ".."), { recursive: true });
	writeFileSync(
		path,
		[
			"#!/usr/bin/env python3",
			"from __future__ import annotations",
			"import sys",
			`print("${marker}:" + sys.argv[1])`,
			"",
		].join("\n"),
	);
}

function writeReviewBackfillValidator(repo: string, body?: string) {
	const scriptsDir = join(repo, "scripts");
	const ledgerPath = join(
		repo,
		"docs/goals/codex-runtime-evidence-verifier-cockpit/notes/review-coverage-backfill.json",
	);
	mkdirSync(scriptsDir, { recursive: true });
	mkdirSync(join(ledgerPath, ".."), { recursive: true });
	writeFileSync(ledgerPath, "{}");
	writeFileSync(
		join(scriptsDir, "check-goal-review-backfill.py"),
		body ??
			[
				"#!/usr/bin/env python3",
				"from __future__ import annotations",
				"import sys",
				'print("review-backfill:" + sys.argv[1])',
				"raise SystemExit(0)",
				"",
			].join("\n"),
	);
}

function writeRuntimeEvidenceActiveArtifacts(repo: string, content?: string) {
	writeReviewBackfillValidator(repo);
	const harnessDir = join(repo, ".harness");
	const goalDir = join(
		repo,
		"docs/goals/codex-runtime-evidence-verifier-cockpit",
	);
	mkdirSync(harnessDir, { recursive: true });
	mkdirSync(goalDir, { recursive: true });
	writeFileSync(
		join(harnessDir, "active-artifacts.md"),
		content ??
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
}

function writeRuntimeEvidenceReceiptsFromObjects(
	repo: string,
	receipts: Record<string, unknown>[],
) {
	const receiptsDir = join(
		repo,
		"docs/goals/codex-runtime-evidence-verifier-cockpit",
	);
	mkdirSync(receiptsDir, { recursive: true });
	writeFileSync(
		join(receiptsDir, "receipts.jsonl"),
		[...receipts.map((receipt) => JSON.stringify(receipt)), ""].join("\n"),
	);
	const latestReceipt = receipts.at(-1) ?? {};
	const latestReceiptId =
		typeof latestReceipt.id === "string" ? latestReceipt.id : "R999";
	const latestHead =
		typeof latestReceipt.head_sha === "string"
			? latestReceipt.head_sha
			: "current-pr-head";
	writeFileSync(
		join(receiptsDir, "current-route.json"),
		JSON.stringify(
			{
				schemaVersion: "goal-current-route/v1",
				goalSlug: "codex-runtime-evidence-verifier-cockpit",
				issueKey: "JSC-363",
				status: "blocked",
				activeRoute: "fixture route",
				currentSlice: "fixture slice",
				currentHeadSha: latestHead,
				lastReceipt: latestReceiptId,
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

function writeRuntimeEvidenceReceipts(repo: string, headSha: string) {
	writeRuntimeEvidenceReceiptsFromObjects(repo, [
		{
			id: "R999",
			head_sha: headSha,
			lifecycle_unit: "pr-309-current-state-refresh",
			pr_state_snapshot: {
				pr: 309,
				head_sha: headSha,
				status: "checks green",
			},
		},
	]);
}

function writeGenericGoalBoard(goalDir: string) {
	mkdirSync(goalDir, { recursive: true });
	writeFileSync(
		join(goalDir, "goal.md"),
		[
			"# Fixture Goal",
			"",
			"## Table of Contents",
			"",
			"- [Scope](#scope)",
			"",
			"## Scope",
			"",
		].join("\n"),
	);
	writeFileSync(
		join(goalDir, "state.yaml"),
		[
			"tasks:",
			'  - id: "T001"',
			'    type: "scout"',
			'    assignee: "Scout"',
			'    status: "active"',
			'    objective: "Validate fixture board."',
			'    receipt_id: "R001"',
			'  - id: "T002"',
			'    type: "judge"',
			'    assignee: "Judge"',
			'    status: "queued"',
			'    objective: "Review fixture board."',
			"",
		].join("\n"),
	);
	writeFileSync(
		join(goalDir, "receipts.jsonl"),
		[
			JSON.stringify({
				id: "R001",
				task_id: "T001",
				decision: "created",
				summary: "Fixture board created.",
			}),
			"",
		].join("\n"),
	);
}

describe("check-goal-board.py", () => {
	afterEach(() => {
		for (const root of tempRoots.splice(0)) {
			rmSync(root, { force: true, recursive: true });
		}
	});

	it("falls back to repo-local validation when no skill checkout exists", () => {
		const root = createTempRoot("goal-board-local-fallback-");
		const repo = join(root, "coding-harness");
		const scriptsDir = join(repo, "scripts");
		const goalDir = join(repo, "docs/goals/example");
		mkdirSync(scriptsDir, { recursive: true });
		copyFileSync(SCRIPT_PATH, join(scriptsDir, "check-goal-board.py"));
		writeGenericGoalBoard(goalDir);

		const result = spawnSync(
			"python3",
			["scripts/check-goal-board.py", "docs/goals/example"],
			{
				cwd: repo,
				encoding: "utf8",
				env: {
					...process.env,
					GOAL_GOVERNOR_CHECK_BOARD: "",
					GOAL_GOVERNOR_CHECK_GOAL_BOARD: "",
					HOME: join(root, "home-without-agent-skills"),
					PYTHONDONTWRITEBYTECODE: "1",
				},
			},
		);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("PASS: goal board is valid");
	});

	it("honors the legacy Goal Governor override variable", () => {
		const root = createTempRoot("goal-board-override-");
		const validatorPath = join(root, "check_goal_board.py");
		const goalDir = join(root, "goal");
		mkdirSync(goalDir);
		writeValidator(validatorPath, "legacy-override");

		const result = spawnSync("python3", [SCRIPT_PATH, goalDir], {
			encoding: "utf8",
			env: {
				...process.env,
				GOAL_GOVERNOR_CHECK_BOARD: validatorPath,
				GOAL_GOVERNOR_CHECK_GOAL_BOARD: "",
				PYTHONDONTWRITEBYTECODE: "1",
			},
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toContain(`legacy-override:${goalDir}`);
	});

	it("resolves the validator adjacent to the git source checkout", () => {
		const root = createTempRoot("goal-board-source-root-");
		const sourceParent = join(root, "source-parent");
		const sourceRepo = join(sourceParent, "coding-harness");
		const worktreeParent = join(root, "disposable-worktrees");
		const worktree = join(worktreeParent, "coding-harness-worktree");
		const goalDir = join(worktree, "goal");
		const validatorPath = join(
			sourceParent,
			"agent-skills/Skills/agent-ops/goal-governor/scripts/check_goal_board.py",
		);
		mkdirSync(join(sourceRepo, "scripts"), { recursive: true });
		mkdirSync(worktreeParent, { recursive: true });
		copyFileSync(SCRIPT_PATH, join(sourceRepo, "scripts/check-goal-board.py"));
		writeValidator(validatorPath, "source-adjacent");
		execFileSync("git", ["init"], { cwd: sourceRepo, stdio: "ignore" });
		execFileSync("git", ["config", "user.email", "test@example.com"], {
			cwd: sourceRepo,
		});
		execFileSync("git", ["config", "user.name", "Test User"], {
			cwd: sourceRepo,
		});
		execFileSync("git", ["add", "scripts/check-goal-board.py"], {
			cwd: sourceRepo,
		});
		execFileSync("git", ["commit", "-m", "add script"], {
			cwd: sourceRepo,
			stdio: "ignore",
		});
		execFileSync("git", ["worktree", "add", worktree], {
			cwd: sourceRepo,
			stdio: "ignore",
		});
		mkdirSync(goalDir);

		const result = spawnSync(
			"python3",
			["scripts/check-goal-board.py", goalDir],
			{
				cwd: worktree,
				encoding: "utf8",
				env: {
					...process.env,
					GOAL_GOVERNOR_CHECK_BOARD: "",
					GOAL_GOVERNOR_CHECK_GOAL_BOARD: "",
					HOME: join(root, "home-without-agent-skills"),
					PYTHONDONTWRITEBYTECODE: "1",
				},
			},
		);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain(`source-adjacent:${goalDir}`);
	});

	it("runs audit freshness as a required extension for the runtime evidence cockpit goal", () => {
		const root = createTempRoot("goal-board-audit-extension-");
		const repo = join(root, "coding-harness");
		const scriptsDir = join(repo, "scripts");
		const goalDir = join(
			repo,
			"docs/goals/codex-runtime-evidence-verifier-cockpit",
		);
		const validatorPath = join(root, "check_goal_board.py");
		const markerPath = join(root, "audit-freshness-ran.txt");
		mkdirSync(scriptsDir, { recursive: true });
		mkdirSync(goalDir, { recursive: true });
		copyFileSync(SCRIPT_PATH, join(scriptsDir, "check-goal-board.py"));
		writeValidator(validatorPath, "goal-board");
		writeRuntimeEvidenceReceipts(repo, "current-pr-head");
		writeRuntimeEvidenceActiveArtifacts(repo);
		writeFileSync(
			join(scriptsDir, "check-goal-audit-freshness.py"),
			[
				"#!/usr/bin/env python3",
				"from __future__ import annotations",
				"import pathlib",
				"import sys",
				`pathlib.Path(${JSON.stringify(markerPath)}).write_text("|".join(sys.argv[1:]))`,
				"",
			].join("\n"),
		);

		const result = spawnSync(
			"python3",
			["scripts/check-goal-board.py", goalDir],
			{
				cwd: repo,
				encoding: "utf8",
				env: {
					...process.env,
					GOAL_GOVERNOR_CHECK_BOARD: validatorPath,
					GOAL_GOVERNOR_CHECK_GOAL_BOARD: "",
					PYTHONDONTWRITEBYTECODE: "1",
				},
			},
		);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain(`goal-board:${goalDir}`);
		expect(existsSync(markerPath)).toBe(true);
	});

	it("fails the runtime evidence cockpit goal when audit freshness fails", () => {
		const root = createTempRoot("goal-board-audit-fails-");
		const repo = join(root, "coding-harness");
		const scriptsDir = join(repo, "scripts");
		const goalDir = join(
			repo,
			"docs/goals/codex-runtime-evidence-verifier-cockpit",
		);
		const validatorPath = join(root, "check_goal_board.py");
		mkdirSync(scriptsDir, { recursive: true });
		mkdirSync(goalDir, { recursive: true });
		copyFileSync(SCRIPT_PATH, join(scriptsDir, "check-goal-board.py"));
		writeValidator(validatorPath, "goal-board");
		writeRuntimeEvidenceReceipts(repo, "current-pr-head");
		writeRuntimeEvidenceActiveArtifacts(repo);
		writeFileSync(
			join(scriptsDir, "check-goal-audit-freshness.py"),
			[
				"#!/usr/bin/env python3",
				"from __future__ import annotations",
				"import sys",
				'print("stale audit evidence", file=sys.stderr)',
				"raise SystemExit(7)",
				"",
			].join("\n"),
		);

		const result = spawnSync(
			"python3",
			["scripts/check-goal-board.py", goalDir],
			{
				cwd: repo,
				encoding: "utf8",
				env: {
					...process.env,
					GOAL_GOVERNOR_CHECK_BOARD: validatorPath,
					GOAL_GOVERNOR_CHECK_GOAL_BOARD: "",
					PYTHONDONTWRITEBYTECODE: "1",
				},
			},
		);

		expect(result.status).toBe(7);
		expect(result.stdout).toContain(`goal-board:${goalDir}`);
		expect(result.stderr).toContain("stale audit evidence");
	});

	it("fails the runtime evidence cockpit goal when review backfill validation fails", () => {
		const root = createTempRoot("goal-board-review-backfill-fails-");
		const repo = join(root, "coding-harness");
		const scriptsDir = join(repo, "scripts");
		const goalDir = join(
			repo,
			"docs/goals/codex-runtime-evidence-verifier-cockpit",
		);
		const validatorPath = join(root, "check_goal_board.py");
		mkdirSync(scriptsDir, { recursive: true });
		mkdirSync(goalDir, { recursive: true });
		copyFileSync(SCRIPT_PATH, join(scriptsDir, "check-goal-board.py"));
		writeValidator(validatorPath, "goal-board");
		writeRuntimeEvidenceReceipts(repo, "current-pr-head");
		writeRuntimeEvidenceActiveArtifacts(repo);
		writeFileSync(
			join(scriptsDir, "check-goal-audit-freshness.py"),
			[
				"#!/usr/bin/env python3",
				"from __future__ import annotations",
				"raise SystemExit(0)",
				"",
			].join("\n"),
		);
		writeReviewBackfillValidator(
			repo,
			[
				"#!/usr/bin/env python3",
				"from __future__ import annotations",
				"import sys",
				'print("stale review backfill", file=sys.stderr)',
				"raise SystemExit(6)",
				"",
			].join("\n"),
		);

		const result = spawnSync(
			"python3",
			["scripts/check-goal-board.py", goalDir],
			{
				cwd: repo,
				encoding: "utf8",
				env: {
					...process.env,
					GOAL_GOVERNOR_CHECK_BOARD: validatorPath,
					GOAL_GOVERNOR_CHECK_GOAL_BOARD: "",
					PYTHONDONTWRITEBYTECODE: "1",
				},
			},
		);

		expect(result.status).toBe(6);
		expect(result.stdout).toContain(`goal-board:${goalDir}`);
		expect(result.stderr).toContain("stale review backfill");
	});

	it("fails the runtime evidence cockpit goal when active artifacts do not route it", () => {
		const root = createTempRoot("goal-board-active-artifacts-fails-");
		const repo = join(root, "coding-harness");
		const scriptsDir = join(repo, "scripts");
		const goalDir = join(
			repo,
			"docs/goals/codex-runtime-evidence-verifier-cockpit",
		);
		const validatorPath = join(root, "check_goal_board.py");
		mkdirSync(scriptsDir, { recursive: true });
		mkdirSync(goalDir, { recursive: true });
		copyFileSync(SCRIPT_PATH, join(scriptsDir, "check-goal-board.py"));
		writeValidator(validatorPath, "goal-board");
		writeRuntimeEvidenceActiveArtifacts(
			repo,
			[
				"# Active Harness Specs And Plans",
				"",
				"| Route | Linear Key | Canonical Artifacts |",
				"| --- | --- | --- |",
				"| Old assurance lane | JSC-331 | docs/goals/jsc-331-goal-governed-evidence-led-implementation/goal.md |",
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

		const result = spawnSync(
			"python3",
			["scripts/check-goal-board.py", goalDir],
			{
				cwd: repo,
				encoding: "utf8",
				env: {
					...process.env,
					GOAL_GOVERNOR_CHECK_BOARD: validatorPath,
					GOAL_GOVERNOR_CHECK_GOAL_BOARD: "",
					PYTHONDONTWRITEBYTECODE: "1",
				},
			},
		);

		expect(result.status).toBe(1);
		expect(result.stdout).toContain(`goal-board:${goalDir}`);
		expect(result.stderr).toContain(
			"Project Brain active-artifacts index does not route",
		);
		expect(result.stderr).toContain("JSC-363");
	});

	it("fails when the runtime evidence cockpit appears outside the active route", () => {
		const root = createTempRoot("goal-board-active-route-only-");
		const repo = join(root, "coding-harness");
		const scriptsDir = join(repo, "scripts");
		const goalDir = join(
			repo,
			"docs/goals/codex-runtime-evidence-verifier-cockpit",
		);
		const validatorPath = join(root, "check_goal_board.py");
		mkdirSync(scriptsDir, { recursive: true });
		mkdirSync(goalDir, { recursive: true });
		copyFileSync(SCRIPT_PATH, join(scriptsDir, "check-goal-board.py"));
		writeValidator(validatorPath, "goal-board");
		writeRuntimeEvidenceActiveArtifacts(
			repo,
			[
				"# Active Harness Specs And Plans",
				"",
				"## Current Active Route",
				"",
				"| Route | Linear Key | Canonical Artifacts |",
				"| --- | --- | --- |",
				"| Old assurance lane | JSC-331 | docs/goals/jsc-331-goal-governed-evidence-led-implementation/goal.md |",
				"",
				"## Artifact Index",
				"",
				"| Key | Artifacts |",
				"| --- | --- |",
				"| JSC-363 | .harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md plus .harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md plus docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md plus .harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md |",
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

		const result = spawnSync(
			"python3",
			["scripts/check-goal-board.py", goalDir],
			{
				cwd: repo,
				encoding: "utf8",
				env: {
					...process.env,
					GOAL_GOVERNOR_CHECK_BOARD: validatorPath,
					GOAL_GOVERNOR_CHECK_GOAL_BOARD: "",
					PYTHONDONTWRITEBYTECODE: "1",
				},
			},
		);

		expect(result.status).toBe(1);
		expect(result.stdout).toContain(`goal-board:${goalDir}`);
		expect(result.stderr).toContain("Current Active Route");
		expect(result.stderr).toContain("JSC-363");
	});

	it("runs runtime cockpit extensions when flags precede the goal path", () => {
		const root = createTempRoot("goal-board-goal-arg-scan-");
		const repo = join(root, "coding-harness");
		const scriptsDir = join(repo, "scripts");
		const goalDir = join(
			repo,
			"docs/goals/codex-runtime-evidence-verifier-cockpit",
		);
		const validatorPath = join(root, "check_goal_board.py");
		const markerPath = join(root, "audit-freshness-ran.txt");
		mkdirSync(scriptsDir, { recursive: true });
		mkdirSync(goalDir, { recursive: true });
		copyFileSync(SCRIPT_PATH, join(scriptsDir, "check-goal-board.py"));
		writeValidator(validatorPath, "goal-board");
		writeRuntimeEvidenceReceipts(repo, "current-pr-head");
		writeRuntimeEvidenceActiveArtifacts(repo);
		writeFileSync(
			join(scriptsDir, "check-goal-audit-freshness.py"),
			[
				"#!/usr/bin/env python3",
				"from __future__ import annotations",
				"import pathlib",
				`pathlib.Path(${JSON.stringify(markerPath)}).write_text("ran")`,
				"",
			].join("\n"),
		);

		const result = spawnSync(
			"python3",
			["scripts/check-goal-board.py", "--mode", "required", goalDir],
			{
				cwd: repo,
				encoding: "utf8",
				env: {
					...process.env,
					GOAL_GOVERNOR_CHECK_BOARD: validatorPath,
					GOAL_GOVERNOR_CHECK_GOAL_BOARD: "",
					PYTHONDONTWRITEBYTECODE: "1",
				},
			},
		);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("goal-board:--mode");
		expect(existsSync(markerPath)).toBe(true);
	});

	it("fails when active artifacts omit the latest route receipt head", () => {
		const root = createTempRoot("goal-board-stale-pr-head-");
		const repo = join(root, "coding-harness");
		const scriptsDir = join(repo, "scripts");
		const goalDir = join(
			repo,
			"docs/goals/codex-runtime-evidence-verifier-cockpit",
		);
		const validatorPath = join(root, "check_goal_board.py");
		mkdirSync(scriptsDir, { recursive: true });
		mkdirSync(goalDir, { recursive: true });
		copyFileSync(SCRIPT_PATH, join(scriptsDir, "check-goal-board.py"));
		writeValidator(validatorPath, "goal-board");
		writeRuntimeEvidenceReceipts(repo, "new-pr-head");
		writeRuntimeEvidenceActiveArtifacts(
			repo,
			[
				"# Active Harness Specs And Plans",
				"",
				"## Current Active Route",
				"",
				"| Route | Linear Key | Canonical Artifacts | Status | Next Safe Action |",
				"| --- | --- | --- | --- | --- |",
				"| Codex runtime evidence verifier cockpit | JSC-363 | .harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md plus .harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md plus docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md plus .harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md | stale old-pr-head | continue |",
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

		const result = spawnSync(
			"python3",
			["scripts/check-goal-board.py", goalDir],
			{
				cwd: repo,
				encoding: "utf8",
				env: {
					...process.env,
					GOAL_GOVERNOR_CHECK_BOARD: validatorPath,
					GOAL_GOVERNOR_CHECK_GOAL_BOARD: "",
					PYTHONDONTWRITEBYTECODE: "1",
				},
			},
		);

		expect(result.status).toBe(1);
		expect(result.stdout).toContain(`goal-board:${goalDir}`);
		expect(result.stderr).toContain("stale route state");
		expect(result.stderr).toContain("new-pr-head");
	});

	it("passes when active artifacts include the latest route receipt head", () => {
		const root = createTempRoot("goal-board-current-pr-head-");
		const repo = join(root, "coding-harness");
		const scriptsDir = join(repo, "scripts");
		const goalDir = join(
			repo,
			"docs/goals/codex-runtime-evidence-verifier-cockpit",
		);
		const validatorPath = join(root, "check_goal_board.py");
		mkdirSync(scriptsDir, { recursive: true });
		mkdirSync(goalDir, { recursive: true });
		copyFileSync(SCRIPT_PATH, join(scriptsDir, "check-goal-board.py"));
		writeValidator(validatorPath, "goal-board");
		writeRuntimeEvidenceReceipts(repo, "current-pr-head");
		writeRuntimeEvidenceActiveArtifacts(
			repo,
			[
				"# Active Harness Specs And Plans",
				"",
				"## Current Active Route",
				"",
				"| Route | Linear Key | Canonical Artifacts | Status | Next Safe Action |",
				"| --- | --- | --- | --- | --- |",
				"| Codex runtime evidence verifier cockpit | JSC-363 | .harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md plus .harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md plus docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md plus .harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md | latest route head current-pr-head | continue |",
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

		const result = spawnSync(
			"python3",
			["scripts/check-goal-board.py", goalDir],
			{
				cwd: repo,
				encoding: "utf8",
				env: {
					...process.env,
					GOAL_GOVERNOR_CHECK_BOARD: validatorPath,
					GOAL_GOVERNOR_CHECK_GOAL_BOARD: "",
					PYTHONDONTWRITEBYTECODE: "1",
				},
			},
		);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain(`goal-board:${goalDir}`);
	});

	it("fails when a merged PR route still tells operators to merge the stale branch", () => {
		const root = createTempRoot("goal-board-stale-merged-route-");
		const repo = join(root, "coding-harness");
		const scriptsDir = join(repo, "scripts");
		const goalDir = join(
			repo,
			"docs/goals/codex-runtime-evidence-verifier-cockpit",
		);
		const validatorPath = join(root, "check_goal_board.py");
		mkdirSync(scriptsDir, { recursive: true });
		mkdirSync(goalDir, { recursive: true });
		copyFileSync(SCRIPT_PATH, join(scriptsDir, "check-goal-board.py"));
		writeValidator(validatorPath, "goal-board");
		writeRuntimeEvidenceReceipts(repo, "merged-main-head");
		writeRuntimeEvidenceActiveArtifacts(
			repo,
			[
				"# Active Harness Specs And Plans",
				"",
				"## Current Active Route",
				"",
				"| Route | Linear Key | Canonical Artifacts | Status | Next Safe Action |",
				"| --- | --- | --- | --- | --- |",
				"| Codex runtime evidence verifier cockpit | JSC-363 | .harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md plus .harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md plus docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md plus .harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md | merged-main-head | Next Safe Action: merge this post-PR384 blocker refresh |",
				"",
			].join("\n"),
		);
		writeFileSync(
			join(goalDir, "state.yaml"),
			[
				"version: 2",
				"thin_execution_tracker:",
				"  active_route:",
				'    kind: "github_pr"',
				'    active_branch: "codex/jsc-363-post-pr384-linear-blocker-refresh"',
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

		const result = spawnSync(
			"python3",
			["scripts/check-goal-board.py", goalDir],
			{
				cwd: repo,
				encoding: "utf8",
				env: {
					...process.env,
					GOAL_GOVERNOR_CHECK_BOARD: validatorPath,
					GOAL_GOVERNOR_CHECK_GOAL_BOARD: "",
					PYTHONDONTWRITEBYTECODE: "1",
				},
			},
		);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("github_pr active_route");
		expect(result.stderr).toContain("open_pr_count: 0");
		expect(result.stderr).toContain("merge this post-PR");
	});

	it("parses runtime active_route through YAML rather than line regexes", () => {
		const root = createTempRoot("goal-board-yaml-active-route-");
		const repo = join(root, "coding-harness");
		const scriptsDir = join(repo, "scripts");
		const goalDir = join(
			repo,
			"docs/goals/codex-runtime-evidence-verifier-cockpit",
		);
		const validatorPath = join(root, "check_goal_board.py");
		mkdirSync(scriptsDir, { recursive: true });
		mkdirSync(goalDir, { recursive: true });
		copyFileSync(SCRIPT_PATH, join(scriptsDir, "check-goal-board.py"));
		writeValidator(validatorPath, "goal-board");
		writeRuntimeEvidenceReceipts(repo, "merged-main-head");
		writeRuntimeEvidenceActiveArtifacts(
			repo,
			[
				"# Active Harness Specs And Plans",
				"",
				"## Current Active Route",
				"",
				"| Route | Linear Key | Canonical Artifacts | Status | Next Safe Action |",
				"| --- | --- | --- | --- | --- |",
				"| Codex runtime evidence verifier cockpit | JSC-363 | .harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md plus .harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md plus docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md plus .harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md | merged-main-head | continue |",
				"",
			].join("\n"),
		);
		writeFileSync(
			join(goalDir, "state.yaml"),
			[
				"version: 2",
				"thin_execution_tracker:",
				"  active_route:",
				"    kind: 'github_pr' # single quotes and comment need YAML parsing",
				"    active_branch: 'codex/jsc-363-post-pr384-linear-blocker-refresh'",
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

		const result = spawnSync(
			"python3",
			["scripts/check-goal-board.py", goalDir],
			{
				cwd: repo,
				encoding: "utf8",
				env: {
					...process.env,
					GOAL_GOVERNOR_CHECK_BOARD: validatorPath,
					GOAL_GOVERNOR_CHECK_GOAL_BOARD: "",
					PYTHONDONTWRITEBYTECODE: "1",
				},
			},
		);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("github_pr active_route");
		expect(result.stderr).toContain("open_pr_count: 0");
	});

	it("fails when the current runtime evidence receipt contains a local home path", () => {
		const root = createTempRoot("goal-board-local-path-");
		const repo = join(root, "coding-harness");
		const scriptsDir = join(repo, "scripts");
		const goalDir = join(
			repo,
			"docs/goals/codex-runtime-evidence-verifier-cockpit",
		);
		const validatorPath = join(root, "check_goal_board.py");
		mkdirSync(scriptsDir, { recursive: true });
		mkdirSync(goalDir, { recursive: true });
		copyFileSync(SCRIPT_PATH, join(scriptsDir, "check-goal-board.py"));
		writeValidator(validatorPath, "goal-board");
		writeRuntimeEvidenceActiveArtifacts(repo);
		writeRuntimeEvidenceReceiptsFromObjects(repo, [
			{
				id: "R150",
				head_sha: "current-pr-head",
				lifecycle_unit: "pre-cutover-latest-receipt",
				memory_surfaces_read: ["/Users/jamiecraik/.codex/memories/MEMORY.md"],
				pr_state_snapshot: { pr: 309, head_sha: "current-pr-head" },
			},
		]);
		writeFileSync(
			join(scriptsDir, "check-goal-audit-freshness.py"),
			[
				"#!/usr/bin/env python3",
				"from __future__ import annotations",
				"raise SystemExit(0)",
				"",
			].join("\n"),
		);

		const result = spawnSync(
			"python3",
			["scripts/check-goal-board.py", goalDir],
			{
				cwd: repo,
				encoding: "utf8",
				env: {
					...process.env,
					GOAL_GOVERNOR_CHECK_BOARD: validatorPath,
					GOAL_GOVERNOR_CHECK_GOAL_BOARD: "",
					PYTHONDONTWRITEBYTECODE: "1",
				},
			},
		);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("local home path");
		expect(result.stderr).toContain("receipt R150");
		expect(result.stderr).toContain("$.memory_surfaces_read[0]");
		expect(result.stderr).not.toContain("/Users/jamiecraik");
	});

	it("fails when runtime evidence receipt ids are duplicated", () => {
		const root = createTempRoot("goal-board-duplicate-receipt-");
		const repo = join(root, "coding-harness");
		const scriptsDir = join(repo, "scripts");
		const goalDir = join(
			repo,
			"docs/goals/codex-runtime-evidence-verifier-cockpit",
		);
		const validatorPath = join(root, "check_goal_board.py");
		mkdirSync(scriptsDir, { recursive: true });
		mkdirSync(goalDir, { recursive: true });
		copyFileSync(SCRIPT_PATH, join(scriptsDir, "check-goal-board.py"));
		writeValidator(validatorPath, "goal-board");
		writeRuntimeEvidenceActiveArtifacts(repo);
		writeRuntimeEvidenceReceiptsFromObjects(repo, [
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
		]);
		writeFileSync(
			join(scriptsDir, "check-goal-audit-freshness.py"),
			[
				"#!/usr/bin/env python3",
				"from __future__ import annotations",
				"raise SystemExit(0)",
				"",
			].join("\n"),
		);

		const result = spawnSync(
			"python3",
			["scripts/check-goal-board.py", goalDir],
			{
				cwd: repo,
				encoding: "utf8",
				env: {
					...process.env,
					GOAL_GOVERNOR_CHECK_BOARD: validatorPath,
					GOAL_GOVERNOR_CHECK_GOAL_BOARD: "",
					PYTHONDONTWRITEBYTECODE: "1",
				},
			},
		);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("receipt id must be unique");
		expect(result.stderr).toContain("R151");
		expect(result.stderr).toContain("lines 1 and 2");
	});

	it("does not fail on historical local paths once the cutover receipt exists", () => {
		const root = createTempRoot("goal-board-historical-local-path-");
		const repo = join(root, "coding-harness");
		const scriptsDir = join(repo, "scripts");
		const goalDir = join(
			repo,
			"docs/goals/codex-runtime-evidence-verifier-cockpit",
		);
		const validatorPath = join(root, "check_goal_board.py");
		mkdirSync(scriptsDir, { recursive: true });
		mkdirSync(goalDir, { recursive: true });
		copyFileSync(SCRIPT_PATH, join(scriptsDir, "check-goal-board.py"));
		writeValidator(validatorPath, "goal-board");
		writeRuntimeEvidenceActiveArtifacts(repo);
		writeRuntimeEvidenceReceiptsFromObjects(repo, [
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
		writeFileSync(
			join(scriptsDir, "check-goal-audit-freshness.py"),
			[
				"#!/usr/bin/env python3",
				"from __future__ import annotations",
				"raise SystemExit(0)",
				"",
			].join("\n"),
		);

		const result = spawnSync(
			"python3",
			["scripts/check-goal-board.py", goalDir],
			{
				cwd: repo,
				encoding: "utf8",
				env: {
					...process.env,
					GOAL_GOVERNOR_CHECK_BOARD: validatorPath,
					GOAL_GOVERNOR_CHECK_GOAL_BOARD: "",
					PYTHONDONTWRITEBYTECODE: "1",
				},
			},
		);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain(`goal-board:${goalDir}`);
	});

	it("fails on post-cutover local paths even when a later receipt is clean", () => {
		const root = createTempRoot("goal-board-hidden-local-path-");
		const repo = join(root, "coding-harness");
		const scriptsDir = join(repo, "scripts");
		const goalDir = join(
			repo,
			"docs/goals/codex-runtime-evidence-verifier-cockpit",
		);
		const validatorPath = join(root, "check_goal_board.py");
		mkdirSync(scriptsDir, { recursive: true });
		mkdirSync(goalDir, { recursive: true });
		copyFileSync(SCRIPT_PATH, join(scriptsDir, "check-goal-board.py"));
		writeValidator(validatorPath, "goal-board");
		writeRuntimeEvidenceActiveArtifacts(repo);
		writeRuntimeEvidenceReceiptsFromObjects(repo, [
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
		]);
		writeFileSync(
			join(scriptsDir, "check-goal-audit-freshness.py"),
			[
				"#!/usr/bin/env python3",
				"from __future__ import annotations",
				"raise SystemExit(0)",
				"",
			].join("\n"),
		);

		const result = spawnSync(
			"python3",
			["scripts/check-goal-board.py", goalDir],
			{
				cwd: repo,
				encoding: "utf8",
				env: {
					...process.env,
					GOAL_GOVERNOR_CHECK_BOARD: validatorPath,
					GOAL_GOVERNOR_CHECK_GOAL_BOARD: "",
					PYTHONDONTWRITEBYTECODE: "1",
				},
			},
		);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("receipt R151");
		expect(result.stderr).toContain("$.evidence.source");
		expect(result.stderr).not.toContain("file:///Users/jamie");
	});

	it("fails on malformed post-cutover receipt IDs with local paths", () => {
		const root = createTempRoot("goal-board-malformed-cutover-id-");
		const repo = join(root, "coding-harness");
		const scriptsDir = join(repo, "scripts");
		const goalDir = join(
			repo,
			"docs/goals/codex-runtime-evidence-verifier-cockpit",
		);
		const validatorPath = join(root, "check_goal_board.py");
		mkdirSync(scriptsDir, { recursive: true });
		mkdirSync(goalDir, { recursive: true });
		copyFileSync(SCRIPT_PATH, join(scriptsDir, "check-goal-board.py"));
		writeValidator(validatorPath, "goal-board");
		writeRuntimeEvidenceActiveArtifacts(repo);
		writeRuntimeEvidenceReceiptsFromObjects(repo, [
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
		]);
		writeFileSync(
			join(scriptsDir, "check-goal-audit-freshness.py"),
			[
				"#!/usr/bin/env python3",
				"from __future__ import annotations",
				"raise SystemExit(0)",
				"",
			].join("\n"),
		);

		const result = spawnSync(
			"python3",
			["scripts/check-goal-board.py", goalDir],
			{
				cwd: repo,
				encoding: "utf8",
				env: {
					...process.env,
					GOAL_GOVERNOR_CHECK_BOARD: validatorPath,
					GOAL_GOVERNOR_CHECK_GOAL_BOARD: "",
					PYTHONDONTWRITEBYTECODE: "1",
				},
			},
		);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("receipt R151a");
		expect(result.stderr).toContain("$.evidence.source");
		expect(result.stderr).not.toContain("file:///Users/jamie");
	});

	it("fails on post-cutover local paths stored as JSON object keys", () => {
		const root = createTempRoot("goal-board-local-path-key-");
		const repo = join(root, "coding-harness");
		const scriptsDir = join(repo, "scripts");
		const goalDir = join(
			repo,
			"docs/goals/codex-runtime-evidence-verifier-cockpit",
		);
		const validatorPath = join(root, "check_goal_board.py");
		mkdirSync(scriptsDir, { recursive: true });
		mkdirSync(goalDir, { recursive: true });
		copyFileSync(SCRIPT_PATH, join(scriptsDir, "check-goal-board.py"));
		writeValidator(validatorPath, "goal-board");
		writeRuntimeEvidenceActiveArtifacts(repo);
		writeRuntimeEvidenceReceiptsFromObjects(repo, [
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
		]);
		writeFileSync(
			join(scriptsDir, "check-goal-audit-freshness.py"),
			[
				"#!/usr/bin/env python3",
				"from __future__ import annotations",
				"raise SystemExit(0)",
				"",
			].join("\n"),
		);

		const result = spawnSync(
			"python3",
			["scripts/check-goal-board.py", goalDir],
			{
				cwd: repo,
				encoding: "utf8",
				env: {
					...process.env,
					GOAL_GOVERNOR_CHECK_BOARD: validatorPath,
					GOAL_GOVERNOR_CHECK_GOAL_BOARD: "",
					PYTHONDONTWRITEBYTECODE: "1",
				},
			},
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
		const root = createTempRoot("goal-board-cross-platform-paths-");
		const repo = join(root, "coding-harness");
		const scriptsDir = join(repo, "scripts");
		const goalDir = join(
			repo,
			"docs/goals/codex-runtime-evidence-verifier-cockpit",
		);
		const validatorPath = join(root, "check_goal_board.py");
		mkdirSync(scriptsDir, { recursive: true });
		mkdirSync(goalDir, { recursive: true });
		copyFileSync(SCRIPT_PATH, join(scriptsDir, "check-goal-board.py"));
		writeValidator(validatorPath, "goal-board");
		writeRuntimeEvidenceActiveArtifacts(repo);
		writeRuntimeEvidenceReceiptsFromObjects(repo, [
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
		]);
		writeFileSync(
			join(scriptsDir, "check-goal-audit-freshness.py"),
			[
				"#!/usr/bin/env python3",
				"from __future__ import annotations",
				"raise SystemExit(0)",
				"",
			].join("\n"),
		);

		const result = spawnSync(
			"python3",
			["scripts/check-goal-board.py", goalDir],
			{
				cwd: repo,
				encoding: "utf8",
				env: {
					...process.env,
					GOAL_GOVERNOR_CHECK_BOARD: validatorPath,
					GOAL_GOVERNOR_CHECK_GOAL_BOARD: "",
					PYTHONDONTWRITEBYTECODE: "1",
				},
			},
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
