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
});
