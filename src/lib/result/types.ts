/**
 * Result Types - Standardized error handling for CLI commands
 *
 * Provides a consistent Result<T, E> pattern across all commands.
 * Use this instead of throwing exceptions for expected error cases.
 */

// ============================================================================
// Core Result Types
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
 *
 * Use discriminated unions: { ok: true, value: T } | { ok: false, error: E }
 *
 * @example
 * ```typescript
 * function mightFail(): Result<string, FileError> {
 *   try {
 *     return ok(readFileSync(path, "utf-8"));
 *   } catch (e) {
 *     return err({ code: "READ_FAILED", message: "Could not read file" });
 *   }
 * }
 *
 * const result = mightFail();
 * if (!result.ok) {
 *   console.error(result.error.message);
 *   process.exit(1);
 * }
 * console.log(result.value);
 * ```
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
// Standard CLI Error Codes
// ============================================================================

/**
 * Standard error codes for CLI commands.
 *
 * These codes should be used consistently across all commands
 * to enable programmatic error handling.
 */
export type CliErrorCode =
	// Validation errors (user input)
	| "VALIDATION_ERROR"
	| "MISSING_REQUIRED_OPTION"
	| "INVALID_FORMAT"
	| "INVALID_VALUE"

	// File system errors
	| "FILE_NOT_FOUND"
	| "PERMISSION_DENIED"
	| "PATH_TRAVERSAL"
	| "READ_ERROR"
	| "WRITE_ERROR"

	// Contract/Configuration errors
	| "CONTRACT_NOT_FOUND"
	| "CONTRACT_INVALID"
	| "PRESET_NOT_FOUND"
	| "CONFIG_ERROR"

	// External service errors
	| "NETWORK_ERROR"
	| "TIMEOUT"
	| "API_ERROR"
	| "AUTHENTICATION_ERROR"

	// Business logic errors
	| "POLICY_VIOLATION"
	| "BUDGET_EXCEEDED"
	| "NOT_FOUND"
	| "ALREADY_EXISTS"
	| "PRECONDITION_FAILED"

	// System errors
	| "SYSTEM_ERROR"
	| "NOT_IMPLEMENTED"
	| "UNKNOWN_ERROR";

/**
 * Standard CLI error structure.
 */
export interface CliError {
	/** Error code for programmatic handling */
	readonly code: CliErrorCode;
	/** Human-readable error message */
	readonly message: string;
	/** Optional additional context */
	readonly details?: unknown | undefined;
	/** Original error if wrapped */
	readonly cause?: Error | undefined;
	/**
	 * Recovery hint for self-healing.
	 * Provides actionable guidance for agents and users.
	 */
	readonly recovery?: string | undefined;
}

/**
 * Convenience type for commands using standard CLI errors.
 */
export type CliResult<T> = Result<T, CliError>;

// ============================================================================
// Standard Exit Codes
// ============================================================================

/**
 * Standard exit codes for CLI commands.
 *
 * @example
 * ```typescript
 * export const EXIT_CODES = {
 *   SUCCESS: 0,
 *   VALIDATION_ERROR: 1,
 *   FILE_NOT_FOUND: 2,
 *   SYSTEM_ERROR: 10,
 * } as const;
 * ```
 */
export interface StandardExitCodes {
	readonly SUCCESS: 0;
	readonly VALIDATION_ERROR: 1;
	readonly FILE_NOT_FOUND: 2;
	readonly PERMISSION_DENIED: 3;
	readonly SYSTEM_ERROR: 10;
}

/**
 * Default exit codes. Commands can extend this.
 */
