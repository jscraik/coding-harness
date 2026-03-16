import { describe, expect, it } from "vitest";
import {
	PERFORMANCE_PRECHECK_ENV,
	formatTimingAssertionSkipDiagnostic,
	runPerformanceOverloadPrecheck,
} from "./performance-overload.js";

describe("runPerformanceOverloadPrecheck", () => {
	it("marks the environment as overloaded when forced by env override", async () => {
		const result = await runPerformanceOverloadPrecheck({
			context: "force-overload-test",
			env: {
				[PERFORMANCE_PRECHECK_ENV.forceOverload]: "true",
			},
			observed: {
				cpuCount: 8,
				loadPerCore: 0.2,
				freeMemoryRatio: 0.6,
				eventLoopLagMs: 5,
			},
		});

		expect(result.overloaded).toBe(true);
		expect(result.reasons).toContain(
			`forced by ${PERFORMANCE_PRECHECK_ENV.forceOverload}=true`,
		);
	});

	it("marks the environment as overloaded when measured metrics exceed thresholds", async () => {
		const result = await runPerformanceOverloadPrecheck({
			context: "metric-overload-test",
			thresholds: {
				maxLoadPerCore: 1.0,
				minFreeMemoryRatio: 0.3,
				maxEventLoopLagMs: 40,
			},
			observed: {
				cpuCount: 8,
				loadPerCore: 1.3,
				freeMemoryRatio: 0.2,
				eventLoopLagMs: 90,
			},
		});

		expect(result.overloaded).toBe(true);
		expect(result.reasons).toEqual([
			"load/core 1.30 > 1",
			"free memory 20.0% < 30.0%",
			"event-loop lag 90ms > 40ms",
		]);
	});

	it("does not mark the environment as overloaded when all metrics are within thresholds", async () => {
		const result = await runPerformanceOverloadPrecheck({
			context: "healthy-test",
			thresholds: {
				maxLoadPerCore: 1.0,
				minFreeMemoryRatio: 0.2,
				maxEventLoopLagMs: 60,
			},
			observed: {
				cpuCount: 8,
				loadPerCore: 0.6,
				freeMemoryRatio: 0.4,
				eventLoopLagMs: 8,
			},
		});

		expect(result.overloaded).toBe(false);
		expect(result.reasons).toEqual([]);
	});

	it("supports disabling overload checks explicitly", async () => {
		const result = await runPerformanceOverloadPrecheck({
			context: "disabled-test",
			env: {
				[PERFORMANCE_PRECHECK_ENV.disablePrecheck]: "1",
			},
			observed: {
				cpuCount: 8,
				loadPerCore: 9,
				freeMemoryRatio: 0.01,
				eventLoopLagMs: 500,
			},
		});

		expect(result.overloaded).toBe(false);
		expect(result.skippedByPolicy).toBe(true);
	});
});

describe("formatTimingAssertionSkipDiagnostic", () => {
	it("includes explicit skip context and functional-assertion continuation", () => {
		const message = formatTimingAssertionSkipDiagnostic({
			overloaded: true,
			skippedByPolicy: false,
			reasons: ["event-loop lag 110ms > 50ms"],
			thresholds: {
				maxLoadPerCore: 1.5,
				minFreeMemoryRatio: 0.1,
				maxEventLoopLagMs: 50,
			},
			observed: {
				cpuCount: 8,
				loadPerCore: 0.9,
				freeMemoryRatio: 0.5,
				eventLoopLagMs: 110,
			},
			diagnostic: "throughput p95 assertion",
		});

		expect(message).toContain("Timing-sensitive assertions skipped");
		expect(message).toContain("Functional assertions continued to run.");
		expect(message).toContain("eventLoopLagMs=110");
	});
});
