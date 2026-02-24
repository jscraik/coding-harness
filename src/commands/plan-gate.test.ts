import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXIT_CODES, runPlanGate } from "../lib/plan-gate/detector.js";
import { runPlanGateCLI } from "./plan-gate.js";

const TEST_DIR = "artifacts/plans-gate-test";

// Helper to create a plan for testing
function createTestPlan(
	title: string,
	date: string,
	type: string,
	status: string,
	content: string,
	basePath: string,
	origin?: string,
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
		if (!existsSync(TEST_DIR)) {
			mkdirSync(TEST_DIR, { recursive: true });
		}
		// Clean up plans directory
		const plansDir = join(TEST_DIR, "docs/plans");
		if (existsSync(plansDir)) {
			rmSync(plansDir, { recursive: true });
		}
	});

	afterEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	describe("runPlanGate", () => {
		it("fails when no plans exist", () => {
			const result = runPlanGate({ plansPath: join(TEST_DIR, "docs/plans") });

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
				TEST_DIR,
			);

			const result = runPlanGate({ plansPath: join(TEST_DIR, "docs/plans") });

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
				TEST_DIR,
			);
			createTestPlan(
				"Bug Fix B",
				"2026-02-24",
				"bugfix",
				"draft",
				"## Implementation Steps\n\n## Acceptance Criteria",
				TEST_DIR,
			);

			const result = runPlanGate({
				plansPath: join(TEST_DIR, "docs/plans"),
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
				TEST_DIR,
				// No origin
			);

			const result = runPlanGate({
				plansPath: join(TEST_DIR, "docs/plans"),
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
				TEST_DIR,
				"docs/brainstorms/2026-02-20-test-feature-brainstorm.md",
			);

			const result = runPlanGate({
				plansPath: join(TEST_DIR, "docs/plans"),
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
				TEST_DIR,
			);

			const result = runPlanGate({
				plansPath: join(TEST_DIR, "docs/plans"),
				strict: true,
			});

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
				TEST_DIR,
			);

			const result = runPlanGate({
				plansPath: join(TEST_DIR, "docs/plans"),
				maxAge: 30,
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
				TEST_DIR,
			);

			const result = runPlanGate({
				plansPath: join(TEST_DIR, "docs/plans"),
				maxAge: 30,
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
				TEST_DIR,
			);

			const exitCode = runPlanGateCLI({
				plansPath: join(TEST_DIR, "docs/plans"),
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
				plansPath: join(TEST_DIR, "docs/plans"),
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
				TEST_DIR,
			);

			const exitCode = runPlanGateCLI({
				plansPath: join(TEST_DIR, "docs/plans"),
				requireOrigin: true,
			});

			expect(exitCode).toBe(EXIT_CODES.ORIGIN_MISSING);
		});
	});
});
