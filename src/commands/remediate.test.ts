/**
 * Tests for remediate CLI command
 *
 * Covers:
 * - Exit codes for various outcomes
 * - Finding parsing and normalization
 * - Dry-run mode handling
 * - Policy violations
 * - Invalid input handling
 */

import type { SpawnSyncReturns } from "node:child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EXIT_CODES, runRemediate } from "./remediate.js";

// Mock spawnSync for git commands
vi.mock("node:child_process", () => ({
	spawnSync: vi.fn(),
}));

// Mock fs with writable methods needed by apply transactions.
vi.mock("node:fs", async () => {
	const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
	return {
		...actual,
		readFileSync: vi.fn(),
		writeFileSync: vi.fn(),
		renameSync: vi.fn(),
		unlinkSync: vi.fn(),
		mkdirSync: vi.fn(),
		realpathSync: vi.fn((path: string) => path), // Return path as-is for tests
	};
});

// Mock path validator to always succeed in tests
vi.mock("../lib/input/validator.js", () => ({
	PathTraversalError: class PathTraversalError extends Error {
		constructor() {
			super("Path traversal detected");
			this.name = "PathTraversalError";
		}
	},
	validatePath: vi.fn((_baseDir: string, userPath: string) => userPath),
}));

import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { PathTraversalError, validatePath } from "../lib/input/validator.js";

const HEAD_SHA = "a".repeat(40);

function createMockSpawnResult(
	stdout: string,
	options: { status?: number; stderr?: string; error?: Error } = {},
): SpawnSyncReturns<string> {
	return {
		stdout,
		stderr: options.stderr ?? "",
		status: options.status ?? 0,
		error: options.error ?? undefined,
		signal: null,
		pid: 12345,
		output: [stdout, stdout],
	} as SpawnSyncReturns<string>;
}

