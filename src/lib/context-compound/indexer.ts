/**
 * Context Compound - Indexer
 *
 * File indexing pipeline with:
 * - Content hashing for duplicate detection
 * - File size limits
 * - Concurrent indexing with semaphore
 * - Frontmatter parsing for metadata
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { MAX_FILE_SIZE_BYTES } from "./constants.js";
import type { OllamaClient } from "./ollama.js";
import type { VectorStore } from "./store.js";
import {
	type DocumentMetadata,
	type EmbeddingRecord,
	type IndexerError,
	type Result,
	err,
	ok,
} from "./types.js";

/**
 * Options for indexing a file.
 */
export interface IndexOptions {
	/** File path to index */
	filepath: string;
	/** Document type */
	type: "brainstorm" | "plan" | "solution";
	/** Base directory for relative paths */
	basePath?: string | undefined;
}

/**
 * Result of indexing a file.
 */
export interface IndexResult {
	/** Whether the file was indexed (false if skipped due to unchanged content) */
	indexed: boolean;
	/** Path that was processed */
	path: string;
	/** Error if indexing failed */
	error?: IndexerError;
}

/**
 * Parse YAML frontmatter from markdown content.
 * Returns frontmatter object and body content.
 */
function parseFrontmatter(content: string): {
	frontmatter: Record<string, unknown>;
	body: string;
} {
	const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
	if (!match) {
		return { frontmatter: {}, body: content };
	}

	const frontmatter: Record<string, unknown> = {};
	const contentCapture = match[1];
	if (!contentCapture) {
		return { frontmatter: {}, body: content };
	}

	const lines = contentCapture.split("\n");
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

/**
 * Compute SHA-256 hash of content.
 */
function computeHash(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}

/**
 * Check if file is within size limits.
 */
function validateFileSize(filepath: string): Result<void, IndexerError> {
	try {
		const stats = statSync(filepath);
		if (stats.size > MAX_FILE_SIZE_BYTES) {
			return err({
				code: "FILE_TOO_LARGE",
				message: `File size ${stats.size} exceeds maximum ${MAX_FILE_SIZE_BYTES}`,
				path: filepath,
			});
		}
		return ok(undefined);
	} catch (error) {
		return err({
			code: "READ_FAILED",
			message: `Cannot stat file: ${error instanceof Error ? error.message : "Unknown error"}`,
			path: filepath,
		});
	}
}

/**
 * Index a single file.
 *
 * @param options - Index options
 * @param ollama - Ollama client for embeddings
 * @param store - Vector store for persistence
 * @returns Index result
 */
export async function indexFile(
	options: IndexOptions,
	ollama: OllamaClient,
	store: VectorStore,
): Promise<IndexResult> {
	const { filepath, type, basePath = process.cwd() } = options;

	// Validate file exists
	if (!existsSync(filepath)) {
		return {
			indexed: false,
			path: filepath,
			error: {
				code: "READ_FAILED",
				message: "File not found",
				path: filepath,
			},
		};
	}

	// Check file size
	const sizeResult = validateFileSize(filepath);
	if (!sizeResult.ok) {
		return { indexed: false, path: filepath, error: sizeResult.error };
	}

	// Read file
	let content: string;
	try {
		content = readFileSync(filepath, "utf-8");
	} catch (error) {
		return {
			indexed: false,
			path: filepath,
			error: {
				code: "READ_FAILED",
				message: error instanceof Error ? error.message : "Unknown error",
				path: filepath,
			},
		};
	}

	// Compute content hash
	const contentHash = computeHash(content);

	// Check if already indexed with same hash
	const relativePath = filepath.replace(basePath, "").replace(/^\//, "");
	const existingHash = store.getContentHash(relativePath);
	if (existingHash === contentHash) {
		return { indexed: false, path: filepath }; // Skip: unchanged
	}

	// Parse frontmatter
	const { frontmatter, body } = parseFrontmatter(content);

	// Build metadata
	const today = new Date().toISOString().split("T")[0] ?? "2026-01-01";
	const metadata: DocumentMetadata = {
		type,
		topic:
			(frontmatter.topic as string) ||
			(frontmatter.title as string) ||
			basename(filepath),
		date: (frontmatter.date as string) || today,
		status: (frontmatter.status as string) || undefined,
	};

	// Generate embedding from content (frontmatter + body)
	const textToEmbed = `${metadata.topic}\n\n${body}`;
	const embedResult = await ollama.embed(textToEmbed);

	if (!embedResult.ok) {
		return {
			indexed: false,
			path: filepath,
			error: {
				code: "EMBED_FAILED",
				message: embedResult.error.message,
				path: filepath,
			},
		};
	}

	// Create record
	const record: EmbeddingRecord = {
		path: relativePath,
		contentHash,
		embedding: embedResult.value,
		metadata,
		indexedAt: new Date(),
	};

	// Store in database
	const insertResult = store.insert(record);
	if (!insertResult.ok) {
		return {
			indexed: false,
			path: filepath,
			error: {
				code: "EMBED_FAILED",
				message: insertResult.error.message,
				path: filepath,
			},
		};
	}

	return { indexed: true, path: filepath };
}

/**
 * Index multiple files with concurrency control.
 *
 * @param files - Files to index
 * @param ollama - Ollama client
 * @param store - Vector store
 * @param options - Batch options
 * @returns Results for all files
 */
export async function indexBatch(
	files: IndexOptions[],
	ollama: OllamaClient,
	store: VectorStore,
	options: {
		concurrency?: number;
		onProgress?: (result: IndexResult) => void;
	} = {},
): Promise<IndexResult[]> {
	const { concurrency = 3, onProgress } = options;
	const results: IndexResult[] = [];

	// Process in chunks for concurrency control (simple semaphore)
	for (let i = 0; i < files.length; i += concurrency) {
		const chunk = files.slice(i, i + concurrency);
		const chunkResults = await Promise.all(
			chunk.map((file) => indexFile(file, ollama, store)),
		);

		for (const result of chunkResults) {
			results.push(result);
			onProgress?.(result);
		}
	}

	return results;
}

/**
 * Create an index options entry for a brainstorm file.
 */
export function brainstormIndexOptions(
	filepath: string,
	basePath?: string,
): IndexOptions {
	return { filepath, type: "brainstorm", basePath };
}

/**
 * Create an index options entry for a plan file.
 */
export function planIndexOptions(
	filepath: string,
	basePath?: string,
): IndexOptions {
	return { filepath, type: "plan", basePath };
}
