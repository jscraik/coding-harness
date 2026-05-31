/**
 * Evidence type identifiers for verification.
 * Supports both screenshots and video evidence.
 */
export type EvidenceType = "screenshot" | "video";

/**
 * Supported image formats for evidence files.
 */
export type ImageFormat = "png" | "jpeg";

/**
 * Supported video formats for evidence files.
 */
export type VideoFormat = "mp4" | "webm";

/**
 * All supported evidence file formats.
 */
export type EvidenceFormat = ImageFormat | VideoFormat;

/**
 * Metadata for a validated evidence file.
 */
export interface EvidenceFile {
	/** Absolute path to the evidence file */
	path: string;
	/** Detected format (image or video format) */
	type: EvidenceFormat;
	/** Evidence type (screenshot or video) */
	evidenceType?: EvidenceType;
	/** File size in bytes */
	sizeBytes: number;
	/** Optional dimensions (for screenshots) */
	dimensions?: { width: number; height: number };
	/** Optional duration in seconds (for videos) */
	durationSeconds?: number;
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
	/** Optional browser evidence manifest validation report */
	browserEvidence?: import("../browser-evidence/types.js").BrowserEvidenceValidationReport;
}

/**
 * Library function result (discriminated union).
 */
export type EvidenceVerifyResult =
	| { ok: true; output: EvidenceVerifyOutput }
	| { ok: false; error: { code: string; message: string } };

/**
 * Default maximum file size for evidence files (1MB for images).
 */
export const DEFAULT_MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1MB

/**
 * Default maximum file size for video evidence (100MB).
 */
export const DEFAULT_MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

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

/**
 * Magic bytes for MP4 format.
 * MP4 files start with ftyp box: XX XX XX XX 66 74 79 70 (ftyp)
 * We check for 'ftyp' at offset 4.
 */
export const MP4_MAGIC_BYTES = Buffer.from([0x66, 0x74, 0x79, 0x70]); // 'ftyp' at offset 4

/**
 * Magic bytes for WebM format.
 * WebM files start with EBML header: 1A 45 DF A3
 */
export const WEBM_MAGIC_BYTES = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
