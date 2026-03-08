/**
 * Input Validation - Centralized input sanitization and validation
 *
 * Provides validators for CLI arguments to prevent:
 * - Shell/command injection
 * - Path traversal
 * - Buffer overflow (oversized inputs)
 * - Argument injection
 */

import { type CliResult, createError, err, ok } from "../result/types.js";

// ============================================================================
// Constants
// ============================================================================

/** Maximum allowed length for general string inputs */
export const MAX_INPUT_LENGTH = 4096;

/** Maximum allowed length for file paths */
export const MAX_PATH_LENGTH = 4096;

/** Maximum allowed length for git references */
export const MAX_GIT_REF_LENGTH = 255;

/** Maximum allowed length for identifiers (names, IDs) */
export const MAX_IDENTIFIER_LENGTH = 256;

/** Maximum allowed array size */
export const MAX_ARRAY_SIZE = 10000;

// ============================================================================
// Validation Error Types
// ============================================================================

export class InputValidationError extends Error {
	readonly code: string;
	readonly field: string | undefined;

	constructor(code: string, message: string, field?: string) {
		super(message);
		this.name = "InputValidationError";
		this.code = code;
		this.field = field;
	}
}

// ============================================================================
// Shell Injection Prevention
// ============================================================================

/**
 * Dangerous shell characters that could lead to command injection.
 * These characters can be used to break out of command arguments.
 */
