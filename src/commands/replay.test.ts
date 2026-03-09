import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EXIT_CODES, runReplayCLI } from "./replay.js";

describe("replay command", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		while (tempDirs.length > 0) {
			const dir = tempDirs.pop();
			if (dir) {
				rmSync(dir, { recursive: true, force: true });
			}
		}
	});

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
			const tempDir = mkdtempSync(join(tmpdir(), "replay-test-"));
			tempDirs.push(tempDir);
			const runRecordsDir = join(tempDir, "agent-runs");
			const exitCode = await runReplayCLI({ list: true, runRecordsDir });
			expect(exitCode).toBe(EXIT_CODES.SUCCESS);

			const runDirs = readdirSync(runRecordsDir, { withFileTypes: true })
				.filter((entry) => entry.isDirectory())
				.map((entry) => entry.name);
			expect(runDirs.length).toBe(1);
			const manifest = JSON.parse(
				readFileSync(
					join(runRecordsDir, runDirs[0] ?? "", "manifest.json"),
					"utf-8",
				),
			);
			expect(manifest.command).toBe("replay");
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
