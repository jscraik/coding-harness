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

// Re-export validatePath from validator.ts for backward compatibility
// The validator.ts version is symlink-safe using realpathSync
export { validatePath } from "./validator.js";

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
