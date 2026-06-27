import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT_PATH = join(process.cwd(), "scripts/check-public-api-docs.mjs");

const tempRoots: string[] = [];

function runGit(root: string, args: string[]) {
	const result = spawnSync("git", args, {
		cwd: root,
		encoding: "utf8",
	});
	if (result.status !== 0) {
		throw new Error(result.stderr || result.stdout);
	}
}

function createRepo(files: Record<string, string>) {
	const root = mkdtempSync(join(tmpdir(), "public-api-docs-"));
	tempRoots.push(root);
	mkdirSync(join(root, "src"), { recursive: true });
	runGit(root, ["init"]);
	runGit(root, ["config", "user.email", "codex@example.test"]);
	runGit(root, ["config", "user.name", "Codex"]);
	writeFileSync(join(root, "README.md"), "# Fixture\n");
	for (const [path, content] of Object.entries(files)) {
		const absolutePath = join(root, path);
		mkdirSync(dirname(absolutePath), { recursive: true });
		writeFileSync(absolutePath, content);
	}
	runGit(root, ["add", "."]);
	runGit(root, ["commit", "-m", "baseline"]);
	return root;
}

function runScript(
	root: string,
	args: string[] = [],
	env: Record<string, string | undefined> = {},
) {
	return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
		cwd: root,
		encoding: "utf8",
		env: {
			...process.env,
			DOCSTRING_COVERAGE_THRESHOLD: "80",
			...env,
		},
	});
}

afterEach(() => {
	for (const root of tempRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("check-public-api-docs.mjs", () => {
	it("fails when touched function JSDoc coverage falls below the ratchet", () => {
		const root = createRepo({});
		writeFileSync(
			join(root, "src/api.ts"),
			["function missingDoc() {", "\treturn true;", "}", ""].join("\n"),
		);

		const result = runScript(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"touched function JSDoc coverage ratchet failed; aggregate coverage is 0.00%, and each changed production file must meet 80.00%",
		);
		expect(result.stderr).toContain("src/api.ts:1 missingDoc");
	});

	it("does not charge untouched legacy functions to a focused diff", () => {
		const root = createRepo({
			"src/api.ts": [
				"function legacyMissingDoc() {",
				"\treturn true;",
				"}",
				"",
			].join("\n"),
		});
		writeFileSync(
			join(root, "src/api.ts"),
			[
				"function legacyMissingDoc() {",
				"\treturn true;",
				"}",
				"",
				"/** Documents the newly touched function. */",
				"function addedWithDoc() {",
				"\treturn true;",
				"}",
				"",
			].join("\n"),
		);

		const result = runScript(root);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain(
			"checked 1 file(s); exported public API docs present.",
		);
	});

	it("keeps exported public API declarations as a hard JSDoc failure", () => {
		const root = createRepo({});
		writeFileSync(
			join(root, "src/api.ts"),
			["export function missingPublicDoc() {", "\treturn true;", "}", ""].join(
				"\n",
			),
		);

		const result = runScript(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"exported public API declarations need JSDoc",
		);
		expect(result.stderr).toContain("src/api.ts:1 missingPublicDoc");
	});

	it("fails closed when the configured docstring threshold is invalid", () => {
		const root = createRepo({
			"src/api.ts": [
				"/** Documents the public helper. */",
				"export function documentedPublicHelper() {",
				"\treturn true;",
				"}",
				"",
			].join("\n"),
		});

		const result = runScript(root, [], {
			DOCSTRING_COVERAGE_THRESHOLD: "not-a-number",
		});

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"invalid DOCSTRING_COVERAGE_THRESHOLD: not-a-number",
		);
	});

	it("requires JSDoc for exported variable initializer API targets", () => {
		const root = createRepo({});
		writeFileSync(
			join(root, "src/api.ts"),
			[
				"export const missingArrow = () => true;",
				"export const MissingClass = class {",
				"\tvalue = true;",
				"};",
				"",
			].join("\n"),
		);

		const result = runScript(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"exported public API declarations need JSDoc",
		);
		expect(result.stderr).toContain("src/api.ts:1 missingArrow");
		expect(result.stderr).toContain("src/api.ts:2 MissingClass");
	});

	it("treats comment-only edits as touched function documentation coverage", () => {
		const root = createRepo({
			"src/api.ts": [
				"/** Documents the helper. */",
				"function commentOnlyTouched() {",
				"\treturn true;",
				"}",
				"",
			].join("\n"),
		});
		writeFileSync(
			join(root, "src/api.ts"),
			[
				"/* Downgraded helper docs. */",
				"function commentOnlyTouched() {",
				"\treturn true;",
				"}",
				"",
			].join("\n"),
		);

		const result = runScript(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"touched function JSDoc coverage ratchet failed",
		);
		expect(result.stderr).toContain("src/api.ts:2 commentOnlyTouched");
	});

	it("treats deletion-only hunks as touched function documentation coverage", () => {
		const root = createRepo({
			"src/api.ts": [
				"function deletionTouched() {",
				"\tconst removed = true;",
				"\treturn true;",
				"}",
				"",
			].join("\n"),
		});
		writeFileSync(
			join(root, "src/api.ts"),
			["function deletionTouched() {", "\treturn true;", "}", ""].join("\n"),
		);

		const result = runScript(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"touched function JSDoc coverage ratchet failed",
		);
		expect(result.stderr).toContain("src/api.ts:1 deletionTouched");
	});
});
