import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT_PATH = fileURLToPath(
	new URL("../../scripts/check-code-size.mjs", import.meta.url),
);

const tempRoots: string[] = [];

function createTempRepo() {
	const root = mkdtempSync(join(tmpdir(), "check-code-size-"));
	tempRoots.push(root);
	mkdirSync(join(root, "src"), { recursive: true });
	const init = spawnSync("git", ["init"], { cwd: root, encoding: "utf8" });
	expect(init.status).toBe(0);
	return root;
}

function writeSource(root: string, path: string, content: string): void {
	mkdirSync(dirname(join(root, path)), { recursive: true });
	writeFileSync(join(root, path), content);
}

function runScript(root: string, args: string[] = []) {
	return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
		cwd: root,
		encoding: "utf8",
	});
}

function longFunctionSource(lineCount: number): string {
	const body = Array.from(
		{ length: lineCount },
		(_, index) => `\tconst value${String(index)} = ${String(index)};`,
	);
	return ["export function oversized() {", ...body, "\treturn 1;", "}"].join(
		"\n",
	);
}

function complexFunctionSource(branches: number): string {
	const body = Array.from(
		{ length: branches },
		(_, index) =>
			`\tif (value > ${String(index)}) total += ${String(index + 1)};`,
	);
	return [
		"export function tangled(value: number) {",
		"\tlet total = 0;",
		...body,
		"\treturn total;",
		"}",
	].join("\n");
}

afterEach(() => {
	for (const root of tempRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("check-code-size.mjs", () => {
	it("passes concise changed production source", () => {
		const root = createTempRepo();
		writeSource(
			root,
			"src/concise.ts",
			"export function ok() {\n\treturn 1;\n}\n",
		);

		const result = runScript(root);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("size and complexity limits passed");
	});

	it("blocks changed production functions over 80 logical lines", () => {
		const root = createTempRepo();
		writeSource(root, "src/oversized.ts", longFunctionSource(82));

		const result = runScript(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("src/oversized.ts:1 oversized has");
		expect(result.stderr).toContain("max is 80");
	});

	it("allows explicitly listed legacy production files to exceed file length", () => {
		const root = createTempRepo();
		writeSource(
			root,
			"src/lib/contract/types-core.ts",
			Array.from(
				{ length: 401 },
				(_, index) => `export const value${String(index)} = ${String(index)};`,
			).join("\n"),
		);

		const result = runScript(root);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("size and complexity limits passed");
	});

	it("blocks changed production functions over complexity 10", () => {
		const root = createTempRepo();
		writeSource(root, "src/tangled.ts", complexFunctionSource(11));

		const result = runScript(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"src/tangled.ts:1 tangled has complexity 12",
		);
		expect(result.stderr).toContain("max is 10");
	});

	it("suppresses size findings already present in the debt baseline", () => {
		const root = createTempRepo();
		writeSource(root, "src/tangled.ts", complexFunctionSource(11));
		writeSource(
			root,
			"contracts/code-quality-debt-baseline.json",
			JSON.stringify({
				schemaVersion: "code-quality-debt-baseline/v1",
				entries: [
					{
						id: "high_complexity_function:src/tangled.ts:tangled",
					},
				],
			}),
		);

		const result = runScript(root);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("1 baselined finding(s) suppressed");
	});

	it("emits structured JSON findings for AST-derived size failures", () => {
		const root = createTempRepo();
		writeSource(root, "src/tangled.ts", complexFunctionSource(11));

		const result = runScript(root, ["--json"]);
		const report = JSON.parse(result.stdout) as {
			status: string;
			findings: Array<Record<string, unknown>>;
		};

		expect(result.status).toBe(1);
		expect(report.status).toBe("fail");
		expect(report.findings[0]).toEqual(
			expect.objectContaining({
				kind: "function_complexity",
				path: "src/tangled.ts",
				line: 1,
				symbol: "tangled",
				actual: 12,
				max: 10,
			}),
		);
	});

	it("blocks changed test files over 1200 logical lines", () => {
		const root = createTempRepo();
		writeSource(
			root,
			"src/large.test.ts",
			Array.from(
				{ length: 1_201 },
				(_, index) => `// line ${String(index)}`,
			).join("\n"),
		);

		const result = runScript(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"src/large.test.ts:1 test file has 1201 lines",
		);
		expect(result.stderr).toContain("max is 1200");
	});
});
