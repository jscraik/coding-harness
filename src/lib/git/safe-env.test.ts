import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { sanitizeGitEnvironment } from "./safe-env.js";

describe("sanitizeGitEnvironment", () => {
	it("strict policy drops every GIT-prefixed key", () => {
		const sanitized = sanitizeGitEnvironment(
			{
				GIT_DIR: "/tmp/repo/.git",
				GIT_AUTHOR_NAME: "Jamie",
				PATH: "/usr/bin",
			},
			{ policy: "strict" },
		);

		expect(sanitized).toEqual({ PATH: "/usr/bin" });
	});

	it("minimal policy drops caller-scoped repository keys and keeps identity config", () => {
		const sanitized = sanitizeGitEnvironment(
			{
				GIT_ALTERNATE_OBJECT_DIRECTORIES: "/tmp/quarantine/alternates",
				GIT_CONFIG: "/tmp/gitconfig",
				GIT_CONFIG_COUNT: "1",
				GIT_CONFIG_GLOBAL: "/tmp/global.gitconfig",
				GIT_CONFIG_KEY_0: "status.showUntrackedFiles",
				GIT_CONFIG_NOSYSTEM: "1",
				GIT_CONFIG_PARAMETERS: "status.showUntrackedFiles=no",
				GIT_CONFIG_SYSTEM: "/tmp/system.gitconfig",
				GIT_CONFIG_VALUE_0: "no",
				GIT_DIR: "/tmp/repo/.git",
				GIT_OBJECT_DIRECTORY: "/tmp/quarantine/objects",
				GIT_QUARANTINE_PATH: "/tmp/quarantine",
				GIT_WORK_TREE: "/tmp/repo",
				GIT_AUTHOR_NAME: "Jamie",
				PATH: "/usr/bin",
			},
			{ policy: "minimal" },
		);

		expect(sanitized).toEqual({
			GIT_AUTHOR_NAME: "Jamie",
			PATH: "/usr/bin",
		});
	});

	function expectGitSuccess(
		result: ReturnType<typeof spawnSync>,
		label: string,
	): void {
		expect(result.error, label).toBeUndefined();
		expect(result.status, `${label} stderr: ${result.stderr}`).toBe(0);
	}

	it("minimal policy drops env-provided Git config that can alter status truth", () => {
		const root = mkdtempSync(join(tmpdir(), "git-env-config-"));
		const contaminatedEnv = {
			...process.env,
			GIT_CONFIG_COUNT: "1",
			GIT_CONFIG_KEY_0: "status.showUntrackedFiles",
			GIT_CONFIG_VALUE_0: "no",
		};

		const initResult = spawnSync("git", ["init"], {
			cwd: root,
			encoding: "utf8",
		});
		expectGitSuccess(initResult, "git init for env config test");
		writeFileSync(join(root, "untracked.txt"), "untracked\n");

		const contaminatedStatus = spawnSync("git", ["status", "--porcelain"], {
			cwd: root,
			env: contaminatedEnv,
			encoding: "utf8",
		});
		const sanitizedStatus = spawnSync("git", ["status", "--porcelain"], {
			cwd: root,
			env: sanitizeGitEnvironment(contaminatedEnv, { policy: "minimal" }),
			encoding: "utf8",
		});

		expectGitSuccess(contaminatedStatus, "contaminated git status");
		expectGitSuccess(sanitizedStatus, "sanitized git status");
		expect(contaminatedStatus.stdout).not.toContain("untracked.txt");
		expect(sanitizedStatus.stdout).toContain("?? untracked.txt");
	});

	it("minimal policy drops Git config file pointers that can alter status truth", () => {
		const root = mkdtempSync(join(tmpdir(), "git-env-file-config-"));
		const configPath = join(root, "evil.gitconfig");
		const contaminatedEnv = {
			...process.env,
			GIT_CONFIG_GLOBAL: configPath,
		};

		const initResult = spawnSync("git", ["init"], {
			cwd: root,
			encoding: "utf8",
		});
		expectGitSuccess(initResult, "git init for file config test");
		writeFileSync(join(root, "untracked.txt"), "untracked\n");
		writeFileSync(configPath, "[status]\n\tshowUntrackedFiles = no\n");

		const contaminatedStatus = spawnSync("git", ["status", "--porcelain"], {
			cwd: root,
			env: contaminatedEnv,
			encoding: "utf8",
		});
		const sanitizedStatus = spawnSync("git", ["status", "--porcelain"], {
			cwd: root,
			env: sanitizeGitEnvironment(contaminatedEnv, { policy: "minimal" }),
			encoding: "utf8",
		});

		expectGitSuccess(contaminatedStatus, "contaminated file-config git status");
		expectGitSuccess(sanitizedStatus, "sanitized file-config git status");
		expect(contaminatedStatus.stdout).not.toContain("untracked.txt");
		expect(sanitizedStatus.stdout).toContain("?? untracked.txt");
	});
});