describe("remediate command", () => {
	const mockSpawnSync = vi.mocked(spawnSync);
	const mockReadFileSync = vi.mocked(readFileSync);
	const mockWriteFileSync = vi.mocked(writeFileSync);
	const mockRenameSync = vi.mocked(renameSync);
	const mockUnlinkSync = vi.mocked(unlinkSync);
	const mockMkdirSync = vi.mocked(mkdirSync);
	const mockValidatePath = vi.mocked(validatePath);

	beforeEach(() => {
		vi.clearAllMocks();
		process.env.HARNESS_DISPOSABLE_WORKSPACE = undefined;
		// Default: validatePath passes through unchanged
		mockValidatePath.mockImplementation(
			(_baseDir: string, userPath: string) => userPath,
		);
		// Default: git commands succeed
		mockSpawnSync.mockImplementation(
			(_command: string, args: readonly string[] | undefined) => {
				const argList = args ?? [];
				if (argList[0] === "rev-parse") {
					return createMockSpawnResult(HEAD_SHA);
				}
				if (argList[0] === "merge-base") {
					return createMockSpawnResult("", { status: 0 }); // is-ancestor returns true
				}
				if (argList[0] === "status") {
					return createMockSpawnResult("");
				}
				return createMockSpawnResult("");
			},
		);
	});

	describe("exit codes", () => {
		it("exits SUCCESS for valid remediation with all findings processed", async () => {
			const codeqlFinding = {
				id: "test-1",
				rule: { id: "rule-1", name: "Test Rule" },
				location: { path: "src/test.ts", startLine: 10 },
				commitSha: HEAD_SHA,
				severity: "warning" as const,
			};

			mockReadFileSync.mockReturnValue(JSON.stringify([codeqlFinding]));

			const result = await runRemediate({ findings: "findings.json" });

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(result.outcome.ok).toBe(true);
		});

		it("exits USAGE for invalid JSON input", async () => {
			mockReadFileSync.mockReturnValue("not valid json");

			const result = await runRemediate({ findings: "findings.json" });

			expect(result.exitCode).toBe(EXIT_CODES.USAGE);
			expect(result.outcome.ok).toBe(false);
			if (!result.outcome.ok) {
				expect(result.outcome.error.code).toBe("E_VALIDATION");
			}
		});

		// Regression: findings path must be validated before readFileSync is called
		it("validates findings path against workspace root before reading", async () => {
			const codeqlFinding = {
				id: "test-path-validation",
				rule: { id: "rule-1", name: "Test Rule" },
				location: { path: "src/test.ts", startLine: 10 },
				commitSha: HEAD_SHA,
				severity: "warning" as const,
			};
			mockReadFileSync.mockReturnValue(JSON.stringify([codeqlFinding]));

			await runRemediate({ findings: "findings.json" });

			expect(mockValidatePath).toHaveBeenCalledWith(
				process.cwd(),
				"findings.json",
			);
		});

		// Regression: path traversal attempt must not reach readFileSync
		it("exits USAGE and never reads file when findings path fails traversal check", async () => {
			mockValidatePath.mockImplementation(() => {
				throw new PathTraversalError();
			});

			const result = await runRemediate({ findings: "../../../etc/passwd" });

			expect(result.exitCode).toBe(EXIT_CODES.USAGE);
			expect(result.outcome.ok).toBe(false);
			if (!result.outcome.ok) {
				expect(result.outcome.error.code).toBe("E_VALIDATION");
				expect(result.outcome.error.message).toContain(
					"Path traversal detected",
				);
			}
			expect(mockReadFileSync).not.toHaveBeenCalled();
		});

		it("exits USAGE for findings with missing required fields", async () => {
			const invalidFinding = { id: "test-1" }; // Missing required fields

			mockReadFileSync.mockReturnValue(JSON.stringify([invalidFinding]));

			const result = await runRemediate({ findings: "findings.json" });

			expect(result.exitCode).toBe(EXIT_CODES.USAGE);
			expect(result.outcome.ok).toBe(false);
			if (!result.outcome.ok) {
				expect(result.outcome.error.code).toBe("E_VALIDATION");
			}
		});

		it("fails closed when explicit contract path cannot be loaded", async () => {
			mockReadFileSync.mockReturnValue(JSON.stringify([]));

			const result = await runRemediate({
				findings: "findings.json",
				contractPath: "missing.contract.json",
			});

			expect(result.exitCode).toBe(EXIT_CODES.USAGE);
			expect(result.outcome.ok).toBe(false);
			if (!result.outcome.ok) {
				expect(result.outcome.error.code).toBe("E_CONTRACT");
			}
		});

		it("exits SUCCESS when all findings produce actions (including requires_human)", async () => {
			// Phase 2: High severity produces requires_human action instead of skip
			const findings = [
				{
					id: "test-1",
					rule: { id: "rule-1" },
					location: { path: "src/test.ts", startLine: 10 },
					commitSha: HEAD_SHA,
					severity: "warning" as const, // This will be auto-applied
				},
				{
					id: "test-2",
					rule: { id: "rule-2" },
					location: { path: "src/test2.ts", startLine: 20 },
					commitSha: HEAD_SHA,
					severity: "error" as const, // Phase 2: produces requires_human action
				},
			];

			mockReadFileSync.mockReturnValue(JSON.stringify(findings));

			const result = await runRemediate({ findings: "findings.json" });

			// Phase 2: Both findings produce actions (commit + requires_human), so SUCCESS
			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(result.outcome.ok).toBe(true);
			if (result.outcome.ok) {
				expect(result.outcome.output.actions).toHaveLength(2);
				// One auto-applied, one requires human
				const actionTypes = result.outcome.output.actions.map((a) => a.type);
				expect(actionTypes).toContain("commit");
				expect(actionTypes).toContain("requires_human");
			}
		});

		it("exits INTERNAL when git command fails", async () => {
			mockSpawnSync.mockReturnValue(
				createMockSpawnResult("", {
					status: 128,
					error: new Error("git not found"),
				}),
			);

			const result = await runRemediate({ findings: "findings.json" });

			expect(result.exitCode).toBe(EXIT_CODES.INTERNAL);
			expect(result.outcome.ok).toBe(false);
		});

		it("exits POLICY for TOCTOU race condition", async () => {
			const findings = [
				{
					id: "test-1",
					rule: { id: "rule-1" },
					location: { path: "src/test.ts", startLine: 10 },
					commitSha: HEAD_SHA,
					severity: "warning" as const,
				},
			];

			mockReadFileSync.mockReturnValue(JSON.stringify(findings));

			// Simulate race condition: HEAD changes between checkpoints
			const newSha = "b".repeat(40);

			// Make getHeadSha return different SHA on second call
			let callCount = 0;
			mockSpawnSync.mockImplementation(
				(_command: string, args: readonly string[] | undefined) => {
					const argList = args ?? [];
					if (argList[0] === "rev-parse" && argList[1] === "HEAD") {
						callCount++;
						if (callCount === 2) {
							return createMockSpawnResult(newSha);
						}
						return createMockSpawnResult(HEAD_SHA);
					}
					if (argList[0] === "merge-base") {
						return createMockSpawnResult("", { status: 0 });
					}
					return createMockSpawnResult("");
				},
			);

			const result = await runRemediate({ findings: "findings.json" });

			expect(result.exitCode).toBe(EXIT_CODES.POLICY);
			expect(result.outcome.ok).toBe(false);
			if (!result.outcome.ok) {
				expect(result.outcome.error.code).toBe("E_RACE_DETECTED");
			}
		});

		it("hard-fails apply mode on non-disposable workspace", async () => {
			const finding = {
				id: "test-apply-1",
				rule: { id: "rule-1", name: "Apply Rule" },
				location: { path: "src/test.ts", startLine: 10 },
				commitSha: HEAD_SHA,
				severity: "warning" as const,
			};
			mockReadFileSync.mockReturnValue(JSON.stringify([finding]));

			const result = await runRemediate({
				mode: "apply",
				findings: "findings.json",
			});

			expect(result.exitCode).toBe(EXIT_CODES.POLICY);
			expect(result.outcome.ok).toBe(false);
			if (!result.outcome.ok) {
				expect(result.outcome.error.code).toBe("E_POLICY");
				expect(result.outcome.error.message).toContain(
					"Apply mode requires a disposable workspace",
				);
			}
		});

		it("allows apply mode in detected git worktree checkout", async () => {
			const finding = {
				id: "test-apply-worktree-1",
				rule: { id: "rule-1", name: "Apply Rule" },
				location: { path: "src/test.ts", startLine: 1, endLine: 1 },
				commitSha: HEAD_SHA,
				severity: "warning" as const,
				evidence: JSON.stringify({
					op: "replace_range",
					content: "const patched = true;",
					startLine: 1,
					endLine: 1,
				}),
			};

			mockReadFileSync.mockImplementation((path) => {
				if (path === "findings.json") {
					return JSON.stringify([finding]);
				}
				if (path === `${process.cwd()}/src/test.ts`) {
					return "const patched = false;\n";
				}
				return "";
			});

			mockSpawnSync.mockImplementation(
				(_command: string, args: readonly string[] | undefined) => {
					const argList = args ?? [];
					if (argList[0] === "rev-parse" && argList[1] === "--git-dir") {
						return createMockSpawnResult(
							`${process.cwd()}/.git/worktrees/feature`,
						);
					}
					if (argList[0] === "rev-parse" && argList[1] === "HEAD") {
						return createMockSpawnResult(HEAD_SHA);
					}
					if (argList[0] === "status") {
						return createMockSpawnResult("");
					}
					if (argList[0] === "merge-base") {
						return createMockSpawnResult("", { status: 0 });
					}
					return createMockSpawnResult("");
				},
			);

			const result = await runRemediate({
				mode: "apply",
				findings: "findings.json",
			});

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(result.outcome.ok).toBe(true);
			if (result.outcome.ok) {
				expect(result.outcome.output.transactions).toHaveLength(1);
				expect(result.outcome.output.transactions?.[0]?.status).toBe("applied");
			}
		});

		it("hard-fails apply mode when disposable workspace is dirty", async () => {
			process.env.HARNESS_DISPOSABLE_WORKSPACE = "true";
			const finding = {
				id: "test-apply-2",
				rule: { id: "rule-1", name: "Apply Rule" },
				location: { path: "src/test.ts", startLine: 10 },
				commitSha: HEAD_SHA,
				severity: "warning" as const,
			};
			mockReadFileSync.mockReturnValue(JSON.stringify([finding]));
			mockSpawnSync.mockImplementation(
				(_command: string, args: readonly string[] | undefined) => {
					const argList = args ?? [];
					if (argList[0] === "rev-parse" && argList[1] === "HEAD") {
						return createMockSpawnResult(HEAD_SHA);
					}
					if (argList[0] === "status") {
						return createMockSpawnResult(" M src/test.ts\n");
					}
					if (argList[0] === "merge-base") {
						return createMockSpawnResult("", { status: 0 });
					}
					return createMockSpawnResult("");
				},
			);

			const result = await runRemediate({
				mode: "apply",
				findings: "findings.json",
			});

			expect(result.exitCode).toBe(EXIT_CODES.POLICY);
			expect(result.outcome.ok).toBe(false);
			if (!result.outcome.ok) {
				expect(result.outcome.error.code).toBe("E_POLICY");
				expect(result.outcome.error.message).toContain(
					"Apply mode requires a clean disposable workspace",
				);
			}
		});

		it("applies low-risk patch in single-finding transaction mode", async () => {
			process.env.HARNESS_DISPOSABLE_WORKSPACE = "true";
			const finding = {
				id: "test-apply-tx-1",
				rule: { id: "rule-1", name: "Apply Rule" },
				location: { path: "src/test.ts", startLine: 1, endLine: 1 },
				commitSha: HEAD_SHA,
				severity: "warning" as const,
				evidence: JSON.stringify({
					op: "replace_range",
					content: "const patched = true;",
					startLine: 1,
					endLine: 1,
				}),
			};
			mockReadFileSync.mockImplementation((path) => {
				if (path === "findings.json") {
					return JSON.stringify([finding]);
				}
				if (path === `${process.cwd()}/src/test.ts`) {
					return "const patched = false;\n";
				}
				return "";
			});

			const result = await runRemediate({
				mode: "apply",
				findings: "findings.json",
			});

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(result.outcome.ok).toBe(true);
			if (result.outcome.ok) {
				expect(result.outcome.output.transactions).toHaveLength(1);
				expect(result.outcome.output.transactions?.[0]?.status).toBe("applied");
			}
			expect(mockMkdirSync).toHaveBeenCalled();
			expect(mockWriteFileSync).toHaveBeenCalled();
			expect(mockRenameSync).toHaveBeenCalled();
			expect(mockUnlinkSync).toHaveBeenCalled();
		});

		it("rolls back a finding transaction on HEAD change during apply", async () => {
			process.env.HARNESS_DISPOSABLE_WORKSPACE = "true";
			const finding = {
				id: "test-apply-tx-rollback",
				rule: { id: "rule-1", name: "Apply Rule" },
				location: { path: "src/test.ts", startLine: 1, endLine: 1 },
				commitSha: HEAD_SHA,
				severity: "warning" as const,
				evidence: JSON.stringify({
					op: "replace_range",
					content: "const patched = true;",
					startLine: 1,
					endLine: 1,
				}),
			};
			mockReadFileSync.mockImplementation((path) => {
				if (path === "findings.json") {
					return JSON.stringify([finding]);
				}
				if (path === `${process.cwd()}/src/test.ts`) {
					return "const patched = false;\n";
				}
				return "";
			});

			let revParseCalls = 0;
			mockSpawnSync.mockImplementation(
				(_command: string, args: readonly string[] | undefined) => {
					const argList = args ?? [];
					if (argList[0] === "rev-parse" && argList[1] === "HEAD") {
						revParseCalls++;
						if (revParseCalls >= 6) {
							return createMockSpawnResult("b".repeat(40));
						}
						return createMockSpawnResult(HEAD_SHA);
					}
					if (argList[0] === "status") {
						return createMockSpawnResult("");
					}
					if (argList[0] === "merge-base") {
						return createMockSpawnResult("", { status: 0 });
					}
					return createMockSpawnResult("");
				},
			);

			const result = await runRemediate({
				mode: "apply",
				findings: "findings.json",
			});

			expect(result.exitCode).toBe(EXIT_CODES.PARTIAL);
			expect(result.outcome.ok).toBe(true);
			if (result.outcome.ok) {
				expect(result.outcome.output.transactions).toHaveLength(1);
				expect(result.outcome.output.transactions?.[0]?.status).toBe(
					"rolled_back",
				);
			}
		});
	});

	describe("finding normalization", () => {
		it("normalizes CodeQL findings correctly", async () => {
			const codeqlFinding = {
				id: "codeql-1",
				rule: { id: "cs/rule-1", name: "Test Rule", description: "Test desc" },
				location: { path: "src/test.ts", startLine: 10, endLine: 15 },
				commitSha: HEAD_SHA,
				severity: "warning" as const,
				discoveredAt: "2026-02-25T00:00:00Z",
				evidence: "test evidence",
			};

			mockReadFileSync.mockReturnValue(JSON.stringify([codeqlFinding]));

			const result = await runRemediate({ findings: "findings.json" });

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(result.outcome.ok).toBe(true);
		});

		it("normalizes Codex findings correctly", async () => {
			const codexFinding = {
				id: "codex-1",
				ruleName: "test-rule",
				message: "Test message",
				filePath: "src/test.ts",
				line: 10,
				commitSha: HEAD_SHA,
				severity: "info" as const,
				timestamp: "2026-02-25T00:00:00Z",
			};

			mockReadFileSync.mockReturnValue(JSON.stringify([codexFinding]));

			const result = await runRemediate({ findings: "findings.json" });

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(result.outcome.ok).toBe(true);
		});

		it("accepts single finding (not array)", async () => {
			const finding = {
				id: "test-1",
				rule: { id: "rule-1" },
				location: { path: "src/test.ts", startLine: 10 },
				commitSha: HEAD_SHA,
				severity: "warning" as const,
			};

			mockReadFileSync.mockReturnValue(JSON.stringify(finding));

			const result = await runRemediate({ findings: "findings.json" });

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			if (result.outcome.ok) {
				expect(result.outcome.output.findingsProcessed).toBe(1);
			}
		});

		it("rejects findings with invalid commit SHA", async () => {
			const finding = {
				id: "test-1",
				rule: { id: "rule-1" },
				location: { path: "src/test.ts", startLine: 10 },
				commitSha: "invalid-sha",
				severity: "warning" as const,
			};

			mockReadFileSync.mockReturnValue(JSON.stringify([finding]));

			const result = await runRemediate({ findings: "findings.json" });

			expect(result.exitCode).toBe(EXIT_CODES.USAGE);
		});

		it("rejects findings with invalid line numbers", async () => {
			const finding = {
				id: "test-1",
				rule: { id: "rule-1" },
				location: { path: "src/test.ts", startLine: -1 }, // Invalid line
				commitSha: HEAD_SHA,
				severity: "warning" as const,
			};

			mockReadFileSync.mockReturnValue(JSON.stringify([finding]));

			const result = await runRemediate({ findings: "findings.json" });

			expect(result.exitCode).toBe(EXIT_CODES.USAGE);
		});
	});

	describe("dry-run mode", () => {
		it("respects dryRun option", async () => {
			const finding = {
				id: "test-1",
				rule: { id: "rule-1" },
				location: { path: "src/test.ts", startLine: 10 },
				commitSha: HEAD_SHA,
				severity: "warning" as const,
			};

			mockReadFileSync.mockReturnValue(JSON.stringify([finding]));

			const result = await runRemediate({
				findings: "findings.json",
				dryRun: true,
			});

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(result.outcome.ok).toBe(true);
			if (result.outcome.ok) {
				expect(result.outcome.output.actions[0]?.dryRun).toBe(true);
			}
		});

		it("codex provider defaults to dry-run", async () => {
			const codexFinding = {
				id: "codex-1",
				ruleName: "test-rule",
				message: "Test",
				filePath: "src/test.ts",
				line: 10,
				commitSha: HEAD_SHA,
				severity: "info" as const,
			};

			mockReadFileSync.mockReturnValue(JSON.stringify([codexFinding]));

			const result = await runRemediate({
				findings: "findings.json",
				// No dryRun flag - should use provider default
			});

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(result.outcome.ok).toBe(true);
			if (result.outcome.ok) {
				// Codex defaults to dryRunOnlyByDefault: true
				expect(result.outcome.output.actions[0]?.dryRun).toBe(true);
			}
		});
	});

	describe("tier-based policy", () => {
		it("processes low severity findings", async () => {
			const finding = {
				id: "test-1",
				rule: { id: "rule-1" },
				location: { path: "src/test.ts", startLine: 10 },
				commitSha: HEAD_SHA,
				severity: "note" as const, // Maps to low
			};

			mockReadFileSync.mockReturnValue(JSON.stringify([finding]));

			const result = await runRemediate({ findings: "findings.json" });

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(result.outcome.ok).toBe(true);
			if (result.outcome.ok) {
				expect(result.outcome.output.actions).toHaveLength(1);
			}
		});

		it("processes medium severity findings for codeql", async () => {
			const finding = {
				id: "test-1",
				rule: { id: "rule-1" },
				location: { path: "src/test.ts", startLine: 10 },
				commitSha: HEAD_SHA,
				severity: "warning" as const, // Maps to medium
			};

			mockReadFileSync.mockReturnValue(JSON.stringify([finding]));

			const result = await runRemediate({ findings: "findings.json" });

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(result.outcome.ok).toBe(true);
			if (result.outcome.ok) {
				expect(result.outcome.output.actions).toHaveLength(1);
			}
		});

		it("produces requires_human action for high severity findings (codeql max tier is medium)", async () => {
			const finding = {
				id: "test-1",
				rule: { id: "rule-1" },
				location: { path: "src/test.ts", startLine: 10 },
				commitSha: HEAD_SHA,
				severity: "error" as const, // Maps to high
			};

			mockReadFileSync.mockReturnValue(JSON.stringify([finding]));

			const result = await runRemediate({ findings: "findings.json" });

			// Phase 2: High severity produces requires_human action, not skip
			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(result.outcome.ok).toBe(true);
			if (result.outcome.ok) {
				expect(result.outcome.output.actions).toHaveLength(1);
				expect(result.outcome.output.actions[0]?.type).toBe("requires_human");
				expect(result.outcome.output.actions[0]?.reason).toContain(
					"requires human review",
				);
				expect(result.outcome.output.skipped).toHaveLength(0);
			}
		});
	});

	describe("stdin input", () => {
		it("reads from stdin when findings is '-'", async () => {
			const finding = {
				id: "test-1",
				rule: { id: "rule-1" },
				location: { path: "src/test.ts", startLine: 10 },
				commitSha: HEAD_SHA,
				severity: "warning" as const,
			};

			// When findings is "-", readFileSync is called with fd 0 (stdin)
			mockReadFileSync.mockImplementation((path) => {
				if (path === 0 || path === "0") {
					return JSON.stringify([finding]);
				}
				return "";
			});

			await runRemediate({ findings: "-" });

			// Should have tried to read from stdin (fd 0)
			expect(mockReadFileSync).toHaveBeenCalledWith(0, "utf-8");
		});
	});

	describe("file read errors", () => {
		it("exits USAGE when file not found", async () => {
			mockReadFileSync.mockImplementation(() => {
				throw new Error("ENOENT: no such file");
			});

			const result = await runRemediate({ findings: "nonexistent.json" });

			expect(result.exitCode).toBe(EXIT_CODES.USAGE);
			expect(result.outcome.ok).toBe(false);
			if (!result.outcome.ok) {
				expect(result.outcome.error.code).toBe("E_VALIDATION");
			}
		});
	});
});
