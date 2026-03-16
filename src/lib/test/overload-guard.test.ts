import os from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	evaluateTimingAssertionOverload,
	runTimingAssertionWithOverloadGuard,
} from "./overload-guard.js";

describe("overload timing assertion guard", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
	});

	it("honors explicit skip override", () => {
		vi.stubEnv("HARNESS_TEST_SKIP_TIMING_ASSERTIONS", "1");

		const result = evaluateTimingAssertionOverload();

		expect(result.overloaded).toBe(true);
		expect(result.reason).toBe("HARNESS_TEST_SKIP_TIMING_ASSERTIONS=1");
	});

	it("auto-detects overload from load and memory pressure", () => {
		vi.stubEnv("HARNESS_TEST_MAX_LOAD_PER_CPU", "1");
		vi.stubEnv("HARNESS_TEST_MIN_FREE_MEMORY_RATIO", "0.3");
		vi.spyOn(os, "cpus").mockReturnValue([
			{
				model: "test",
				speed: 1000,
				times: { user: 1, nice: 1, sys: 1, idle: 1, irq: 1 },
			},
		]);
		vi.spyOn(os, "loadavg").mockReturnValue([3, 2, 1]);
		vi.spyOn(os, "totalmem").mockReturnValue(100);
		vi.spyOn(os, "freemem").mockReturnValue(5);

		const result = evaluateTimingAssertionOverload();

		expect(result.overloaded).toBe(true);
		expect(result.reason).toContain("load-per-cpu threshold exceeded");
		expect(result.reason).toContain("free-memory threshold exceeded");
		expect(
			result.diagnostics.some((entry) => entry.startsWith("loadPerCpu=")),
		).toBe(true);
	});

	it("skips guarded assertion with explicit diagnostic while preserving test flow", () => {
		const reporter = vi.fn<(message: string) => void>();
		const assertion = vi.fn(() => {
			throw new Error("timing assertion should not execute when overloaded");
		});

		const outcome = runTimingAssertionWithOverloadGuard({
			label: "synthetic latency <= 100ms",
			assertion,
			reporter,
			check: {
				overloaded: true,
				reason: "synthetic overload for test",
				diagnostics: ["loadPerCpu=2.8", "freeMemoryRatio=0.03"],
			},
		});

		expect(outcome.skipped).toBe(true);
		expect(assertion).not.toHaveBeenCalled();
		expect(reporter).toHaveBeenCalledWith(
			expect.stringContaining("[timing-assertion-skipped]"),
		);
		expect(outcome.diagnostic).toContain("synthetic overload for test");
	});

	it("executes guarded assertion when system is healthy", () => {
		const assertion = vi.fn();

		const outcome = runTimingAssertionWithOverloadGuard({
			label: "healthy run",
			assertion,
			check: {
				overloaded: false,
				reason: "within-threshold",
				diagnostics: ["loadPerCpu=0.30"],
			},
		});

		expect(outcome.skipped).toBe(false);
		expect(assertion).toHaveBeenCalledTimes(1);
		expect(outcome.diagnostic).toBeNull();
	});
});
