import { closeSync, openSync, readSync, statSync } from "node:fs";
import { realpathSync } from "node:fs";
import { dirname, normalize, resolve, sep } from "node:path";
import type {
	EvidenceCheckResult,
	EvidenceError,
	EvidenceErrorCode,
	EvidenceFile,
	EvidenceFormat,
	EvidenceResult,
	ImageFormat,
	VideoFormat,
} from "./types.js";
import {
	DEFAULT_MAX_FILE_SIZE_BYTES,
	DEFAULT_MAX_VIDEO_SIZE_BYTES,
	JPEG_MAGIC_BYTES,
	MP4_MAGIC_BYTES,
	PNG_MAGIC_BYTES,
	WEBM_MAGIC_BYTES,
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
 * Resolve the nearest existing ancestor for a path.
 * Walks up until an existing segment can be canonicalized.
 */
function resolveNearestExistingAncestor(path: string): string {
	let current = path;

	while (true) {
		try {
			return realpathSync(current);
		} catch {
			const parent = dirname(current);
			if (parent === current) {
				throw new PathTraversalError();
			}
			current = parent;
		}
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
		// Path doesn't exist - validate nearest existing ancestor directory
		try {
			const realAncestor = resolveNearestExistingAncestor(resolved);
			assertWithinBase(realBase, realAncestor);
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
 * Detect video format from magic bytes.
 *
 * @param buffer - Buffer containing file data (at least 8 bytes)
 * @returns Detected format or null if unrecognized
 */
export function detectVideoFormat(buffer: Buffer): VideoFormat | null {
	if (buffer.length < 8) {
		return null;
	}

	// Check MP4: look for 'ftyp' at offset 4
	// MP4 files start with: [size (4 bytes)] 'ftyp' [brand]
	if (buffer.subarray(4, 8).equals(MP4_MAGIC_BYTES)) {
		return "mp4";
	}

	// Check WebM: EBML header starts with 1A 45 DF A3
	if (buffer.subarray(0, 4).equals(WEBM_MAGIC_BYTES)) {
		return "webm";
	}

	return null;
}

/**
 * Detect evidence format (image or video) from magic bytes.
 *
 * @param buffer - Buffer containing file data
 * @returns Detected format or null if unrecognized
 */
export function detectEvidenceFormat(buffer: Buffer): EvidenceFormat | null {
	// Try image formats first
	const imageFormat = detectImageFormat(buffer);
	if (imageFormat) return imageFormat;

	// Then try video formats
	return detectVideoFormat(buffer);
}

/**
 * Determine evidence type from format.
 *
 * @param format - Detected format
 * @returns Evidence type (screenshot or video)
 */
export function getEvidenceType(
	format: EvidenceFormat,
): "screenshot" | "video" {
	const videoFormats: VideoFormat[] = ["mp4", "webm"];
	return videoFormats.includes(format as VideoFormat) ? "video" : "screenshot";
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
	maxVideoSizeBytes: number = DEFAULT_MAX_VIDEO_SIZE_BYTES,
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

	// 3. Read only the file header (16 bytes) to detect format
	//    This avoids loading oversized files into memory before the size check.
	const HEADER_SIZE = 16;
	const headerBuf = Buffer.alloc(HEADER_SIZE);
	try {
		const fd = openSync(validatedPath, "r");
		try {
			readSync(fd, headerBuf, 0, HEADER_SIZE, 0);
		} finally {
			closeSync(fd);
		}
	} catch {
		return createEvidenceError(
			"READ_ERROR",
			`Failed to read evidence file: ${filePath}`,
			filePath,
		);
	}

	const format = detectEvidenceFormat(headerBuf);
	if (!format) {
		return createEvidenceError(
			"INVALID_FORMAT",
			`Invalid evidence format (expected PNG, JPEG, MP4, or WebM): ${filePath}`,
			filePath,
		);
	}

	// 4. Validate file size based on type (video has higher limit)
	//    Size is already known from step 2 — no extra I/O needed.
	const isVideo = format === "mp4" || format === "webm";
	const effectiveLimit = isVideo ? maxVideoSizeBytes : maxFileSizeBytes;
	if (stats.size > effectiveLimit) {
		return createEvidenceError(
			"FILE_TOO_LARGE",
			`Evidence file exceeds ${effectiveLimit} bytes: ${filePath} (${stats.size} bytes)`,
			filePath,
		);
	}

	// 5. Success — return validated file metadata
	// (Full file contents are not returned; callers use the path for subsequent reads.)
	const evidenceFile: EvidenceFile = {
		path: validatedPath,
		type: format,
		evidenceType: getEvidenceType(format),
		sizeBytes: stats.size,
	};

	const result: EvidenceCheckResult = {
		ok: true,
		file: evidenceFile,
	};

	return result;
}
