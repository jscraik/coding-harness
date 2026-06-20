import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COMMAND_SPECS } from "../lib/cli/registry/command-specs.js";
import { runFitnessCLI } from "./fitness.js";

function staticPassingFitnessReport(generatedAt: string) {
	return {
		schemaVersion: "harness-fitness/v1",
		status: "pass",
		generatedAt,
		summary: {
			lanes: 6,
			findings: 0,
			failures: 0,
			warnings: 0,
			lanesNeedingEvidence: 0,
		},
		lanes: [
			{
				id: "architecture-fitness",
				label: "Architecture fitness",
				command: "pnpm architecture:check",
				principle: "protect_deep_module_boundaries",
				enforcement: "architecture_fitness",
				status: "pass",
				evidenceSource: "artifacts/architecture.json",
				findings: [],
			},
			{
				id: "quality-budget",
				label: "Quality budget",
				command: "pnpm run quality:size",
				principle: "reduce_cognitive_load",
				enforcement: "quality_budget",
				status: "pass",
				evidenceSource: "artifacts/quality-size.json",
				findings: [],
			},
			{
				id: "type-safety",
				label: "Type safety",
				command: "pnpm run fitness:typecheck-artifact",
				principle: "prove_type_safety",
				enforcement: "type_safety",
				status: "pass",
				evidenceSource: "artifacts/typecheck.json",
				findings: [],
			},
			{
				id: "static-lint",
				label: "Static lint",
				command: "pnpm run fitness:lint-artifact",
				principle: "preserve_static_contracts",
				enforcement: "static_analysis",
				status: "pass",
				evidenceSource: "artifacts/lint.json",
				findings: [],
			},
			{
				id: "behavior-proof",
				label: "Behavior proof",
				command: "pnpm run quality:behavior-tests",
				principle: "prove_behavior_outcomes",
				enforcement: "hard_blocker",
				status: "pass",
				evidenceSource: "artifacts/behavior-tests.json",
				findings: [],
			},
			{
				id: "feedback-learning",
				label: "Feedback learning",
				command: "pnpm run harness:audit-tracking",
				principle: "compound_feedback_to_harness",
				enforcement: "hard_blocker",
				status: "pass",
				evidenceSource: "artifacts/harness-audit-tracking.json",
				findings: [],
			},
		],
		topDeterministicFinding: null,
		claimBoundaries: ["Fitness reports normalize local gate evidence only."],
	};
}

