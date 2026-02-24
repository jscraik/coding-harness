import { describe, expect, it } from "vitest";
import {
	type ExecutionTrace,
	type TraceEvent,
	addTraceEvent,
	captureTrace,
	generateTraceId,
	listTraces,
	loadTrace,
	replayTrace,
	validateTrace,
} from "./tracer.js";

describe("tracer", () => {
	describe("generateTraceId", () => {
		it("generates stable IDs", () => {
			const seed = "test-seed-123";
			const id1 = generateTraceId(seed);
			const id2 = generateTraceId(seed);
			expect(id1).toBe(id2);
		});

		it("generates unique IDs for different seeds", () => {
			const id1 = generateTraceId("seed-1");
			const id2 = generateTraceId("seed-2");
			expect(id1).not.toBe(id2);
		});

		it("generates IDs with correct prefix", () => {
			const id = generateTraceId();
			expect(id).toMatch(/^trace-[a-f0-9]{16}$/);
		});
	});

	describe("captureTrace", () => {
		it("captures a new trace", async () => {
			const trace = await captureTrace("test-command", ["--flag", "value"], {
				config: {
					baseDir: `.test-traces-capture-${Date.now()}`,
					maxTraces: 10,
				},
				tags: ["test"],
			});

			expect(trace.traceId).toMatch(/^trace-/);
			expect(trace.command).toBe("test-command");
			expect(trace.args).toEqual(["--flag", "value"]);
			expect(trace.events).toHaveLength(0);
			expect(trace.metadata.tags).toContain("test");
		});

		it("includes sanitized environment", async () => {
			const trace = await captureTrace("cmd", [], {
				config: {
					baseDir: `.test-traces-env-${Date.now()}`,
					maxTraces: 10,
					includeEnv: false,
				},
				environment: {
					NODE_ENV: "test",
					SECRET_KEY: "should-not-appear",
					PATH: "/usr/bin",
				},
			});

			expect(trace.environment.NODE_ENV).toBe("test");
			expect(trace.environment.SECRET_KEY).toBeUndefined();
		});
	});

	describe("addTraceEvent", () => {
		it("adds event to trace", async () => {
			const config = {
				baseDir: `.test-traces-add-${Date.now()}`,
				maxTraces: 10,
			};
			const trace = await captureTrace("cmd", [], { config });

			await addTraceEvent(
				trace.traceId,
				{ type: "command", payload: { cmd: "ls" } },
				config,
			);

			const loaded = await loadTrace(trace.traceId, config);
			expect(loaded).not.toBeNull();
			expect(loaded?.events).toHaveLength(1);
			expect(loaded?.events[0]?.type).toBe("command");
		});

		it("throws for non-existent trace", async () => {
			await expect(
				addTraceEvent("trace-nonexistent", { type: "command", payload: {} }),
			).rejects.toThrow("Trace not found");
		});
	});

	describe("loadTrace", () => {
		it("loads saved trace", async () => {
			const config = {
				baseDir: `.test-traces-load-${Date.now()}`,
				maxTraces: 10,
			};
			const trace = await captureTrace("cmd", ["arg1"], { config });

			const loaded = await loadTrace(trace.traceId, config);
			expect(loaded).not.toBeNull();
			expect(loaded?.traceId).toBe(trace.traceId);
			expect(loaded?.command).toBe("cmd");
		});

		it("returns null for non-existent trace", async () => {
			const loaded = await loadTrace("trace-does-not-exist");
			expect(loaded).toBeNull();
		});
	});

	describe("listTraces", () => {
		it("lists traces sorted by creation time", async () => {
			const uniqueDir = `.test-traces-list-${Date.now()}`;
			const config = { baseDir: uniqueDir, maxTraces: 10 };

			// Create two traces
			const trace1 = await captureTrace("cmd1", [], { config });
			await new Promise((r) => setTimeout(r, 10)); // Small delay
			const trace2 = await captureTrace("cmd2", [], { config });

			const list = await listTraces(config);
			expect(list).toHaveLength(2);
			expect(list[0]?.traceId).toBe(trace2.traceId); // Newest first
			expect(list[1]?.traceId).toBe(trace1.traceId);
		});

		it("returns empty array when no traces exist", async () => {
			const list = await listTraces({ baseDir: ".nonexistent", maxTraces: 10 });
			expect(list).toEqual([]);
		});
	});

	describe("replayTrace", () => {
		it("returns error for non-existent trace", async () => {
			const result = await replayTrace("trace-nonexistent");
			expect(result.success).toBe(false);
			expect(result.message).toContain("not found");
		});

		it("performs dry run without executing", async () => {
			const config = {
				baseDir: `.test-traces-dryrun-${Date.now()}`,
				maxTraces: 10,
			};
			const trace = await captureTrace("cmd", [], { config });

			await addTraceEvent(
				trace.traceId,
				{ type: "command", payload: {} },
				config,
			);

			const result = await replayTrace(trace.traceId, { config, dryRun: true });
			expect(result.success).toBe(true);
			expect(result.message).toContain("Dry run");
		});

		it("replays events with callback", async () => {
			const config = {
				baseDir: `.test-traces-callback-${Date.now()}`,
				maxTraces: 10,
			};
			const trace = await captureTrace("cmd", [], { config });

			await addTraceEvent(
				trace.traceId,
				{ type: "command", payload: { id: 1 } },
				config,
			);
			await addTraceEvent(
				trace.traceId,
				{ type: "command", payload: { id: 2 } },
				config,
			);

			const replayedEvents: TraceEvent[] = [];
			const result = await replayTrace(trace.traceId, {
				config,
				onEvent: (event) => {
					replayedEvents.push(event);
				},
			});

			expect(result.success).toBe(true);
			expect(result.replayedEvents).toBe(2);
			expect(replayedEvents).toHaveLength(2);
		});
	});

	describe("validateTrace", () => {
		it("validates correct trace", () => {
			const trace: ExecutionTrace = {
				traceId: "trace-abc123",
				createdAt: new Date().toISOString(),
				workingDirectory: "/test",
				command: "test",
				args: [],
				environment: {},
				events: [],
				metadata: {},
			};

			expect(validateTrace(trace)).toBe(true);
		});

		it("rejects trace with invalid ID", () => {
			const trace = {
				traceId: "invalid-id",
				createdAt: new Date().toISOString(),
				workingDirectory: "/test",
				command: "test",
				args: [],
				environment: {},
				events: [],
				metadata: {},
			};

			expect(validateTrace(trace)).toBe(false);
		});

		it("rejects trace with invalid date", () => {
			const trace = {
				traceId: "trace-abc123",
				createdAt: "invalid-date",
				workingDirectory: "/test",
				command: "test",
				args: [],
				environment: {},
				events: [],
				metadata: {},
			};

			expect(validateTrace(trace)).toBe(false);
		});

		it("rejects non-object", () => {
			expect(validateTrace(null)).toBe(false);
			expect(validateTrace("string")).toBe(false);
			expect(validateTrace(123)).toBe(false);
		});
	});
});
