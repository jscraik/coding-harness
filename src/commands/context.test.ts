import { sep } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	DEFAULT_DB_FILENAME,
	DEFAULT_HARNESS_DIR,
} from "../lib/context-compound/constants.js";

const constructorPaths: string[] = [];
const initMock = vi.fn<
	() =>
		| { ok: true; value: undefined }
		| { ok: false; error: { code: string; message: string } }
>(() => ({ ok: true, value: undefined }));

const searchMock = vi.fn(
	(
		_embedding: number[],
		_options: { threshold: number; limit: number; includeMetadata: boolean },
	) => ({ ok: true as const, value: [] as Array<unknown> }),
);

vi.mock("../lib/context-compound/store.js", () => ({
	VectorStore: class {
		constructor(dbPath: string) {
			constructorPaths.push(dbPath);
		}

		init() {
			return initMock();
		}

		search(
			_embedding: number[],
			options: { threshold: number; limit: number; includeMetadata: boolean },
		): { ok: true; value: Array<unknown> } {
			return searchMock(_embedding, options);
		}

		close() {
			// no-op for tests
		}
	},
}));

vi.mock("../lib/context-compound/ollama.js", () => ({
	OllamaClient: class {
		async isAvailable() {
			return true;
		}

		async embed() {
			return { ok: true, value: [0.1, 0.2, 0.3] };
		}
	},
}));

describe("runContextCLI", () => {
	beforeEach(() => {
		searchMock.mockClear();
		initMock.mockClear();
		initMock.mockReturnValue({ ok: true, value: undefined });
		constructorPaths.length = 0;
	});

	it("returns SUCCESS and prints help for -h", async () => {
		const { runContextCLI, EXIT_CODES } = await import("./context.js");
		const consoleInfoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		const exitCode = await runContextCLI(["-h"]);

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(searchMock).not.toHaveBeenCalled();
		expect(consoleInfoSpy).toHaveBeenCalledWith(
			"Usage: harness context <query> [options]",
		);

		consoleInfoSpy.mockRestore();
	});

	it("errors on malformed numeric values", async () => {
		const { runContextCLI, EXIT_CODES } = await import("./context.js");

		const exitCode = await runContextCLI([
			"oauth query",
			"--limit",
			"10abc",
			"--threshold",
			"1.2",
		]);

		expect(exitCode).toBe(EXIT_CODES.ERROR);
		expect(searchMock).not.toHaveBeenCalled();
	});

	it("errors on malformed threshold values", async () => {
		const { runContextCLI, EXIT_CODES } = await import("./context.js");

		const exitCode = await runContextCLI(["oauth query", "--threshold", "abc"]);

		expect(exitCode).toBe(EXIT_CODES.ERROR);
		expect(searchMock).not.toHaveBeenCalled();
	});

	it("does not consume short flags as --harness-dir value", async () => {
		const { runContextCLI, EXIT_CODES } = await import("./context.js");
		const consoleInfoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		const exitCode = await runContextCLI([
			"oauth query",
			"--harness-dir",
			"-j",
		]);

		expect(exitCode).toBe(EXIT_CODES.NO_RESULTS);
		expect(consoleInfoSpy).not.toHaveBeenCalledWith(
			expect.stringContaining(`"${DEFAULT_HARNESS_DIR}"`),
		);
		expect(constructorPaths[0]).toContain(
			`${DEFAULT_HARNESS_DIR}${sep}${DEFAULT_DB_FILENAME}`,
		);

		consoleInfoSpy.mockRestore();
	});

	it("parses valid numeric options and harness directory", async () => {
		const { runContextCLI, EXIT_CODES } = await import("./context.js");

		const exitCode = await runContextCLI([
			"oauth query",
			"--limit",
			"5",
			"--threshold",
			"0.8",
			"--harness-dir",
			".custom-harness",
		]);

		expect(exitCode).toBe(EXIT_CODES.NO_RESULTS);
		expect(searchMock).toHaveBeenCalledTimes(1);
		expect(searchMock.mock.calls[0]?.[1]).toEqual({
			threshold: 0.8,
			limit: 5,
			includeMetadata: true,
		});
		expect(constructorPaths[0]).toContain(
			`.custom-harness${sep}${DEFAULT_DB_FILENAME}`,
		);
	});

	it("returns actionable ABI mismatch error when better-sqlite3 is incompatible", async () => {
		const { runContext, EXIT_CODES } = await import("./context.js");
		const consoleInfoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		initMock.mockReturnValue({
			ok: false,
			error: {
				code: "DB_ERROR",
				message:
					"The module '/tmp/better_sqlite3.node' was compiled against a different Node.js version using NODE_MODULE_VERSION 137. This version of Node.js requires NODE_MODULE_VERSION 141.",
			},
		});

		const exitCode = await runContext({
			query: "abi mismatch",
			json: true,
		});

		expect(exitCode).toBe(EXIT_CODES.ERROR);
		const payload = JSON.parse(String(consoleInfoSpy.mock.calls[0]?.[0]));
		expect(payload.error).toContain("Node.js ABI mismatch");
		expect(payload.error).toContain("pnpm rebuild better-sqlite3");
		expect(payload.error).not.toContain("/tmp/better_sqlite3.node");
		consoleInfoSpy.mockRestore();
	});
});
