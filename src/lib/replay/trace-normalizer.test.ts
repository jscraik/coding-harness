import { describe, expect, it } from "vitest";
import { normalizeTrace } from "./trace-normalizer.js";
import type { ExecutionTrace } from "./tracer.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTrace(overrides: Partial<ExecutionTrace> = {}): ExecutionTrace {
	return {
		traceId: "trace-abcdef1234567890",
		createdAt: "2026-04-16T10:00:00.000Z",
		workingDirectory: "/home/user/project",
		environment: { NODE_ENV: "test", PWD: "/home/user/project" },
		command: "harness",
		args: ["check"],
		events: [
			{
				type: "command",
				timestamp: "2026-04-16T10:00:00.000Z",
				payload: { action: "start" },
			},
			{
				type: "tool_use",
				timestamp: "2026-04-16T10:00:05.000Z",
				payload: {
					tool: "linter",
					apiKey: "sk-secret-value-12345",
					result: "pass",
				},
			},
			{
				type: "file_change",
				timestamp: "2026-04-16T10:00:10.000Z",
				payload: {
					path: "/home/user/project/src/index.ts",
					action: "modify",
				},
			},
			{
				type: "error",
				timestamp: "2026-04-16T10:00:15.500Z",
				payload: { message: "Something went wrong" },
				correlationId: "corr-001",
			},
		],
		metadata: { gitBranch: "main" },
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("normalizeTrace", () => {
	it("relativizes working directory against base dir", () => {
		const trace = makeTrace();
		const result = normalizeTrace(trace, { baseDir: "/home/user/project" });
		expect(result.workingDirectory).toBe(".");
	});

	it("relativizes subdirectory paths", () => {
		const trace = makeTrace({
			workingDirectory: "/home/user/project/subdir",
		});
		const result = normalizeTrace(trace, { baseDir: "/home/user/project" });
		expect(result.workingDirectory).toBe("./subdir");
	});

	it("replaces home directory with tilde", () => {
		const trace = makeTrace({
			workingDirectory: "/Users/john/my-project",
		});
		const result = normalizeTrace(trace, { baseDir: "/home/user" });
		expect(result.workingDirectory).toBe("~/my-project");
	});

	it("normalizes timestamps to ordinal offsets", () => {
		const trace = makeTrace();
		const result = normalizeTrace(trace);
		expect(result.createdAt).toBe("T+0");
		expect(result.events[0]!.timestamp).toBe("T+0");
		expect(result.events[1]!.timestamp).toBe("T+5");
		expect(result.events[2]!.timestamp).toBe("T+10");
	});

	it("preserves timestamps when normalization disabled", () => {
		const trace = makeTrace();
		const result = normalizeTrace(trace, {
			normalizeTimestamps: false,
		});
		expect(result.createdAt).toBe("2026-04-16T10:00:00.000Z");
		expect(result.events[0]!.timestamp).toBe("2026-04-16T10:00:00.000Z");
	});

	it("redacts secret keys from payloads", () => {
		const trace = makeTrace();
		const result = normalizeTrace(trace);
		const toolPayload = result.events[1]!.payload as Record<string, unknown>;
		expect(toolPayload.apiKey).toBe("[REDACTED]");
		expect(toolPayload.tool).toBe("linter");
		expect(toolPayload.result).toBe("pass");
	});

	it("preserves non-secret payload values", () => {
		const trace = makeTrace();
		const result = normalizeTrace(trace);
		const startPayload = result.events[0]!.payload as Record<string, unknown>;
		expect(startPayload.action).toBe("start");
	});

	it("redacts secrets when enabled", () => {
		const trace = makeTrace();
		const result = normalizeTrace(trace, { redactSecrets: true });
		const toolPayload = result.events[1]!.payload as Record<string, unknown>;
		expect(toolPayload.apiKey).toBe("[REDACTED]");
	});

	it("skips redaction when disabled", () => {
		const trace = makeTrace();
		const result = normalizeTrace(trace, { redactSecrets: false });
		const toolPayload = result.events[1]!.payload as Record<string, unknown>;
		expect(toolPayload.apiKey).toBe("sk-secret-value-12345");
	});

	it("preserves correlation IDs", () => {
		const trace = makeTrace();
		const result = normalizeTrace(trace);
		expect(result.events[3]!.correlationId).toBe("corr-001");
	});

	it("preserves metadata", () => {
		const trace = makeTrace();
		const result = normalizeTrace(trace);
		expect(result.metadata.gitBranch).toBe("main");
	});

	it("preserves command and args", () => {
		const trace = makeTrace();
		const result = normalizeTrace(trace);
		expect(result.command).toBe("harness");
		expect(result.args).toEqual(["check"]);
	});

	it("relativizes paths in file_change payloads", () => {
		const trace = makeTrace();
		const result = normalizeTrace(trace, {
			baseDir: "/home/user/project",
		});
		const filePayload = result.events[2]!.payload as Record<string, unknown>;
		expect(filePayload.path).toBe("./src/index.ts");
	});

	it("produces deterministic output for same input", () => {
		const trace = makeTrace();
		const result1 = normalizeTrace(trace);
		const result2 = normalizeTrace(trace);
		expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
	});
});
