import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { countMarkdownFiles, detectStaleDocs } from "./stale-detector.js";

describe("detectStaleDocs", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const dir of tempDirs) {
			rmSync(dir, { recursive: true, force: true });
		}
		tempDirs.length = 0;
	});

	it("parses CRLF frontmatter without treating doc as stale", () => {
		mkdirSync("artifacts", { recursive: true });
		const root = mkdtempSync(join(process.cwd(), "artifacts/stale-detector-"));
		tempDirs.push(root);

		const docsDir = join(root, "docs");
		mkdirSync(docsDir, { recursive: true });

		const today = new Date().toISOString().split("T")[0] ?? "2026-01-01";
		const content = [
			"---",
			`last_validated: ${today}`,
			"---",
			"",
			"# Guide",
		].join("\r\n");

		writeFileSync(join(docsDir, "guide.md"), content, "utf-8");

		const stale = detectStaleDocs(docsDir, 30);
		expect(stale).toEqual([]);
	});

	it("ignores generated QUALITY_SCORE.md for stale detection and counts", () => {
		mkdirSync("artifacts", { recursive: true });
		const root = mkdtempSync(join(process.cwd(), "artifacts/stale-detector-"));
		tempDirs.push(root);

		const docsDir = join(root, "docs");
		mkdirSync(docsDir, { recursive: true });

		const today = new Date().toISOString().split("T")[0] ?? "2026-01-01";
		writeFileSync(
			join(docsDir, "guide.md"),
			`---\nlast_validated: ${today}\n---\n\n# Guide\n`,
			"utf-8",
		);
		writeFileSync(
			join(docsDir, "QUALITY_SCORE.md"),
			"---\nlast_updated: 2026-02-25\ncalculated_by: harness-gardener\n---\n",
			"utf-8",
		);

		expect(detectStaleDocs(docsDir, 30)).toEqual([]);
		expect(countMarkdownFiles(docsDir)).toBe(1);
	});
});
