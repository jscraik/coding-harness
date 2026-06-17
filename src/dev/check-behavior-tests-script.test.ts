import { spawnSync } from "node:child_process";
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT_PATH = join(process.cwd(), "scripts/check-behavior-tests.mjs");

const tempRoots: string[] = [];

function createTempRoot() {
	const root = mkdtempSync(join(tmpdir(), "behavior-tests-"));
	tempRoots.push(root);
	return root;
}

function writeFile(root: string, path: string, content: string) {
	const filePath = join(root, path);
	mkdirSync(join(filePath, ".."), { recursive: true });
	writeFileSync(filePath, content);
}

function writeManifest(root: string, path: string, provingCommand?: string) {
	const command = provingCommand ?? `pnpm vitest run ${path}`;
	writeManifestEntries(root, [
		{
			path,
			provingCommand: command,
		},
	]);
}

function writeManifestEntries(
	root: string,
	entries: readonly { path: string; provingCommand?: string }[],
) {
	writeFile(
		root,
		"src/lib/testing/behavior-test-suites.json",
		JSON.stringify(
			entries.map((entry) => ({
				path: entry.path,
				owner: "test-owner",
				rationale: "prove executable behavior assertion detection",
				provingCommand: entry.provingCommand ?? `pnpm vitest run ${entry.path}`,
			})),
			null,
			2,
		),
	);
}

function writeFakeVitest(
	root: string,
	suitePath: string,
	mode: "trace" | "no-trace" = "trace",
	path = "node_modules/.bin/vitest",
	stackPath = suitePath,
) {
	const executablePath = path.endsWith(".cmd") ? `${path}.mjs` : path;
	writeFile(
		root,
		executablePath,
		[
			"#!/usr/bin/env node",
			"import { appendFileSync } from 'node:fs';",
			"if (process.argv.slice(2).join(' ') !== 'run " +
				suitePath +
				"') process.exit(2);",
			`if (${JSON.stringify(mode)} === 'trace') appendFileSync(`,
			"  process.env.HARNESS_EXPECT_BEHAVIOR_TRACE_FILE ?? '',",
			"  JSON.stringify({ given: 'input', should: 'match', token: process.env.HARNESS_EXPECT_BEHAVIOR_TRACE_TOKEN, stack: " +
				JSON.stringify(`at test (${stackPath}:1:1)`) +
				" }) + '\\n',",
			");",
		].join("\n"),
	);
	if (path.endsWith(".cmd")) {
		writeFile(root, path, ["#!/bin/sh", 'exec node "$0.mjs" "$@"'].join("\n"));
	}
	chmodSync(join(root, path), 0o755);
	if (executablePath !== path) chmodSync(join(root, executablePath), 0o755);
}

function writeMultiSuiteFakeVitest(
	root: string,
	suitePaths: readonly string[],
	noTraceSuitePaths: readonly string[] = [],
) {
	writeFile(
		root,
		"node_modules/.bin/vitest",
		[
			"#!/usr/bin/env node",
			"import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';",
			"const args = process.argv.slice(2);",
			`const suitePaths = ${JSON.stringify(suitePaths)};`,
			`const noTraceSuitePaths = ${JSON.stringify(noTraceSuitePaths)};`,
			"const calls = existsSync('vitest-args.json') ? JSON.parse(readFileSync('vitest-args.json', 'utf8')) : [];",
			"calls.push(args);",
			"writeFileSync('vitest-args.json', JSON.stringify(calls));",
			"const suitePath = args[1];",
			"if (args.length !== 2 || args[0] !== 'run' || !suitePaths.includes(suitePath)) process.exit(2);",
			"if (!noTraceSuitePaths.includes(suitePath)) {",
			"  appendFileSync(",
			"    process.env.HARNESS_EXPECT_BEHAVIOR_TRACE_FILE ?? '',",
			"    JSON.stringify({ given: 'input', should: 'match', token: process.env.HARNESS_EXPECT_BEHAVIOR_TRACE_TOKEN, stack: 'at test (' + suitePath + ':1:1)' }) + '\\n',",
			"  );",
			"}",
		].join("\n"),
	);
	chmodSync(join(root, "node_modules/.bin/vitest"), 0o755);
}

