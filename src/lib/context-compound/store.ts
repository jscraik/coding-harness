/**
 * Context Compound - Vector Store
 *
 * SQLite/vec storage with parameterized queries and WAL mode.
 */

import { chmodSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import {
	DB_FILE_PERMISSIONS,
	DEFAULT_SEARCH_LIMIT,
	DEFAULT_SIMILARITY_THRESHOLD,
	EMBEDDING_DIMENSIONS,
	distanceToSimilarity,
	similarityToDistance,
} from "./constants.js";
import {
	type Result,
	type SearchResult,
	type StoreError,
	err,
	ok,
} from "./types.js";
import type { DocumentMetadata, EmbeddingRecord } from "./types.js";

/**
 * Vector store using sqlite-vec for similarity search.
 */
export class VectorStore {
	private db: Database.Database | null = null;

	/**
	 * @param dbPath - Path to SQLite database file
	 */
	constructor(private readonly dbPath: string) {}

	/**
	 * Initialize the database with schema.
	 *
	 * @returns Result indicating success or failure
	 */
	init(): Result<void, StoreError> {
		try {
			// Ensure directory exists
			const dir = dirname(this.dbPath);
			mkdirSync(dir, { recursive: true });

			// Open database
			this.db = new Database(this.dbPath);

			// Enable WAL mode for concurrent access
			this.db.pragma("journal_mode = WAL");

			// Load sqlite-vec extension
			sqliteVec.load(this.db);

			// Create tables
			this.db.exec(`
        CREATE TABLE IF NOT EXISTS documents (
          path TEXT PRIMARY KEY,
          content_hash TEXT NOT NULL,
          type TEXT NOT NULL,
          topic TEXT,
          date TEXT NOT NULL,
          indexed_at TEXT NOT NULL
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS vec_documents USING vec0(
          path TEXT PRIMARY KEY,
          embedding float[${EMBEDDING_DIMENSIONS}] distance_metric=cosine
        );

        CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
        CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(date);
      `);

			// Set restrictive permissions
			try {
				chmodSync(this.dbPath, DB_FILE_PERMISSIONS);
			} catch {
				// Non-critical: continue even if chmod fails
			}

			return ok(undefined);
		} catch (error) {
			return err({
				code: "DB_ERROR",
				message: `Failed to initialize: ${error instanceof Error ? error.message : "Unknown error"}`,
			});
		}
	}

	/**
	 * Insert or replace an embedding record.
	 *
	 * @param record - The embedding record to store
	 * @returns Result indicating success or failure
	 */
	insert(record: EmbeddingRecord): Result<void, StoreError> {
		if (!this.db) {
			return err({
				code: "NOT_INITIALIZED",
				message: "Database not initialized",
			});
		}

		const db = this.db; // Capture for transaction closure
		const insert = db.transaction(() => {
			// Insert metadata
			db.prepare(
				`
          INSERT OR REPLACE INTO documents (path, content_hash, type, topic, date, indexed_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
			).run(
				record.path,
				record.contentHash,
				record.metadata.type,
				record.metadata.topic,
				record.metadata.date,
				record.indexedAt.toISOString(),
			);

			// Insert embedding
			db.prepare(
				`
          INSERT OR REPLACE INTO vec_documents (path, embedding)
          VALUES (?, ?)
        `,
			).run(record.path, record.embedding);
		});

		try {
			insert();
			return ok(undefined);
		} catch (error) {
			return err({
				code: "DB_ERROR",
				message: `Insert failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			});
		}
	}

	/**
	 * Search for similar embeddings.
	 *
	 * @param queryEmbedding - The query embedding vector
	 * @param options - Search options (limit, threshold)
	 * @returns Result containing search results or error
	 */
	search(
		queryEmbedding: Float32Array,
		options: {
			limit?: number;
			threshold?: number;
			includeMetadata?: boolean;
		} = {},
	): Result<SearchResult[], StoreError> {
		if (!this.db) {
			return err({
				code: "NOT_INITIALIZED",
				message: "Database not initialized",
			});
		}

		const {
			limit = DEFAULT_SEARCH_LIMIT,
			threshold = DEFAULT_SIMILARITY_THRESHOLD,
			includeMetadata = false,
		} = options;

		// Convert similarity threshold to distance
		const maxDistance = similarityToDistance(threshold);

		try {
			const stmt = this.db.prepare(`
        SELECT v.path, v.distance
        FROM vec_documents v
        WHERE v.embedding MATCH ? AND v.distance <= ?
        ORDER BY v.distance
        LIMIT ?
      `);

			const rows = stmt.all(queryEmbedding, maxDistance, limit) as Array<{
				path: string;
				distance: number;
			}>;

			const results: SearchResult[] = rows.map((row) => ({
				path: row.path,
				similarity: distanceToSimilarity(row.distance),
			}));

			// Fetch metadata if requested
			if (includeMetadata && results.length > 0) {
				const paths = results.map((r) => r.path);
				const placeholders = paths.map(() => "?").join(",");
				const metaStmt = this.db.prepare(
					`SELECT path, type, topic, date FROM documents WHERE path IN (${placeholders})`,
				);
				const metaRows = metaStmt.all(...paths) as Array<{
					path: string;
					type: string;
					topic: string;
					date: string;
				}>;

				const metaMap = new Map(metaRows.map((m) => [m.path, m]));

				return ok(
					results.map((r) => {
						const meta = metaMap.get(r.path);
						if (meta) {
							return {
								...r,
								metadata: {
									type: meta.type as DocumentMetadata["type"],
									topic: meta.topic,
									date: meta.date,
								},
							};
						}
						return r;
					}),
				);
			}

			return ok(results);
		} catch (error) {
			return err({
				code: "DB_ERROR",
				message: `Search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			});
		}
	}

	/**
	 * Check if a document exists and get its content hash.
	 *
	 * @param path - Document path
	 * @returns Content hash if exists, null otherwise
	 */
	getContentHash(path: string): string | null {
		if (!this.db) return null;

		try {
			const stmt = this.db.prepare(
				"SELECT content_hash FROM documents WHERE path = ?",
			);
			const row = stmt.get(path) as { content_hash: string } | undefined;
			return row?.content_hash ?? null;
		} catch {
			return null;
		}
	}

	/**
	 * Get indexing statistics.
	 *
	 * @returns Statistics about indexed documents
	 */
	getStats(): {
		totalDocuments: number;
		documentTypes: Record<string, number>;
	} {
		if (!this.db) {
			return { totalDocuments: 0, documentTypes: {} };
		}

		try {
			const countStmt = this.db.prepare(
				"SELECT COUNT(*) as count FROM documents",
			);
			const countRow = countStmt.get() as { count: number };

			const typeStmt = this.db.prepare(
				"SELECT type, COUNT(*) as count FROM documents GROUP BY type",
			);
			const typeRows = typeStmt.all() as Array<{
				type: string;
				count: number;
			}>;

			const documentTypes: Record<string, number> = {};
			for (const row of typeRows) {
				documentTypes[row.type] = row.count;
			}

			return {
				totalDocuments: countRow.count,
				documentTypes,
			};
		} catch {
			return { totalDocuments: 0, documentTypes: {} };
		}
	}

	/**
	 * Close the database connection.
	 */
	close(): void {
		this.db?.close();
		this.db = null;
	}
}
