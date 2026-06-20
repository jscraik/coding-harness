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
			lanes: 6,
			findings: 0,
			failures: 0,
			warnings: 0,
			lanesNeedingEvidence: 6,
		});
		expect(report.lanes.map((lane) => lane.command)).toEqual([
			"pnpm architecture:check",
			"pnpm run quality:size",
			"pnpm typecheck",
			"pnpm lint",
			"pnpm run quality:behavior-tests",
			"pnpm run harness:audit-tracking",
		]);
		expect(report.topDeterministicFinding).toBeNull();
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
		expect(report.topDeterministicFinding).toEqual(
			expect.objectContaining({
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
		expect(report.summary.lanesNeedingEvidence).toBe(5);
	});

	it("discovers existing deterministic gate artifacts and prioritizes hard blockers", () => {
		const dir = mkdtempSync(join(tmpdir(), "fitness-artifacts-"));
		cleanup.push(dir);
		writeFileSync(
			join(dir, "architecture.json"),
			JSON.stringify({ violations: [] }),
			"utf8",
		);
		writeFileSync(
			join(dir, "quality-size.json"),
			JSON.stringify({
				schemaVersion: "quality-size/v1",
				status: "fail",
				findings: [
					{
						path: "src/lib/fitness/report.ts",
						line: 12,
						message: "file has 410 lines; max is 400",
					},
				],
			}),
			"utf8",
		);
		writeFileSync(
			join(dir, "typecheck.json"),
			JSON.stringify({
				schemaVersion: "typecheck/v1",
				status: "pass",
				failures: [],
			}),
			"utf8",
		);
		writeFileSync(
			join(dir, "lint.json"),
			JSON.stringify({
				schemaVersion: "lint/v1",
				status: "pass",
				findings: [],
			}),
			"utf8",
		);
		writeFileSync(
			join(dir, "behavior-tests.json"),
			JSON.stringify({
				schemaVersion: "behavior-tests/v1",
				status: "pass",
				failures: [],
			}),
			"utf8",
		);
		writeFileSync(
			join(dir, "harness-audit-tracking.json"),
			JSON.stringify({
				schemaVersion: "harness-audit-tracking/v1",
				status: "fail",
				failures: [{ name: ".harness/feedback-loops control-plane map" }],
			}),
			"utf8",
		);

		const report = buildFitnessReport({
			artifactsDir: dir,
			now: new Date("2026-06-19T12:00:00.000Z"),
		});

		expect(report.status).toBe("fail");
		expect(report.summary.lanesNeedingEvidence).toBe(0);
		expect(report.topDeterministicFinding).toEqual(
			expect.objectContaining({
				lane: "feedback-learning",
				recommendedCommand: "pnpm run harness:audit-tracking",
			}),
		);
	});

	it("fails closed when deterministic gate artifacts are malformed", () => {
		const dir = mkdtempSync(join(tmpdir(), "fitness-malformed-"));
		cleanup.push(dir);
		writeFileSync(
			join(dir, "architecture.json"),
			JSON.stringify({ status: "pass" }),
			"utf8",
		);
		writeFileSync(
			join(dir, "quality-size.json"),
			JSON.stringify({ schemaVersion: "quality-size/v1", status: "pass" }),
			"utf8",
		);
		writeFileSync(
			join(dir, "typecheck.json"),
			JSON.stringify({ schemaVersion: "typecheck/v1", status: "pass" }),
			"utf8",
		);
		writeFileSync(
			join(dir, "lint.json"),
			JSON.stringify({ schemaVersion: "lint/v1", status: "pass" }),
			"utf8",
		);
		writeFileSync(
			join(dir, "behavior-tests.json"),
			JSON.stringify({ schemaVersion: "behavior-tests/v1", status: "pass" }),
			"utf8",
		);
		writeFileSync(
			join(dir, "harness-audit-tracking.json"),
			JSON.stringify({
				schemaVersion: "harness-audit-tracking/v1",
				status: "pass",
			}),
			"utf8",
		);

		const report = buildFitnessReport({
			artifactsDir: dir,
			now: new Date("2026-06-19T12:00:00.000Z"),
		});

		expect(report.status).toBe("fail");
		expect(report.summary.failures).toBe(6);
		expect(report.summary.lanesNeedingEvidence).toBe(0);
		expect(report.lanes.map((lane) => lane.status)).toEqual([
			"fail",
			"fail",
			"fail",
			"fail",
			"fail",
			"fail",
		]);
		expect(report.topDeterministicFinding).toEqual(
			expect.objectContaining({
				id: "architecture:artifact:malformed",
				recommendedCommand: "pnpm architecture:check",
			}),
		);
	});

	it("fails closed when deterministic gate artifact entries are malformed", () => {
		const dir = mkdtempSync(join(tmpdir(), "fitness-malformed-entry-"));
		cleanup.push(dir);
		const reports: Array<[string, Record<string, unknown>]> = [
			["architecture.json", { violations: [] }],
			["quality-size.json", { status: "fail", findings: ["oversized"] }],
			["typecheck.json", { status: "pass", failures: [] }],
			["lint.json", { status: "pass", findings: [] }],
			["behavior-tests.json", { status: "pass", failures: [] }],
			["harness-audit-tracking.json", { status: "pass", failures: [] }],
		];
		for (const [name, report] of reports) {
			writeFileSync(join(dir, name), JSON.stringify(report), "utf8");
		}

		const report = buildFitnessReport({
			artifactsDir: dir,
			now: new Date("2026-06-19T12:00:00.000Z"),
		});

		expect(report.status).toBe("fail");
		expect(report.summary.failures).toBe(1);
		expect(report.lanes[1]).toEqual(
			expect.objectContaining({
				id: "quality-budget",
				status: "fail",
			}),
		);
		expect(report.lanes[1]?.findings[0]).toEqual(
			expect.objectContaining({
				id: "quality-budget:artifact:malformed",
				recommendedCommand: "pnpm run quality:size",
			}),
		);
	});

	it("fails closed when architecture violation entries are malformed", () => {
		const dir = mkdtempSync(join(tmpdir(), "fitness-architecture-entry-"));
		cleanup.push(dir);
		writeFileSync(
			join(dir, "architecture.json"),
			JSON.stringify({ status: "pass", violations: ["bad"] }),
			"utf8",
		);

		const report = buildFitnessReport({
			architectureReportPath: join(dir, "architecture.json"),
			now: new Date("2026-06-19T12:00:00.000Z"),
		});

		expect(report.status).toBe("fail");
		expect(report.lanes[0]).toEqual(
			expect.objectContaining({
				id: "architecture-fitness",
				status: "fail",
			}),
		);
		expect(report.lanes[0]?.findings[0]).toEqual(
			expect.objectContaining({
				id: "architecture:artifact:malformed",
				recommendedCommand: "pnpm architecture:check",
			}),
		);
	});

	it("fails closed when source artifacts report failure without details", () => {
		const dir = mkdtempSync(join(tmpdir(), "fitness-empty-failure-"));
		cleanup.push(dir);
		const reports: Array<[string, Record<string, unknown>]> = [
			["architecture.json", { status: "fail", violations: [] }],
			["quality-size.json", { status: "fail", findings: [] }],
			["typecheck.json", { status: "pass", failures: [] }],
			["lint.json", { status: "pass", findings: [] }],
			["behavior-tests.json", { status: "pass", failures: [] }],
			["harness-audit-tracking.json", { status: "pass", failures: [] }],
		];
		for (const [name, report] of reports) {
			writeFileSync(join(dir, name), JSON.stringify(report), "utf8");
		}

		const report = buildFitnessReport({
			artifactsDir: dir,
			now: new Date("2026-06-19T12:00:00.000Z"),
		});

		expect(report.status).toBe("fail");
		expect(report.summary.failures).toBe(2);
		expect(report.lanes[0]).toEqual(
			expect.objectContaining({
				id: "architecture-fitness",
				status: "fail",
			}),
		);
		expect(report.lanes[1]).toEqual(
			expect.objectContaining({
				id: "quality-budget",
				status: "fail",
			}),
		);
		expect(report.topDeterministicFinding).toEqual(
			expect.objectContaining({
				id: "architecture:artifact:malformed",
				recommendedCommand: "pnpm architecture:check",
			}),
		);
	});

	it("keeps AI-assisted review findings advisory", () => {
		const dir = mkdtempSync(join(tmpdir(), "fitness-review-"));
		cleanup.push(dir);
		const reports: Array<[string, Record<string, unknown>]> = [
			["architecture.json", { violations: [] }],
			["quality-size.json", { status: "pass", findings: [] }],
			["typecheck.json", { status: "pass", failures: [] }],
			["lint.json", { status: "pass", findings: [] }],
			["behavior-tests.json", { status: "pass", failures: [] }],
			["harness-audit-tracking.json", { status: "pass", failures: [] }],
		];
		for (const [name, report] of reports) {
			writeFileSync(join(dir, name), JSON.stringify(report), "utf8");
		}
		writeFileSync(
			join(dir, "autoreview.json"),
			JSON.stringify({
				status: "fail",
				findings: [
					{
						title: "Reviewer suggests more examples",
						message: "Add examples when the contract stabilizes.",
						severity: "error",
					},
				],
			}),
			"utf8",
		);

		const report = buildFitnessReport({
			artifactsDir: dir,
			now: new Date("2026-06-19T12:00:00.000Z"),
		});

		expect(report.status).toBe("warn");
		expect(report.summary.failures).toBe(0);
		expect(report.topDeterministicFinding).toBeNull();
		expect(report.lanes.at(-1)).toEqual(
			expect.objectContaining({
				id: "ai-review-advisory",
				status: "warn",
			}),
		);
	});
});
