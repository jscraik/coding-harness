import { describe, expect, it } from "vitest";

import {
	COMMAND_RUNTIME_BUDGET_SCHEMA_VERSION,
	buildCommandRuntimeBudgetReport,
	validateCommandRuntimeBudgetReport,
} from "./command-runtime-budget.js";

describe("command runtime budget", () => {
	it("reports pass when observed commands remain within budget", () => {
		const report = buildCommandRuntimeBudgetReport([
			{
				command:
					"pnpm vitest run src/lib/runtime/command-runtime-budget.test.ts",
				durationMs: 1200,
				budgetMs: 5000,
				evidenceRef: "local:vitest",
			},
		]);

		expect(report.schemaVersion).toBe(COMMAND_RUNTIME_BUDGET_SCHEMA_VERSION);
		expect(report.status).toBe("pass");
		expect(report.slowestCommand?.command).toContain("vitest");
		expect(validateCommandRuntimeBudgetReport(report)).toEqual([]);
	});

	it("reports fail when a command breaches its runtime budget", () => {
		const report = buildCommandRuntimeBudgetReport([
			{
				command: "pnpm check",
				durationMs: 91_000,
				budgetMs: 60_000,
				evidenceRef: "local:pnpm-check",
			},
		]);

		expect(report.status).toBe("fail");
		expect(report.breaches).toHaveLength(1);
	});
});
