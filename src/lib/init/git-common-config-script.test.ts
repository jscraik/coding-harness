import { copyFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const SCRIPT_PATH = join(process.cwd(), "scripts/check-git-common-config.sh");

function createFixtureRepo() {
	const repoRoot = mkdtempSync(join(tmpdir(), "git-common-config-"));
	mkdirSync(join(repoRoot, "scripts"));
	copyFileSync(
		SCRIPT_PATH,
		join(repoRoot, "scripts/check-git-common-config.sh"),
	);
	execFileSync("git", ["init"], { cwd: repoRoot, stdio: "ignore" });
	return repoRoot;
}

describe("check-git-common-config.sh", () => {
	it("passes when common git config does not pin core.worktree", () => {
		const repoRoot = createFixtureRepo();

		const result = spawnSync("bash", ["scripts/check-git-common-config.sh"], {
			cwd: repoRoot,
			encoding: "utf8",
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("[check-git-common-config] ok");
	});

	it("fails when common git config pins core.worktree", () => {
		const repoRoot = createFixtureRepo();
		const poisonedWorktree = join(tmpdir(), "poisoned-worktree");
		execFileSync(
			"git",
			["config", "--local", "core.worktree", poisonedWorktree],
			{
				cwd: repoRoot,
			},
		);

		const result = spawnSync("bash", ["scripts/check-git-common-config.sh"], {
			cwd: repoRoot,
			encoding: "utf8",
		});

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			`shared Git config contains core.worktree=${poisonedWorktree}`,
		);
		expect(result.stderr).toContain("git config --local --unset core.worktree");
	});
});
