import { spawnSync } from "node:child_process";
import {
	chmodSync,
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT_SOURCE = join(process.cwd(), "scripts", "test-ci.sh");

describe("scripts/test-ci.sh", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const tempDir of tempDirs.splice(0)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("invokes split Vitest lanes without suppressing unhandled errors", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "test-ci-script-"));
		tempDirs.push(tempDir);

		const scriptsDir = join(tempDir, "scripts");
		const binDir = join(tempDir, "bin");
		const invocationsLog = join(tempDir, "pnpm-invocations.log");
		const testResultsDir = join(tempDir, "artifacts", "test-results");

		mkdirSync(scriptsDir, { recursive: true });
		mkdirSync(binDir, { recursive: true });
		copyFileSync(SCRIPT_SOURCE, join(scriptsDir, "test-ci.sh"));
		chmodSync(join(scriptsDir, "test-ci.sh"), 0o755);

		writeFileSync(
			join(binDir, "pnpm"),
			[
				"#!/usr/bin/env bash",
				"set -euo pipefail",
				'printf \'%s\\n\' "$*" >> "${PNPM_INVOCATIONS_LOG:?}"',
				"exit 0",
				"",
			].join("\n"),
			"utf-8",
		);
		chmodSync(join(binDir, "pnpm"), 0o755);

		const result = spawnSync("bash", [join(scriptsDir, "test-ci.sh")], {
			cwd: tempDir,
			encoding: "utf-8",
			env: {
				...process.env,
				PATH: `${binDir}${delimiter}${process.env.PATH ?? ""}`,
				PNPM_INVOCATIONS_LOG: invocationsLog,
				TEST_RESULTS_DIR: testResultsDir,
			},
		});

		expect(result.status).toBe(0);
		const invocations = readFileSync(invocationsLog, "utf-8")
			.trim()
			.split("\n")
			.filter((line) => line.length > 0);

		expect(invocations).toHaveLength(2);
		expect(invocations[0]).toContain("vitest run --maxWorkers=1");
		expect(invocations[0]).toContain(
			"--exclude src/commands/ci-migrate.test.ts",
		);
		expect(invocations[0]).toContain(
			`--outputFile.junit=${testResultsDir}/junit-standard.xml`,
		);
		expect(invocations[1]).toContain(
			"vitest run --maxWorkers=1 src/commands/ci-migrate.test.ts",
		);
		expect(invocations[1]).toContain(
			`--outputFile.junit=${testResultsDir}/junit-ci-migrate.xml`,
		);
		for (const invocation of invocations) {
			expect(invocation).not.toContain("--dangerouslyIgnoreUnhandledErrors");
		}
	});

	it("stops after the first failing lane and returns non-zero", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "test-ci-script-fail-"));
		tempDirs.push(tempDir);

		const scriptsDir = join(tempDir, "scripts");
		const binDir = join(tempDir, "bin");
		const invocationsLog = join(tempDir, "pnpm-invocations.log");
		const testResultsDir = join(tempDir, "artifacts", "test-results");

		mkdirSync(scriptsDir, { recursive: true });
		mkdirSync(binDir, { recursive: true });
		copyFileSync(SCRIPT_SOURCE, join(scriptsDir, "test-ci.sh"));
		chmodSync(join(scriptsDir, "test-ci.sh"), 0o755);

		writeFileSync(
			join(binDir, "pnpm"),
			[
				"#!/usr/bin/env bash",
				"set -euo pipefail",
				'printf \'%s\\n\' "$*" >> "${PNPM_INVOCATIONS_LOG:?}"',
				'if [[ "$*" == *"--exclude src/commands/ci-migrate.test.ts"* ]]; then',
				"  exit 1",
				"fi",
				"exit 0",
				"",
			].join("\n"),
			"utf-8",
		);
		chmodSync(join(binDir, "pnpm"), 0o755);

		const result = spawnSync("bash", [join(scriptsDir, "test-ci.sh")], {
			cwd: tempDir,
			encoding: "utf-8",
			env: {
				...process.env,
				PATH: `${binDir}${delimiter}${process.env.PATH ?? ""}`,
				PNPM_INVOCATIONS_LOG: invocationsLog,
				TEST_RESULTS_DIR: testResultsDir,
			},
		});

		expect(result.status).toBe(1);
		const invocations = readFileSync(invocationsLog, "utf-8")
			.trim()
			.split("\n")
			.filter((line) => line.length > 0);
		expect(invocations).toHaveLength(1);
		expect(invocations[0]).toContain(
			"--exclude src/commands/ci-migrate.test.ts",
		);
	});
});
