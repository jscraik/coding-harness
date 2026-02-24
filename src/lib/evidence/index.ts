// Evidence library - Browser evidence verification and validation
//
// This module provides:
// - Type definitions for evidence files and validation results
// - Image format validation (PNG/JPEG via magic bytes)
// - Path traversal protection
// - File loading with size limits
// - Structured logging with optional OTLP export

// Types
export type {
	EvidenceType,
	ImageFormat,
	EvidenceFile,
	EvidenceErrorCode,
	EvidenceError,
	EvidenceCheckResult,
	EvidenceResult,
	EvidenceVerifyOutput,
	EvidenceVerifyResult,
} from "./types.js";

export {
	DEFAULT_MAX_FILE_SIZE_BYTES,
	PNG_MAGIC_BYTES,
	JPEG_MAGIC_BYTES,
} from "./types.js";

// Validator
export {
	PathTraversalError,
	validatePath,
	detectImageFormat,
	createEvidenceError,
	loadEvidenceFile,
} from "./validator.js";

// Loader utilities
export {
	fileExists,
	getFileSize,
	resolvePath,
	getRealPath,
	getParentRealPath,
} from "./loader.js";

// Logger
export type { LogLevel, LogEntry, LoggerOptions } from "./logger.js";
export { StructuredLogger, ChildLogger, logger } from "./logger.js";

// Policy enforcement
export type {
	PolicyViolationCode,
	PolicyCheckResult,
	PolicyEnforcementResult,
} from "./policy.js";
export {
	requiresEvidence,
	isFormatAllowed,
	enforceEvidencePolicy,
	getFilesRequiringEvidence,
	summarizePolicy,
} from "./policy.js";
