import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runNodeScript, runScriptProcess } from "./script-test-utils.js";

const SCRIPT_PATH = join(
	process.cwd(),
	"scripts/check-boundary-unknown-guards.mjs",
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

function writeBaseline(root: string, entries: unknown[] = []) {
	writeSource(
		root,
		"scripts/boundary-unknown-guards-baseline.json",
		`${JSON.stringify(
			{
				schema_version: 1,
				description: "test baseline",
				entries,
			},
			null,
			2,
		)}\n`,
	);
}

function track(root: string, paths: string[]) {
	const result = runScriptProcess("git", ["add", "--", ...paths], {
		cwd: root,
	});
	expect(result.status).toBe(0);
}

function runGuard(root: string, args: readonly string[] = []) {
	return runNodeScript(SCRIPT_PATH, args, { cwd: root });
}

describe("check-boundary-unknown-guards.mjs", () => {
	afterEach(() => {
		for (const root of tempRoots.splice(0)) {
			rmSync(root, { force: true, recursive: true });
		}
	});

	it("fails new TypeScript generic shape guards with an upstream-boundary repair prompt", () => {
		const root = createTempRepo("boundary-unknown-ts-");
		writeBaseline(root);
		writeSource(
			root,
			"src/domain/shape.ts",
			[
				"function isRecord(value: unknown): value is Record<string, unknown> {",
				'\treturn typeof value === "object" && value !== null;',
				"}",
			].join("\n"),
		);
		track(root, [
			"scripts/boundary-unknown-guards-baseline.json",
			"src/domain/shape.ts",
		]);

		const result = runGuard(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("boundary-no-late-unknown:isRecord");
		expect(result.stderr).toContain("Agent prompt: Do not add isRecord here.");
		expect(result.stderr).toContain(
			"Fix the upstream parser, schema, API adapter, DTO, config loader",
		);
	});

	it("fails JavaScript, Python, and shell generic shape helpers", () => {
		const root = createTempRepo("boundary-unknown-polyglot-");
		writeBaseline(root);
		writeSource(
			root,
			"scripts/shape.cjs",
			[
				"function isObject(value) {",
				'\treturn typeof value === "object" && value !== null;',
				"}",
			].join("\n"),
		);
		writeSource(
			root,
			"tools/shape.py",
			["def is_record(value):", "    return isinstance(value, dict)"].join(
				"\n",
			),
		);
		writeSource(
			root,
			"scripts/shape.sh",
			["as_record() {", "  return 0", "}"].join("\n"),
		);
		track(root, [
			"scripts/boundary-unknown-guards-baseline.json",
			"scripts/shape.cjs",
			"tools/shape.py",
			"scripts/shape.sh",
		]);

		const result = runGuard(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("boundary-no-late-unknown:isObject");
		expect(result.stderr).toContain("boundary-no-late-unknown:is_record");
		expect(result.stderr).toContain("boundary-no-late-unknown:as_record");
	});

	it("allows typed domain validators that do not introduce late unknown helpers", () => {
		const root = createTempRepo("boundary-unknown-domain-validator-");
		writeBaseline(root);
		writeSource(
			root,
			"src/domain/shape.ts",
			[
				"interface Receipt { id: string }",
				"export function hasReceiptId(value: Receipt): boolean {",
				"\treturn value.id.length > 0;",
				"}",
			].join("\n"),
		);
		track(root, [
			"scripts/boundary-unknown-guards-baseline.json",
			"src/domain/shape.ts",
		]);

		const result = runGuard(root);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("no new entries");
	});
});
