import { existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { SIMULATE_EXIT_CODES } from "../lib/simulate/types.js";
import { runSimulate } from "./simulate.js";

describe("simulate output path validation", () => {
	// cwd-relative workspace temp dir for setup
	const testRoot = join(process.cwd(), ".harness-simulate-test");
	// Genuinely outside cwd — mirrors the real PoC attack (ln -s /tmp/escape artifacts-link)
	const externalDir = join(tmpdir(), `harness-simulate-escape-${Date.now()}`);

	afterEach(() => {
		rmSync(testRoot, { recursive: true, force: true });
		rmSync(externalDir, { recursive: true, force: true });
	});

	// Regression: outputPath via symlink pointing outside cwd must be caught before writeFileSync
	it("rejects output paths that escape cwd via symlink traversal", () => {
		mkdirSync(testRoot, { recursive: true });
		mkdirSync(externalDir, { recursive: true });

		// Symlink inside workspace -> directory outside cwd (mirrors PoC)
		const symlinkPath = join(testRoot, "artifacts-link");
		symlinkSync(externalDir, symlinkPath, "dir");

		const outputPath = join(
			".harness-simulate-test",
			"artifacts-link",
			"report.json",
		);

		const result = runSimulate({
			contractA: "harness.contract.json",
			contractB: "harness.contract.json",
			outputPath,
			json: true,
		});

		expect(result.ok).toBe(false);
		expect(result.exitCode).toBe(SIMULATE_EXIT_CODES.VALIDATION_ERROR);
		if (!result.ok) {
			expect(result.error.code).toBe("E_PATH_TRAVERSAL");
			expect(result.error.message).toContain(
				"Output path escapes working directory",
			);
		}

		// Confirm nothing was written outside the workspace
		expect(existsSync(join(externalDir, "report.json"))).toBe(false);
	});

	it("accepts and writes output for valid in-workspace paths", () => {
		mkdirSync(testRoot, { recursive: true });
		const outputPath = join(".harness-simulate-test", "report.json");

		const result = runSimulate({
			contractA: "harness.contract.json",
			contractB: "harness.contract.json",
			outputPath,
			json: true,
		});

		expect(result.ok).toBe(true);
		expect(result.exitCode).toBe(SIMULATE_EXIT_CODES.SUCCESS);
		expect(existsSync(join(process.cwd(), outputPath))).toBe(true);
	});
});
