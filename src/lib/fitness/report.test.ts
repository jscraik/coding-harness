import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildFitnessReport } from "./report.js";

describe("buildFitnessReport", () => {
	const cleanup: string[] = [];

	afterEach(() => {
		for (const path of cleanup.splice(0)) {
			rmSync(path, { force: true, recursive: true });
		}
	});

	it("emits lane contracts when no gate evidence has been supplied", () => {
		const report = buildFitnessReport({
			now: new Date("2026-06-19T12:00:00.000Z"),
		});

		expect(report.schemaVersion).toBe("harness-fitness/v1");
		expect(report.status).toBe("needs_evidence");
		expect(report.summary).toEqual({
			lanes: 4,
			findings: 0,
			failures: 0,
			warnings: 0,
			lanesNeedingEvidence: 4,
		});
		expect(report.lanes.map((lane) => lane.command)).toEqual([
			"pnpm architecture:check",
			"pnpm run quality:size",
			"pnpm run quality:behavior-tests",
			"pnpm run harness:audit-tracking",
		]);
	});

	it("normalizes architecture check violations into fitness findings", () => {
		const dir = mkdtempSync(join(tmpdir(), "fitness-report-"));
		cleanup.push(dir);
		const architectureReportPath = join(dir, "architecture.json");
		writeFileSync(
			architectureReportPath,
			JSON.stringify({
				schema_version: 1,
				status: "fail",
				violations: [
					{
						rule: "no-circular-deps",
						severity: "error",
						file: "src/commands/fleet-plan-cli.ts",
						message:
							"Circular import: src/commands/fleet-plan-cli.ts -> src/commands/fleet-plan.ts",
						baselined: false,
					},
				],
			}),
			"utf8",
		);

		const report = buildFitnessReport({
			architectureReportPath,
			now: new Date("2026-06-19T12:00:00.000Z"),
		});

		expect(report.status).toBe("fail");
		expect(report.summary.failures).toBe(1);
		expect(report.lanes[0]).toEqual(
			expect.objectContaining({
				id: "architecture-fitness",
				status: "fail",
				evidenceSource: architectureReportPath,
			}),
		);
		expect(report.lanes[0]?.findings[0]).toEqual(
			expect.objectContaining({
				id: "architecture:no-circular-deps:src/commands/fleet-plan-cli.ts",
				title: "Circular dependency violates module boundary",
				severity: "error",
				principle: "protect_deep_module_boundaries",
				recommendedCommand: "pnpm architecture:check",
			}),
		);
	});

	it("keeps missing evidence explicit when supplied lanes only warn", () => {
		const dir = mkdtempSync(join(tmpdir(), "fitness-report-"));
		cleanup.push(dir);
		const architectureReportPath = join(dir, "architecture.json");
		writeFileSync(
			architectureReportPath,
			JSON.stringify({
				schema_version: 1,
				status: "pass",
				violations: [
					{
						rule: "auth-commands-use-crypto",
						severity: "warning",
						file: "src/commands/check-authz.ts",
						message: "Advisory auth-boundary finding.",
						baselined: false,
					},
				],
			}),
			"utf8",
		);

		const report = buildFitnessReport({
			architectureReportPath,
			now: new Date("2026-06-19T12:00:00.000Z"),
		});

		expect(report.status).toBe("needs_evidence");
		expect(report.summary.warnings).toBe(1);
		expect(report.summary.lanesNeedingEvidence).toBe(3);
	});
});
