import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXIT_CODES, runPlanGate } from "../lib/plan-gate/detector.js";
import { runPlanGateCLI } from "./plan-gate.js";

let testDir = "";

// Helper to create a plan for testing
function createTestPlan(
	title: string,
	date: string,
	type: string,
	status: string,
	content: string,
	basePath: string,
	origin?: string,
	planId?: string,
): string {
	const plansDir = join(basePath, "docs/plans");
	if (!existsSync(plansDir)) {
		mkdirSync(plansDir, { recursive: true });
	}

	const sanitizedTitle = title.toLowerCase().replace(/\s+/g, "-");
	const filename = `${date}-${type}-${sanitizedTitle}-plan.md`;
	const filepath = join(plansDir, filename);

	const frontmatter = [
		"---",
		`title: ${title}`,
		`date: ${date}`,
		`type: ${type}`,
		`status: ${status}`,
		...(origin ? [`origin: ${origin}`] : []),
		...(planId ? [`plan_id: ${planId}`] : []),
		"---",
	].join("\n");

	const fullContent = `${frontmatter}

${content}
`;

	writeFileSync(filepath, fullContent, "utf-8");
	return filepath;
}

describe("plan-gate command", () => {
	beforeEach(() => {
		const baseDir = resolve("artifacts");
		mkdirSync(baseDir, { recursive: true });
		testDir = join(baseDir, `plans-gate-test-${randomUUID()}`);
		mkdirSync(testDir, { recursive: true });
		// Clean up plans directory
		const plansDir = join(testDir, "docs/plans");
		if (existsSync(plansDir)) {
			rmSync(plansDir, { recursive: true, force: true });
		}
	});

	afterEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe("runPlanGate", () => {
		it("fails when no plans exist", () => {
			const result = runPlanGate({ plansPath: join(testDir, "docs/plans") });

			expect(result.passed).toBe(false);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]?.code).toBe("MISSING");
		});

		it("passes with valid plan", () => {
			createTestPlan(
				"Test Feature",
				"2026-02-24",
				"feature",
				"draft",
				"## Implementation Steps\n\n- Step 1\n\n## Acceptance Criteria\n\n- Criterion 1",
				testDir,
				undefined,
				"feat-test-feature",
			);

			const result = runPlanGate({ plansPath: join(testDir, "docs/plans") });

			expect(result.passed).toBe(true);
			expect(result.artifacts).toHaveLength(1);
			expect(result.artifacts[0]?.title).toBe("Test Feature");
		});

		it("filters by type", () => {
			createTestPlan(
				"Feature A",
				"2026-02-24",
				"feature",
				"draft",
				"## Implementation Steps\n\n## Acceptance Criteria",
				testDir,
			);
			createTestPlan(
				"Bug Fix B",
				"2026-02-24",
				"bugfix",
				"draft",
				"## Implementation Steps\n\n## Acceptance Criteria",
				testDir,
			);

			const result = runPlanGate({
				plansPath: join(testDir, "docs/plans"),
				type: "bugfix",
			});

			expect(result.passed).toBe(true);
			expect(result.artifacts).toHaveLength(1);
			expect(result.artifacts[0]?.type).toBe("bugfix");
		});

		it("requires origin when flag is set", () => {
			createTestPlan(
				"Test Feature",
				"2026-02-24",
				"feature",
				"draft",
				"## Implementation Steps\n\n## Acceptance Criteria",
				testDir,
				// No origin
			);

			const result = runPlanGate({
				plansPath: join(testDir, "docs/plans"),
				requireOrigin: true,
			});

			expect(result.passed).toBe(false);
			expect(result.errors.some((e) => e.code === "ORIGIN_MISSING")).toBe(true);
		});

		it("passes with origin when required", () => {
			createTestPlan(
				"Test Feature",
				"2026-02-24",
				"feature",
				"draft",
				"## Implementation Steps\n\n## Acceptance Criteria",
				testDir,
				"docs/brainstorms/2026-02-20-test-feature-brainstorm.md",
				"feat-test-feature",
			);

			const result = runPlanGate({
				plansPath: join(testDir, "docs/plans"),
				requireOrigin: true,
			});

			expect(result.passed).toBe(true);
			expect(result.artifacts[0]?.hasOrigin).toBe(true);
		});

		it("checks sections in strict mode", () => {
			createTestPlan(
				"Incomplete Plan",
				"2026-02-24",
				"feature",
				"draft",
				"# Just a title", // Missing required sections
				testDir,
			);

			const result = runPlanGate({
				plansPath: join(testDir, "docs/plans"),
				strict: true,
			});

			expect(result.passed).toBe(false);
			expect(result.errors.some((e) => e.code === "INCOMPLETE")).toBe(true);
		});

		it("reports stale plans (non-draft only)", () => {
			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 60); // 60 days ago
			const oldDateStr = oldDate.toISOString().slice(0, 10);

			createTestPlan(
				"Old Approved Plan",
				oldDateStr,
				"feature",
				"approved", // Non-draft status
				"## Implementation Steps\n\n## Acceptance Criteria",
				testDir,
			);

			const result = runPlanGate({
				plansPath: join(testDir, "docs/plans"),
				maxAge: 30,
			});

			expect(result.passed).toBe(false);
			expect(result.errors.some((e) => e.code === "STALE")).toBe(true);
		});

		it("falls back to default max age when maxAge is NaN", () => {
			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 60);
			const oldDateStr = oldDate.toISOString().slice(0, 10);

			createTestPlan(
				"Old Approved Plan",
				oldDateStr,
				"feature",
				"approved",
				"## Implementation Steps\n\n## Acceptance Criteria",
				testDir,
			);

			const result = runPlanGate({
				plansPath: join(testDir, "docs/plans"),
				maxAge: Number.NaN,
			});

			expect(result.passed).toBe(false);
			expect(result.errors.some((e) => e.code === "STALE")).toBe(true);
		});

		it("does not mark drafts as stale", () => {
			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 60);
			const oldDateStr = oldDate.toISOString().slice(0, 10);

			createTestPlan(
				"Old Draft",
				oldDateStr,
				"feature",
				"draft", // Draft status - age check skipped
				"## Implementation Steps\n\n## Acceptance Criteria",
				testDir,
			);

			const result = runPlanGate({
				plansPath: join(testDir, "docs/plans"),
				maxAge: 30,
			});

			expect(result.passed).toBe(true);
		});

		it("requires plan_id when flag is set", () => {
			createTestPlan(
				"Traceability Plan",
				"2026-03-12",
				"feat",
				"active",
				"## Implementation Steps\n\n- Step 1\n\n## Acceptance Criteria\n\n- [ ] Criterion 1",
				testDir,
			);

			const result = runPlanGate({
				plansPath: join(testDir, "docs/plans"),
				requirePlanId: true,
			});

			expect(result.passed).toBe(false);
			expect(
				result.errors.some((error) => error.code === "PLAN_ID_MISSING"),
			).toBe(true);
		});

		it("validates referenced plan IDs from PR metadata", () => {
			createTestPlan(
				"Traceability Plan",
				"2026-03-12",
				"feat",
				"active",
				"## Implementation Steps\n\n- Step 1\n\n## Acceptance Criteria\n\n- [ ] Criterion 1",
				testDir,
				undefined,
				"feat-traceability-plan",
			);

			const result = runPlanGate({
				plansPath: join(testDir, "docs/plans"),
				prBody: "- Plan IDs: `feat-traceability-plan`",
				requireTraceability: true,
				changedFiles: ["src/commands/review-gate.ts"],
				requirePlanId: true,
			});

			expect(result.passed).toBe(true);
			expect(result.traceability?.planIds).toEqual(["feat-traceability-plan"]);
			expect(result.artifacts).toHaveLength(1);
			expect(result.artifacts[0]?.planId).toBe("feat-traceability-plan");
		});

		it("fails when changed work has no plan IDs", () => {
			createTestPlan(
				"Traceability Plan",
				"2026-03-12",
				"feat",
				"active",
				"## Implementation Steps\n\n- Step 1\n\n## Acceptance Criteria\n\n- [ ] Criterion 1",
				testDir,
				undefined,
				"feat-traceability-plan",
			);

			const result = runPlanGate({
				plansPath: join(testDir, "docs/plans"),
				requireTraceability: true,
				changedFiles: ["src/commands/review-gate.ts"],
			});

			expect(result.passed).toBe(false);
			expect(
				result.errors.some((error) => error.code === "TRACEABILITY_MISSING"),
			).toBe(true);
		});

		it("fails when completed acceptance items lack evidence refs", () => {
			createTestPlan(
				"Evidence Plan",
				"2026-03-12",
				"feat",
				"active",
				[
					"## Implementation Steps",
					"",
					"- Step 1",
					"",
					"## Acceptance Checklist",
					"",
					"- [x] Completed without proof",
				].join("\n"),
				testDir,
				undefined,
				"feat-evidence-plan",
			);

			const result = runPlanGate({
				plansPath: join(testDir, "docs/plans"),
				planIds: ["feat-evidence-plan"],
				requireAcceptanceEvidence: true,
				requirePlanId: true,
			});

			expect(result.passed).toBe(false);
			expect(
				result.errors.some(
					(error) => error.code === "ACCEPTANCE_EVIDENCE_MISSING",
				),
			).toBe(true);
		});

		it("passes when completed acceptance items carry evidence refs", () => {
			createTestPlan(
				"Evidence Plan",
				"2026-03-12",
				"feat",
				"active",
				[
					"## Implementation Steps",
					"",
					"- Step 1",
					"",
					"## Acceptance Checklist",
					"",
					"- [x] Completed with evidence: [review-gate.ts](/Users/jamiecraik/dev/coding-harness/src/commands/review-gate.ts)",
				].join("\n"),
				testDir,
				undefined,
				"feat-evidence-plan",
			);

			const result = runPlanGate({
				plansPath: join(testDir, "docs/plans"),
				planIds: ["feat-evidence-plan"],
				requireAcceptanceEvidence: true,
				requirePlanId: true,
			});

			expect(result.passed).toBe(true);
		});
	});

	describe("runPlanGateCLI", () => {
		it("outputs JSON when --json flag is set", () => {
			const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {
				// noop for assertion
			});

			createTestPlan(
				"Test Feature",
				"2026-02-24",
				"feature",
				"draft",
				"## Implementation Steps\n\n## Acceptance Criteria",
				testDir,
			);

			const exitCode = runPlanGateCLI({
				plansPath: join(testDir, "docs/plans"),
				json: true,
			});

			expect(exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(consoleSpy).toHaveBeenCalled();

			const output = consoleSpy.mock.calls[0]?.[0];
			expect(output).toContain('"passed"');

			consoleSpy.mockRestore();
		});

		it("returns PLAN_MISSING when no plans found", () => {
			const exitCode = runPlanGateCLI({
				plansPath: join(testDir, "docs/plans"),
			});

			expect(exitCode).toBe(EXIT_CODES.PLAN_MISSING);
		});

		it("returns ORIGIN_MISSING when origin required but missing", () => {
			createTestPlan(
				"Test Feature",
				"2026-02-24",
				"feature",
				"draft",
				"## Implementation Steps\n\n## Acceptance Criteria",
				testDir,
			);

			const exitCode = runPlanGateCLI({
				plansPath: join(testDir, "docs/plans"),
				requireOrigin: true,
			});

			expect(exitCode).toBe(EXIT_CODES.ORIGIN_MISSING);
		});

		it("returns TRACEABILITY_ERROR when plan IDs are missing for changed work", () => {
			createTestPlan(
				"Traceability Plan",
				"2026-03-12",
				"feat",
				"active",
				"## Implementation Steps\n\n- Step 1\n\n## Acceptance Criteria\n\n- [ ] Criterion 1",
				testDir,
				undefined,
				"feat-traceability-plan",
			);

			const exitCode = runPlanGateCLI({
				plansPath: join(testDir, "docs/plans"),
				requireTraceability: true,
				changedFiles: ["src/commands/review-gate.ts"],
			});

			expect(exitCode).toBe(EXIT_CODES.TRACEABILITY_ERROR);
		});
	});
});
