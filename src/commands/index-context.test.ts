import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const indexBatchMock = vi.fn(
	async (
		files: Array<{ filepath: string }>,
	): Promise<Array<{ indexed: boolean; path: string }>> =>
		files.map((file) => ({ indexed: true, path: file.filepath })),
);

vi.mock("../lib/context-compound/store.js", () => ({
	VectorStore: class {
		init() {
			return { ok: true, value: undefined };
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

		async warmup() {
			// no-op for tests
		}
	},
}));

vi.mock("../lib/context-compound/indexer.js", () => ({
	indexBatch: indexBatchMock,
	brainstormIndexOptions: (filepath: string, basePath?: string) => ({
		filepath,
		type: "brainstorm" as const,
		basePath,
	}),
	planIndexOptions: (filepath: string, basePath?: string) => ({
		filepath,
		type: "plan" as const,
		basePath,
	}),
}));

describe("runIndexContext", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		vi.clearAllMocks();
		for (const dir of tempDirs) {
			rmSync(dir, { recursive: true, force: true });
		}
		tempDirs.length = 0;
	});

	it("indexes markdown files in nested directories", async () => {
		const { runIndexContext, EXIT_CODES } = await import("./index-context.js");

		const root = mkdtempSync(join(tmpdir(), "harness-index-context-"));
		tempDirs.push(root);

		const brainstormDir = join(root, "docs/brainstorms");
		const nestedDir = join(brainstormDir, "nested");
		mkdirSync(nestedDir, { recursive: true });
		writeFileSync(join(brainstormDir, "top.md"), "# top", "utf-8");
		writeFileSync(join(nestedDir, "nested.md"), "# nested", "utf-8");

		const exitCode = await runIndexContext({
			baseDir: root,
			json: true,
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		const indexedPaths = indexBatchMock.mock.calls.flatMap((call) =>
			(call[0] as Array<{ filepath: string }>).map((file) => file.filepath),
		);
		expect(indexedPaths).toContain(join(brainstormDir, "top.md"));
		expect(indexedPaths).toContain(join(nestedDir, "nested.md"));
	});

	it("returns ERROR when --harness-dir value is missing", async () => {
		const { runIndexContextCLI, EXIT_CODES } = await import(
			"./index-context.js"
		);
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		const exitCode = await runIndexContextCLI(["--harness-dir", "--force"]);

		expect(exitCode).toBe(EXIT_CODES.ERROR);
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			"Error: --harness-dir requires a value",
		);

		consoleErrorSpy.mockRestore();
	});

	it("returns ERROR when --harness-dir value is another flag", async () => {
		const { runIndexContextCLI, EXIT_CODES } = await import(
			"./index-context.js"
		);
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		const exitCode = await runIndexContextCLI(["--harness-dir", "-j"]);

		expect(exitCode).toBe(EXIT_CODES.ERROR);
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			"Error: --harness-dir requires a value",
		);

		consoleErrorSpy.mockRestore();
	});

	it("returns ERROR when harnessDir escapes baseDir", async () => {
		const { runIndexContext, EXIT_CODES } = await import("./index-context.js");
		const root = mkdtempSync(join(tmpdir(), "harness-index-context-"));
		tempDirs.push(root);

		const consoleInfoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		const exitCode = await runIndexContext({
			baseDir: root,
			harnessDir: "../outside",
			json: true,
		});

		expect(exitCode).toBe(EXIT_CODES.ERROR);
		expect(indexBatchMock).not.toHaveBeenCalled();

		consoleInfoSpy.mockRestore();
	});

	it("returns ERROR when harnessDir is a symlink that resolves outside baseDir", async () => {
		const { runIndexContext, EXIT_CODES } = await import("./index-context.js");
		const root = mkdtempSync(join(tmpdir(), "harness-index-context-"));
		tempDirs.push(root);

		const outside = join(root, "outside");
		const harnessLink = join(root, "link-harness");
		mkdirSync(outside, { recursive: true });
		symlinkSync(outside, harnessLink);

		const consoleInfoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		const exitCode = await runIndexContext({
			baseDir: root,
			harnessDir: harnessLink,
			json: true,
		});

		expect(exitCode).toBe(EXIT_CODES.ERROR);
		expect(indexBatchMock).not.toHaveBeenCalled();

		consoleInfoSpy.mockRestore();
	});

	it("accepts nested harnessDir paths that do not exist yet", async () => {
		const { runIndexContext, EXIT_CODES } = await import("./index-context.js");
		const root = mkdtempSync(join(tmpdir(), "harness-index-context-"));
		tempDirs.push(root);

		const brainstormDir = join(root, "docs/brainstorms");
		mkdirSync(brainstormDir, { recursive: true });
		writeFileSync(join(brainstormDir, "topic.md"), "# topic", "utf-8");

		const exitCode = await runIndexContext({
			baseDir: root,
			harnessDir: ".harness/nested/path",
			json: true,
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(indexBatchMock).toHaveBeenCalled();
	});
});
