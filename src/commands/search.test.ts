import type { SpawnSyncReturns } from "node:child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EXIT_CODES, runSearch, runSearchCLI } from "./search.js";

vi.mock("node:child_process", () => ({
	spawnSync: vi.fn(),
}));

vi.mock("../lib/context-compound/ollama.js", () => {
	const isAvailable = vi.fn();
	const embed = vi.fn();

	return {
		OllamaClient: vi.fn(function OllamaClient() {
			return {
				isAvailable,
				embed,
			};
		}),
		__mockOllama: {
			isAvailable,
			embed,
		},
	};
});

vi.mock("../lib/context-compound/store.js", () => {
	const init = vi.fn();
	const search = vi.fn();
	const close = vi.fn();

	return {
		VectorStore: vi.fn(function VectorStore() {
			return {
				init,
				search,
				close,
			};
		}),
		__mockStore: {
			init,
			search,
			close,
		},
	};
});

vi.mock("../lib/contract/loader.js", () => {
	const loadContract = vi.fn();
	return {
		loadContract,
		__mockContractLoader: {
			loadContract,
		},
	};
});

import { spawnSync } from "node:child_process";
import * as ollamaModule from "../lib/context-compound/ollama.js";
import * as storeModule from "../lib/context-compound/store.js";
import * as contractLoaderModule from "../lib/contract/loader.js";

function createSpawnResult(
	stdout: string,
	options: { status?: number; stderr?: string; error?: Error } = {},
): SpawnSyncReturns<string> {
	return {
		stdout,
		stderr: options.stderr ?? "",
		status: options.status ?? 0,
		error: options.error ?? undefined,
		signal: null,
		pid: 123,
		output: [stdout, stdout],
	} as SpawnSyncReturns<string>;
}

function createMissingContractError(): Error & { code: string } {
	const error = new Error("Contract not found") as Error & { code: string };
	error.code = "ENOENT";
	return error;
}

