import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Markdown page content and path metadata used by Project Brain lint checks. */
export interface BrainMarkdownPage {
	path: string;
	content: string;
	lines: string[];
}

/** Read a Project Brain markdown page from the harness directory. */
export function readBrainMarkdownPage(
	harnessDir: string,
	path: string,
): BrainMarkdownPage | null {
	const fullPath = join(harnessDir, path);
	if (!existsSync(fullPath)) return null;
	const content = readFileSync(fullPath, "utf-8");
	return { path, content, lines: content.split("\n") };
}

/** Collect the Project Brain markdown pages checked by brain lint. */
export function collectBrainMarkdownPages(
	harnessDir: string,
): BrainMarkdownPage[] {
	const pages: BrainMarkdownPage[] = [];
	for (const path of [
		"knowledge/INDEX.md",
		"knowledge/LOG.md",
		"quality/criteria.md",
		"review-log.md",
	]) {
		const page = readBrainMarkdownPage(harnessDir, path);
		if (page) pages.push(page);
	}

	const knowledgeDir = join(harnessDir, "knowledge");
	if (!existsSync(knowledgeDir)) return pages;
	for (const entry of readdirSync(knowledgeDir).sort()) {
		const entryPath = join(knowledgeDir, entry);
		if (!statSync(entryPath).isDirectory()) continue;
		for (const file of ["knowledge.md", "rules.md", "hypotheses.md"]) {
			const page = readBrainMarkdownPage(
				harnessDir,
				`knowledge/${entry}/${file}`,
			);
			if (page) pages.push(page);
		}
	}
	return pages;
}

/** Parse single-line YAML frontmatter values used by Project Brain pages. */
export function parseBrainFrontmatter(
	page: BrainMarkdownPage,
): Map<string, string> | null {
	if (page.lines[0] !== "---") return null;
	const closingIndex = page.lines.findIndex(
		(line, index) => index > 0 && line === "---",
	);
	if (closingIndex < 0) return null;
	const values = new Map<string, string>();
	for (const line of page.lines.slice(1, closingIndex)) {
		const match = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);
		if (!match) continue;
		values.set(match[1] ?? "", match[2]?.trim() ?? "");
	}
	return values;
}

/** Parse inline YAML list values such as [a, b] from Project Brain metadata. */
export function parseBrainFrontmatterList(value: string | undefined): string[] {
	if (!value) return [];
	const trimmed = value.trim();
	if (!trimmed || trimmed === "[]") return [];
	if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
		return trimmed
			.slice(1, -1)
			.split(",")
			.map((entry) => entry.trim().replace(/^["']|["']$/g, ""))
			.filter(Boolean);
	}
	return [trimmed.replace(/^["']|["']$/g, "")].filter(Boolean);
}
