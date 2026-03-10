/**
 * Contract Inheritance Error Types
 *
 * Custom error classes for the preset inheritance system with
 * specific error types for different failure modes.
 *
 * All errors include a `code` property for programmatic handling via
 * discriminated unions (e.g., switch statements on error.code).
 */

/**
 * Error codes for preset-related errors.
 * Used for programmatic error handling and discriminated unions.
 */
export type PresetErrorCode =
	| "PRESET_FETCH_ERROR"
	| "CIRCULAR_INHERITANCE"
	| "INTEGRITY_ERROR"
	| "URL_VALIDATION_ERROR"
	| "MERGE_ERROR"
	| "MAX_DEPTH_EXCEEDED";

/**
 * Error thrown when a preset cannot be fetched from a remote or local source.
 */
export class PresetFetchError extends Error {
	/** Discriminator code for programmatic error handling */
	readonly code = "PRESET_FETCH_ERROR" as const;

	constructor(
		public readonly source: string,
		message: string,
		public readonly cause?: Error,
	) {
		super(`Failed to fetch preset from ${source}: ${message}`);
		this.name = "PresetFetchError";
	}
}

/**
 * Error thrown when circular inheritance is detected in preset chain.
 */
export class CircularInheritanceError extends Error {
	/** Discriminator code for programmatic error handling */
	readonly code = "CIRCULAR_INHERITANCE" as const;

	constructor(public readonly chain: string[]) {
		super(`Circular preset inheritance detected: ${chain.join(" -> ")}`);
		this.name = "CircularInheritanceError";
	}
}

/**
 * Error thrown when SRI integrity check fails for a remote preset.
 */
export class IntegrityError extends Error {
	/** Discriminator code for programmatic error handling */
	readonly code = "INTEGRITY_ERROR" as const;

	constructor(
		public readonly url: string,
		public readonly expected: string,
		public readonly actual: string,
	) {
		super(
			`Integrity mismatch for ${url}. Expected ${expected}, got ${actual}. Possible supply chain attack.`,
		);
		this.name = "IntegrityError";
	}
}

/**
 * Error codes for URL validation failures.
 */
export type UrlValidationErrorCode =
	| "PROTOCOL_NOT_ALLOWED"
	| "HOST_NOT_ALLOWED"
	| "PRIVATE_IP_BLOCKED"
	| "INVALID_URL"
	| "REDIRECT_NOT_ALLOWED"
	| "DNS_LOOKUP_FAILED";

/**
 * Error thrown when a URL fails validation (SSRF protection).
 */
export class UrlValidationError extends Error {
	/** Discriminator code for programmatic error handling */
	readonly code: UrlValidationErrorCode;

	constructor(message: string, code: UrlValidationErrorCode) {
		super(message);
		this.name = "UrlValidationError";
		this.code = code;
	}
}

/**
 * Error thrown when a dangerous key is detected during merge.
 */
export class MergeError extends Error {
	/** Discriminator code for programmatic error handling */
	readonly code = "MERGE_ERROR" as const;

	constructor(
		message: string,
		public readonly key: string,
	) {
		super(message);
		this.name = "MergeError";
	}
}

/**
 * Error thrown when max inheritance depth is exceeded.
 */
export class MaxDepthExceededError extends Error {
	/** Discriminator code for programmatic error handling */
	readonly code = "MAX_DEPTH_EXCEEDED" as const;

	constructor(
		public readonly depth: number,
		public readonly maxDepth: number,
	) {
		super(
			`Inheritance depth ${depth} exceeds maximum ${maxDepth}. Possible circular reference.`,
		);
		this.name = "MaxDepthExceededError";
	}
}

/**
 * Type union of all preset-related errors for discriminated union handling.
 *
 * Example usage:
 * ```typescript
 * try {
 *   await loadContractWithInheritance(path);
 * } catch (error) {
 *   if (error instanceof PresetError) {
 *     switch (error.code) {
 *       case "PRESET_FETCH_ERROR":
 *         // Handle fetch error
 *         break;
 *       case "CIRCULAR_INHERITANCE":
 *         // Handle circular reference
 *         break;
 *       // ... etc
 *     }
 *   }
 * }
 * ```
 */
export type PresetError =
	| PresetFetchError
	| CircularInheritanceError
	| IntegrityError
	| UrlValidationError
	| MergeError
	| MaxDepthExceededError;

/**
 * Check if an error is a known preset-related error.
 */
export function isPresetError(error: unknown): error is PresetError {
	return (
		error instanceof Error &&
		"code" in error &&
		typeof (error as PresetError).code === "string"
	);
}
