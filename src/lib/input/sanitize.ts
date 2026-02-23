import { resolve } from "node:path";

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

/**
 * Validate and sanitize a file system path to prevent path traversal attacks.
 *
 * @param inputPath - User-provided path to validate
 * @param baseDir - Base directory that the path must resolve within (default: process.cwd())
 * @returns The validated, resolved path
 * @throws Error if path validation fails
 */
export function validatePath(inputPath: string, baseDir?: string): string {
	// Reject paths with null bytes
	if (inputPath.includes("\0")) {
		throw new Error("Path contains invalid characters");
	}

	// Reject paths containing parent directory traversal
	if (inputPath.includes("..") || inputPath.includes("~")) {
		throw new Error("Path traversal detected in input");
	}

	// Reject absolute paths that don't start with baseDir
	const resolved = resolve(baseDir ?? process.cwd(), inputPath);
	const baseResolved = resolve(baseDir ?? process.cwd());

	// Ensure resolved path is within base directory (path jail)
	if (!resolved.startsWith(baseResolved)) {
		throw new Error("Path escapes allowed directory");
	}

	return resolved;
}

/**
 * Sanitize a path for safe display in error messages.
 * Removes home directory and other sensitive path components.
 *
 * @param path - Path to sanitize for display
 * @returns Sanitized path safe for error messages
 */
export function sanitizePathForDisplay(path: string): string {
	return path
		.replace(/\/Users\/[^/]+/g, "[USER]")
		.replace(/\/home\/[^/]+/g, "[USER]")
		.replace(/C:\\Users\\[^\\]+/g, "[USER]")
		.replace(process.cwd(), ".");
}
