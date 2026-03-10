import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EXIT_CODES } from "./types.js";
import { runMemoryGate, runMemoryGateCLI } from "./validator.js";

describe("runMemoryGateCLI", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		vi.restoreAllMocks();
		for (const dir of tempDirs) {
			rmSync(dir, { recursive: true, force: true });
		}
		tempDirs.length = 0;
	});

	it.skip("calculates trends from persisted history including current run", () => {
		const root = mkdtempSync(join(process.cwd(), ".harness-memory-validator-"));
		tempDirs.push(root);

		const memoryPath = join(root, "memory.json");
		const forjamiePath = join(root, "FORJAMIE.md");
		const metricsPath = join(root, ".memory-metrics.json");

		writeFileSync(
			forjamiePath,
			"# Closeout\n\n" +
				"This closeout file intentionally exceeds one hundred bytes to satisfy " +
				"codex branch compliance checks when they are active.",
			"utf-8",
		);

		writeFileSync(
			memoryPath,
			JSON.stringify(
				{
					repo: "coding-harness",
					session_id: "session-1",
					preamble: { bootstrap: true, search: true },
					entries: [
						{
							level: "learning",
							content: "completed operation successfully",
							tags: ["memory"],
							session_id: "session-1",
						},
					],
					closeout: {
						forjamie_updated: true,
						date: "2026-01-01T00:00:00.000Z",
					},
					meta: {
						created_at: "2026-02-25T00:00:00.000Z",
						version: "1.0",
					},
				},
				null,
				2,
			),
			"utf-8",
		);

		writeFileSync(
			metricsPath,
			JSON.stringify(
				{
					current: {
						pass_k: 0,
						total_ops: 1,
						successful_ops: 1,
						tool_errors: {},
						duplicate_memory_count: 0,
						unresolved_questions: [],
					},
					history: [
						{
							date: "2026-02-24T00:00:00.000Z",
							metrics: {
								pass_k: 0,
								total_ops: 1,
								successful_ops: 1,
								tool_errors: {},
								duplicate_memory_count: 0,
								unresolved_questions: [],
							},
						},
					],
					started_at: "2026-02-24T00:00:00.000Z",
					last_updated: "2026-02-24T00:00:00.000Z",
				},
				null,
				2,
			),
			"utf-8",
		);

		const consoleLogSpy = vi
			.spyOn(console, "log")
			.mockImplementation(() => undefined);

		const exitCode = runMemoryGateCLI({
			memoryPath,
			forjamiePath,
			metricsPath,
			json: true,
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(consoleLogSpy).toHaveBeenCalledTimes(1);

		const output = JSON.parse(String(consoleLogSpy.mock.calls[0]?.[0] ?? "{}"));
		expect(output.trends.pass_k_trend).toBe("improving");
	});

	it("continues when metrics persistence fails", () => {
		const root = mkdtempSync(join(process.cwd(), ".harness-memory-validator-"));
		tempDirs.push(root);

		const memoryPath = join(root, "memory.json");
		const forjamiePath = join(root, "FORJAMIE.md");
		const metricsDirPath = join(root, ".metrics-dir");

		writeFileSync(
			forjamiePath,
			"# Closeout\n\n" +
				"This closeout file intentionally exceeds one hundred bytes to satisfy " +
				"codex branch compliance checks when they are active.",
			"utf-8",
		);

		writeFileSync(
			memoryPath,
			JSON.stringify(
				{
					repo: "coding-harness",
					session_id: "session-1",
					preamble: { bootstrap: true, search: true },
					entries: [
						{
							level: "learning",
							content: "completed operation successfully",
							tags: ["memory"],
							session_id: "session-1",
						},
					],
					closeout: {
						forjamie_updated: true,
						date: "2026-01-01T00:00:00.000Z",
					},
					meta: {
						created_at: "2026-02-25T00:00:00.000Z",
						version: "1.0",
					},
				},
				null,
				2,
			),
			"utf-8",
		);
		mkdirSync(metricsDirPath, { recursive: true });

		const consoleLogSpy = vi
			.spyOn(console, "log")
			.mockImplementation(() => undefined);

		let exitCode: number | undefined;
		expect(() => {
			exitCode = runMemoryGateCLI({
				memoryPath,
				forjamiePath,
				metricsPath: metricsDirPath,
				json: true,
			});
		}).not.toThrow();

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(consoleLogSpy).toHaveBeenCalledTimes(1);
	});
});

