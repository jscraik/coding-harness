/**
 * Context Compound - Public API
 *
 * Main exports for the Context Compound semantic memory system.
 */

export { OllamaClient } from "./ollama.js";
export { VectorStore } from "./store.js";
export {
	ok,
	err,
	type ContextCompoundConfig,
	type DocumentMetadata,
	type EmbeddingError,
	type EmbeddingRecord,
	type Err,
	type IndexerError,
	type IndexStats,
	type Ok,
	type Result,
	type RetrieveOptions,
	type SearchResult,
	type StoreError,
} from "./types.js";
export {
	brainstormIndexOptions,
	indexBatch,
	indexFile,
	planIndexOptions,
	type IndexOptions,
	type IndexResult,
} from "./indexer.js";
export {
	ALLOWED_OLLAMA_HOSTS,
	DEFAULT_EMBEDDING_MODEL,
	DEFAULT_HARNESS_DIR,
	DEFAULT_OLLAMA_URL,
	DEFAULT_SEARCH_LIMIT,
	DEFAULT_SIMILARITY_THRESHOLD,
	DEFAULT_TIMEOUT_MS,
	EMBEDDING_DIMENSIONS,
	HEALTH_CHECK_TIMEOUT_MS,
	MAX_EMBED_TEXT_LENGTH,
	MAX_FILE_SIZE_BYTES,
	distanceToSimilarity,
	similarityToDistance,
	validateOllamaUrl,
} from "./constants.js";
