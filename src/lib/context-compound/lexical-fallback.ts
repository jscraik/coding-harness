import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import {
	DEFAULT_HARNESS_DIR,
	DEFAULT_LEXICAL_INDEX_FILENAME,
} from "./constants.js";
import type { DocumentMetadata, SearchResult } from "./types.js";

interface LexicalIndexEntry {
	path: string;
	metadata: DocumentMetadata;
	contentHash: string;
}

interface LexicalIndexFile {
	schemaVersion: "context-lexical-index/v1";
	generatedAt: string;
	entries: LexicalIndexEntry[];
}

function parseFrontmatter(content: string): {
	frontmatter: Record<string, unknown>;
	body: string;
} {
	const match = content.match(
		/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/,
	);
	if (!match) {
		return { frontmatter: {}, body: content };
	}

	const frontmatter: Record<string, unknown> = {};
	const contentCapture = match[1];
	if (!contentCapture) {
		return { frontmatter: {}, body: content };
	}

	const lines = contentCapture.split(/\r?\n/);
	let currentKey: string | null = null;
	let currentArray: string[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;
		const trimmed = line.trim();

		if (trimmed.startsWith("- ") && currentKey) {
			currentArray.push(trimmed.slice(2).replace(/^["']|["']$/g, ""));
			continue;
		}

		if (currentKey && currentArray.length > 0) {
			frontmatter[currentKey] = currentArray;
			currentArray = [];
		}

		const colonIndex = line.indexOf(":");
		if (colonIndex > 0) {
			currentKey = line.slice(0, colonIndex).trim();
			const value = line.slice(colonIndex + 1).trim();

			if (value === "") {
				const nextLine = lines[i + 1]?.trim();
				if (nextLine?.startsWith("- ")) {
					currentArray = [];
				} else {
					frontmatter[currentKey] = "";
					currentKey = null;
				}
			} else {
				frontmatter[currentKey] = value.replace(/^["']|["']$/g, "");
				currentKey = null;
			}
		}
	}

	if (currentKey && currentArray.length > 0) {
		frontmatter[currentKey] = currentArray;
	}

	const bodyContent = match[2];
	return { frontmatter, body: bodyContent ? bodyContent.trim() : "" };
}

function discoverMarkdownFiles(dir: string): string[] {
	if (!existsSync(dir)) return [];

	const files: string[] = [];
	const entries = readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...discoverMarkdownFiles(fullPath));
		} else if (entry.isFile() && entry.name.endsWith(".md")) {
			files.push(fullPath);
		}
	}
	return files;
}

function hashContent(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}

function scoreDocument(query: string, content: string): number {
	const queryTokens = Array.from(
		new Set(
			query
				.toLowerCase()
				.split(/[^a-z0-9]+/i)
				.map((token) => token.trim())
				.filter((token) => token.length >= 2),
		),
	);
	if (queryTokens.length === 0) {
		return 0;
	}

	const haystack = content.toLowerCase();
	let matchedTokens = 0;
	let totalOccurrences = 0;

	for (const token of queryTokens) {
		const occurrences = haystack.split(token).length - 1;
		if (occurrences > 0) {
			matchedTokens++;
			totalOccurrences += occurrences;
		}
	}

	if (matchedTokens === 0) {
		return 0;
	}

	const coverage = matchedTokens / queryTokens.length;
	const densityBonus = Math.min(totalOccurrences, 5) * 0.05;
	return Math.min(1, coverage + densityBonus);
}

function buildMetadata(
	filepath: string,
	type: DocumentMetadata["type"],
	content: string,
): DocumentMetadata {
	const { frontmatter } = parseFrontmatter(content);
	const today = new Date().toISOString().split("T")[0] ?? "2026-01-01";
	return {
		type,
		topic:
			(typeof frontmatter.topic === "string" && frontmatter.topic) ||
			(typeof frontmatter.title === "string" && frontmatter.title) ||
			filepath.split("/").at(-1) ||
			filepath,
		date: (typeof frontmatter.date === "string" && frontmatter.date) || today,
		...(typeof frontmatter.status === "string" && frontmatter.status
			? { status: frontmatter.status }
			: {}),
	};
}

export function getLexicalIndexPath(
	baseDir: string,
	harnessDir = DEFAULT_HARNESS_DIR,
): string {
	return join(baseDir, harnessDir, DEFAULT_LEXICAL_INDEX_FILENAME);
}

export function discoverContextSources(baseDir: string): Array<{
	filepath: string;
	type: DocumentMetadata["type"];
}> {
	return [
		...discoverMarkdownFiles(join(baseDir, "docs/brainstorms")).map(
			(filepath) => ({
				filepath,
				type: "brainstorm" as const,
			}),
		),
		...discoverMarkdownFiles(join(baseDir, "docs/plans")).map((filepath) => ({
			filepath,
			type: "plan" as const,
		})),
		...discoverMarkdownFiles(join(baseDir, "docs/solutions")).map(
			(filepath) => ({
				filepath,
				type: "solution" as const,
			}),
		),
	];
}

export function writeLexicalIndex(
	baseDir: string,
	harnessDir = DEFAULT_HARNESS_DIR,
): { path: string; indexed: number } {
	const entries: LexicalIndexEntry[] = discoverContextSources(baseDir).map(
		({ filepath, type }) => {
			const content = readFileSync(filepath, "utf-8");
			return {
				path: relative(baseDir, filepath).split("\\").join("/"),
				metadata: buildMetadata(filepath, type, content),
				contentHash: hashContent(content),
			};
		},
	);

	const output: LexicalIndexFile = {
		schemaVersion: "context-lexical-index/v1",
		generatedAt: new Date().toISOString(),
		entries,
	};

	const lexicalIndexPath = getLexicalIndexPath(baseDir, harnessDir);
	mkdirSync(join(baseDir, harnessDir), { recursive: true });
	writeFileSync(lexicalIndexPath, JSON.stringify(output, null, 2), "utf-8");
	return { path: lexicalIndexPath, indexed: entries.length };
}

function loadLexicalIndex(
	baseDir: string,
	harnessDir = DEFAULT_HARNESS_DIR,
): LexicalIndexFile | null {
	const lexicalIndexPath = getLexicalIndexPath(baseDir, harnessDir);
	if (!existsSync(lexicalIndexPath)) {
		return null;
	}
	try {
		const parsed = JSON.parse(
			readFileSync(lexicalIndexPath, "utf-8"),
		) as Partial<LexicalIndexFile>;
		if (
			parsed.schemaVersion === "context-lexical-index/v1" &&
			Array.isArray(parsed.entries)
		) {
			return parsed as LexicalIndexFile;
		}
	} catch {
		return null;
	}
	return null;
}

export function searchLexicalFallback(
	baseDir: string,
	query: string,
	options?: {
		harnessDir?: string;
		limit?: number;
	},
): SearchResult[] {
	const harnessDir = options?.harnessDir ?? DEFAULT_HARNESS_DIR;
	const limit = options?.limit ?? 10;
	const lexicalIndex =
		loadLexicalIndex(baseDir, harnessDir) ??
		({
			schemaVersion: "context-lexical-index/v1",
			generatedAt: new Date().toISOString(),
			entries: discoverContextSources(baseDir).map(({ filepath, type }) => {
				const content = readFileSync(filepath, "utf-8");
				return {
					path: relative(baseDir, filepath).split("\\").join("/"),
					metadata: buildMetadata(filepath, type, content),
					contentHash: hashContent(content),
				};
			}),
		} satisfies LexicalIndexFile);

	return lexicalIndex.entries
		.map((entry) => {
			const fullPath = join(baseDir, entry.path);
			const content = readFileSync(fullPath, "utf-8");
			const score = scoreDocument(
				query,
				`${entry.metadata.topic}\n${entry.metadata.type}\n${content}`,
			);
			return {
				path: entry.path,
				similarity: score,
				metadata: entry.metadata,
			};
		})
		.filter((result) => result.similarity > 0)
		.sort((a, b) => b.similarity - a.similarity)
		.slice(0, limit);
}
