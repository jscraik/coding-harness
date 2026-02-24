/**
 * Context Compound - Ollama Client
 *
 * Client for local Ollama embedding API with:
 * - SSRF protection via URL validation
 * - AbortController/timeout handling
 * - Warmup method for cold-start mitigation
 */

import {
	DEFAULT_EMBEDDING_MODEL,
	DEFAULT_OLLAMA_URL,
	DEFAULT_TIMEOUT_MS,
	EMBEDDING_DIMENSIONS,
	HEALTH_CHECK_TIMEOUT_MS,
	MAX_EMBED_TEXT_LENGTH,
	validateOllamaUrl,
} from "./constants.js";
import { type EmbeddingError, type Result, err, ok } from "./types.js";

/**
 * Client for Ollama embedding API.
 */
export class OllamaClient {
	private readonly baseUrl: string;
	private readonly timeoutMs: number;
	private readonly model: string;

	/**
	 * Create a new Ollama client.
	 *
	 * @param options - Configuration options
	 * @throws Error if URL fails SSRF validation
	 */
	constructor(
		options: {
			baseUrl?: string;
			timeoutMs?: number;
			model?: string;
		} = {},
	) {
		const baseUrl = options.baseUrl ?? DEFAULT_OLLAMA_URL;
		// SECURITY: Validate URL to prevent SSRF attacks
		validateOllamaUrl(baseUrl);
		this.baseUrl = baseUrl;
		this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
		this.model = options.model ?? DEFAULT_EMBEDDING_MODEL;
	}

	/**
	 * Check if Ollama is available.
	 *
	 * @returns True if Ollama responds to health check
	 */
	async isAvailable(): Promise<boolean> {
		try {
			const response = await fetch(`${this.baseUrl}/api/tags`, {
				method: "GET",
				signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
			});
			return response.ok;
		} catch {
			return false;
		}
	}

	/**
	 * Warm up the embedding model to reduce cold-start latency.
	 * Call this before bulk indexing operations.
	 */
	async warmup(): Promise<void> {
		try {
			await fetch(`${this.baseUrl}/api/embeddings`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					model: this.model,
					prompt: "warmup",
				}),
				signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
			});
		} catch {
			// Ignore errors during warmup - this is best-effort
		}
	}

	/**
	 * Generate embeddings for text.
	 *
	 * @param text - Text to embed (truncated to MAX_EMBED_TEXT_LENGTH)
	 * @returns Result containing Float32Array embedding or error
	 */
	async embed(text: string): Promise<Result<Float32Array, EmbeddingError>> {
		const abortController = new AbortController();

		// Set up timeout
		const timeoutId = setTimeout(() => {
			abortController.abort();
		}, this.timeoutMs);

		try {
			const response = await fetch(`${this.baseUrl}/api/embeddings`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						model: this.model,
						prompt: text.slice(0, MAX_EMBED_TEXT_LENGTH),
					}),
					signal: abortController.signal,
				});

			clearTimeout(timeoutId);

			if (!response.ok) {
				return err({
					code: "OLLAMA_ERROR",
					message: `HTTP ${response.status}: ${response.statusText}`,
					retryable: response.status >= 500,
				});
			}

			const data = (await response.json()) as { embedding?: number[] };

			if (
				!Array.isArray(data.embedding) ||
				data.embedding.length !== EMBEDDING_DIMENSIONS
			) {
				return err({
					code: "INVALID_RESPONSE",
					message: `Invalid embedding: expected ${EMBEDDING_DIMENSIONS} dimensions, got ${data.embedding?.length}`,
					retryable: false,
				});
			}

			return ok(new Float32Array(data.embedding));
		} catch (error) {
			clearTimeout(timeoutId);

			const isTimeout = error instanceof Error && error.name === "AbortError";

			return err({
				code: isTimeout ? "TIMEOUT" : "NETWORK_ERROR",
				message: error instanceof Error ? error.message : "Unknown error",
				retryable: true,
			});
		}
	}
}
