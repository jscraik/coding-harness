import { existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildSimulateOptionsFromCliArgs } from "../lib/simulate/cli-args.js";
import { SIMULATE_EXIT_CODES } from "../lib/simulate/types.js";
import { runSimulate, runSimulateFromCliArgs } from "./simulate.js";

describe("simulate CLI argument parsing", () => {
	it("projects required and optional flags into simulate options", () => {
		const parsed = buildSimulateOptionsFromCliArgs([
			"--contract-a",
			"baseline.json",
			"--contract-b",
			"candidate.json",
			"--artifacts",
			"artifacts/pilot",
			"--traces",
			".traces",
			"--output",
			"report.json",
			"--json",
			"--ci-soft",
			"--verbose",
		]);

		expect(parsed).toEqual({
			ok: true,
			options: {
				contractA: "baseline.json",
				contractB: "candidate.json",
				artifactsDir: "artifacts/pilot",
				tracesDir: ".traces",
				outputPath: "report.json",
				json: true,
				ciSoft: true,
				verbose: true,
			},
		});
	});

	it("returns usage errors before simulation when required flags are missing", () => {
		expect(buildSimulateOptionsFromCliArgs(["--contract-b", "b.json"])).toEqual(
			{ ok: false, message: "Error: --contract-a is required" },
		);
		expect(buildSimulateOptionsFromCliArgs(["--contract-a", "a.json"])).toEqual(
			{ ok: false, message: "Error: --contract-b is required" },
		);
	});
});

describe("simulate output path validation", () => {
	// cwd-relative workspace temp dir for setup
	const testRoot = join(process.cwd(), ".harness-simulate-test");
	// Genuinely outside cwd — mirrors the real PoC attack (ln -s /tmp/escape artifacts-link)
	const externalDir = join(tmpdir(), `harness-simulate-escape-${Date.now()}`);

	afterEach(() => {
		vi.restoreAllMocks();
		rmSync(testRoot, { recursive: true, force: true });
		rmSync(externalDir, { recursive: true, force: true });
	});

	it("returns help before requiring contract flags", () => {
		const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

		expect(runSimulateFromCliArgs(["--help"])).toBe(
			SIMULATE_EXIT_CODES.SUCCESS,
		);
		expect(info).toHaveBeenCalledWith(
			"Usage: harness simulate --contract-a <path> --contract-b <path> [options]",
		);
	});

	it("returns usage errors before running simulation", () => {
		const error = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		expect(runSimulateFromCliArgs(["--contract-b", "b.json"])).toBe(2);
		expect(error).toHaveBeenCalledWith("Error: --contract-a is required");
	});

	it("runs from parsed CLI args and writes JSON output", () => {
		mkdirSync(testRoot, { recursive: true });
		vi.spyOn(console, "info").mockImplementation(() => undefined);
		const outputPath = join(".harness-simulate-test", "report.json");

		expect(
			runSimulateFromCliArgs([
				"--contract-a",
				"harness.contract.json",
				"--contract-b",
				"harness.contract.json",
				"--output",
				outputPath,
				"--json",
			]),
		).toBe(SIMULATE_EXIT_CODES.SUCCESS);
		expect(existsSync(join(process.cwd(), outputPath))).toBe(true);
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
