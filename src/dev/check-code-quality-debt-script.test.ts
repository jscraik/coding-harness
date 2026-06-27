import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT_PATH = fileURLToPath(
	new URL("../../scripts/check-code-quality-debt.mjs", import.meta.url),
);

const tempRoots: string[] = [];

function createTempRepo() {
	const root = mkdtempSync(join(tmpdir(), "check-code-quality-debt-"));
	tempRoots.push(root);
	mkdirSync(join(root, "src"), { recursive: true });
	const init = spawnSync("git", ["init"], { cwd: root, encoding: "utf8" });
	expect(init.status).toBe(0);
	return root;
}

function writeSource(root: string, path: string, content: string): void {
	const absolutePath = join(root, path);
	mkdirSync(dirname(absolutePath), { recursive: true });
	writeFileSync(absolutePath, content);
}

function runScript(root: string, args: string[] = []) {
	return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
		cwd: root,
		encoding: "utf8",
	});
}

function duplicateBlockSource(name: string): string {
	const lines = Array.from(
		{ length: 26 },
		(_, index) => `\tconst value${String(index)} = input + ${String(index)};`,
	);
	return [
		`export function ${name}(input: number) {`,
		...lines,
		"\treturn input;",
		"}",
	].join("\n");
}

afterEach(() => {
	for (const root of tempRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("check-code-quality-debt.mjs", () => {
	it("fails closed when the baseline is missing", () => {
		const root = createTempRepo();
		writeSource(
			root,
			"src/clean.ts",
			"export function clean() {\n\treturn 1;\n}\n",
		);

		const result = runScript(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("missing baseline");
		expect(result.stderr).toContain(
			"pnpm run quality:debt -- --update-baseline",
		);
	});

	it("writes a baseline and passes unchanged debt", () => {
		const root = createTempRepo();
		writeSource(
			root,
			"src/legacy.ts",
			"// TODO: legacy marker\nexport const value: any = 1;\n",
		);

		const update = runScript(root, ["--update-baseline"]);
		const result = runScript(root, ["--json"]);

		expect(update.status).toBe(0);
		expect(update.stdout).toContain("wrote");
		expect(result.status).toBe(0);
		const report = JSON.parse(result.stdout) as {
			status: string;
			currentCount: number;
			newDebt: unknown[];
		};
		expect(report.status).toBe("pass");
		expect(report.currentCount).toBeGreaterThan(0);
		expect(report.newDebt).toEqual([]);
	});

	it("blocks new production markers after baseline generation", () => {
		const root = createTempRepo();
		writeSource(
			root,
			"src/clean.ts",
			"export function clean() {\n\treturn 1;\n}\n",
		);
		expect(runScript(root, ["--update-baseline"]).status).toBe(0);

		writeSource(
			root,
			"src/new-marker.ts",
			"// FIXME: ship later\nexport function marker() {\n\treturn 1;\n}\n",
		);
		const result = runScript(root, ["--json"]);
		const report = JSON.parse(result.stdout) as {
			status: string;
			newDebt: Array<{ category: string; path: string }>;
		};

		expect(result.status).toBe(1);
		expect(report.status).toBe("fail");
		expect(report.newDebt).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					category: "production_marker",
					path: "src/new-marker.ts",
				}),
			]),
		);
	});

	it("blocks new duplicate production blocks after baseline generation", () => {
		const root = createTempRepo();
		writeSource(root, "src/one.ts", duplicateBlockSource("one"));
		expect(runScript(root, ["--update-baseline"]).status).toBe(0);

		writeSource(root, "src/two.ts", duplicateBlockSource("two"));
		const result = runScript(root, ["--json"]);
		const report = JSON.parse(result.stdout) as {
			status: string;
			newDebt: Array<{ category: string; relatedPath?: string }>;
		};

		expect(result.status).toBe(1);
		expect(report.status).toBe("fail");
		expect(report.newDebt).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					category: "duplicate_block",
					relatedPath: "src/two.ts",
				}),
			]),
		);
	});
});
