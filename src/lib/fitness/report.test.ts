import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

	function writePassingGateArtifacts(dir: string): void {
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
	}

	it("emits lane contracts when no gate evidence has been supplied", () => {
		const report = buildFitnessReport({
			now: new Date("2026-06-19T12:00:00.000Z"),
		});

		expect(report.schemaVersion).toBe("harness-fitness/v1");
		expect(report.status).toBe("needs_evidence");
		expect(report.summary).toEqual({
			lanes: 10,
			findings: 0,
			failures: 0,
			warnings: 0,
			lanesNeedingEvidence: 6,
		});
		expect(report.lanes.map((lane) => lane.command)).toEqual([
			"pnpm architecture:check",
			"pnpm run quality:size",
			"pnpm run fitness:typecheck-artifact",
			"pnpm run fitness:lint-artifact",
			"pnpm run quality:behavior-tests",
			"pnpm run harness:audit-tracking",
			"pnpm run coding-policy:route",
			"pnpm run docs:lifecycle",
			"pnpm run quality:self-affirming",
			"pnpm run quality:debt",
		]);
		expect(report.coverage).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					category: "typescript-type-discipline",
					commands: expect.arrayContaining([
						"pnpm run fitness:typecheck-artifact",
					]),
				}),
				expect.objectContaining({
					category: "structure-and-architecture",
					commands: expect.arrayContaining(["pnpm run quality:debt"]),
				}),
				expect.objectContaining({
					category: "python-and-script-hygiene",
					commands: expect.arrayContaining(["pnpm run python:types"]),
				}),
				expect.objectContaining({
					category: "config-and-contract-data",
					commands: expect.arrayContaining(["pnpm run artifact:types"]),
				}),
				expect.objectContaining({
					category: "engineering-judgment-and-agent-safety",
					claimBoundary: expect.stringContaining("routing metadata"),
				}),
			]),
		);
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

	it("admits optional capability lanes only when their artifacts are supplied", () => {
		const dir = mkdtempSync(join(tmpdir(), "fitness-optional-lanes-"));
		cleanup.push(dir);
		writeFileSync(
			join(dir, "agent-routing.json"),
			JSON.stringify({
				schemaVersion: "coding-policy-route/v1",
				policyModules: [],
				requiredGates: [],
			}),
			"utf8",
		);
		writeFileSync(
			join(dir, "documentation-lifecycle.json"),
			JSON.stringify({
				status: "fail",
				violations: [{ path: "docs/README.md", message: "missing metadata" }],
			}),
			"utf8",
		);
		writeFileSync(
			join(dir, "test-confidence.json"),
			JSON.stringify({
				status: "fail",
				findings: [
					{ path: "src/example.test.ts", line: 4, message: "same oracle" },
				],
			}),
			"utf8",
		);
		writeFileSync(
			join(dir, "program-design.json"),
			JSON.stringify({
				status: "fail",
				newDebt: [
					{ path: "src/legacy.ts", line: 12, detail: "duplicate block" },
				],
			}),
			"utf8",
		);

		const report = buildFitnessReport({ artifactsDir: dir });

		expect(report.lanes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "agent-routing",
					applicability: "admitted",
					status: "pass",
				}),
				expect.objectContaining({
					id: "documentation-lifecycle",
					applicability: "admitted",
					status: "fail",
				}),
				expect.objectContaining({
					id: "test-confidence",
					applicability: "admitted",
					status: "fail",
				}),
				expect.objectContaining({
					id: "program-design",
					applicability: "admitted",
					status: "fail",
				}),
			]),
		);
	});

	it("fails closed when an admitted capability artifact is malformed", () => {
		const dir = mkdtempSync(join(tmpdir(), "fitness-optional-malformed-"));
		cleanup.push(dir);
		writeFileSync(join(dir, "agent-routing.json"), "{not-json", "utf8");

		const report = buildFitnessReport({ artifactsDir: dir });
		const lane = report.lanes.find((entry) => entry.id === "agent-routing");

		expect(lane).toEqual(
			expect.objectContaining({ applicability: "admitted", status: "fail" }),
		);
		expect(lane?.findings[0]).toEqual(
			expect.objectContaining({ id: "agent-routing:artifact:malformed" }),
		);
	});

	it("keeps a quality-debt burn-down warning distinct from malformed evidence", () => {
		const dir = mkdtempSync(join(tmpdir(), "fitness-program-design-burndown-"));
		cleanup.push(dir);
		writeFileSync(
			join(dir, "program-design.json"),
			JSON.stringify({
				status: "warn",
				newDebt: [],
				resolvedDebt: [{ id: "old-debt" }],
			}),
			"utf8",
		);

		const report = buildFitnessReport({ artifactsDir: dir });
		const lane = report.lanes.find((entry) => entry.id === "program-design");

		expect(lane).toEqual(
			expect.objectContaining({ applicability: "admitted", status: "warn" }),
		);
		expect(lane?.findings[0]).toEqual(
			expect.objectContaining({
				id: "program-design:burn-down",
				title: "Program design debt burn-down",
				severity: "warning",
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
						kind: "file_lines",
						path: "src/lib/fitness/report.ts",
						line: 12,
						actual: 410,
						max: 400,
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
		expect(report.lanes[1]?.findings[0]).toEqual(
			expect.objectContaining({
				lane: "quality-structure",
				enforcement: "quality_structure",
				metrics: {
					moduleLogicalLines: 410,
					maxModuleLogicalLines: 400,
				},
				requiredFix: expect.objectContaining({
					objective:
						"Reduce structural complexity while preserving public behavior.",
				}),
				acceptanceCriteria: expect.arrayContaining([
					"pnpm run quality:size reports no finding for this location.",
				]),
			}),
		);
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
			"not_run",
			"not_run",
			"not_run",
			"not_run",
		]);
		expect(report.topDeterministicFinding).toEqual(
			expect.objectContaining({
				id: "architecture:artifact:malformed",
				recommendedCommand: "pnpm architecture:check",
			}),
		);
	});

	it("fails closed when deterministic gate artifacts omit status", () => {
		const dir = mkdtempSync(join(tmpdir(), "fitness-missing-status-"));
		cleanup.push(dir);
		writePassingGateArtifacts(dir);
		writeFileSync(
			join(dir, "typecheck.json"),
			JSON.stringify({ schemaVersion: "typecheck/v1", failures: [] }),
			"utf8",
		);

		const report = buildFitnessReport({
			artifactsDir: dir,
			now: new Date("2026-06-19T12:00:00.000Z"),
		});

		expect(report.status).toBe("fail");
		expect(report.summary.failures).toBe(1);
		expect(report.lanes[2]).toEqual(
			expect.objectContaining({
				id: "type-safety",
				status: "fail",
			}),
		);
		expect(report.lanes[2]?.findings[0]).toEqual(
			expect.objectContaining({
				id: "type-safety:artifact:malformed",
				recommendedCommand: "pnpm run fitness:typecheck-artifact",
				evidence: expect.objectContaining({
					message: "Expected artifact status to be pass, warn, or fail.",
				}),
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
				id: "quality-structure",
				status: "fail",
			}),
		);
		expect(report.lanes[1]?.findings[0]).toEqual(
			expect.objectContaining({
				id: "quality-structure:artifact:malformed",
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
				id: "quality-structure",
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
		writePassingGateArtifacts(dir);
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

	it("fails closed when gate artifacts cannot be parsed", () => {
		const dir = mkdtempSync(join(tmpdir(), "fitness-unreadable-"));
		cleanup.push(dir);
		writeFileSync(join(dir, "typecheck.json"), "{not json", "utf8");

		const report = buildFitnessReport({
			typecheckReportPath: join(dir, "typecheck.json"),
			now: new Date("2026-06-19T12:00:00.000Z"),
		});

		expect(report.status).toBe("fail");
		expect(report.lanes[2]).toEqual(
			expect.objectContaining({
				id: "type-safety",
				status: "fail",
			}),
		);
		expect(report.lanes[2]?.findings[0]).toEqual(
			expect.objectContaining({
				id: "type-safety:artifact:malformed",
				recommendedCommand: "pnpm run fitness:typecheck-artifact",
			}),
		);
	});

	it("builds advisory trend snapshots without making review findings blocking", () => {
		const dir = mkdtempSync(join(tmpdir(), "fitness-trend-"));
		cleanup.push(dir);
		writePassingGateArtifacts(dir);
		const baselineDir = join(dir, "baseline-artifacts");
		mkdirSync(baselineDir);
		writePassingGateArtifacts(baselineDir);
		writeFileSync(
			join(baselineDir, "quality-size.json"),
			JSON.stringify({
				status: "fail",
				findings: [{ message: "baseline failure" }],
			}),
			"utf8",
		);
		writeFileSync(
			join(dir, "autoreview.json"),
			JSON.stringify({
				status: "fail",
				findings: [{ title: "Reviewer suggests more examples" }],
			}),
			"utf8",
		);
		const baselinePath = join(dir, "baseline.json");
		writeFileSync(
			baselinePath,
			JSON.stringify({
				...buildFitnessReport({
					artifactsDir: baselineDir,
					now: new Date("2026-06-18T12:00:00.000Z"),
				}),
			}),
			"utf8",
		);

		const report = buildFitnessReport({
			artifactsDir: dir,
			trendBaselinePath: baselinePath,
			now: new Date("2026-06-19T12:00:00.000Z"),
		});

		expect(report.status).toBe("warn");
		expect(report.topDeterministicFinding).toBeNull();
		expect(report.trendSnapshot).toEqual(
			expect.objectContaining({
				baselineRef: baselinePath,
				baselineStatus: "loaded",
				direction: "improved",
				delta: expect.objectContaining({
					failures: -1,
					advisoryFindings: 1,
				}),
				current: expect.objectContaining({
					deterministicFindings: 0,
					advisoryFindings: 1,
				}),
			}),
		);
	});

	it("keeps trend baseline failures advisory", () => {
		const dir = mkdtempSync(join(tmpdir(), "fitness-trend-invalid-"));
		cleanup.push(dir);
		writePassingGateArtifacts(dir);
		const baselinePath = join(dir, "baseline.json");
		writeFileSync(baselinePath, "not-json", "utf8");

		const report = buildFitnessReport({
			artifactsDir: dir,
			trendBaselinePath: baselinePath,
			now: new Date("2026-06-19T12:00:00.000Z"),
		});

		expect(report.status).toBe("pass");
		expect(report.trendSnapshot).toEqual(
			expect.objectContaining({
				baselineRef: baselinePath,
				baselineStatus: "unavailable",
				delta: null,
				direction: "baseline_unavailable",
			}),
		);
	});
});
