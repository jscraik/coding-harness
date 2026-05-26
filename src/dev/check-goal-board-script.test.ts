import { execFileSync, spawnSync } from "node:child_process";
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
});