describe("runFitnessCLI", () => {
	const cleanup: string[] = [];

	afterEach(() => {
		vi.restoreAllMocks();
		for (const path of cleanup.splice(0)) {
			rmSync(path, { force: true, recursive: true });
		}
	});

	it("returns failure when required gate evidence is missing", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		expect(runFitnessCLI(["--json"])).toBe(1);

		const result = JSON.parse(String(infoSpy.mock.calls.at(-1)?.[0]));
		expect(result.schemaVersion).toBe("harness-fitness/v1");
		expect(result.status).toBe("needs_evidence");
		expect(result.lanes).toHaveLength(6);
		expect(result.lanes[0]).toEqual(
			expect.objectContaining({
				id: "architecture-fitness",
				command: "pnpm architecture:check",
				status: "not_run",
			}),
		);
		expect(result.lanes[2]).toEqual(
			expect.objectContaining({
				id: "type-safety",
				command: "pnpm run fitness:typecheck-artifact",
			}),
		);
		expect(result.lanes[3]).toEqual(
			expect.objectContaining({
				id: "static-lint",
				command: "pnpm run fitness:lint-artifact",
			}),
		);
	});

	it("returns failure when ingested architecture findings include errors", () => {
		const dir = mkdtempSync(join(tmpdir(), "fitness-cli-"));
		cleanup.push(dir);
		const reportPath = join(dir, "architecture.json");
		writeFileSync(
			reportPath,
			JSON.stringify({
				violations: [
					{
						rule: "commands-no-cross-import",
						severity: "error",
						file: "src/commands/a.ts",
						message: "Command facade imports another command facade.",
					},
				],
			}),
			"utf8",
		);
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		expect(runFitnessCLI(["--json", "--architecture-report", reportPath])).toBe(
			1,
		);

		const result = JSON.parse(String(infoSpy.mock.calls.at(-1)?.[0]));
		expect(result.status).toBe("fail");
		expect(result.summary.failures).toBe(1);
	});

	it("reports usage when architecture report flag is missing a value", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		expect(runFitnessCLI(["--json", "--architecture-report"])).toBe(2);

		const result = JSON.parse(String(infoSpy.mock.calls.at(-1)?.[0]));
		expect(result.error.code).toBe("fitness.architecture_report_required");
	});

	it("discovers artifact-backed gate reports from an existing directory", () => {
		const dir = mkdtempSync(join(tmpdir(), "fitness-cli-artifacts-"));
		cleanup.push(dir);
		writeFileSync(
			join(dir, "architecture.json"),
			JSON.stringify({ violations: [] }),
		);
		writeFileSync(
			join(dir, "quality-size.json"),
			JSON.stringify({
				schemaVersion: "quality-size/v1",
				status: "pass",
				findings: [],
			}),
		);
		writeFileSync(
			join(dir, "typecheck.json"),
			JSON.stringify({
				schemaVersion: "typecheck/v1",
				status: "pass",
				failures: [],
			}),
		);
		writeFileSync(
			join(dir, "lint.json"),
			JSON.stringify({
				schemaVersion: "lint/v1",
				status: "pass",
				findings: [],
			}),
		);
		writeFileSync(
			join(dir, "behavior-tests.json"),
			JSON.stringify({
				schemaVersion: "behavior-tests/v1",
				status: "pass",
				failures: [],
			}),
		);
		writeFileSync(
			join(dir, "harness-audit-tracking.json"),
			JSON.stringify({
				schemaVersion: "harness-audit-tracking/v1",
				status: "fail",
				failures: [{ name: "audit destination distinction" }],
			}),
		);
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		expect(runFitnessCLI(["--json", "--from-existing-artifacts", dir])).toBe(1);

		const result = JSON.parse(String(infoSpy.mock.calls.at(-1)?.[0]));
		expect(result.status).toBe("fail");
		expect(result.topDeterministicFinding).toEqual(
			expect.objectContaining({
				lane: "feedback-learning",
				recommendedCommand: "pnpm run harness:audit-tracking",
			}),
		);
	});

	it("reports usage when artifact-backed mode is missing a directory", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		expect(runFitnessCLI(["--json", "--from-existing-artifacts"])).toBe(2);

		const result = JSON.parse(String(infoSpy.mock.calls.at(-1)?.[0]));
		expect(result.error.code).toBe("fitness.artifacts_dir_required");
	});

	it("reports usage when typecheck report flag is missing a value", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		expect(runFitnessCLI(["--json", "--typecheck-report"])).toBe(2);

		const result = JSON.parse(String(infoSpy.mock.calls.at(-1)?.[0]));
		expect(result.error.code).toBe("fitness.typecheck_report_required");
	});

	it("reports usage when lint report flag is missing a value", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		expect(runFitnessCLI(["--json", "--lint-report"])).toBe(2);

		const result = JSON.parse(String(infoSpy.mock.calls.at(-1)?.[0]));
		expect(result.error.code).toBe("fitness.lint_report_required");
	});

	it("returns success when only AI-assisted review findings warn", () => {
		const dir = mkdtempSync(join(tmpdir(), "fitness-cli-review-"));
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
						message: "Add examples after the contract stabilizes.",
						severity: "error",
					},
				],
			}),
			"utf8",
		);
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		expect(runFitnessCLI(["--json", "--from-existing-artifacts", dir])).toBe(0);

		const result = JSON.parse(String(infoSpy.mock.calls.at(-1)?.[0]));
		expect(result.status).toBe("warn");
		expect(result.summary).toMatchObject({
			failures: 0,
			warnings: 1,
			lanesNeedingEvidence: 0,
		});
		expect(result.topDeterministicFinding).toBeNull();
		expect(result.lanes.at(-1)).toEqual(
			expect.objectContaining({
				id: "ai-review-advisory",
				enforcement: "advisory",
				status: "warn",
			}),
		);
	});

	it("reports usage when advisory review report flag is missing a value", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		expect(runFitnessCLI(["--json", "--advisory-review-report"])).toBe(2);

		const result = JSON.parse(String(infoSpy.mock.calls.at(-1)?.[0]));
		expect(result.error.code).toBe("fitness.advisory_review_report_required");
	});

	it("emits trend snapshots when a baseline fitness report is supplied", () => {
		const dir = mkdtempSync(join(tmpdir(), "fitness-cli-trend-"));
		cleanup.push(dir);
		const baselinePath = join(dir, "baseline.json");
		writeFileSync(
			baselinePath,
			JSON.stringify(staticPassingFitnessReport("2026-06-18T12:00:00.000Z")),
			"utf8",
		);
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		expect(runFitnessCLI(["--json", "--trend-baseline", baselinePath])).toBe(1);

		const result = JSON.parse(String(infoSpy.mock.calls.at(-1)?.[0]));
		expect(result.trendSnapshot).toEqual(
			expect.objectContaining({
				baselineRef: baselinePath,
				baselineStatus: "loaded",
				direction: "regressed",
			}),
		);
	});

	it("reports usage when trend baseline flag is missing a value", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		expect(runFitnessCLI(["--json", "--trend-baseline"])).toBe(2);

		const result = JSON.parse(String(infoSpy.mock.calls.at(-1)?.[0]));
		expect(result.error.code).toBe("fitness.trend_baseline_required");
	});

	it("is registered as a command capability", () => {
		expect(COMMAND_SPECS.some((spec) => spec.name === "fitness")).toBe(true);
	});
});
