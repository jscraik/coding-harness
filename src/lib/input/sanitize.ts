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
