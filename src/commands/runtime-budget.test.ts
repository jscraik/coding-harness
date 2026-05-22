import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { runRuntimeBudgetCLI } from "./runtime-budget.js";

describe("runtime-budget command", () => {
	it("emits a passing command-runtime-budget report", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runRuntimeBudgetCLI([
			"--command",
			"pnpm check",
			"--duration-ms",
			"45000",
			"--budget-ms",
			"60000",
			"--evidence-ref",
			"local:pnpm-check",
			"--json",
		]);

		expect(exitCode).toBe(0);
		expect(String(infoSpy.mock.calls[0]?.[0])).toContain(
			'"schemaVersion": "command-runtime-budget/v1"',
		);
		vi.restoreAllMocks();
	});

	it("fails when an observation breaches the budget", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runRuntimeBudgetCLI([
			"--command",
			"pnpm check",
			"--duration-ms",
			"70000",
			"--budget-ms",
			"60000",
			"--evidence-ref",
			"local:pnpm-check",
			"--json",
		]);

		expect(exitCode).toBe(1);
		expect(String(infoSpy.mock.calls[0]?.[0])).toContain('"status": "fail"');
		vi.restoreAllMocks();
	});

	it("returns a usage error for malformed input JSON", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		const dir = mkdtempSync(join(tmpdir(), "runtime-budget-"));
		const inputPath = join(dir, "observations.json");
		writeFileSync(inputPath, "{not-json");

		const exitCode = runRuntimeBudgetCLI(["--input", inputPath, "--json"]);

		expect(exitCode).toBe(2);
		expect(JSON.parse(String(infoSpy.mock.calls[0]?.[0]))).toMatchObject({
			schemaVersion: "command-runtime-budget/v1",
			status: "error",
			error: {
				code: "runtime-budget.usage",
				message: `runtime-budget input file is malformed JSON: ${inputPath}`,
			},
		});
		vi.restoreAllMocks();
	});

	it("returns a usage error for malformed observation entries", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		const dir = mkdtempSync(join(tmpdir(), "runtime-budget-"));
		const inputPath = join(dir, "observations.json");
		writeFileSync(
			inputPath,
			JSON.stringify([{ command: "pnpm check", durationMs: "fast" }]),
		);

		const exitCode = runRuntimeBudgetCLI(["--input", inputPath, "--json"]);

		expect(exitCode).toBe(2);
		expect(JSON.parse(String(infoSpy.mock.calls[0]?.[0]))).toMatchObject({
			schemaVersion: "command-runtime-budget/v1",
			status: "error",
			error: {
				code: "runtime-budget.usage",
				message: "runtime-budget observations[0] is malformed.",
			},
		});
		vi.restoreAllMocks();
	});

	it("returns a usage error for incomplete flag observations", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runRuntimeBudgetCLI([
			"--command",
			"pnpm check",
			"--duration-ms",
			"45000",
			"--json",
		]);

		expect(exitCode).toBe(2);
		expect(JSON.parse(String(infoSpy.mock.calls[0]?.[0]))).toMatchObject({
			schemaVersion: "command-runtime-budget/v1",
			status: "error",
			error: {
				code: "runtime-budget.usage",
				message:
					"runtime-budget requires --input or --command, --duration-ms, --budget-ms, and --evidence-ref.",
			},
		});
		vi.restoreAllMocks();
	});
});
