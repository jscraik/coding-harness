import { readFileSync, statSync } from "node:fs";
import { realpathSync } from "node:fs";
import { dirname, normalize, resolve, sep } from "node:path";
import type {
	EvidenceCheckResult,
	EvidenceError,
	EvidenceErrorCode,
	EvidenceFile,
	EvidenceResult,
	ImageFormat,
} from "./types.js";
import {
	DEFAULT_MAX_FILE_SIZE_BYTES,
	JPEG_MAGIC_BYTES,
	PNG_MAGIC_BYTES,
} from "./types.js";

/**
 * Error thrown when path traversal is detected.
 */
export class PathTraversalError extends Error {
	constructor() {
		super("Path traversal detected");
		this.name = "PathTraversalError";
	}
}

/**
 * Assert that a candidate path is within the base directory.
 * Prevents sibling-prefix attacks (e.g., `/base-evil/...` passing `startsWith("/base")`).
 */
function assertWithinBase(realBase: string, candidateRealPath: string): void {
	const basePrefix = realBase.endsWith(sep) ? realBase : realBase + sep;
	if (
		candidateRealPath !== realBase &&
		!candidateRealPath.startsWith(basePrefix)
	) {
		throw new PathTraversalError();
	}
}

/**
 * Validate that a user-provided path stays within the base directory.
 * Handles symlink attacks by canonicalizing the resolved path.
 *
 * @param baseDir - The base directory to constrain paths to
 * @param userPath - User-provided path to validate
 * @returns The resolved, validated path
 * @throws PathTraversalError if path escapes base directory
 */
export function validatePath(baseDir: string, userPath: string): string {
	const resolved = resolve(baseDir, normalize(userPath));
	const realBase = realpathSync(baseDir);

	// CRITICAL: Canonicalize resolved path BEFORE comparison
	let realResolved: string;
	try {
		realResolved = realpathSync(resolved);
	} catch {
		// Path doesn't exist - validate parent directory
		const parentDir = dirname(resolved);
		try {
			const realParent = realpathSync(parentDir);
			assertWithinBase(realBase, realParent);
		} catch {
			throw new PathTraversalError();
		}
		return resolved;
	}

	assertWithinBase(realBase, realResolved);
	return realResolved;
}

/**
 * Detect image format from magic bytes.
 *
 * @param buffer - Buffer containing file data (at least 8 bytes)
 * @returns Detected format or null if unrecognized
 */
export function detectImageFormat(buffer: Buffer): ImageFormat | null {
	if (buffer.length < 8) {
		return null;
	}

	// Check PNG signature (first 4 bytes)
	if (buffer.subarray(0, 4).equals(PNG_MAGIC_BYTES)) {
		return "png";
	}

	// Check JPEG signature (first 3 bytes)
	if (buffer.subarray(0, 3).equals(JPEG_MAGIC_BYTES)) {
		return "jpeg";
	}

	return null;
}

/**
 * Create a structured evidence error.
 */
export function createEvidenceError(
	code: EvidenceErrorCode,
	message: string,
	path: string,
): EvidenceError {
	return { ok: false, code, message, path };
}

/**
 * Load and validate an evidence file.
 *
 * Performs:
 * 1. Path traversal protection
 * 2. File existence check
 * 3. File size validation
 * 4. Image format validation via magic bytes
 *
 * @param filePath - Path to the evidence file
 * @param baseDir - Base directory to constrain paths to (defaults to cwd)
 * @param maxFileSizeBytes - Maximum allowed file size (defaults to 1MB)
 * @returns EvidenceResult with file metadata or error
 */
export function loadEvidenceFile(
	filePath: string,
	baseDir: string = process.cwd(),
	maxFileSizeBytes: number = DEFAULT_MAX_FILE_SIZE_BYTES,
): EvidenceResult {
	// 1. Validate path stays within base directory
	let validatedPath: string;
	try {
		validatedPath = validatePath(baseDir, filePath);
	} catch {
		return createEvidenceError(
			"PATH_TRAVERSAL",
			"Path escapes base directory",
			filePath,
		);
	}

	// 2. Check file exists and get stats
	let stats: { size: number };
	try {
		stats = statSync(validatedPath);
	} catch {
		return createEvidenceError(
			"FILE_NOT_FOUND",
			`Evidence file not found: ${filePath}`,
			filePath,
		);
	}

	// 3. Validate file size
	if (stats.size > maxFileSizeBytes) {
		return createEvidenceError(
			"FILE_TOO_LARGE",
			`Evidence file exceeds ${maxFileSizeBytes} bytes: ${filePath} (${stats.size} bytes)`,
			filePath,
		);
	}

	// 4. Read file and validate format
	let buffer: Buffer;
	try {
		buffer = readFileSync(validatedPath);
	} catch {
		return createEvidenceError(
			"READ_ERROR",
			`Failed to read evidence file: ${filePath}`,
			filePath,
		);
	}

	const format = detectImageFormat(buffer);
	if (!format) {
		return createEvidenceError(
			"INVALID_FORMAT",
			`Invalid image format (expected PNG or JPEG): ${filePath}`,
			filePath,
		);
	}

	// Success - return validated file metadata
	const evidenceFile: EvidenceFile = {
		path: validatedPath,
		type: format,
		sizeBytes: stats.size,
	};

	const result: EvidenceCheckResult = {
		ok: true,
		file: evidenceFile,
	};

	return result;
}
