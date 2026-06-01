export const BROWSER_EVIDENCE_SCHEMA_VERSION = "browser-evidence/v1" as const;
export const DEFAULT_BROWSER_SCREENSHOT_MAX_FILE_SIZE_BYTES = 16 * 1024 * 1024;

export const BROWSER_EVIDENCE_ERROR_CODES = [
	"BROWSER_MANIFEST_NOT_FOUND",
	"BROWSER_MANIFEST_PATH_UNSAFE",
	"BROWSER_MANIFEST_INVALID_JSON",
	"BROWSER_MANIFEST_SCHEMA_INVALID",
	"BROWSER_SCREENSHOT_MISSING",
	"BROWSER_SCREENSHOT_BLANK",
	"BROWSER_SCREENSHOT_INVALID_FORMAT",
	"BROWSER_VIEWPORT_COVERAGE_MISSING",
	"BROWSER_CONSOLE_TELEMETRY_MISSING",
	"BROWSER_CONSOLE_ERROR_DISALLOWED",
	"BROWSER_CONSOLE_POLICY_VIOLATION",
	"BROWSER_SCREENSHOT_PATH_UNSAFE",
] as const;

/** Machine-readable browser evidence validation error code. */
export type BrowserEvidenceErrorCode =
	(typeof BROWSER_EVIDENCE_ERROR_CODES)[number];

/** Console event levels captured by browser automation. */
export type BrowserConsoleLevel =
	| "error"
	| "warning"
	| "info"
	| "log"
	| "debug";

/** Screenshot artifact pointer captured for one browser viewport. */
export interface BrowserEvidenceScreenshot {
	path: string;
	viewportId: string;
	width: number;
	height: number;
	description?: string;
}

/** Sanitized browser console event captured during UI evidence collection. */
export interface BrowserConsoleEvent {
	level: BrowserConsoleLevel;
	message?: string;
	text?: string;
	source?: string;
	timestamp?: string;
}

/** Browser console policy used to decide which console levels block validation. */
export interface BrowserConsolePolicy {
	failOn?: BrowserConsoleLevel[];
	allowedMessagePatterns?: string[];
}

/** Deterministic screenshot thresholds used to reject blank render artifacts. */
export interface BrowserBlankScreenshotPolicy {
	minWidth?: number;
	minHeight?: number;
	minBytes?: number;
	minUniqueColors?: number;
}

/** Browser evidence manifest consumed by the evidence verifier CLI. */
export interface BrowserEvidenceManifest {
	schemaVersion: typeof BROWSER_EVIDENCE_SCHEMA_VERSION;
	screenshots: BrowserEvidenceScreenshot[];
	requiredViewportIds: string[];
	consoleEvents: BrowserConsoleEvent[];
	consolePolicy: BrowserConsolePolicy;
	blankScreenshotPolicy: BrowserBlankScreenshotPolicy;
}

/** One browser evidence validation failure with stable code and safe details. */
export interface BrowserEvidenceValidationError {
	code: BrowserEvidenceErrorCode;
	message: string;
	path?: string;
	details?: Record<string, unknown>;
}

/** Machine-readable report emitted after browser evidence validation. */
export interface BrowserEvidenceValidationReport {
	checked: boolean;
	manifestPath: string;
	passed: boolean;
	requiredViewportIds: string[];
	capturedViewportIds: string[];
	missingViewportIds: string[];
	screenshotsChecked: number;
	consoleEventsChecked: number;
	errors: BrowserEvidenceValidationError[];
}

/** Options for validating a browser evidence manifest from a repo root. */
export interface BrowserEvidenceValidationOptions {
	manifestPath: string;
	baseDir?: string;
	requiredViewportIds?: string[];
}