export const DEFAULT_EXIT_CODES: StandardExitCodes = {
	SUCCESS: 0,
	VALIDATION_ERROR: 1,
	FILE_NOT_FOUND: 2,
	PERMISSION_DENIED: 3,
	SYSTEM_ERROR: 10,
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a standard CLI error.
 */
export function createError(
	code: CliErrorCode,
	message: string,
	details?: unknown,
	cause?: Error,
): CliError {
	return {
		code,
		message,
		...(details !== undefined ? { details } : {}),
		...(cause !== undefined ? { cause } : {}),
	};
}

/**
 * Wrap a synchronous function in a Result.
 *
 * @example
 * ```typescript
 * const result = tryCatch(() => JSON.parse(input));
 * if (!result.ok) {
 *   // Handle parse error
 * }
 * ```
 */
export function tryCatch<T>(fn: () => T): Result<T, CliError> {
	try {
		return ok(fn());
	} catch (error) {
		return err({
			code: "SYSTEM_ERROR",
			message: error instanceof Error ? error.message : "Unknown error",
			...(error instanceof Error ? { cause: error } : {}),
		});
	}
}

/**
 * Wrap an async function in a Result.
 *
 * @example
 * ```typescript
 * const result = await tryCatchAsync(async () => await fetchData());
 * ```
 */
export async function tryCatchAsync<T>(
	fn: () => Promise<T>,
): Promise<Result<T, CliError>> {
	try {
		return ok(await fn());
	} catch (error) {
		return err({
			code: "SYSTEM_ERROR",
			message: error instanceof Error ? error.message : "Unknown error",
			...(error instanceof Error ? { cause: error } : {}),
		});
	}
}

// ============================================================================
// JSON Output Types (Robot-Mode Standard)
// ============================================================================

/**
 * Current JSON output schema version.
 * Increment when making breaking changes to output structure.
 */
export const JSON_OUTPUT_SCHEMA_VERSION = "1.0.0" as const;

/**
 * Base metadata included in all JSON outputs.
 * Enables version-aware consumers and consistent telemetry.
 */
export interface JsonOutputMeta {
	/** Schema version for programmatic detection of breaking changes */
	readonly schemaVersion: typeof JSON_OUTPUT_SCHEMA_VERSION;
	/** Command that produced this output */
	readonly command: string;
	/** ISO timestamp when output was generated */
	readonly generated_at: string;
}

/**
 * Standard JSON output wrapper for successful command results.
 *
 * @example
 * ```typescript
 * const output: JsonOutputSuccess<BlastRadiusData> = {
 *   schemaVersion: "1.0.0",
 *   command: "blast-radius",
 *   generated_at: new Date().toISOString(),
 *   ok: true,
 *   data: { files: [...], checks: [...] },
 *   exitCode: 0
 * };
 * ```
 */
export interface JsonOutputSuccess<T> extends JsonOutputMeta {
	/** Discriminator for success */
	readonly ok: true;
	/** Command-specific output data */
	readonly data: T;
	/** Exit code for this result */
	readonly exitCode: number;
}

/**
 * Standard JSON output wrapper for command errors.
 *
 * @example
 * ```typescript
 * const output: JsonOutputError = {
 *   schemaVersion: "1.0.0",
 *   command: "blast-radius",
 *   generated_at: new Date().toISOString(),
 *   ok: false,
 *   error: {
 *     code: "MISSING_REQUIRED_OPTION",
 *     message: "No files provided",
 *     recovery: "Use --files <paths> to specify files"
 *   },
 *   exitCode: 1
 * };
 * ```
 */
export interface JsonOutputError extends JsonOutputMeta {
	/** Discriminator for error */
	readonly ok: false;
	/** Structured error information */
	readonly error: {
		/** Error code for programmatic handling */
		readonly code: CliErrorCode;
		/** Human-readable error message */
		readonly message: string;
		/** Optional additional context */
		readonly details?: unknown;
		/**
		 * Recovery hint for self-healing.
		 * Provides actionable guidance for agents and users.
		 */
		readonly recovery?: string;
	};
	/** Exit code for this result */
	readonly exitCode: number;
}

/**
 * Union type for all JSON outputs.
 */
export type JsonOutput<T> = JsonOutputSuccess<T> | JsonOutputError;

/**
 * Create a successful JSON output envelope.
 *
 * @param command - Command name that produced this output
 * @param data - Command-specific output data
 * @param exitCode - Exit code (default: 0)
 *
 * @example
 * ```typescript
 * const output = createJsonOutput("blast-radius", {
 *   files: ["src/cli.ts"],
 *   checks: ["test", "lint"]
 * });
 * console.log(JSON.stringify(output, null, 2));
 * ```
 */
export function createJsonOutput<T>(
	command: string,
	data: T,
	exitCode = 0,
): JsonOutputSuccess<T> {
	return {
		schemaVersion: JSON_OUTPUT_SCHEMA_VERSION,
		command,
		generated_at: new Date().toISOString(),
		ok: true,
		data,
		exitCode,
	};
}

/**
 * Create an error JSON output envelope.
 *
 * @param command - Command name that produced this error
 * @param error - CLI error with optional recovery hint
 * @param exitCode - Exit code (default: 1)
 *
 * @example
 * ```typescript
 * const output = createJsonErrorOutput("blast-radius", {
 *   code: "MISSING_REQUIRED_OPTION",
 *   message: "No files provided",
 *   recovery: "Use --files <paths> to specify files"
 * });
 * console.error(JSON.stringify(output, null, 2));
 * ```
 */
export function createJsonErrorOutput(
	command: string,
	error: CliError,
	exitCode = 1,
): JsonOutputError {
	return {
		schemaVersion: JSON_OUTPUT_SCHEMA_VERSION,
		command,
		generated_at: new Date().toISOString(),
		ok: false,
		error: {
			code: error.code,
			message: error.message,
			...(error.details !== undefined ? { details: error.details } : {}),
			...(error.recovery !== undefined ? { recovery: error.recovery } : {}),
		},
		exitCode,
	};
}

/**
 * Convert a Result to a JSON output envelope.
 *
 * @param command - Command name
 * @param result - Result from a command execution
 * @param options - Exit code mappings
 *
 * @example
 * ```typescript
 * const result = runBlastRadius(options);
 * const jsonOutput = resultToJsonOutput("blast-radius", result, {
 *   successCode: 0,
 *   errorCode: 2
 * });
 * console.log(JSON.stringify(jsonOutput, null, 2));
 * ```
 */
export function resultToJsonOutput<T>(
	command: string,
	result: Result<T, CliError>,
	options?: {
		successCode?: number;
		errorCode?: number;
	},
): JsonOutput<T> {
	if (result.ok) {
		return createJsonOutput(command, result.value, options?.successCode ?? 0);
	}
	return createJsonErrorOutput(command, result.error, options?.errorCode ?? 1);
}

/**
 * Unwrap a Result or throw if error.
 * Use sparingly - prefer explicit error handling.
 */
export function unwrap<T>(result: Result<T, CliError>): T {
	if (!result.ok) {
		throw new Error(result.error.message);
	}
	return result.value;
}

/**
 * Map a successful Result value.
 */
export function map<T, U, E>(
	result: Result<T, E>,
	fn: (value: T) => U,
): Result<U, E> {
	if (!result.ok) {
		return result;
	}
	return ok(fn(result.value));
}

/**
 * Map an error Result.
 */
export function mapError<T, E, F>(
	result: Result<T, E>,
	fn: (error: E) => F,
): Result<T, F> {
	if (result.ok) {
		return result;
	}
	return err(fn(result.error));
}

/**
 * Flatten a nested Result.
 */
export function flatten<T, E>(result: Result<Result<T, E>, E>): Result<T, E> {
	if (!result.ok) {
		return result;
	}
	return result.value;
}

/**
 * Chain operations that return Results.
 */
export function flatMap<T, U, E>(
	result: Result<T, E>,
	fn: (value: T) => Result<U, E>,
): Result<U, E> {
	if (!result.ok) {
		return result;
	}
	return fn(result.value);
}

/**
 * Get the value or a default.
 */
export function getOrElse<T, E>(result: Result<T, E>, defaultValue: T): T {
	return result.ok ? result.value : defaultValue;
}

/**
 * Match on both cases of a Result.
 */
export function match<T, E, U>(
	result: Result<T, E>,
	handlers: {
		onOk: (value: T) => U;
		onErr: (error: E) => U;
	},
): U {
	if (result.ok) {
		return handlers.onOk(result.value);
	}
	return handlers.onErr(result.error);
}
