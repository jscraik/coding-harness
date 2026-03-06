import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	checkMissingOrigin,
	createPlan,
	findPlans,
	generatePlanFilename,
	loadPlan,
	updatePlanStatus,
} from "./plan.js";

const TEST_DIR = "artifacts/plans-test";

function isoDateDaysAgo(daysAgo: number): string {
	const now = new Date();
	const date = new Date(
		Date.UTC(
			now.getUTCFullYear(),
			now.getUTCMonth(),
			now.getUTCDate() - daysAgo,
		),
	);
	return date.toISOString().split("T")[0] ?? "";
}

// Helper to create a brainstorm for testing
function createTestBrainstorm(
	topic: string,
	date: string,
	decisions: string[],
	basePath: string,
): string {
	const brainstormsDir = join(basePath, "docs/brainstorms");
	if (!existsSync(brainstormsDir)) {
		mkdirSync(brainstormsDir, { recursive: true });
	}

	const filename = `${date}-${topic.toLowerCase().replace(/\s+/g, "-")}-brainstorm.md`;
	const filepath = join(brainstormsDir, filename);

	const content = `---
topic: ${topic}
date: ${date}
status: draft
decisions:
${decisions.map((d) => `  - ${d}`).join("\n")}
---

# Brainstorm: ${topic}

Test content.
`;

	writeFileSync(filepath, content, "utf-8");
	return filepath;
}

describe("plan workflow", () => {
	beforeEach(() => {
		if (!existsSync(TEST_DIR)) {
			mkdirSync(TEST_DIR, { recursive: true });
		}
		// Clean up
		const dirs = [
			join(TEST_DIR, "docs/plans"),
			join(TEST_DIR, "docs/brainstorms"),
		];
		for (const dir of dirs) {
			if (existsSync(dir)) {
				rmSync(dir, { recursive: true });
			}
		}
	});

	afterEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	describe("generatePlanFilename", () => {
		it("generates correct filename format", () => {
			const date = new Date("2026-02-24");
			const filename = generatePlanFilename("feature", "api-redesign", date);
			expect(filename).toBe("2026-02-24-feature-api-redesign-plan.md");
		});

		it("sanitizes special characters", () => {
			const filename = generatePlanFilename(
				"feature",
				"API v2.0!",
				new Date("2026-02-24"),
			);
			expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}-feature-api-v2-0-plan\.md$/);
		});
	});

	describe("createPlan", () => {
		it("creates plan file with frontmatter", () => {
			const filepath = createPlan({
				title: "Test Feature",
				type: "feature",
				content: "Implementation plan here...",
				basePath: TEST_DIR,
			});

			expect(existsSync(filepath)).toBe(true);

			const loaded = loadPlan(filepath);
			expect(loaded.frontmatter.title).toBe("Test Feature");
			expect(loaded.frontmatter.type).toBe("feature");
			expect(loaded.frontmatter.status).toBe("draft");
			expect(loaded.content).toContain("Implementation plan");
		});

		it("links to origin brainstorm when provided", () => {
			// Create a brainstorm first
			createTestBrainstorm(
				"test-feature",
				"2026-02-20",
				["Use TypeScript", "Add tests"],
				TEST_DIR,
			);

			const filepath = createPlan({
				title: "Test Feature",
				type: "feature",
				content: "Plan content...",
				originBrainstorm: "2026-02-20-test-feature-brainstorm.md",
				basePath: TEST_DIR,
			});

			const loaded = loadPlan(filepath);
			expect(loaded.frontmatter.origin).toBe(
				"2026-02-20-test-feature-brainstorm.md",
			);
			expect(loaded.frontmatter.brainstormDate).toBe("2026-02-20");
			expect(loaded.frontmatter.decisions).toEqual([
				"Use TypeScript",
				"Add tests",
			]);
		});

		it("auto-discovers related brainstorm", () => {
			// Create a brainstorm with matching topic
			createTestBrainstorm(
				"test-feature",
				isoDateDaysAgo(1),
				["Decision 1"],
				TEST_DIR,
			);

			const filepath = createPlan({
				title: "test-feature", // Matches brainstorm topic
				type: "feature",
				content: "Plan content...",
				basePath: TEST_DIR,
			});

			const loaded = loadPlan(filepath);
			expect(loaded.frontmatter.origin).toBeDefined();
		});
	});

	describe("findPlans", () => {
		it("returns empty array when no plans exist", () => {
			const result = findPlans(TEST_DIR);
			expect(result).toEqual([]);
		});

		it("finds all plans", () => {
			createPlan({
				title: "Feature A",
				type: "feature",
				content: "A",
				basePath: TEST_DIR,
			});
			createPlan({
				title: "Feature B",
				type: "refactor",
				content: "B",
				basePath: TEST_DIR,
			});

			const result = findPlans(TEST_DIR);
			expect(result).toHaveLength(2);
			expect(result.map((p) => p.frontmatter.title)).toContain("Feature A");
			expect(result.map((p) => p.frontmatter.title)).toContain("Feature B");
		});
	});

	describe("checkMissingOrigin", () => {
		it("returns missing=false when plan has origin", () => {
			createTestBrainstorm("feature-x", "2026-02-20", [], TEST_DIR);

			const planPath = createPlan({
				title: "Feature X",
				type: "feature",
				content: "Plan...",
				originBrainstorm: "2026-02-20-feature-x-brainstorm.md",
				basePath: TEST_DIR,
			});

			const result = checkMissingOrigin(planPath, TEST_DIR);
			expect(result.missing).toBe(false);
		});

		it("returns missing=true when related brainstorm exists but no origin", () => {
			createTestBrainstorm("feature-y", isoDateDaysAgo(1), [], TEST_DIR);

			const planPath = createPlan({
				title: "feature-y", // Matches brainstorm
				type: "feature",
				content: "Plan...",
				basePath: TEST_DIR,
			});

			// Remove origin from the plan file
			const content = readFileSync(planPath, "utf-8");
			const updated = content
				.replace(/origin:.*/g, "")
				.replace(/brainstormDate:.*/g, "");
			writeFileSync(planPath, updated, "utf-8");

			const result = checkMissingOrigin(planPath, TEST_DIR);
			expect(result.missing).toBe(true);
			expect(result.recentBrainstorms.length).toBeGreaterThan(0);
		});
	});

	describe("updatePlanStatus", () => {
		it("updates plan status", () => {
			const filepath = createPlan({
				title: "Test",
				type: "feature",
				content: "Content",
				basePath: TEST_DIR,
			});

			updatePlanStatus(filepath, "approved");

			const loaded = loadPlan(filepath);
			expect(loaded.frontmatter.status).toBe("approved");
		});
	});
});
