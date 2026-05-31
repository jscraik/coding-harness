import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT_PATH = join(process.cwd(), "scripts/check-git-env-sanitizer.mjs");

const tempRoots: string[] = [];

function createTempRepo() {
	const root = mkdtempSync(join(tmpdir(), "git-env-sanitizer-"));
	tempRoots.push(root);
	spawnSync("git", ["init"], { cwd: root, encoding: "utf8" });
	return root;
}

function writeSource(root: string, path: string, content: string) {
	const filePath = join(root, path);
	mkdirSync(join(filePath, ".."), { recursive: true });
	writeFileSync(filePath, content);
}

function runScript(root: string) {
	return spawnSync(process.execPath, [SCRIPT_PATH], {
		cwd: root,
		encoding: "utf8",
	});
}

describe("check-git-env-sanitizer.mjs", () => {
	afterEach(() => {
		for (const root of tempRoots.splice(0)) {
			rmSync(root, { force: true, recursive: true });
		}
	});

	it("fails for untracked source files that manually clean git environment variables", () => {
		const root = createTempRepo();
		writeSource(
			root,
			"src/lib/runtime/untracked-git-env.ts",
			[
				"export function clean(environment: NodeJS.ProcessEnv) {",
				"	delete environment.GIT_DIR;",
				"	return environment;",
				"}",
			].join("\n"),
		);

		const result = runScript(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("src/lib/runtime/untracked-git-env.ts");
		expect(result.stderr).toContain("Use sanitizeGitEnvironment");
	});

	it("fails for bracket-based manual git environment cleanup", () => {
		const root = createTempRepo();
		writeSource(
			root,
			"src/lib/runtime/bracket-git-env.ts",
			[
				"export function clean(environment: NodeJS.ProcessEnv) {",
				'	delete environment["GIT_DIR"];',
				"	return environment;",
				"}",
			].join("\n"),
		);

		const result = runScript(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("src/lib/runtime/bracket-git-env.ts");
	});

	it("fails for key-filter manual git environment cleanup", () => {
		const root = createTempRepo();
		writeSource(
			root,
			"src/lib/runtime/filter-git-env.ts",
			[
				"export function clean(environment: NodeJS.ProcessEnv) {",
				"	for (const key of Object.keys(environment)) {",
				"		if (/^GIT_/.test(key)) delete environment[key];",
				"	}",
				"	return environment;",
				"}",
			].join("\n"),
		);

		const result = runScript(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("src/lib/runtime/filter-git-env.ts");
	});

	it("allows the centralized sanitizer module to own git environment cleanup", () => {
		const root = createTempRepo();
		writeSource(
			root,
			"src/lib/git/safe-env.ts",
			[
				"export function sanitize(environment: NodeJS.ProcessEnv) {",
				"	delete environment.GIT_DIR;",
				"	return environment;",
				"}",
			].join("\n"),
		);

		const result = runScript(root);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("no manual git environment cleanup found");
	});
});
