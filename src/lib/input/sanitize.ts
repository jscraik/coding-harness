/**
 * Sensitive patterns for error message sanitization.
 * Note: This is the canonical implementation - cli.ts should import from here.
 */
const SENSITIVE_PATTERNS: [RegExp, string][] = [
	// Paths
	[/\/Users\/[^/]+/g, "[HOME]"],
	[/\/home\/[^/]+/g, "[HOME]"],
	[/C:\\Users\\[^\\]+/g, "[HOME]"],
	// API keys (specific patterns only - not broad 20+ char to avoid redacting commit hashes)
	[/sk-[a-zA-Z0-9]{20,}/g, "[REDACTED]"],
	[/ghp_[a-zA-Z0-9]{36}/g, "[REDACTED]"],
	[/gho_[a-zA-Z0-9]{36}/g, "[REDACTED]"],
	[/github_pat_[a-zA-Z0-9_]{22,}/g, "[REDACTED]"],
	[/AKIA[A-Z0-9]{16}/g, "[REDACTED]"],
	// JWTs
	[/eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*/g, "[REDACTED]"],
];

const EVIDENCE_SUBSTITUTION_PATTERNS: [RegExp, string][] = [
	[/\$\(\s*gh\s+auth\s+token\s*\)/gi, "$GITHUB_TOKEN"],
	[/\$\(\s*printenv\s+GITHUB_TOKEN\s*\)/gi, "$GITHUB_TOKEN"],
	[/\$\(\s*echo\s+\$GITHUB_TOKEN\s*\)/gi, "$GITHUB_TOKEN"],
];

const EVIDENCE_QUERY_PARAM_PATTERN =
	/((?:access_token|token|api[_-]?key|secret|password)=)[^&\s)\]]+/gi;
const EVIDENCE_AUTH_HEADER_PATTERN = /(\bAuthorization:\s*)[^\r\n]+/gi;

/** Return a display-safe error string with local paths and known secret shapes redacted. */
export function sanitizeError(error: unknown): string {
	if (error instanceof Error) {
		let message = error.message;
		for (const [pattern, replacement] of SENSITIVE_PATTERNS) {
			message = message.replace(pattern, replacement);
		}
		return `${error.name}: ${message}`;
	}
	let message = String(error);
	for (const [pattern, replacement] of SENSITIVE_PATTERNS) {
		message = message.replace(pattern, replacement);
	}
	return message;
}

/**
 * Sanitize commit/PR evidence text to prevent credential disclosure.
 * - Rewrites common shell token substitutions to env placeholders.
 * - Redacts known secret formats and token-like URL query parameters.
 */
export function sanitizeEvidenceText(text: string): string {
	let sanitized = text;
	for (const [pattern, replacement] of EVIDENCE_SUBSTITUTION_PATTERNS) {
		sanitized = sanitized.replace(pattern, replacement);
	}
	for (const [pattern, replacement] of SENSITIVE_PATTERNS) {
		sanitized = sanitized.replace(pattern, replacement);
	}
	sanitized = sanitized.replace(EVIDENCE_AUTH_HEADER_PATTERN, "$1[REDACTED]");
	sanitized = sanitized.replace(EVIDENCE_QUERY_PARAM_PATTERN, "$1[REDACTED]");
	return sanitized;
}

// Re-export validatePath from validator.ts for backward compatibility
// The validator.ts version is symlink-safe using realpathSync
export { validatePath } from "./validator.js";

// Re-export validation functions
export {
	MAX_ARRAY_SIZE,
	MAX_GIT_REF_LENGTH,
	MAX_IDENTIFIER_LENGTH,
	MAX_INPUT_LENGTH,
	MAX_PATH_LENGTH,
	validateArray,
	validateArraySize,
	validateCliString,
	validateGitRef,
	validateIdentifier,
	validateLength,
	validateNoShellInjection,
	validatePathComponent,
	validateSafeArgument,
	validateSafeString,
	validateSafeUrl,
} from "./validation.js";

/**
 * Sanitize a path for safe display in error messages.
 * Removes home directory and other sensitive path components.
 *
 * @param path - Path to sanitize for display
 * @returns Sanitized path safe for error messages
 */
export function sanitizePathForDisplay(path: string): string {
	return path
		.replace(/\/Users\/[^/]+/g, "[HOME]")
		.replace(/\/home\/[^/]+/g, "[HOME]")
		.replace(/C:\\Users\\[^\\]+/g, "[HOME]")
		.replace(process.cwd(), ".");
}
