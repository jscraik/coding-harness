import type { SpawnSyncReturns } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXIT_CODES, runDiffBudget, runDiffBudgetCLI } from "./diff-budget.js";

// Mock spawnSync
vi.mock("node:child_process", () => ({
	spawnSync: vi.fn(),
}));

// Mock fs
vi.mock("node:fs", () => ({
	existsSync: vi.fn(() => false),
	readFileSync: vi.fn(),
}));

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

function createMockSpawnResult(
	stdout: string,
	options: { status?: number; stderr?: string; error?: Error } = {},
): SpawnSyncReturns<string> {
	return {
		stdout,
		stderr: options.stderr ?? "",
		status: options.status ?? 0,
		error: options.error ?? new Error("no error"),
		signal: null,
		pid: 12345,
		output: [stdout, stdout],
	};
}

describe("diff-budget command", () => {
	const mockSpawnSync = vi.mocked(spawnSync);
	const mockExistsSync = vi.mocked(existsSync);
	const mockReadFileSync = vi.mocked(readFileSync);

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("runDiffBudget", () => {
		it("returns passed when within budget", () => {
			mockSpawnSync.mockReturnValue(
				createMockSpawnResult("5\t3\tsrc/file.ts\n"),
			);

			const result = runDiffBudget({ base: "main", head: "HEAD" });

			expect(result.passed).toBe(true);
			expect(result.metrics.filesChanged).toBe(1);
			expect(result.metrics.additions).toBe(5);
			expect(result.metrics.deletions).toBe(3);
		});

		it("returns failed when exceeding file budget", () => {
			// Create 15 files (over default limit of 10)
			const lines = Array(15)
				.fill(null)
				.map((_, i) => `1\t0\tsrc/file${i}.ts`)
				.join("\n");

			mockSpawnSync.mockReturnValue(createMockSpawnResult(lines));

			const result = runDiffBudget({ base: "main", head: "HEAD" });

			expect(result.passed).toBe(false);
			expect(result.metrics.filesChanged).toBe(15);
			expect(result.check.violations).toHaveLength(1);
			expect(result.check.violations[0]?.type).toBe("files");
		});

		it("returns failed when exceeding LOC budget", () => {
			// Create changes that exceed 400 LOC
			mockSpawnSync.mockReturnValue(
				createMockSpawnResult("250\t0\tsrc/file1.ts\n250\t0\tsrc/file2.ts\n"),
			);

			const result = runDiffBudget({ base: "main", head: "HEAD" });

			expect(result.passed).toBe(false);
			expect(result.metrics.netLOC).toBe(500);
			expect(result.check.violations).toHaveLength(1);
			expect(result.check.violations[0]?.type).toBe("loc");
		});

		it("loads budget from contract file", () => {
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(
				JSON.stringify({ diffBudget: { maxFiles: 20, maxNetLOC: 1000 } }),
			);

			mockSpawnSync.mockReturnValue(
				createMockSpawnResult("15\t0\tsrc/file.ts\n"),
			);

			const result = runDiffBudget({
				base: "main",
				head: "HEAD",
				contractPath: "harness.contract.json",
			});

			expect(result.passed).toBe(true);
			expect(result.metrics.filesChanged).toBe(1);
		});

		it("handles empty diff", () => {
			mockSpawnSync.mockReturnValue(createMockSpawnResult(""));

			const result = runDiffBudget({ base: "main", head: "HEAD" });

			expect(result.passed).toBe(true);
			expect(result.metrics.filesChanged).toBe(0);
			expect(result.metrics.netLOC).toBe(0);
		});

		it("handles git diff error", () => {
			mockSpawnSync.mockReturnValue(
				createMockSpawnResult("", {
					status: 128,
					stderr: "fatal: bad revision",
				}),
			);

			expect(() => runDiffBudget({ base: "invalid", head: "HEAD" })).toThrow(
				"git diff failed",
			);
		});

		it("applies valid override", () => {
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockImplementation((path) => {
				const pathStr = path.toString();
				if (pathStr.includes("override")) {
					return JSON.stringify({
						reason: "Large refactoring",
						approvedBy: "admin",
						timestamp: "2026-02-24T00:00:00Z",
					});
				}
				return JSON.stringify({ diffBudget: { maxFiles: 10, maxNetLOC: 400 } });
			});

			// Exceed budget
			mockSpawnSync.mockReturnValue(
				createMockSpawnResult(
					Array(15)
						.fill(null)
						.map((_, i) => `1\t0\tsrc/file${i}.ts`)
						.join("\n"),
				),
			);

			const result = runDiffBudget({
				base: "main",
				head: "HEAD",
				overridePath: "diff-override.json",
			});

			expect(result.passed).toBe(true);
			expect(result.check.override).toBeDefined();
		});
	});

	describe("runDiffBudgetCLI", () => {
		it("outputs JSON when --json flag is set", () => {
			const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {
				// noop for assertion
			});

			mockSpawnSync.mockReturnValue(
				createMockSpawnResult("5\t3\tsrc/file.ts\n"),
			);

			const exitCode = runDiffBudgetCLI({ json: true });

			expect(exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(consoleSpy).toHaveBeenCalled();

			const output = consoleSpy.mock.calls[0]?.[0];
			expect(output).toContain('"passed"');

			consoleSpy.mockRestore();
		});

		it("returns BUDGET_EXCEEDED when violations exist", () => {
			mockSpawnSync.mockReturnValue(
				createMockSpawnResult(
					Array(15)
						.fill(null)
						.map((_, i) => `1\t0\tsrc/file${i}.ts`)
						.join("\n"),
				),
			);

			const exitCode = runDiffBudgetCLI({});

			expect(exitCode).toBe(EXIT_CODES.BUDGET_EXCEEDED);
		});

		it("returns SYSTEM_ERROR on exception", () => {
			mockSpawnSync.mockReturnValue(
				createMockSpawnResult("", {
					status: 128,
					error: new Error("git not found"),
				}),
			);

			const exitCode = runDiffBudgetCLI({});

			expect(exitCode).toBe(EXIT_CODES.SYSTEM_ERROR);
		});
	});
});
