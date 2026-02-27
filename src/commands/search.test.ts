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
		OllamaClient: vi.fn().mockImplementation(() => ({
			isAvailable,
			embed,
		})),
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
		VectorStore: vi.fn().mockImplementation(() => ({
			init,
			search,
			close,
		})),
		__mockStore: {
			init,
			search,
			close,
		},
	};
});

import { spawnSync } from "node:child_process";
import * as ollamaModule from "../lib/context-compound/ollama.js";
import * as storeModule from "../lib/context-compound/store.js";

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
});
