import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

function runScript(root: string, env: NodeJS.ProcessEnv = process.env) {
	return runNodeScript(SCRIPT_PATH, [], {
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
});
