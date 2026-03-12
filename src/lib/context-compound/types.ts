/**
 * Context Compound - Types
 *
 * All type definitions (no implementation).
 */

// ============================================================================
// Result Type Pattern
// ============================================================================

/**
 * Success variant of Result.
 */
export interface Ok<T> {
	readonly ok: true;
	readonly value: T;
}

/**
 * Failure variant of Result.
 */
export interface Err<E> {
	readonly ok: false;
	readonly error: E;
}

/**
 * Result type for explicit error handling.
 * Use discriminated unions: { ok: true, value: T } | { ok: false, error: E }
 */
export type Result<T, E> = Ok<T> | Err<E>;

/**
 * Helper to create an Ok result.
 */
export function ok<T>(value: T): Ok<T> {
	return { ok: true, value };
}

/**
 * Helper to create an Err result.
 */
export function err<E>(error: E): Err<E> {
	return { ok: false, error };
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error codes for Ollama client operations.
 */
export type OllamaErrorCode =
	| "OLLAMA_ERROR"
	| "NETWORK_ERROR"
	| "TIMEOUT"
	| "INVALID_RESPONSE"
	| "SSRF_VIOLATION";

/**
 * Error details from Ollama client.
 */
export interface EmbeddingError {
	readonly code: OllamaErrorCode;
	readonly message: string;
	readonly retryable: boolean;
}

/**
 * Error codes for store operations.
 */
export type StoreErrorCode =
	| "DB_ERROR"
	| "NOT_INITIALIZED"
	| "INSERT_FAILED"
	| "SEARCH_FAILED";

/**
 * Error details from vector store.
 */
export interface StoreError {
	readonly code: StoreErrorCode;
	readonly message: string;
}

/**
 * Error codes for indexing operations.
 */
export type IndexerErrorCode =
	| "FILE_TOO_LARGE"
	| "READ_FAILED"
	| "PARSE_FAILED"
	| "EMBED_FAILED";

/**
 * Error details from indexer.
 */
export interface IndexerError {
	readonly code: IndexerErrorCode;
	readonly message: string;
	readonly path: string;
}

// ============================================================================
// Domain Types
// ============================================================================

/**
 * Metadata for an indexed document.
 */
export interface DocumentMetadata {
	readonly type: "brainstorm" | "plan" | "solution" | "reference";
	readonly topic: string;
	readonly date: string;
	readonly status?: string | undefined;
	readonly authority?: "canonical" | "governed" | "supporting" | undefined;
	readonly family?: string | undefined;
	readonly stalenessState?: "fresh" | "unknown" | "stale" | undefined;
}

/**
 * Record stored in the vector database.
 */
export interface EmbeddingRecord {
	readonly path: string;
	readonly contentHash: string;
	readonly embedding: Float32Array;
	readonly metadata: DocumentMetadata;
	readonly indexedAt: Date;
}

/**
 * Result from a similarity search.
 */
export interface SearchResult {
	readonly path: string;
	readonly similarity: number;
	readonly metadata?: DocumentMetadata;
}

/**
 * Options for retrieving context.
 */
export interface RetrieveOptions {
	readonly limit?: number;
	readonly threshold?: number;
	readonly includeMetadata?: boolean;
}

/**
 * Configuration for ContextCompound.
 */
export interface ContextCompoundConfig {
	readonly ollamaUrl?: string;
	readonly model?: string;
	readonly dbPath?: string;
	readonly harnessDir?: string;
}

/**
 * Statistics about indexed documents.
 */
export interface IndexStats {
	readonly totalDocuments: number;
	readonly lastIndexedAt?: Date;
	readonly documentTypes: Record<string, number>;
}
