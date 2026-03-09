/**
 * Context Compound - Constants
 *
 * All magic numbers, defaults, and validation helpers in one place.
 */

// Ollama Configuration
export const DEFAULT_OLLAMA_PORT = 11434;
export const DEFAULT_OLLAMA_URL = `http://localhost:${DEFAULT_OLLAMA_PORT}`;
export const DEFAULT_EMBEDDING_MODEL = "bge-m3";
export const EMBEDDING_DIMENSIONS = 1024;
export const MAX_EMBED_TEXT_LENGTH = 8192;

// Timeouts
export const DEFAULT_TIMEOUT_MS = 30000;
export const HEALTH_CHECK_TIMEOUT_MS = 5000;

// Search Configuration
export const DEFAULT_SIMILARITY_THRESHOLD = 0.7;
export const DEFAULT_SEARCH_LIMIT = 10;

// Security - Allowed Ollama hosts (SSRF protection)
export const ALLOWED_OLLAMA_HOSTS = ["localhost", "127.0.0.1", "::1"];

// File System Limits
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// Database Permissions
export const DB_FILE_PERMISSIONS = 0o600; // Owner read/write only

// Paths
export const DEFAULT_HARNESS_DIR = ".harness";
export const DEFAULT_DB_FILENAME = "context-compound.db";
export const DEFAULT_LEXICAL_INDEX_FILENAME = "context-lexical-index.json";

/**
 * Validate Ollama URL to prevent SSRF attacks.
 * Only allows localhost and loopback addresses.
 */
export function validateOllamaUrl(url: string): void {
	const parsed = new URL(url);
	if (!["http:", "https:"].includes(parsed.protocol)) {
		throw new Error(`Invalid protocol: ${parsed.protocol}`);
	}
	// Normalize hostname: strip brackets from IPv6 addresses
	const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
	if (!ALLOWED_OLLAMA_HOSTS.includes(hostname)) {
		throw new Error(`Ollama URL must be localhost, got: ${parsed.hostname}`);
	}
}

/**
 * Convert similarity score to distance for sqlite-vec.
 * sqlite-vec cosine distance = 1 - similarity
 */
export function similarityToDistance(similarity: number): number {
	return 1 - similarity;
}

/**
 * Convert distance back to similarity score.
 */
export function distanceToSimilarity(distance: number): number {
	return 1 - distance;
}
