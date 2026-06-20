import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runNodeScript, runScriptProcess } from "./script-test-utils.js";

const SCRIPT_PATH = join(
	process.cwd(),
	"scripts/check-harness-audit-tracking.mjs",
);

const tempRoots: string[] = [];

function createTempRepo(prefix: string) {
	const root = mkdtempSync(join(tmpdir(), prefix));
	tempRoots.push(root);
	const result = runScriptProcess("git", ["init"], { cwd: root });
	expect(result.status).toBe(0);
	return root;
}

function writeSource(root: string, path: string, content: string) {
	const filePath = join(root, path);
	mkdirSync(dirname(filePath), { recursive: true });
	writeFileSync(filePath, content);
}

function runScript(
	root: string,
	env: NodeJS.ProcessEnv = process.env,
	args: readonly string[] = [],
) {
	return runNodeScript(SCRIPT_PATH, args, {
		cwd: root,
		env,
	});
}

function writeCompliantHarnessTrackingFiles(root: string) {
	writeSource(
		root,
		".gitignore",
		[
			".harness/*",
			"!.harness/audits/",
			".harness/audits/*",
			"!.harness/audits/**/*.md",
			"!.harness/feedback-loops/",
			".harness/feedback-loops/*",
			"!.harness/feedback-loops/index.json",
		].join("\n"),
	);
	writeSource(
		root,
		".harness/README.md",
		[
			"Operator-requested audits belong in `.harness/audits/`.",
			"Research-discovery audits belong in `.harness/research/audits/`.",
			"Audit names should look like `.harness/audits/YYYY-MM-DD-...-audit.md`.",
			"Track `.harness/feedback-loops/index.json` for feedback-loop-audit.",
		].join("\n"),
	);
}

describe("check-harness-audit-tracking.mjs", () => {
	afterEach(() => {
		for (const root of tempRoots.splice(0)) {
			rmSync(root, { force: true, recursive: true });
		}
	});

	it("sanitizes caller-scoped git environment before checking harness ignore rules", () => {
		const root = createTempRepo("harness-audit-tracking-");
		writeCompliantHarnessTrackingFiles(root);

		const contaminatingRoot = createTempRepo("harness-audit-contaminating-");
		writeSource(contaminatingRoot, ".gitignore", [".harness/*"].join("\n"));

		const result = runScript(root, {
			...process.env,
			GIT_DIR: join(contaminatingRoot, ".git"),
			GIT_WORK_TREE: contaminatingRoot,
			GIT_INDEX_FILE: join(contaminatingRoot, ".git", "index"),
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toContain(
			"verified .harness audit tracking contract",
		);
		expect(result.stderr).not.toContain("missing audit tracking contract");
	});

	it("emits parseable JSON when required inputs cannot be read", () => {
		const root = createTempRepo("harness-audit-tracking-missing-");

		const result = runScript(root, process.env, ["--json"]);

		expect(result.status).toBe(1);
		expect(result.stderr).toBe("");
		const payload = JSON.parse(result.stdout) as {
			schemaVersion: string;
			status: string;
			failures: Array<{ name: string; message: string }>;
		};
		expect(payload.schemaVersion).toBe("harness-audit-tracking/v1");
		expect(payload.status).toBe("fail");
		expect(payload.failures).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: "audit-tracking input read failure",
				}),
			]),
		);
	});

	it("classifies fatal git check-ignore exits as operational failures", () => {
		const root = createTempRepo("harness-audit-tracking-git-fatal-");
		writeCompliantHarnessTrackingFiles(root);
		const binDir = join(root, "bin");
		mkdirSync(binDir, { recursive: true });
		const gitPath = join(binDir, "git");
		writeFileSync(
			gitPath,
			[
				"#!/bin/sh",
				'if [ "$1" = "check-ignore" ]; then',
				"  echo fatal check-ignore >&2",
				"  exit 128",
				"fi",
				'exec /usr/bin/git "$@"',
				"",
			].join("\n"),
		);
		chmodSync(gitPath, 0o755);

		const result = runScript(
			root,
			{
				...process.env,
				PATH: `${binDir}:${process.env.PATH ?? ""}`,
			},
			["--json"],
		);

		expect(result.status).toBe(1);
		const payload = JSON.parse(result.stdout) as {
			failures: Array<{ name: string; message: string }>;
		};
		expect(payload.failures).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: "git check-ignore execution failure",
				}),
			]),
		);
	});
});
