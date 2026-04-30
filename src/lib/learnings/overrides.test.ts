import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	LEARNING_OVERRIDE_SCHEMA_VERSION,
	loadLearningOverrides,
} from "./overrides.js";

describe("learning overrides", () => {
	const cleanup: string[] = [];
	afterEach(() => {
		for (const path of cleanup.splice(0))
			rmSync(path, { recursive: true, force: true });
	});

	it("loads audited suppressions", () => {
		const dir = mkdtempSync(join(tmpdir(), "learning-overrides-"));
		cleanup.push(dir);
		mkdirSync(join(dir, ".harness/learnings"), { recursive: true });
		writeFileSync(
			join(dir, ".harness/learnings/overrides.json"),
			JSON.stringify({
				schemaVersion: LEARNING_OVERRIDE_SCHEMA_VERSION,
				suppressions: [
					{
						learningId: "coderabbit.coding-harness.frontmatter",
						pathPattern: "docs/**",
						reason: "False positive for migrated docs.",
						owner: "docs-owner",
						expiresAt: "2026-12-31",
						replacementAction: "Track this in the docs migration issue.",
					},
				],
			}),
			"utf-8",
		);

		const result = loadLearningOverrides({
			path: ".harness/learnings/overrides.json",
			repoRoot: dir,
			now: new Date("2026-04-30T00:00:00Z"),
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.overrides.suppressions[0]?.owner).toBe("docs-owner");
		expect(result.warnings).toEqual([]);
	});

	it("fails closed for expired suppressions in strict mode", () => {
		const dir = mkdtempSync(join(tmpdir(), "learning-overrides-expired-"));
		cleanup.push(dir);
		const path = join(dir, "overrides.json");
		writeFileSync(
			path,
			JSON.stringify({
				schemaVersion: LEARNING_OVERRIDE_SCHEMA_VERSION,
				suppressions: [
					{
						learningId: "coderabbit.coding-harness.frontmatter",
						pathPattern: "docs/**",
						reason: "Temporary rollout exception.",
						owner: "docs-owner",
						expiresAt: "2026-01-01",
						replacementAction: "Remove duplicated metadata later.",
					},
				],
			}),
			"utf-8",
		);

		const result = loadLearningOverrides({
			path,
			mode: "strict",
			now: new Date("2026-04-30T00:00:00Z"),
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.warnings[0]).toMatchObject({
			id: "learnings-gate.override.expired.coderabbit.coding-harness.frontmatter",
			severity: "error",
		});
	});

	it("warns for expired suppressions in advisory mode", () => {
		const dir = mkdtempSync(join(tmpdir(), "learning-overrides-advisory-"));
		cleanup.push(dir);
		const path = join(dir, "overrides.json");
		writeFileSync(
			path,
			JSON.stringify({
				schemaVersion: LEARNING_OVERRIDE_SCHEMA_VERSION,
				suppressions: [
					{
						learningId: "coderabbit.coding-harness.frontmatter",
						pathPattern: "docs/**",
						reason: "Temporary rollout exception.",
						owner: "docs-owner",
						expiresAt: "2026-01-01",
						replacementAction: "Remove duplicated metadata later.",
					},
				],
			}),
			"utf-8",
		);

		const result = loadLearningOverrides({
			path,
			mode: "advisory",
			now: new Date("2026-04-30T00:00:00Z"),
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.warnings[0]?.severity).toBe("warning");
	});
});
