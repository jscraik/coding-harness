/**
 * Mutation queue and backoff utilities for mutative GitHub requests.
 *
 * Serializes requests through a single async chain and applies bounded
 * exponential backoff with optional jitter on retryable failures.
 */

export interface MutationQueueOptions {
	/** Initial delay (ms) before first retry. */
	baseDelayMs?: number;
	/** Maximum delay (ms) after backoff growth. */
	maxDelayMs?: number;
	/** Maximum retry attempts, including the initial request. */
	maxAttempts?: number;
	/** Exponential growth factor for each retry. */
	backoffFactor?: number;
	/** Jitter ratio (0..1) applied as ±factor around delay. */
	jitterRatio?: number;
	/** RNG provider for deterministic tests. */
	random?: () => number;
}

export interface MutationAttemptError {
	readonly error: unknown;
	readonly status?: number | undefined;
	readonly retryAfterMs?: number;
}

export const DEFAULT_MUTATION_QUEUE_OPTIONS: Required<MutationQueueOptions> = {
	baseDelayMs: 250,
	maxDelayMs: 30_000,
	maxAttempts: 5,
	backoffFactor: 2,
	jitterRatio: 0.2,
	random: Math.random,
};

/**
 * Calculate the delay (in milliseconds) to wait before the next retry attempt.
 *
 * Computes an exponential backoff from `baseDelayMs` using `backoffFactor` raised to `attempt`,
 * caps the result to `maxDelayMs`, and optionally applies symmetric jitter proportional to `jitterRatio`.
 *
 * @param attempt - Zero-based retry attempt index (0 = first retry after initial failure).
 * @param options - Configuration that may supply `baseDelayMs`, `maxDelayMs`, `maxAttempts`, `backoffFactor`, `jitterRatio`, and a `random` RNG; these are merged with defaults.
 * @returns The computed delay in milliseconds (integer, >= 0). When `jitterRatio` is 0 the value is the truncated capped delay; otherwise a randomized value within ±`jitterRatio` of the capped delay is returned.
 */
export function computeMutationBackoffDelay(
	attempt: number,
	options: MutationQueueOptions,
): number {
	const normalized = { ...DEFAULT_MUTATION_QUEUE_OPTIONS, ...options };
	const exponential =
		normalized.baseDelayMs * normalized.backoffFactor ** attempt;
	const capped = Math.min(exponential, normalized.maxDelayMs);
	if (normalized.jitterRatio === 0) {
		return Math.trunc(capped);
	}

	const span = capped * normalized.jitterRatio;
	const jitter = normalized.random() * span * 2 - span;
	return Math.max(0, Math.round(capped + jitter));
}

/**
 * Determines whether a mutation attempt error should be retried.
 *
 * Considers an error retryable when its numeric `status` is one of
 * 403, 408, 429, 500, 502, 503, or 504, or when the wrapped `Error`
 * message (if present) contains the substrings "econnreset" or "timeout".
 *
 * @param error - The annotated mutation attempt error to evaluate
 * @returns `true` if the error is considered retryable, `false` otherwise
 */
function isRetryableMutationError(error: MutationAttemptError): boolean {
	if (typeof error.status === "number") {
		return [403, 408, 429, 500, 502, 503, 504].includes(error.status);
	}
	if (error.error instanceof Error) {
		const message = error.error.message.toLowerCase();
		return message.includes("econnreset") || message.includes("timeout");
	}
	return false;
}

/**
 * Pauses execution for the specified number of milliseconds.
 *
 * If `ms` is less than or equal to 0 the function returns immediately.
 *
 * @param ms - Time to wait in milliseconds; values <= 0 result in no delay
 */
async function sleep(ms: number): Promise<void> {
	if (ms <= 0) {
		return;
	}
	await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Serialized queue instance for mutative request classes.
 */
export class MutationQueue {
	#chain: Promise<void>;
	private readonly options: Required<MutationQueueOptions>;

	constructor(options: MutationQueueOptions = {}) {
		this.options = { ...DEFAULT_MUTATION_QUEUE_OPTIONS, ...options };
		this.#chain = Promise.resolve();
	}

	/**
	 * Execute a mutative operation under serialization and retry policy.
	 */
	public execute<T>(operation: () => Promise<T>): Promise<T> {
		const next = this.#chain.then(async () => {
			let lastError: unknown;

			for (let attempt = 0; attempt < this.options.maxAttempts; attempt += 1) {
				try {
					return await operation();
				} catch (error) {
					lastError = error;
					const status = (error as { status?: number | undefined }).status;
					const wrapped: MutationAttemptError = {
						error,
						...(status !== undefined ? { status } : {}),
					};

					if (
						!isRetryableMutationError(wrapped) ||
						attempt + 1 >= this.options.maxAttempts
					) {
						throw error;
					}

					const delay = computeMutationBackoffDelay(attempt, this.options);
					await sleep(delay);
				}
			}

			throw lastError;
		});

		this.#chain = next.then(
			() => undefined,
			() => undefined,
		);

		return next;
	}
}

/**
 * Singleton queue shared by GitHub mutation calls.
 */
export const mutationQueue = new MutationQueue();
