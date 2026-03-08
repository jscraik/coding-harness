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
const initMock = vi.fn<
	() =>
		| { ok: true; value: undefined }
		| { ok: false; error: { code: string; message: string } }
>(() => ({ ok: true, value: undefined }));

vi.mock("../lib/context-compound/store.js", () => ({
	VectorStore: class {
		init() {
			return initMock();
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
		initMock.mockClear();
		initMock.mockReturnValue({ ok: true, value: undefined });
		for (const dir of tempDirs) {
			rmSync(dir, { recursive: true, force: true });
		}
		tempDirs.length = 0;
	});

	it("indexes markdown files in nested directories", async () => {
		const { runIndexContext } = await import("./index-context.js");

		const root = mkdtempSync(join(tmpdir(), "harness-index-context-"));
		tempDirs.push(root);

		const brainstormDir = join(root, "docs/brainstorms");
		const nestedDir = join(brainstormDir, "nested");
		mkdirSync(nestedDir, { recursive: true });
		writeFileSync(join(brainstormDir, "top.md"), "# top", "utf-8");
		writeFileSync(join(nestedDir, "nested.md"), "# nested", "utf-8");

		const result = await runIndexContext({
			baseDir: root,
			json: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.success).toBe(true);
			expect(result.value.indexed).toBe(2);
		}
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
		const { runIndexContext } = await import("./index-context.js");
		const root = mkdtempSync(join(tmpdir(), "harness-index-context-"));
		tempDirs.push(root);

		const result = await runIndexContext({
			baseDir: root,
			harnessDir: "../outside",
			json: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("PATH_TRAVERSAL");
		}
		expect(indexBatchMock).not.toHaveBeenCalled();
	});

	it("returns ERROR when harnessDir is a symlink that resolves outside baseDir", async () => {
		const { runIndexContext } = await import("./index-context.js");
		const root = mkdtempSync(join(tmpdir(), "harness-index-context-"));
		tempDirs.push(root);

		const outside = join(root, "outside");
		const harnessLink = join(root, "link-harness");
		mkdirSync(outside, { recursive: true });
		symlinkSync(outside, harnessLink);

		const result = await runIndexContext({
			baseDir: root,
			harnessDir: harnessLink,
			json: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("PATH_TRAVERSAL");
		}
		expect(indexBatchMock).not.toHaveBeenCalled();
	});

	it("accepts nested harnessDir paths that do not exist yet", async () => {
		const { runIndexContext } = await import("./index-context.js");
		const root = mkdtempSync(join(tmpdir(), "harness-index-context-"));
		tempDirs.push(root);

		const brainstormDir = join(root, "docs/brainstorms");
		mkdirSync(brainstormDir, { recursive: true });
		writeFileSync(join(brainstormDir, "topic.md"), "# topic", "utf-8");

		const result = await runIndexContext({
			baseDir: root,
			harnessDir: ".harness/nested/path",
			json: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.success).toBe(true);
		}
		expect(indexBatchMock).toHaveBeenCalled();
	});

	it("returns actionable ABI mismatch error when store init fails", async () => {
		const { runIndexContext } = await import("./index-context.js");
		const root = mkdtempSync(join(tmpdir(), "harness-index-context-"));
		tempDirs.push(root);

		const brainstormDir = join(root, "docs/brainstorms");
		mkdirSync(brainstormDir, { recursive: true });
		writeFileSync(join(brainstormDir, "topic.md"), "# topic", "utf-8");

		initMock.mockReturnValue({
			ok: false,
			error: {
				code: "DB_ERROR",
				message:
					"The module '/tmp/better_sqlite3.node' was compiled against a different Node.js version using NODE_MODULE_VERSION 137. This version of Node.js requires NODE_MODULE_VERSION 141.",
			},
		});

		const result = await runIndexContext({
			baseDir: root,
			json: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain("Node.js ABI mismatch");
			expect(result.error.message).toContain("pnpm rebuild better-sqlite3");
			expect(result.error.message).not.toContain("/tmp/better_sqlite3.node");
		}
	});
});
