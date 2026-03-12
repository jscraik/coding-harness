import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { discoverContextSourceDocuments } from "../context-integrity/sources.js";
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
	overrides?: Partial<DocumentMetadata>,
): DocumentMetadata {
	const { frontmatter } = parseFrontmatter(content);
	const today = new Date().toISOString().split("T")[0] ?? "2026-01-01";
	return {
		type,
		topic:
			overrides?.topic ||
			(typeof frontmatter.topic === "string" && frontmatter.topic) ||
			(typeof frontmatter.title === "string" && frontmatter.title) ||
			filepath.split("/").at(-1) ||
			filepath,
		date:
			overrides?.date ||
			(typeof frontmatter.date === "string" && frontmatter.date) ||
			today,
		...((typeof frontmatter.status === "string" && frontmatter.status) ||
		overrides?.status
			? {
					status:
						overrides?.status ||
						(typeof frontmatter.status === "string"
							? frontmatter.status
							: undefined),
				}
			: {}),
		...(overrides?.authority ? { authority: overrides.authority } : {}),
		...(overrides?.family ? { family: overrides.family } : {}),
		...(overrides?.stalenessState
			? { stalenessState: overrides.stalenessState }
			: {}),
	};
}

const AUTHORITY_RANK: Record<
	NonNullable<DocumentMetadata["authority"]>,
	number
> = {
	canonical: 0,
	governed: 1,
	supporting: 2,
};

const STALENESS_RANK: Record<
	NonNullable<DocumentMetadata["stalenessState"]>,
	number
> = {
	fresh: 0,
	unknown: 1,
	stale: 2,
};

export function getLexicalIndexPath(
	baseDir: string,
	harnessDir = DEFAULT_HARNESS_DIR,
): string {
	return join(baseDir, harnessDir, DEFAULT_LEXICAL_INDEX_FILENAME);
}

export function discoverContextSources(baseDir: string) {
	return discoverContextSourceDocuments(baseDir);
}

export function writeLexicalIndex(
	baseDir: string,
	harnessDir = DEFAULT_HARNESS_DIR,
): { path: string; indexed: number } {
	const entries: LexicalIndexEntry[] = discoverContextSources(baseDir).map(
		(document) => {
			const { filepath, type, authority, family, stalenessState } = document;
			const content = readFileSync(filepath, "utf-8");
			return {
				path: relative(baseDir, filepath).split("\\").join("/"),
				metadata: buildMetadata(filepath, type, content, {
					authority,
					family,
					stalenessState,
				}),
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
			entries: discoverContextSources(baseDir).map((document) => {
				const { filepath, type, authority, family, stalenessState } = document;
				const content = readFileSync(filepath, "utf-8");
				return {
					path: relative(baseDir, filepath).split("\\").join("/"),
					metadata: buildMetadata(filepath, type, content, {
						authority,
						family,
						stalenessState,
					}),
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
		.sort((a, b) => {
			if (b.similarity !== a.similarity) {
				return b.similarity - a.similarity;
			}
			const authorityDelta =
				(AUTHORITY_RANK[a.metadata?.authority ?? "supporting"] ?? 99) -
				(AUTHORITY_RANK[b.metadata?.authority ?? "supporting"] ?? 99);
			if (authorityDelta !== 0) {
				return authorityDelta;
			}
			const stalenessDelta =
				(STALENESS_RANK[a.metadata?.stalenessState ?? "unknown"] ?? 99) -
				(STALENESS_RANK[b.metadata?.stalenessState ?? "unknown"] ?? 99);
			if (stalenessDelta !== 0) {
				return stalenessDelta;
			}
			const familyA = a.metadata?.family ?? "";
			const familyB = b.metadata?.family ?? "";
			if (familyA !== familyB) {
				return familyA.localeCompare(familyB);
			}
			return a.path.localeCompare(b.path);
		})
		.slice(0, limit);
}
