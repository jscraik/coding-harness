/**
 * Evidence type identifiers for verification.
 * MVP: Screenshots only (PNG/JPEG).
 */
export type EvidenceType = "screenshot";

/**
 * Supported image formats for evidence files.
 */
export type ImageFormat = "png" | "jpeg";

/**
 * Metadata for a validated evidence file.
 */
export interface EvidenceFile {
	/** Absolute path to the evidence file */
	path: string;
	/** Detected image format */
	type: ImageFormat;
	/** File size in bytes */
	sizeBytes: number;
	/** Optional image dimensions (deferred - requires image parsing) */
	dimensions?: { width: number; height: number };
}

/**
 * Machine-readable error codes for evidence validation.
 */
export type EvidenceErrorCode =
	| "FILE_NOT_FOUND"
	| "INVALID_FORMAT"
	| "FILE_TOO_LARGE"
	| "PATH_TRAVERSAL"
	| "READ_ERROR";

/**
 * Structured error for evidence validation failures.
 */
export interface EvidenceError {
	ok: false;
	/** Machine-readable error code */
	code: EvidenceErrorCode;
	/** Human-readable error message */
	message: string;
	/** Path that caused the error */
	path: string;
}

/**
 * Successful evidence validation result.
 */
export interface EvidenceCheckResult {
	ok: true;
	/** Validated evidence file metadata */
	file: EvidenceFile;
}

/**
 * Result of validating a single evidence file.
 * Discriminated union for type-safe error handling.
 */
export type EvidenceResult = EvidenceCheckResult | EvidenceError;

/**
 * Output from evidence verification command.
 */
export interface EvidenceVerifyOutput {
	/** Number of successfully verified files */
	verified: number;
	/** Number of files that failed verification */
	failed: number;
	/** List of verified evidence files */
	files: EvidenceFile[];
	/** List of validation errors */
	errors: EvidenceError[];
}

/**
 * Library function result (discriminated union).
 */
export type EvidenceVerifyResult =
	| { ok: true; output: EvidenceVerifyOutput }
	| { ok: false; error: { code: string; message: string } };

/**
 * Default maximum file size for evidence files (1MB).
 */
export const DEFAULT_MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1MB

/**
 * Magic bytes for PNG format (8 bytes).
 * PNG signature: 89 50 4E 47 0D 0A 1A 0A
 */
export const PNG_MAGIC_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

/**
 * Magic bytes for JPEG format (3 bytes).
 * JPEG signature: FF D8 FF
 */
export const JPEG_MAGIC_BYTES = Buffer.from([0xff, 0xd8, 0xff]);