function runScript(
	root: string,
	nodeArgs: readonly string[] = [],
	extraEnv: NodeJS.ProcessEnv = {},
) {
	return spawnSync(process.execPath, [...nodeArgs, SCRIPT_PATH], {
		cwd: root,
		encoding: "utf8",
		env: {
			...process.env,
			...extraEnv,
			PATH: `${join(root, "bin")}${delimiter}${process.env.PATH ?? ""}`,
		},
	});
}

describe("check-behavior-tests.mjs", () => {
	afterEach(() => {
		for (const root of tempRoots.splice(0)) {
			rmSync(root, { force: true, recursive: true });
		}
	});

	it("rejects inert expectBehavior text in comments", () => {
		const root = createTempRoot();
		writeManifest(root, "src/lib/example.test.ts");
		writeFile(
			root,
			"src/lib/example.test.ts",
			[
				"import { describe, it } from 'vitest';",
				"describe('example', () => {",
				"	it('does not prove behavior', () => {",
				"		// expectBehavior({ given: '', should: '', actual: 1, expected: 1 })",
				"	});",
				"});",
			].join("\n"),
		);

		const result = runScript(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"must include at least one executable expectBehavior assertion",
		);
	});

	it("rejects a locally shadowed expectBehavior function", () => {
		const root = createTempRoot();
		writeManifest(root, "src/lib/example.test.ts");
		writeFile(
			root,
			"src/lib/example.test.ts",
			[
				"import { describe, it } from 'vitest';",
				"const expectBehavior = () => {};",
				"describe('example', () => {",
				"	it('spoofs behavior', () => {",
				"		expectBehavior({ given: 'input', should: 'match', actual: 1, expected: 1 });",
				"	});",
				"});",
			].join("\n"),
		);

		const result = runScript(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"must include at least one executable expectBehavior assertion",
		);
	});

	it("rejects malformed expectBehavior calls", () => {
		const root = createTempRoot();
		writeManifest(root, "src/lib/example.test.ts");
		writeFile(
			root,
			"src/lib/example.test.ts",
			[
				"import { describe, it } from 'vitest';",
				"import { expectBehavior } from './testing/expect-behavior.js';",
				"describe('example', () => {",
				"	it('does not prove behavior shape', () => {",
				"		expectBehavior();",
				"	});",
				"});",
			].join("\n"),
		);

		const result = runScript(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"must include at least one executable expectBehavior assertion",
		);
	});

	it("rejects suite-local expectBehavior shims", () => {
		const root = createTempRoot();
		writeManifest(root, "src/lib/example.test.ts");
		writeFakeVitest(root, "src/lib/example.test.ts");
		writeFile(
			root,
			"src/lib/example.test.ts",
			[
				"import { describe, it } from 'vitest';",
				"import { expectBehavior } from './expect-behavior.js';",
				"describe('example', () => {",
				"\tit('spoofs helper identity', () => {",
				"\t\texpectBehavior({ given: 'input', should: 'match', actual: 1, expected: 1 });",
				"\t});",
				"});",
			].join("\n"),
		);

		const result = runScript(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"must include at least one executable expectBehavior assertion",
		);
	});

	it("rejects valid-shaped expectBehavior calls that never execute", () => {
		const root = createTempRoot();
		writeManifest(root, "src/lib/example.test.ts");
		writeFakeVitest(root, "src/lib/example.test.ts", "no-trace");
		writeFile(
			root,
			"src/lib/example.test.ts",
			[
				"import { describe, it } from 'vitest';",
				"import { expectBehavior } from './testing/expect-behavior.js';",
				"describe('example', () => {",
				"	it('does not prove runtime behavior', () => {",
				"		if (false) {",
				"			expectBehavior({ given: 'input', should: 'match', actual: 1, expected: 1 });",
				"		}",
				"	});",
				"});",
			].join("\n"),
		);

		const result = runScript(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"must execute an expectBehavior assertion from that suite",
		);
	});

	it("rejects non-vitest proving commands that can forge trace files", () => {
		const root = createTempRoot();
		writeManifest(
			root,
			"src/lib/example.test.ts",
			"node scripts/write-trace.mjs",
		);
		writeFile(
			root,
			"src/lib/example.test.ts",
			[
				"import { describe, it } from 'vitest';",
				"import { expectBehavior } from './testing/expect-behavior.js';",
				"describe('example', () => {",
				"\tit('proves behavior', () => {",
				"\t\texpectBehavior({ given: 'input', should: 'match', actual: 1, expected: 1 });",
				"\t});",
				"});",
			].join("\n"),
		);

		const result = runScript(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"provingCommand must be exactly: pnpm vitest run src/lib/example.test.ts",
		);
	});

	it("ignores PATH-shadowed pnpm trace writers", () => {
		const root = createTempRoot();
		writeManifest(root, "src/lib/example.test.ts");
		writeFakeVitest(root, "src/lib/example.test.ts", "trace", "bin/pnpm");
		writeFakeVitest(
			root,
			"src/lib/example.test.ts",
			"no-trace",
			"node_modules/.bin/vitest",
		);
		writeFile(
			root,
			"src/lib/example.test.ts",
			[
				"import { describe, it } from 'vitest';",
				"import { expectBehavior } from './testing/expect-behavior.js';",
				"describe('example', () => {",
				"\tit('proves behavior', () => {",
				"\t\texpectBehavior({ given: 'input', should: 'match', actual: 1, expected: 1 });",
				"\t});",
				"});",
			].join("\n"),
		);

		const result = runScript(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"must execute an expectBehavior assertion from that suite",
		);
	});

	it("rejects suites that access behavior trace controls", () => {
		const root = createTempRoot();
		writeManifest(root, "src/lib/example.test.ts");
		writeFakeVitest(root, "src/lib/example.test.ts");
		writeFile(
			root,
			"src/lib/example.test.ts",
			[
				"import { describe, it } from 'vitest';",
				"import { expectBehavior } from './testing/expect-behavior.js';",
				"describe('example', () => {",
				"\tit('forges trace controls', () => {",
				"\t\tprocess.env.HARNESS_EXPECT_BEHAVIOR_TRACE_FILE;",
				"\t\texpectBehavior({ given: 'input', should: 'match', actual: 1, expected: 1 });",
				"\t});",
				"});",
			].join("\n"),
		);

		const result = runScript(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"must not read or write behavior trace control environment variables",
		);
	});

	it("accepts an executable expectBehavior call", () => {
		const root = createTempRoot();
		writeManifest(root, "src/lib/example.test.ts");
		writeFakeVitest(root, "src/lib/example.test.ts");
		writeFile(
			root,
			"src/lib/example.test.ts",
			[
				"import { describe, it } from 'vitest';",
				"import { expectBehavior } from './testing/expect-behavior.js';",
				"describe('example', () => {",
				"	it('proves behavior', () => {",
				"		expectBehavior({ given: 'input', should: 'match', actual: 1, expected: 1 });",
				"	});",
				"});",
			].join("\n"),
		);

		const result = runScript(root);

		expect(result.status, result.stderr || result.stdout).toBe(0);
		expect(result.stdout).toContain(
			"verified registered evidence-bearing suites",
		);
	});

	it("proves multiple registered suites with isolated Vitest invocations", () => {
		const root = createTempRoot();
		const suitePaths = [
			"src/lib/example-one.test.ts",
			"src/lib/example-two.test.ts",
		];
		writeManifestEntries(
			root,
			suitePaths.map((path) => ({ path })),
		);
		writeMultiSuiteFakeVitest(root, suitePaths);
		for (const suitePath of suitePaths) {
			writeFile(
				root,
				suitePath,
				[
					"import { describe, it } from 'vitest';",
					"import { expectBehavior } from './testing/expect-behavior.js';",
					"describe('example', () => {",
					"\tit('proves behavior', () => {",
					"\t\texpectBehavior({ given: 'input', should: 'match', actual: 1, expected: 1 });",
					"\t});",
					"});",
				].join("\n"),
			);
		}

		const result = runScript(root);

		expect(result.status, result.stderr || result.stdout).toBe(0);
		expect(
			JSON.parse(readFileSync(join(root, "vitest-args.json"), "utf8")),
		).toEqual(suitePaths.map((suitePath) => ["run", suitePath]));
		expect(result.stdout).toContain(
			"verified registered evidence-bearing suites",
		);
	});

	it("rejects partial trace emission across registered suites", () => {
		const root = createTempRoot();
		const suitePaths = [
			"src/lib/example-one.test.ts",
			"src/lib/example-two.test.ts",
		];
		writeManifestEntries(
			root,
			suitePaths.map((path) => ({ path })),
		);
		writeMultiSuiteFakeVitest(root, suitePaths, [
			"src/lib/example-two.test.ts",
		]);
		for (const suitePath of suitePaths) {
			writeFile(
				root,
				suitePath,
				[
					"import { describe, it } from 'vitest';",
					"import { expectBehavior } from './testing/expect-behavior.js';",
					"describe('example', () => {",
					"\tit('proves behavior', () => {",
					"\t\texpectBehavior({ given: 'input', should: 'match', actual: 1, expected: 1 });",
					"\t});",
					"});",
				].join("\n"),
			);
		}

		const result = runScript(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"src/lib/example-two.test.ts provingCommand must execute an expectBehavior assertion from that suite",
		);
		expect(
			JSON.parse(readFileSync(join(root, "vitest-args.json"), "utf8")),
		).toEqual(suitePaths.map((suitePath) => ["run", suitePath]));
	});

	it("rejects behavior traces from overlapping stack path substrings", () => {
		const root = createTempRoot();
		writeManifest(root, "src/lib/example.test.ts");
		writeFakeVitest(
			root,
			"src/lib/example.test.ts",
			"trace",
			"node_modules/.bin/vitest",
			"src/lib/example.test.tsx",
		);
		writeFile(
			root,
			"src/lib/example.test.ts",
			[
				"import { describe, it } from 'vitest';",
				"import { expectBehavior } from './testing/expect-behavior.js';",
				"describe('example', () => {",
				"\tit('proves behavior', () => {",
				"\t\texpectBehavior({ given: 'input', should: 'match', actual: 1, expected: 1 });",
				"\t});",
				"});",
			].join("\n"),
		);

		const result = runScript(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"src/lib/example.test.ts provingCommand must execute an expectBehavior assertion from that suite",
		);
	});

	it("matches behavior traces with Windows-style stack paths", () => {
		const root = createTempRoot();
		writeManifest(root, "src/lib/example.test.ts");
		writeFakeVitest(
			root,
			"src/lib/example.test.ts",
			"trace",
			"node_modules/.bin/vitest",
			"src\\lib\\example.test.ts",
		);
		writeFile(
			root,
			"src/lib/example.test.ts",
			[
				"import { describe, it } from 'vitest';",
				"import { expectBehavior } from './testing/expect-behavior.js';",
				"describe('example', () => {",
				"\tit('proves behavior', () => {",
				"\t\texpectBehavior({ given: 'input', should: 'match', actual: 1, expected: 1 });",
				"\t});",
				"});",
			].join("\n"),
		);

		const result = runScript(root);

		expect(result.status, result.stderr || result.stdout).toBe(0);
		expect(result.stdout).toContain(
			"verified registered evidence-bearing suites",
		);
	});

	it("accepts a repo-local Windows Vitest command shim", () => {
		const root = createTempRoot();
		writeManifest(root, "src/lib/example.test.ts");
		writeFakeVitest(
			root,
			"src/lib/example.test.ts",
			"trace",
			"node_modules/.bin/vitest.cmd",
		);
		writeFile(
			root,
			"src/lib/example.test.ts",
			[
				"import { describe, it } from 'vitest';",
				"import { expectBehavior } from './testing/expect-behavior.js';",
				"describe('example', () => {",
				"\tit('proves behavior', () => {",
				"\t\texpectBehavior({ given: 'input', should: 'match', actual: 1, expected: 1 });",
				"\t});",
				"});",
			].join("\n"),
		);

		const result = runScript(root);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain(
			"verified registered evidence-bearing suites",
		);
	});

	it("prefers the Windows Vitest command shim when running on Windows", () => {
		const root = createTempRoot();
		writeManifest(root, "src/lib/example.test.ts");
		writeFakeVitest(
			root,
			"src/lib/example.test.ts",
			"no-trace",
			"node_modules/.bin/vitest",
		);
		writeFakeVitest(
			root,
			"src/lib/example.test.ts",
			"trace",
			"node_modules/.bin/vitest.cmd",
		);
		writeFile(
			root,
			"src/lib/example.test.ts",
			[
				"import { describe, it } from 'vitest';",
				"import { expectBehavior } from './testing/expect-behavior.js';",
				"describe('example', () => {",
				"\tit('proves behavior', () => {",
				"\t\texpectBehavior({ given: 'input', should: 'match', actual: 1, expected: 1 });",
				"\t});",
				"});",
			].join("\n"),
		);

		const result = runScript(root, [], {
			HARNESS_BEHAVIOR_TEST_PLATFORM: "win32",
		});

		expect(result.status, result.stderr || result.stdout).toBe(0);
		expect(result.stdout).toContain(
			"verified registered evidence-bearing suites",
		);
	});
});
