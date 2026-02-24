import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runBrainstormGate } from "./detector.js";

const TEST_DIR = "artifacts/brainstorm-detector-test";

function createTestBrainstorm(basePath: string, date: string): void {
	const brainstormsDir = join(basePath, "docs/brainstorms");
	if (!existsSync(brainstormsDir)) {
		mkdirSync(brainstormsDir, { recursive: true });
	}

	const filePath = join(brainstormsDir, `${date}-test-topic-brainstorm.md`);
	const content = `---
topic: test-topic
date: ${date}
---

## What We're Building

- Build the thing

## Why This Approach

- It keeps scope focused

## Key Decisions

- Keep tests deterministic
`;

	writeFileSync(filePath, content, "utf-8");
}

describe("brainstorm detector max-age handling", () => {
	beforeEach(() => {
		if (!existsSync(TEST_DIR)) {
			mkdirSync(TEST_DIR, { recursive: true });
		}
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

	it("respects maxAgeDays override", () => {
		createTestBrainstorm(TEST_DIR, "2026-02-04");

		const staleWithDefault = runBrainstormGate({
			brainstormsPath: join(TEST_DIR, "docs/brainstorms"),
		});
		expect(staleWithDefault.passed).toBe(false);
		expect(staleWithDefault.errors.some((e) => e.code === "STALE")).toBe(true);

		const passesWithOverride = runBrainstormGate({
			brainstormsPath: join(TEST_DIR, "docs/brainstorms"),
			maxAgeDays: 30,
		});
		expect(passesWithOverride.passed).toBe(true);
		expect(passesWithOverride.errors.some((e) => e.code === "STALE")).toBe(
			false,
		);
	});

	it("supports legacy maxAge alias used by older callers", () => {
		createTestBrainstorm(TEST_DIR, "2026-02-04");

		const result = runBrainstormGate({
			brainstormsPath: join(TEST_DIR, "docs/brainstorms"),
			maxAge: 30,
		});

		expect(result.passed).toBe(true);
		expect(result.errors.some((e) => e.code === "STALE")).toBe(false);
	});

	it("prefers maxAgeDays when both maxAgeDays and maxAge are provided", () => {
		createTestBrainstorm(TEST_DIR, "2026-02-04");

		const result = runBrainstormGate({
			brainstormsPath: join(TEST_DIR, "docs/brainstorms"),
			maxAgeDays: 7,
			maxAge: 30,
		});

		expect(result.passed).toBe(false);
		expect(result.errors.some((e) => e.code === "STALE")).toBe(true);
	});

	it("falls back to default max age when maxAgeDays is NaN", () => {
		createTestBrainstorm(TEST_DIR, "2026-02-04");

		const result = runBrainstormGate({
			brainstormsPath: join(TEST_DIR, "docs/brainstorms"),
			maxAgeDays: Number.NaN,
		});

		expect(result.passed).toBe(false);
		expect(result.errors.some((e) => e.code === "STALE")).toBe(true);
	});

	it("fails strict mode when required sections are missing", () => {
		const brainstormsDir = join(TEST_DIR, "docs/brainstorms");
		if (!existsSync(brainstormsDir)) {
			mkdirSync(brainstormsDir, { recursive: true });
		}

		writeFileSync(
			join(brainstormsDir, "2026-02-24-incomplete-brainstorm.md"),
			`---\ntopic: incomplete\ndate: 2026-02-24\n---\n\n## What We're Building\n\n- One section only\n`,
			"utf-8",
		);

		const result = runBrainstormGate({
			brainstormsPath: brainstormsDir,
			strict: true,
		});

		expect(result.passed).toBe(false);
		expect(result.errors.some((e) => e.code === "INCOMPLETE")).toBe(true);
	});
});
