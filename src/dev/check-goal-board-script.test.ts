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

function writeRuntimeEvidenceActiveArtifacts(repo: string, content?: string) {
	const harnessDir = join(repo, ".harness");
	mkdirSync(harnessDir, { recursive: true });
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
				"| Codex runtime evidence verifier cockpit | JSC-363 | .harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md plus .harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md plus docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md plus .harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md |",
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
});
