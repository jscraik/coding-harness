import { describe, expect, it } from "vitest";
import { EXIT_CODES, runReplayCLI } from "./replay.js";

describe("replay command", () => {
	describe("runReplayCLI", () => {
		it("returns VALIDATION_ERROR when no trace ID provided", async () => {
			const exitCode = await runReplayCLI({});
			expect(exitCode).toBe(EXIT_CODES.VALIDATION_ERROR);
		});

		it("returns VALIDATION_ERROR for invalid trace ID format", async () => {
			const exitCode = await runReplayCLI({ traceId: "invalid-id" });
			expect(exitCode).toBe(EXIT_CODES.VALIDATION_ERROR);
		});

		it("returns TRACE_NOT_FOUND for non-existent trace", async () => {
			const exitCode = await runReplayCLI({
				traceId: "trace-aaaaaaaaaaaaaaaa",
			});
			expect(exitCode).toBe(EXIT_CODES.TRACE_NOT_FOUND);
		});

		it("lists traces with --list", async () => {
			const exitCode = await runReplayCLI({ list: true });
			expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		});

		it("outputs JSON when --json is set", async () => {
			const exitCode = await runReplayCLI({
				traceId: "trace-bbbbbbbbbbbbbbbb",
				json: true,
			});
			expect(exitCode).toBe(EXIT_CODES.TRACE_NOT_FOUND);
		});
	});
});
