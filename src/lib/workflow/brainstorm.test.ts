import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	createBrainstorm,
	findBrainstorms,
	findRecentBrainstorms,
	generateBrainstormFilename,
	loadBrainstorm,
	requiresBrainstorm,
	updateBrainstormStatus,
} from "./brainstorm.js";

const TEST_DIR = "artifacts/brainstorms-test";

describe("brainstorm workflow", () => {
	beforeEach(() => {
		if (!existsSync(TEST_DIR)) {
			mkdirSync(TEST_DIR, { recursive: true });
		}
		// Clean up any existing files
		const brainstormsDir = join(TEST_DIR, "docs/brainstorms");
		if (existsSync(brainstormsDir)) {
			rmSync(brainstormsDir, { recursive: true });
		}
	});

	afterEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	describe("generateBrainstormFilename", () => {
		it("generates correct filename format", () => {
			const date = new Date("2026-02-24");
			const filename = generateBrainstormFilename("api-design", date);
			expect(filename).toBe("2026-02-24-api-design-brainstorm.md");
		});

		it("sanitizes special characters", () => {
			const filename = generateBrainstormFilename("API Design: v2.0!");
			expect(filename).toMatch(
				/^\d{4}-\d{2}-\d{2}-api-design-v2-0-brainstorm\.md$/,
			);
		});
	});

	describe("createBrainstorm", () => {
		it("creates brainstorm file with frontmatter", () => {
			const topic = "test-feature";
			const content = "Initial thoughts on the feature...";

			const filepath = createBrainstorm(topic, content, {
				basePath: TEST_DIR,
				decisions: ["Use TypeScript", "Add tests"],
			});

			expect(existsSync(filepath)).toBe(true);

			const loaded = loadBrainstorm(filepath);
			expect(loaded.frontmatter.topic).toBe(topic);
			expect(loaded.frontmatter.status).toBe("draft");
			expect(loaded.frontmatter.decisions).toEqual([
				"Use TypeScript",
				"Add tests",
			]);
			expect(loaded.content).toContain("Initial thoughts");
		});
	});

	describe("findBrainstorms", () => {
		it("returns empty array when no brainstorms exist", () => {
			const result = findBrainstorms(TEST_DIR);
			expect(result).toEqual([]);
		});

		it("finds all brainstorms", () => {
			createBrainstorm("feature-a", "Content A", { basePath: TEST_DIR });
			createBrainstorm("feature-b", "Content B", { basePath: TEST_DIR });

			const result = findBrainstorms(TEST_DIR);
			expect(result).toHaveLength(2);
			expect(result.map((b) => b.frontmatter.topic)).toContain("feature-a");
			expect(result.map((b) => b.frontmatter.topic)).toContain("feature-b");
		});
	});

	describe("findRecentBrainstorms", () => {
		it("filters by date range", () => {
			// Create an old brainstorm
			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 20);
			createBrainstorm("old-feature", "Old content", {
				basePath: TEST_DIR,
				date: oldDate,
			});

			// Create a recent brainstorm
			createBrainstorm("recent-feature", "Recent content", {
				basePath: TEST_DIR,
			});

			const recent = findRecentBrainstorms(14, TEST_DIR);
			expect(recent).toHaveLength(1);
			expect(recent[0]?.frontmatter.topic).toBe("recent-feature");
		});
	});

	describe("requiresBrainstorm", () => {
		it("returns true when no matching brainstorm exists", () => {
			expect(requiresBrainstorm("new-feature", TEST_DIR)).toBe(true);
		});

		it("returns false when matching brainstorm exists", () => {
			createBrainstorm("existing-feature", "Content", { basePath: TEST_DIR });
			expect(requiresBrainstorm("existing-feature", TEST_DIR)).toBe(false);
		});
	});

	describe("updateBrainstormStatus", () => {
		it("updates status and supersededBy", () => {
			const filepath = createBrainstorm("test", "Content", {
				basePath: TEST_DIR,
			});

			updateBrainstormStatus(
				filepath,
				"superseded",
				"2026-02-25-new-test-brainstorm.md",
			);

			const loaded = loadBrainstorm(filepath);
			expect(loaded.frontmatter.status).toBe("superseded");
			expect(loaded.frontmatter.supersededBy).toBe(
				"2026-02-25-new-test-brainstorm.md",
			);
		});
	});
});