describe("search command", () => {
	const mockSpawnSync = vi.mocked(spawnSync);
	const mockOllama = (ollamaModule as unknown as { __mockOllama: unknown })
		.__mockOllama as {
		isAvailable: ReturnType<typeof vi.fn>;
		embed: ReturnType<typeof vi.fn>;
	};
	const mockStore = (storeModule as unknown as { __mockStore: unknown })
		.__mockStore as {
		init: ReturnType<typeof vi.fn>;
		search: ReturnType<typeof vi.fn>;
		close: ReturnType<typeof vi.fn>;
	};
	const mockContractLoader = (
		contractLoaderModule as unknown as { __mockContractLoader: unknown }
	).__mockContractLoader as {
		loadContract: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockOllama.isAvailable.mockResolvedValue(false);
		mockStore.init.mockReturnValue({
			ok: true,
			value: undefined,
		});
		mockStore.search.mockReturnValue({
			ok: true,
			value: [],
		});
		mockContractLoader.loadContract.mockImplementation(() => {
			throw createMissingContractError();
		});
	});

	it("returns lexical results from rg JSON output", async () => {
		const rgOutput = JSON.stringify({
			type: "match",
			data: {
				path: { text: "src/commands/policy-gate.ts" },
				line_number: 42,
				lines: { text: "const policyGate = true;\n" },
				submatches: [{ start: 6 }],
			},
		});

		mockSpawnSync.mockReturnValue(createSpawnResult(`${rgOutput}\n`));
		const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {
			// noop
		});

		const code = await runSearch({
			query: "policyGate",
			mode: "lexical",
			json: true,
		});

		expect(code).toBe(EXIT_CODES.SUCCESS);
		expect(consoleSpy).toHaveBeenCalled();
		const payload = JSON.parse(String(consoleSpy.mock.calls[0]?.[0]));
		expect(payload.results).toHaveLength(1);
		expect(payload.results[0]?.source).toBe("lexical");
		expect(payload.results[0]?.line).toBe(42);
		consoleSpy.mockRestore();
	});

	it("returns semantic unavailable exit code for semantic mode", async () => {
		const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {
			// noop
		});

		const code = await runSearch({
			query: "authz",
			mode: "semantic",
			json: true,
		});

		expect(code).toBe(EXIT_CODES.SEMANTIC_UNAVAILABLE);
		const payload = JSON.parse(String(consoleSpy.mock.calls[0]?.[0]));
		expect(payload.warnings).toContain(
			"Semantic search unavailable: Ollama is not running",
		);
		consoleSpy.mockRestore();
	});

	it("prioritizes lexical results over semantic in hybrid mode", async () => {
		const rgOutput = JSON.stringify({
			type: "match",
			data: {
				path: { text: "src/commands/context.ts" },
				line_number: 12,
				lines: { text: "runContext(options);\n" },
				submatches: [{ start: 0 }],
			},
		});
		mockSpawnSync.mockReturnValue(createSpawnResult(`${rgOutput}\n`));

		mockOllama.isAvailable.mockResolvedValue(true);
		mockOllama.embed.mockResolvedValue({ ok: true, value: [0.1, 0.2, 0.3] });
		mockStore.search.mockReturnValue({
			ok: true,
			value: [
				{
					path: "docs/plans/2026-02-24-context-compound-implementation-plan.md",
					content: "Context compound rollout",
					similarity: 0.8,
					metadata: {
						type: "plan",
						topic: "context",
						date: "2026-02-24",
					},
				},
			],
		});

		const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {
			// noop
		});

		await runSearch({
			query: "context",
			mode: "hybrid",
			json: true,
			limit: 5,
		});

		const payload = JSON.parse(String(consoleSpy.mock.calls[0]?.[0]));
		expect(payload.results[0]?.source).toBe("lexical");
		expect(payload.results[1]?.source).toBe("semantic");
		consoleSpy.mockRestore();
	});

	it("validates mode in CLI parsing", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
			// noop
		});

		const code = await runSearchCLI(["foo", "--mode", "invalid"]);

		expect(code).toBe(EXIT_CODES.ERROR);
		expect(errorSpy).toHaveBeenCalledWith(
			"Error: --mode requires lexical, semantic, or hybrid",
		);
		errorSpy.mockRestore();
	});

	it("applies include/exclude path filters to lexical results", async () => {
		const rgOutput = JSON.stringify({
			type: "match",
			data: {
				path: { text: "src/commands/search.ts" },
				line_number: 10,
				lines: { text: "export async function runSearch() {}\\n" },
				submatches: [{ start: 7 }],
			},
		});
		mockSpawnSync.mockReturnValue(createSpawnResult(`${rgOutput}\\n`));

		const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {
			// noop
		});

		const code = await runSearch({
			query: "runSearch",
			mode: "lexical",
			json: true,
			includePaths: ["docs"],
			excludePaths: ["src"],
		});

		expect(code).toBe(EXIT_CODES.NO_RESULTS);
		const payload = JSON.parse(String(consoleSpy.mock.calls[0]?.[0]));
		expect(payload.results).toHaveLength(0);
		consoleSpy.mockRestore();
	});

	it("fails when --strict-semantic is set and semantic is unavailable", async () => {
		mockSpawnSync.mockReturnValue(createSpawnResult(""));
		const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {
			// noop
		});

		const code = await runSearch({
			query: "authz",
			mode: "hybrid",
			json: true,
			strictSemantic: true,
		});

		expect(code).toBe(EXIT_CODES.SEMANTIC_UNAVAILABLE);
		const payload = JSON.parse(String(consoleSpy.mock.calls[0]?.[0]));
		expect(payload.success).toBe(false);
		expect(payload.error).toContain("Strict semantic mode enabled");
		consoleSpy.mockRestore();
	});

	it("returns actionable ABI mismatch warning for semantic store init errors", async () => {
		mockStore.init.mockReturnValue({
			ok: false,
			error: {
				code: "DB_ERROR",
				message:
					"The module '/tmp/better_sqlite3.node' was compiled against a different Node.js version using NODE_MODULE_VERSION 137. This version of Node.js requires NODE_MODULE_VERSION 141.",
			},
		});

		const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {
			// noop
		});

		const code = await runSearch({
			query: "abi mismatch",
			mode: "semantic",
			json: true,
		});

		expect(code).toBe(EXIT_CODES.SEMANTIC_UNAVAILABLE);
		const payload = JSON.parse(String(consoleSpy.mock.calls[0]?.[0]));
		expect(payload.warnings[0]).toContain("Node.js ABI mismatch");
		expect(payload.warnings[0]).toContain("pnpm rebuild better-sqlite3");
		expect(payload.warnings[0]).not.toContain("/tmp/better_sqlite3.node");
		consoleSpy.mockRestore();
	});

	it("uses contextCompact defaults for semantic search when flags are omitted", async () => {
		mockContractLoader.loadContract.mockReturnValue({
			contextCompact: {
				thresholdPercent: 50,
				microCompactThresholdTokens: 1500,
				strategy: "balanced",
			},
		});
		mockOllama.isAvailable.mockResolvedValue(true);
		mockOllama.embed.mockResolvedValue({ ok: true, value: [0.1, 0.2, 0.3] });
		mockStore.search.mockReturnValue({
			ok: true,
			value: [],
		});
		const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {
			// noop
		});

		const code = await runSearch({
			query: "oauth query",
			mode: "semantic",
			json: true,
		});

		expect(code).toBe(EXIT_CODES.NO_RESULTS);
		expect(mockStore.search).toHaveBeenCalledWith(expect.any(Array), {
			threshold: 0.5,
			limit: 5,
			includeMetadata: true,
		});
		consoleSpy.mockRestore();
	});

	it("caps contextCompact threshold by autocompact safety buffer in search", async () => {
		mockContractLoader.loadContract.mockReturnValue({
			contextCompact: {
				thresholdPercent: 99,
				microCompactThresholdTokens: 999_999,
				strategy: "balanced",
			},
		});
		mockOllama.isAvailable.mockResolvedValue(true);
		mockOllama.embed.mockResolvedValue({ ok: true, value: [0.1, 0.2, 0.3] });
		mockStore.search.mockReturnValue({
			ok: true,
			value: [],
		});
		const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {
			// noop
		});

		const code = await runSearch({
			query: "oauth query",
			mode: "semantic",
			json: true,
		});

		expect(code).toBe(EXIT_CODES.NO_RESULTS);
		expect(mockStore.search).toHaveBeenCalledWith(expect.any(Array), {
			threshold: 0.935,
			limit: 10,
			includeMetadata: true,
		});
		consoleSpy.mockRestore();
	});

	it("keeps explicit search limit and threshold over contextCompact defaults", async () => {
		mockContractLoader.loadContract.mockReturnValue({
			contextCompact: {
				thresholdPercent: 95,
				microCompactThresholdTokens: 900,
				strategy: "aggressive",
			},
		});
		mockOllama.isAvailable.mockResolvedValue(true);
		mockOllama.embed.mockResolvedValue({ ok: true, value: [0.1, 0.2, 0.3] });
		mockStore.search.mockReturnValue({
			ok: true,
			value: [],
		});
		const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {
			// noop
		});

		const code = await runSearch({
			query: "oauth query",
			mode: "semantic",
			json: true,
			limit: 9,
			threshold: 0.4,
		});

		expect(code).toBe(EXIT_CODES.NO_RESULTS);
		expect(mockStore.search).toHaveBeenCalledWith(expect.any(Array), {
			threshold: 0.4,
			limit: 9,
			includeMetadata: true,
		});
		consoleSpy.mockRestore();
	});

	it("skips contextCompact contract load when explicit limit and threshold are set", async () => {
		mockOllama.isAvailable.mockResolvedValue(true);
		mockOllama.embed.mockResolvedValue({ ok: true, value: [0.1, 0.2, 0.3] });
		mockStore.search.mockReturnValue({
			ok: true,
			value: [],
		});
		mockSpawnSync.mockReturnValue(createSpawnResult(""));
		const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {
			// noop
		});

		const code = await runSearch({
			query: "oauth query",
			mode: "semantic",
			json: true,
			limit: 9,
			threshold: 0.4,
		});

		expect(code).toBe(EXIT_CODES.NO_RESULTS);
		expect(mockContractLoader.loadContract).not.toHaveBeenCalled();
		consoleSpy.mockRestore();
	});

	it("fails closed when contextCompact contract cannot be parsed", async () => {
		mockOllama.isAvailable.mockResolvedValue(true);
		mockOllama.embed.mockResolvedValue({ ok: true, value: [0.1, 0.2, 0.3] });
		mockContractLoader.loadContract.mockImplementation(() => {
			throw new Error("Contract validation failed with 1 error(s)");
		});
		const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {
			// noop
		});

		const code = await runSearch({
			query: "oauth query",
			mode: "semantic",
			json: true,
		});

		expect(code).toBe(EXIT_CODES.ERROR);
		const payload = JSON.parse(String(consoleSpy.mock.calls[0]?.[0]));
		expect(payload.error).toContain("Failed to load contextCompact policy");
		expect(mockStore.search).not.toHaveBeenCalled();
		consoleSpy.mockRestore();
	});

	describe("input validation", () => {
		it("rejects queries exceeding MAX_INPUT_LENGTH", async () => {
			const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
				// noop
			});

			const longQuery = "a".repeat(5000);
			const code = await runSearchCLI([longQuery]);

			expect(code).toBe(EXIT_CODES.VALIDATION_ERROR);
			expect(errorSpy).toHaveBeenCalledWith(
				expect.stringContaining("exceeds maximum length"),
			);
			errorSpy.mockRestore();
		});

		it("rejects harness-dir with path traversal", async () => {
			const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
				// noop
			});

			const code = await runSearchCLI([
				"query",
				"--harness-dir",
				"../etc/passwd",
			]);

			expect(code).toBe(EXIT_CODES.VALIDATION_ERROR);
			errorSpy.mockRestore();
		});

		it("warns about malformed path filters", async () => {
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
				// noop
			});
			const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
				// noop
			});

			mockSpawnSync.mockReturnValue(createSpawnResult(""));

			await runSearchCLI(["query", "--paths", "invalidfilter"]);

			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining("Invalid filter format"),
			);
			warnSpy.mockRestore();
			errorSpy.mockRestore();
		});

		it("warns about unknown filter kind", async () => {
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
				// noop
			});
			const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
				// noop
			});

			mockSpawnSync.mockReturnValue(createSpawnResult(""));

			await runSearchCLI(["query", "--paths", "unknown:src"]);

			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining("Unknown filter kind"),
			);
			warnSpy.mockRestore();
			errorSpy.mockRestore();
		});

		it("accepts nested include/exclude path prefixes", async () => {
			mockSpawnSync.mockReturnValue(createSpawnResult(""));

			const code = await runSearchCLI([
				"query",
				"--paths",
				"include:src/generated;exclude:src/generated/tmp",
			]);

			expect(code).not.toBe(EXIT_CODES.VALIDATION_ERROR);
		});

		it("preserves additional colons in --paths values", async () => {
			mockSpawnSync.mockReturnValue(createSpawnResult(""));
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
				// noop
			});

			const code = await runSearchCLI([
				"query",
				"--paths",
				"include:docs:notes;exclude:dist",
			]);

			expect(code).not.toBe(EXIT_CODES.VALIDATION_ERROR);
			expect(warnSpy).not.toHaveBeenCalledWith(
				expect.stringContaining("Invalid filter format"),
			);
			warnSpy.mockRestore();
		});

		it("rejects non-positive --limit", async () => {
			const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
				// noop
			});

			const code = await runSearchCLI(["query", "--limit", "0"]);

			expect(code).toBe(EXIT_CODES.VALIDATION_ERROR);
			expect(errorSpy).toHaveBeenCalledWith(
				"Error: --limit must be a positive integer",
			);
			errorSpy.mockRestore();
		});

		it("rejects out-of-range --threshold", async () => {
			const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
				// noop
			});

			const code = await runSearchCLI(["query", "--threshold", "1.2"]);

			expect(code).toBe(EXIT_CODES.VALIDATION_ERROR);
			expect(errorSpy).toHaveBeenCalledWith(
				"Error: --threshold must be between 0 and 1",
			);
			errorSpy.mockRestore();
		});
	});
});
