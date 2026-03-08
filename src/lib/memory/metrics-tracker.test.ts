import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	calculateTrends,
	checkQuestionSLA,
	createEmptyMetrics,
	loadMetrics,
	saveMetrics,
	updateMetrics,
} from "./metrics-tracker.js";
import type { MetricsHistory } from "./metrics-tracker.js";

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs) {
		rmSync(dir, { recursive: true, force: true });
	}
	tempDirs.length = 0;
});

describe("updateMetrics", () => {
	it("increments pass^k and accumulates counters on success", () => {
		const previous = createEmptyMetrics();
		const updated = updateMetrics(previous, {
			success: true,
			entryCount: 3,
			toolErrors: { git: 1 },
			duplicates: 2,
		});

		expect(updated.pass_k).toBe(1);
		expect(updated.total_ops).toBe(3);
		expect(updated.successful_ops).toBe(3);
		expect(updated.tool_errors.git).toBe(1);
		expect(updated.duplicate_memory_count).toBe(2);
	});
});

describe("calculateTrends", () => {
	it("computes error rate from cumulative metric deltas (not snapshot sums)", () => {
		const history: MetricsHistory["history"] = [
			{
				date: "2026-02-25T00:00:00.000Z",
				metrics: {
					pass_k: 1,
					total_ops: 10,
					successful_ops: 8,
					tool_errors: { git: 2 },
					duplicate_memory_count: 0,
					unresolved_questions: [],
				},
			},
			{
				date: "2026-02-25T01:00:00.000Z",
				metrics: {
					pass_k: 2,
					total_ops: 20,
					successful_ops: 16,
					tool_errors: { git: 3 },
					duplicate_memory_count: 0,
					unresolved_questions: [],
				},
			},
			{
				date: "2026-02-25T02:00:00.000Z",
				metrics: {
					pass_k: 3,
					total_ops: 30,
					successful_ops: 24,
					tool_errors: { git: 5 },
					duplicate_memory_count: 0,
					unresolved_questions: [],
				},
			},
		];

		const trends = calculateTrends(history);

		// Delta over window = 20 ops, 3 errors => 0.15
		expect(trends.error_rate).toBeCloseTo(0.15, 5);
		expect(trends.reliability_score).toBeCloseTo(85, 5);
		expect(trends.pass_k_trend).toBe("improving");
	});

	it("returns stable defaults for short history", () => {
		const trends = calculateTrends([
			{
				date: "2026-02-25T00:00:00.000Z",
				metrics: createEmptyMetrics(),
			},
		]);

		expect(trends.pass_k_trend).toBe("stable");
		expect(trends.error_rate).toBe(0);
		expect(trends.reliability_score).toBe(100);
	});
});

describe("loadMetrics", () => {
	it("filters malformed history entries to avoid downstream crashes", () => {
		const root = mkdtempSync(join(process.cwd(), ".harness-metrics-"));
		tempDirs.push(root);
		const metricsPath = join(root, "metrics.json");

		writeFileSync(
			metricsPath,
			JSON.stringify({
				current: createEmptyMetrics(),
				history: [
					{
						date: "2026-02-25T00:00:00.000Z",
						metrics: createEmptyMetrics(),
					},
					{
						date: "2026-02-25T01:00:00.000Z",
						metrics: { pass_k: 1 }, // malformed
					},
				],
			}),
			"utf-8",
		);

		const { history } = loadMetrics(metricsPath);
		expect(history).toHaveLength(1);
		expect(() => calculateTrends(history)).not.toThrow();
	});

	// Regression: symlinked metrics file must not be read (fail-safe empty metrics)
	it("returns empty metrics when metrics path is a symlink", () => {
		const root = mkdtempSync(join(process.cwd(), ".harness-metrics-"));
		tempDirs.push(root);

		const targetPath = join(root, "real-metrics.json");
		writeFileSync(
			targetPath,
			JSON.stringify({ current: createEmptyMetrics(), history: [] }),
			"utf-8",
		);

		const symlinkPath = join(root, "metrics-symlink.json");
		symlinkSync(targetPath, symlinkPath);

		const result = loadMetrics(symlinkPath);
		expect(result.metrics).toEqual(createEmptyMetrics());
		expect(result.history).toEqual([]);
	});
});

describe("saveMetrics", () => {
	// Regression: saveMetrics must throw for symlinked paths (fail-closed for writes)
	it("throws when metrics file path is a symlink", () => {
		const root = mkdtempSync(join(process.cwd(), ".harness-metrics-"));
		tempDirs.push(root);

		const targetPath = join(root, "outside.json");
		writeFileSync(targetPath, "{}", "utf-8");

		const symlinkPath = join(root, "metrics.json");
		symlinkSync(targetPath, symlinkPath);

		expect(() => saveMetrics(createEmptyMetrics(), [], symlinkPath)).toThrow(
			/symlinked metrics file path/,
		);
	});
});

describe("checkQuestionSLA", () => {
	it("treats invalid asked_at timestamps as overdue", () => {
		const metrics = createEmptyMetrics();
		metrics.unresolved_questions.push({
			question: "invalid date question",
			asked_at: "not-a-date",
			sla_hours: 24,
		});

		const result = checkQuestionSLA(metrics);
		expect(result.overdue).toContain("invalid date question");
		expect(result.withinSLA).not.toContain("invalid date question");
	});
});
