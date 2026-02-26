import { createHash } from "node:crypto";
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
import { EMBEDDING_DIMENSIONS } from "./constants.js";
import { indexFile } from "./indexer.js";

describe("indexFile", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const dir of tempDirs) {
			rmSync(dir, { recursive: true, force: true });
		}
		tempDirs.length = 0;
	});

	it("parses CRLF frontmatter metadata correctly", async () => {
		const root = mkdtempSync(join(tmpdir(), "harness-indexer-"));
		tempDirs.push(root);

		const docsDir = join(root, "docs");
		mkdirSync(docsDir, { recursive: true });
		const filePath = join(docsDir, "sample.md");
		const content = [
			"---",
			'topic: "CRLF Topic"',
			"date: 2026-02-25",
			"status: active",
			"---",
			"",
			"# Body",
		].join("\r\n");
		writeFileSync(filePath, content, "utf-8");

		let insertedRecord:
			| { metadata: { topic: string; date: string } }
			| undefined;

		const ollama = {
			embed: vi.fn().mockResolvedValue({
				ok: true,
				value: new Float32Array(EMBEDDING_DIMENSIONS),
			}),
		};
		const store = {
			getContentHash: vi.fn().mockReturnValue(null),
			insert: vi.fn().mockImplementation((record) => {
				insertedRecord = record;
				return { ok: true, value: undefined };
			}),
		};

		const result = await indexFile(
			{ filepath: filePath, type: "plan", basePath: root },
			ollama as never,
			store as never,
		);

		expect(result.indexed).toBe(true);
		expect(insertedRecord?.metadata.topic).toBe("CRLF Topic");
		expect(insertedRecord?.metadata.date).toBe("2026-02-25");
	});

	it("reindexes unchanged content when force is true", async () => {
		const root = mkdtempSync(join(tmpdir(), "harness-indexer-"));
		tempDirs.push(root);

		const docsDir = join(root, "docs");
		mkdirSync(docsDir, { recursive: true });
		const filePath = join(docsDir, "sample.md");
		const content = "# unchanged";
		writeFileSync(filePath, content, "utf-8");

		const contentHash = createHash("sha256").update(content).digest("hex");

		const ollama = {
			embed: vi.fn().mockResolvedValue({
				ok: true,
				value: new Float32Array(EMBEDDING_DIMENSIONS),
			}),
		};
		const store = {
			getContentHash: vi.fn().mockReturnValue(contentHash),
			insert: vi.fn().mockReturnValue({ ok: true, value: undefined }),
		};

		const skipped = await indexFile(
			{ filepath: filePath, type: "plan", basePath: root },
			ollama as never,
			store as never,
		);

		expect(skipped.indexed).toBe(false);
		expect(store.insert).not.toHaveBeenCalled();

		const forced = await indexFile(
			{ filepath: filePath, type: "plan", basePath: root, force: true },
			ollama as never,
			store as never,
		);

		expect(forced.indexed).toBe(true);
		expect(store.insert).toHaveBeenCalledTimes(1);
	});

	it("rejects files outside the configured basePath", async () => {
		const root = mkdtempSync(join(tmpdir(), "harness-indexer-"));
		tempDirs.push(root);

		const baseDir = join(root, "docs");
		const outsideDir = join(root, "outside");
		mkdirSync(baseDir, { recursive: true });
		mkdirSync(outsideDir, { recursive: true });

		const outsideFile = join(outsideDir, "escape.md");
		writeFileSync(outsideFile, "# outside", "utf-8");

		const ollama = {
			embed: vi.fn().mockResolvedValue({
				ok: true,
				value: new Float32Array(EMBEDDING_DIMENSIONS),
			}),
		};
		const store = {
			getContentHash: vi.fn().mockReturnValue(null),
			insert: vi.fn().mockReturnValue({ ok: true, value: undefined }),
		};

		const result = await indexFile(
			{ filepath: outsideFile, type: "plan", basePath: baseDir },
			ollama as never,
			store as never,
		);

		expect(result.indexed).toBe(false);
		expect(result.error?.code).toBe("READ_FAILED");
		expect(result.error?.message).toContain("escapes base path");
		expect(ollama.embed).not.toHaveBeenCalled();
		expect(store.insert).not.toHaveBeenCalled();
	});

	it("rejects symlink files that resolve outside the configured basePath", async () => {
		const root = mkdtempSync(join(tmpdir(), "harness-indexer-"));
		tempDirs.push(root);

		const docsDir = join(root, "docs");
		const outsideDir = join(root, "outside");
		mkdirSync(docsDir, { recursive: true });
		mkdirSync(outsideDir, { recursive: true });

		const escapedTarget = join(outsideDir, "external.md");
		writeFileSync(escapedTarget, "# external", "utf-8");
		const linkedFile = join(docsDir, "escaped.md");
		symlinkSync(escapedTarget, linkedFile);

		const ollama = {
			embed: vi.fn().mockResolvedValue({
				ok: true,
				value: new Float32Array(EMBEDDING_DIMENSIONS),
			}),
		};
		const store = {
			getContentHash: vi.fn().mockReturnValue(null),
			insert: vi.fn().mockReturnValue({ ok: true, value: undefined }),
		};

		const result = await indexFile(
			{ filepath: linkedFile, type: "plan", basePath: docsDir },
			ollama as never,
			store as never,
		);

		expect(result.indexed).toBe(false);
		expect(result.error?.code).toBe("READ_FAILED");
		expect(result.error?.message).toContain("escapes base path");
		expect(ollama.embed).not.toHaveBeenCalled();
		expect(store.insert).not.toHaveBeenCalled();
	});
});