const DANGEROUS_SHELL_CHARS = /[;&|`$(){}[\]<>]/;

/**
 * Patterns that indicate potential command substitution attacks.
 */
const COMMAND_SUBSTITUTION_PATTERNS = [
	/\$\([^)]*\)/, // $(command)
	/`[^`]*`/, // `command`
];

/**
 * Validate that input does not contain shell injection patterns.
 *
 * @param value - Input to validate
 * @param field - Field name for error context
 * @returns Result indicating success or validation error
 */
export function validateNoShellInjection(
	value: string,
	field = "input",
): CliResult<string> {
	if (DANGEROUS_SHELL_CHARS.test(value)) {
		return err(
			createError(
				"VALIDATION_ERROR",
				`${field} contains dangerous shell characters`,
				{ field, reason: "shell_injection_detected" },
			),
		);
	}

	for (const pattern of COMMAND_SUBSTITUTION_PATTERNS) {
		if (pattern.test(value)) {
			return err(
				createError(
					"VALIDATION_ERROR",
					`${field} contains potential command substitution`,
					{ field, reason: "command_substitution_detected" },
				),
			);
		}
	}

	return ok(value);
}

/**
 * Validate that input is safe to use as a command argument.
 * More strict than validateNoShellInjection - only allows alphanumeric and safe punctuation.
 *
 * @param value - Input to validate
 * @param field - Field name for error context
 * @returns Result indicating success or validation error
 */
export function validateSafeArgument(
	value: string,
	field = "argument",
): CliResult<string> {
	// Only allow safe characters: alphanumeric, underscore, hyphen, dot, forward slash
	const safePattern = /^[a-zA-Z0-9_./-]+$/;

	if (!safePattern.test(value)) {
		return err(
			createError("VALIDATION_ERROR", `${field} contains invalid characters`, {
				field,
				reason: "invalid_characters",
				allowed: "alphanumeric, underscore, hyphen, dot, forward slash",
			}),
		);
	}

	return ok(value);
}

// ============================================================================
// Length/Size Validation
// ============================================================================

/**
 * Validate string length is within limits.
 *
 * @param value - String to validate
 * @param maxLength - Maximum allowed length
 * @param field - Field name for error context
 * @returns Result indicating success or validation error
 */
export function validateLength(
	value: string,
	maxLength: number,
	field = "input",
): CliResult<string> {
	if (value.length > maxLength) {
		return err(
			createError(
				"VALIDATION_ERROR",
				`${field} exceeds maximum length of ${maxLength} characters`,
				{ field, maxLength, actualLength: value.length },
			),
		);
	}
	return ok(value);
}

/**
 * Validate array size is within limits.
 *
 * @param value - Array to validate
 * @param maxSize - Maximum allowed size
 * @param field - Field name for error context
 * @returns Result indicating success or validation error
 */
export function validateArraySize<T>(
	value: T[],
	maxSize: number,
	field = "array",
): CliResult<T[]> {
	if (value.length > maxSize) {
		return err(
			createError(
				"VALIDATION_ERROR",
				`${field} exceeds maximum size of ${maxSize} elements`,
				{ field, maxSize, actualSize: value.length },
			),
		);
	}
	return ok(value);
}

/**
 * Validate input length and no shell injection.
 * Common combination for general string inputs.
 *
 * @param value - Input to validate
 * @param maxLength - Maximum allowed length (default: MAX_INPUT_LENGTH)
 * @param field - Field name for error context
 * @returns Result indicating success or validation error
 */
export function validateSafeString(
	value: string,
	maxLength = MAX_INPUT_LENGTH,
	field = "input",
): CliResult<string> {
	const lengthResult = validateLength(value, maxLength, field);
	if (!lengthResult.ok) return lengthResult;

	return validateNoShellInjection(value, field);
}

// ============================================================================
// Git Reference Validation
// ============================================================================

/**
 * Pattern for valid git refs (branches, tags, SHAs).
 * Excludes dangerous patterns like path traversal.
 */
const GIT_REF_PATTERN = /^[a-zA-Z0-9._/-]{1,120}$/;

/**
 * Dangerous git ref patterns.
 */
const DANGEROUS_GIT_PATTERNS = [
	/^-/, // Starts with dash (option injection)
	/\.\./, // Contains .. (path traversal)
	/\/\//, // Contains // (directory traversal)
	/\0/, // Contains null byte
];

/**
 * Validate git reference (branch, tag, SHA) is safe.
 *
 * @param ref - Git reference to validate
 * @param field - Field name for error context
 * @returns Result indicating success or validation error
 */
export function validateGitRef(
	ref: string,
	field = "gitRef",
): CliResult<string> {
	// Check length
	const lengthResult = validateLength(ref, MAX_GIT_REF_LENGTH, field);
	if (!lengthResult.ok) return lengthResult;

	// Check for dangerous patterns
	for (const pattern of DANGEROUS_GIT_PATTERNS) {
		if (pattern.test(ref)) {
			return err(
				createError("VALIDATION_ERROR", `${field} contains invalid pattern`, {
					field,
					ref,
					reason: "dangerous_pattern",
				}),
			);
		}
	}

	// Validate against git ref pattern
	if (!GIT_REF_PATTERN.test(ref)) {
		return err(
			createError("VALIDATION_ERROR", `${field} contains invalid characters`, {
				field,
				ref,
				reason: "invalid_characters",
				allowed: "alphanumeric, dot, underscore, hyphen, forward slash",
			}),
		);
	}

	return ok(ref);
}

// ============================================================================
// Identifier Validation
// ============================================================================

/**
 * Pattern for safe identifiers (file names, IDs, keys).
 */
const SAFE_IDENTIFIER_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Validate identifier is safe (no path traversal, no shell injection).
 *
 * @param value - Identifier to validate
 * @param maxLength - Maximum length (default: MAX_IDENTIFIER_LENGTH)
 * @param field - Field name for error context
 * @returns Result indicating success or validation error
 */
export function validateIdentifier(
	value: string,
	maxLength = MAX_IDENTIFIER_LENGTH,
	field = "identifier",
): CliResult<string> {
	const lengthResult = validateLength(value, maxLength, field);
	if (!lengthResult.ok) return lengthResult;

	if (!SAFE_IDENTIFIER_PATTERN.test(value)) {
		return err(
			createError("VALIDATION_ERROR", `${field} contains invalid characters`, {
				field,
				value,
				reason: "invalid_characters",
				allowed: "alphanumeric, underscore, hyphen",
			}),
		);
	}

	return ok(value);
}

// ============================================================================
// Path Component Validation
// ============================================================================

/**
 * Validate a single path component (filename, directory name).
 * Does not allow path separators.
 *
 * @param value - Path component to validate
 * @param maxLength - Maximum length (default: 255)
 * @param field - Field name for error context
 * @returns Result indicating success or validation error
 */
export function validatePathComponent(
	value: string,
	maxLength = 255,
	field = "pathComponent",
): CliResult<string> {
	const lengthResult = validateLength(value, maxLength, field);
	if (!lengthResult.ok) return lengthResult;

	// Check for path separators
	if (value.includes("/") || value.includes("\\")) {
		return err(
			createError(
				"VALIDATION_ERROR",
				`${field} cannot contain path separators`,
				{ field, value },
			),
		);
	}

	// Check for dangerous patterns
	if (value === ".." || value === ".") {
		return err(
			createError(
				"VALIDATION_ERROR",
				`${field} cannot be relative path special`,
				{ field, value },
			),
		);
	}

	// Check for null bytes
	if (value.includes("\0")) {
		return err(
			createError("VALIDATION_ERROR", `${field} cannot contain null bytes`, {
				field,
				value,
			}),
		);
	}

	return ok(value);
}

// ============================================================================
// URL Validation
// ============================================================================

/**
 * Dangerous URL schemes that should not be used.
 */
const DANGEROUS_URL_SCHEMES = ["javascript:", "data:", "vbscript:", "file:"];

/**
 * Validate URL does not contain dangerous schemes.
 *
 * @param url - URL to validate
 * @param field - Field name for error context
 * @returns Result indicating success or validation error
 */
export function validateSafeUrl(url: string, field = "url"): CliResult<string> {
	const lengthResult = validateLength(url, MAX_INPUT_LENGTH, field);
	if (!lengthResult.ok) return lengthResult;

	const lowerUrl = url.toLowerCase();
	for (const scheme of DANGEROUS_URL_SCHEMES) {
		if (lowerUrl.startsWith(scheme)) {
			return err(
				createError("VALIDATION_ERROR", `${field} uses disallowed URL scheme`, {
					field,
					url,
					scheme: scheme.slice(0, -1),
				}),
			);
		}
	}

	return ok(url);
}

// ============================================================================
// Batch Validation Helpers
// ============================================================================

/**
 * Validate all strings in an array.
 *
 * @param values - Array to validate
 * @param validator - Validator function to apply
 * @param field - Field name for error context
 * @returns Result with validated array or error
 */
export function validateArray<T>(
	values: T[],
	validator: (value: T, index: number) => CliResult<T>,
	field = "array",
): CliResult<T[]> {
	const sizeResult = validateArraySize(values, MAX_ARRAY_SIZE, field);
	if (!sizeResult.ok) return sizeResult;

	const validated: T[] = [];
	for (const [index, value] of values.entries()) {
		const result = validator(value, index);
		if (!result.ok) return result;
		validated.push(result.value);
	}
	return ok(validated);
}

// ============================================================================
// Convenience Exports
// ============================================================================

/**
 * Combined validation for common CLI string inputs.
 * Checks length and shell injection.
 */
export function validateCliString(
	value: string,
	options: {
		maxLength?: number;
		field?: string;
		allowShellChars?: boolean;
	} = {},
): CliResult<string> {
	const {
		maxLength = MAX_INPUT_LENGTH,
		field = "input",
		allowShellChars = false,
	} = options;

	const lengthResult = validateLength(value, maxLength, field);
	if (!lengthResult.ok) return lengthResult;

	if (!allowShellChars) {
		const shellResult = validateNoShellInjection(value, field);
		if (!shellResult.ok) return shellResult;
	}

	return ok(value);
}