describe("runMemoryGate", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const dir of tempDirs) {
			rmSync(dir, { recursive: true, force: true });
		}
		tempDirs.length = 0;
	});

	it("fails closeout validation when closeout date is not a valid ISO date", () => {
		const root = mkdtempSync(join(process.cwd(), ".harness-memory-validator-"));
		tempDirs.push(root);

		const memoryPath = join(root, "memory.json");
		const forjamiePath = join(root, "FORJAMIE.md");

		writeFileSync(
			forjamiePath,
			"# Closeout\n\n" +
				"This closeout file intentionally exceeds one hundred bytes to satisfy " +
				"codex branch compliance checks when they are active.",
			"utf-8",
		);

		writeFileSync(
			memoryPath,
			JSON.stringify(
				{
					repo: "coding-harness",
					session_id: "session-1",
					preamble: { bootstrap: true, search: true },
					entries: [
						{
							level: "learning",
							content: "completed operation successfully",
							tags: ["memory"],
							session_id: "session-1",
						},
					],
					closeout: {
						forjamie_updated: true,
						date: "not-a-date",
					},
					meta: {
						created_at: "2026-02-25T00:00:00.000Z",
						version: "1.0",
					},
				},
				null,
				2,
			),
			"utf-8",
		);

		const result = runMemoryGate({ memoryPath, forjamiePath });
		expect(result.ok).toBe(false);
		expect(result.code).toBe(EXIT_CODES.CLOSEOUT_INCOMPLETE);
		expect(
			result.violations.some((v) =>
				v.message.includes("Closeout date is invalid"),
			),
		).toBe(true);
	});

	// Security: relative path must not escape the working directory
	it("rejects memory path traversal outside repository", () => {
		const root = mkdtempSync(join(tmpdir(), "harness-memory-validator-"));
		tempDirs.push(root);

		const outside = mkdtempSync(join(tmpdir(), "harness-memory-outside-"));
		tempDirs.push(outside);

		const memoryPath = join(outside, "memory.json");
		const forjamiePath = join(root, "FORJAMIE.md");

		writeFileSync(memoryPath, "{}", "utf-8");
		writeFileSync(
			forjamiePath,
			"# Closeout\n\nThis closeout file intentionally exceeds one hundred bytes to satisfy codex branch compliance checks when they are active.",
			"utf-8",
		);

		const previousCwd = process.cwd();
		process.chdir(root);

		try {
			// Build a relative traversal path (e.g. "../../tmp-outside/memory.json")
			const traversalPath = relative(root, memoryPath);
			const result = runMemoryGate({
				memoryPath: traversalPath,
				forjamiePath,
			});

			expect(result.ok).toBe(false);
			expect(result.code).toBe(EXIT_CODES.SYSTEM_ERROR);
			expect(result.message).toContain("Invalid file path");
		} finally {
			process.chdir(previousCwd);
		}
	});

	// Security: files larger than 1 MiB must be rejected before readFileSync
	it("rejects oversized memory files", () => {
		const root = mkdtempSync(join(tmpdir(), "harness-memory-validator-"));
		tempDirs.push(root);

		const memoryPath = join(root, "memory.json");
		const forjamiePath = join(root, "FORJAMIE.md");

		// Write a file that is 1 byte over the 1 MiB limit
		writeFileSync(memoryPath, "x".repeat(1024 * 1024 + 1), "utf-8");
		writeFileSync(
			forjamiePath,
			"# Closeout\n\nThis closeout file intentionally exceeds one hundred bytes to satisfy codex branch compliance checks when they are active.",
			"utf-8",
		);

		const result = runMemoryGate({ memoryPath, forjamiePath });
		expect(result.ok).toBe(false);
		expect(result.code).toBe(EXIT_CODES.SYSTEM_ERROR);
		expect(result.message).toContain("Cannot read memory file");
	});
});
