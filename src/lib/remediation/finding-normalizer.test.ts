import { describe, expect, it } from "vitest";
import {
	type CodeqlFindingInput,
	type CodexFindingInput,
	normalizeCodeqlFinding,
	normalizeCodexFinding,
} from "./finding-normalizer.js";

// Use paths that exist in the repo for tests that need valid paths
// src/lib/remediation/ exists, so we can use files within it
const VALID_PATH = "src/lib/remediation/types.ts";

describe("finding-normalizer", () => {
	// Helper to create a valid CodeQL input
	function createValidCodeqlInput(
		overrides: Partial<CodeqlFindingInput> = {},
	): CodeqlFindingInput {
		return {
			id: "codeql-123",
			rule: {
				id: "js/sql-injection",
				name: "SQL Injection",
				description: "Potential SQL injection vulnerability",
			},
			location: {
				path: VALID_PATH,
				startLine: 42,
			},
			commitSha: "0123456789abcdef0123456789abcdef01234567",
			severity: "warning",
			discoveredAt: "2026-02-25T10:30:00.000Z",
			evidence: "User input used directly in query",
			...overrides,
		};
	}

	// Helper to create a valid Codex input
	function createValidCodexInput(
		overrides: Partial<CodexFindingInput> = {},
	): CodexFindingInput {
		return {
			id: "codex-456",
			ruleName: "Hardcoded Secret",
			message: "Potential hardcoded secret detected",
			filePath: VALID_PATH,
			line: 15,
			commitSha: "abcdef0123456789abcdef0123456789abcdef01",
			severity: "critical",
			timestamp: "2026-02-25T11:00:00.000Z",
			evidence: "const API_KEY = 'sk-xxx'",
			...overrides,
		};
	}

	describe("normalizeCodeqlFinding", () => {
		describe("valid inputs", () => {
			it("normalizes valid CodeQL finding with all fields", () => {
				const input = createValidCodeqlInput();
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(true);
				if (!result.ok) throw new Error("Expected ok result");

				expect(result.finding).toMatchObject({
					id: "codeql-123",
					provider: "codeql",
					severity: "medium",
					title: "SQL Injection",
					description: "Potential SQL injection vulnerability",
					lineStart: 42,
					commitSha: "0123456789abcdef0123456789abcdef01234567",
					discoveredAt: "2026-02-25T10:30:00.000Z",
					evidence: "User input used directly in query",
				});
			});

			it("normalizes CodeQL finding with minimal fields", () => {
				const input: CodeqlFindingInput = {
					id: "minimal-1",
					location: { path: VALID_PATH, startLine: 1 },
					commitSha: "0123456789abcdef0123456789abcdef01234567",
				};

				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(true);
				if (!result.ok) throw new Error("Expected ok result");

				expect(result.finding.provider).toBe("codeql");
				expect(result.finding.severity).toBe("low");
				expect(result.finding.title).toBe("Unknown CodeQL Rule");
				expect(result.finding.description).toBe("No description available");
				expect(result.finding.lineEnd).toBeUndefined();
				expect(result.finding.evidence).toBeUndefined();
				expect(result.finding.discoveredAt).toBeDefined();
			});

			it("includes endLine when provided", () => {
				const input = createValidCodeqlInput({
					location: { path: VALID_PATH, startLine: 10, endLine: 20 },
				});
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(true);
				if (!result.ok) throw new Error("Expected ok result");

				expect(result.finding.lineStart).toBe(10);
				expect(result.finding.lineEnd).toBe(20);
			});

			it("uses rule.id as title fallback when name is missing", () => {
				const input = createValidCodeqlInput({
					rule: { id: "js/xss", description: "XSS vulnerability" },
				});
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(true);
				if (!result.ok) throw new Error("Expected ok result");

				expect(result.finding.title).toBe("js/xss");
			});

			it("uses rule.name as description fallback when description is missing", () => {
				const input = createValidCodeqlInput({
					rule: { name: "XSS Vulnerability" },
				});
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(true);
				if (!result.ok) throw new Error("Expected ok result");

				expect(result.finding.description).toBe("XSS Vulnerability");
			});
		});

		describe("severity mapping", () => {
			it("maps 'error' to 'high'", () => {
				const input = createValidCodeqlInput({ severity: "error" });
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(true);
				if (!result.ok) throw new Error("Expected ok result");

				expect(result.finding.severity).toBe("high");
			});

			it("maps 'warning' to 'medium'", () => {
				const input = createValidCodeqlInput({ severity: "warning" });
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(true);
				if (!result.ok) throw new Error("Expected ok result");

				expect(result.finding.severity).toBe("medium");
			});

			it("maps 'note' to 'low'", () => {
				const input = createValidCodeqlInput({ severity: "note" });
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(true);
				if (!result.ok) throw new Error("Expected ok result");

				expect(result.finding.severity).toBe("low");
			});

			it("maps undefined to 'low'", () => {
				const input = createValidCodeqlInput();
				// Delete severity to simulate undefined
				(input as unknown as Record<string, unknown>).severity = undefined;
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(true);
				if (!result.ok) throw new Error("Expected ok result");

				expect(result.finding.severity).toBe("low");
			});
		});

		describe("input validation - structure", () => {
			it("rejects null input", () => {
				const result = normalizeCodeqlFinding(null);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_MISSING_FIELD");
				expect(result.error.message).toBe("Invalid CodeQL finding structure");
			});

			it("rejects undefined input", () => {
				const result = normalizeCodeqlFinding(undefined);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_MISSING_FIELD");
			});

			it("rejects non-object input", () => {
				const result = normalizeCodeqlFinding("not an object");

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_MISSING_FIELD");
			});

			it("rejects missing id", () => {
				const input = { ...createValidCodeqlInput(), id: undefined };
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_MISSING_FIELD");
			});

			it("rejects missing location", () => {
				const input = { ...createValidCodeqlInput(), location: undefined };
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_MISSING_FIELD");
			});

			it("rejects missing commitSha", () => {
				const input = { ...createValidCodeqlInput(), commitSha: undefined };
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_MISSING_FIELD");
			});

			it("rejects missing location.path", () => {
				// Create malformed input by removing path from location
				const baseInput = createValidCodeqlInput();
				const malformedInput = {
					...baseInput,
					location: { startLine: 1 },
				} as unknown;
				const result = normalizeCodeqlFinding(malformedInput);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_MISSING_FIELD");
			});

			it("rejects missing location.startLine", () => {
				// Create malformed input by removing startLine from location
				const baseInput = createValidCodeqlInput();
				const malformedInput = {
					...baseInput,
					location: { path: VALID_PATH },
				} as unknown;
				const result = normalizeCodeqlFinding(malformedInput);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_MISSING_FIELD");
			});
		});

		describe("input validation - id", () => {
			it("rejects empty id", () => {
				const input = createValidCodeqlInput({ id: "" });
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_MISSING_FIELD");
				expect(result.error.message).toContain("empty");
			});

			it("rejects id exceeding max length", () => {
				const input = createValidCodeqlInput({ id: "a".repeat(257) });
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_MISSING_FIELD");
				expect(result.error.message).toContain("maximum length");
			});

			it("accepts id at max length", () => {
				const input = createValidCodeqlInput({ id: "a".repeat(256) });
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(true);
			});
		});

		describe("input validation - SHA", () => {
			it("rejects invalid SHA format", () => {
				const input = createValidCodeqlInput({
					commitSha: "not-a-valid-sha",
				});
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_INVALID_SHA");
				expect(result.error.message).toContain("Invalid commit SHA");
			});

			it("rejects SHA with uppercase", () => {
				const input = createValidCodeqlInput({
					commitSha: "ABCDEF0123456789ABCDEF0123456789ABCDEF01",
				});
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_INVALID_SHA");
			});

			it("rejects SHA that is too short", () => {
				const input = createValidCodeqlInput({
					commitSha: "0123456789abcdef",
				});
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_INVALID_SHA");
			});
		});

		describe("input validation - path", () => {
			it("rejects path traversal attempt with ../", () => {
				const input = createValidCodeqlInput({
					location: { path: "../../../etc/passwd", startLine: 1 },
				});

				// Mock validatePath to throw PathTraversalError
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_INVALID_PATH");
				expect(result.error.message).toContain("traversal");
			});

			it("rejects shell metacharacters in path", () => {
				const input = createValidCodeqlInput({
					location: { path: "src/file.ts;rm -rf /", startLine: 1 },
				});
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_INVALID_PATH");
				expect(result.error.message).toContain("metacharacters");
			});

			it("rejects pipe character in path", () => {
				const input = createValidCodeqlInput({
					location: { path: "src/file|cat", startLine: 1 },
				});
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_INVALID_PATH");
			});

			it("rejects backtick in path", () => {
				const input = createValidCodeqlInput({
					location: { path: "src/`whoami`.ts", startLine: 1 },
				});
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_INVALID_PATH");
			});

			it("rejects dollar sign in path", () => {
				const input = createValidCodeqlInput({
					location: { path: "src/$HOME/file.ts", startLine: 1 },
				});
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_INVALID_PATH");
			});

			it("rejects empty path", () => {
				const input = createValidCodeqlInput({
					location: { path: "", startLine: 1 },
				});
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_INVALID_PATH");
			});

			it("rejects path exceeding max length", () => {
				const input = createValidCodeqlInput({
					location: { path: "a".repeat(4097), startLine: 1 },
				});
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_INVALID_PATH");
				expect(result.error.message).toContain("maximum length");
			});
		});

		describe("input validation - line numbers", () => {
			it("rejects startLine < 1", () => {
				const input = createValidCodeqlInput({
					location: { path: VALID_PATH, startLine: 0 },
				});
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_PARSE_FAILURE");
				expect(result.error.message).toContain("at least 1");
			});

			it("rejects startLine > max", () => {
				const input = createValidCodeqlInput({
					location: { path: VALID_PATH, startLine: 1000001 },
				});
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_PARSE_FAILURE");
				expect(result.error.message).toContain("maximum");
			});

			it("rejects non-integer startLine", () => {
				const input = createValidCodeqlInput({
					location: { path: VALID_PATH, startLine: 1.5 },
				});
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_PARSE_FAILURE");
				expect(result.error.message).toContain("integer");
			});

			it("rejects endLine < startLine", () => {
				const input = createValidCodeqlInput({
					location: { path: VALID_PATH, startLine: 10, endLine: 5 },
				});
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_PARSE_FAILURE");
				expect(result.error.message).toContain(
					"endLine cannot be less than startLine",
				);
			});

			it("accepts endLine equal to startLine", () => {
				const input = createValidCodeqlInput({
					location: { path: VALID_PATH, startLine: 10, endLine: 10 },
				});
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(true);
			});
		});

		describe("input validation - timestamp", () => {
			it("rejects invalid timestamp format", () => {
				const input = createValidCodeqlInput({
					discoveredAt: "2026/02/25 10:30:00",
				});
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_PARSE_FAILURE");
				expect(result.error.message).toContain("Invalid timestamp format");
			});

			it("rejects non-ISO timestamp", () => {
				const input = createValidCodeqlInput({
					discoveredAt: "Feb 25, 2026",
				});
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_PARSE_FAILURE");
			});

			it("generates timestamp when not provided", () => {
				const input = createValidCodeqlInput();
				// Delete discoveredAt to simulate it not being provided
				(input as unknown as Record<string, unknown>).discoveredAt = undefined;
				const result = normalizeCodeqlFinding(input);

				expect(result.ok).toBe(true);
				if (!result.ok) throw new Error("Expected ok result");

				expect(result.finding.discoveredAt).toBeDefined();
				expect(result.finding.discoveredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
			});
		});
	});

	describe("normalizeCodexFinding", () => {
		describe("valid inputs", () => {
			it("normalizes valid Codex finding with all fields", () => {
				const input = createValidCodexInput();
				const result = normalizeCodexFinding(input);

				expect(result.ok).toBe(true);
				if (!result.ok) throw new Error("Expected ok result");

				expect(result.finding).toMatchObject({
					id: "codex-456",
					provider: "codex",
					severity: "high",
					title: "Hardcoded Secret",
					description: "Potential hardcoded secret detected",
					lineStart: 15,
					commitSha: "abcdef0123456789abcdef0123456789abcdef01",
					discoveredAt: "2026-02-25T11:00:00.000Z",
					evidence: "const API_KEY = 'sk-xxx'",
				});
			});

			it("normalizes Codex finding with minimal fields", () => {
				const input: CodexFindingInput = {
					id: "minimal-2",
					filePath: VALID_PATH,
					line: 1,
					commitSha: "0123456789abcdef0123456789abcdef01234567",
				};

				const result = normalizeCodexFinding(input);

				expect(result.ok).toBe(true);
				if (!result.ok) throw new Error("Expected ok result");

				expect(result.finding.provider).toBe("codex");
				expect(result.finding.severity).toBe("low");
				expect(result.finding.title).toBe("Codex Finding");
				expect(result.finding.description).toBe("No description available");
				expect(result.finding.lineEnd).toBeUndefined();
				expect(result.finding.evidence).toBeUndefined();
				expect(result.finding.discoveredAt).toBeDefined();
			});

			it("uses ruleName as title", () => {
				const input = createValidCodexInput({ ruleName: "Custom Rule" });
				const result = normalizeCodexFinding(input);

				expect(result.ok).toBe(true);
				if (!result.ok) throw new Error("Expected ok result");

				expect(result.finding.title).toBe("Custom Rule");
			});

			it("uses message as description", () => {
				const input = createValidCodexInput({ message: "Custom message" });
				const result = normalizeCodexFinding(input);

				expect(result.ok).toBe(true);
				if (!result.ok) throw new Error("Expected ok result");

				expect(result.finding.description).toBe("Custom message");
			});
		});

		describe("severity mapping", () => {
			it("maps 'critical' to 'high'", () => {
				const input = createValidCodexInput({ severity: "critical" });
				const result = normalizeCodexFinding(input);

				expect(result.ok).toBe(true);
				if (!result.ok) throw new Error("Expected ok result");

				expect(result.finding.severity).toBe("high");
			});

			it("maps 'warning' to 'medium'", () => {
				const input = createValidCodexInput({ severity: "warning" });
				const result = normalizeCodexFinding(input);

				expect(result.ok).toBe(true);
				if (!result.ok) throw new Error("Expected ok result");

				expect(result.finding.severity).toBe("medium");
			});

			it("maps 'info' to 'low'", () => {
				const input = createValidCodexInput({ severity: "info" });
				const result = normalizeCodexFinding(input);

				expect(result.ok).toBe(true);
				if (!result.ok) throw new Error("Expected ok result");

				expect(result.finding.severity).toBe("low");
			});

			it("maps undefined to 'low'", () => {
				const input = createValidCodexInput();
				// Delete severity to simulate undefined
				(input as unknown as Record<string, unknown>).severity = undefined;
				const result = normalizeCodexFinding(input);

				expect(result.ok).toBe(true);
				if (!result.ok) throw new Error("Expected ok result");

				expect(result.finding.severity).toBe("low");
			});
		});

		describe("input validation - structure", () => {
			it("rejects null input", () => {
				const result = normalizeCodexFinding(null);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_MISSING_FIELD");
				expect(result.error.message).toBe("Invalid Codex finding structure");
			});

			it("rejects non-object input", () => {
				const result = normalizeCodexFinding(42);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_MISSING_FIELD");
			});

			it("rejects missing id", () => {
				const input = { ...createValidCodexInput(), id: undefined };
				const result = normalizeCodexFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_MISSING_FIELD");
			});

			it("rejects missing filePath", () => {
				const input = { ...createValidCodexInput(), filePath: undefined };
				const result = normalizeCodexFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_MISSING_FIELD");
			});

			it("rejects missing line", () => {
				const input = { ...createValidCodexInput(), line: undefined };
				const result = normalizeCodexFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_MISSING_FIELD");
			});

			it("rejects missing commitSha", () => {
				const input = { ...createValidCodexInput(), commitSha: undefined };
				const result = normalizeCodexFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_MISSING_FIELD");
			});
		});

		describe("input validation - SHA", () => {
			it("rejects invalid SHA format", () => {
				const input = createValidCodexInput({
					commitSha: "invalid-sha",
				});
				const result = normalizeCodexFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_INVALID_SHA");
			});
		});

		describe("input validation - path", () => {
			it("rejects shell metacharacters in path", () => {
				const input = createValidCodexInput({
					filePath: "src/file.ts && rm -rf /",
				});
				const result = normalizeCodexFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_INVALID_PATH");
				expect(result.error.message).toContain("metacharacters");
			});

			it("rejects empty path", () => {
				const input = createValidCodexInput({ filePath: "" });
				const result = normalizeCodexFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_INVALID_PATH");
			});
		});

		describe("input validation - line numbers", () => {
			it("rejects line < 1", () => {
				const input = createValidCodexInput({ line: 0 });
				const result = normalizeCodexFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_PARSE_FAILURE");
			});

			it("rejects non-integer line", () => {
				const input = createValidCodexInput({ line: 1.5 });
				const result = normalizeCodexFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_PARSE_FAILURE");
			});
		});

		describe("input validation - timestamp", () => {
			it("rejects invalid timestamp format", () => {
				const input = createValidCodexInput({
					timestamp: "not-a-timestamp",
				});
				const result = normalizeCodexFinding(input);

				expect(result.ok).toBe(false);
				if (result.ok) throw new Error("Expected error result");

				expect(result.error.code).toBe("E_PARSE_FAILURE");
			});

			it("generates timestamp when not provided", () => {
				const input = createValidCodexInput();
				// Delete timestamp to simulate it not being provided
				(input as unknown as Record<string, unknown>).timestamp = undefined;
				const result = normalizeCodexFinding(input);

				expect(result.ok).toBe(true);
				if (!result.ok) throw new Error("Expected ok result");

				expect(result.finding.discoveredAt).toBeDefined();
				expect(result.finding.discoveredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
			});
		});
	});

	describe("type guards", () => {
		it("CodeQL type guard rejects wrong structure", () => {
			const codexInput = createValidCodexInput();
			const result = normalizeCodeqlFinding(codexInput);

			expect(result.ok).toBe(false);
			if (result.ok) throw new Error("Expected error result");

			expect(result.error.code).toBe("E_MISSING_FIELD");
		});

		it("Codex type guard rejects wrong structure", () => {
			const codeqlInput = createValidCodeqlInput();
			const result = normalizeCodexFinding(codeqlInput);

			expect(result.ok).toBe(false);
			if (result.ok) throw new Error("Expected error result");

			expect(result.error.code).toBe("E_MISSING_FIELD");
		});
	});

	describe("error raw field", () => {
		it("includes raw input in error for debugging", () => {
			const input = createValidCodeqlInput({
				commitSha: "invalid",
			});
			const result = normalizeCodeqlFinding(input);

			expect(result.ok).toBe(false);
			if (result.ok) throw new Error("Expected error result");

			expect(result.error.raw).toEqual(input);
		});
	});
});
