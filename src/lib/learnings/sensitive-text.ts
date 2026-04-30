/** Redaction marker used for sensitive or local-only text. */
export const SENSITIVE_TEXT_REDACTION = "[REDACTED]";

/** Sensitive text detection result for diagnostics that must not leak values. */
export interface SensitiveTextFinding {
	/** Stable detector code. */
	code: string;
	/** Human-readable category without the sensitive value. */
	label: string;
}

const SENSITIVE_PATTERNS: Array<{
	code: string;
	label: string;
	pattern: RegExp;
}> = [
	{
		code: "sensitive.github_pat",
		label: "GitHub fine-grained token",
		pattern: /github_pat_[A-Za-z0-9_]{20,}/g,
	},
	{
		code: "sensitive.github_token",
		label: "GitHub token",
		pattern: /gh[pousr]_[A-Za-z0-9_]{20,}/g,
	},
	{
		code: "sensitive.openai_key",
		label: "OpenAI API key",
		pattern: /sk-[A-Za-z0-9_-]{20,}/g,
	},
	{
		code: "sensitive.slack_token",
		label: "Slack token",
		pattern: /xox[baprs]-[A-Za-z0-9-]{20,}/g,
	},
	{
		code: "sensitive.bearer",
		label: "Bearer token",
		pattern: /Bearer\s+[A-Za-z0-9._~+/=-]{16,}/gi,
	},
	{
		code: "sensitive.assignment",
		label: "secret assignment",
		pattern:
			/\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*["']?[^"',\s]{8,}/gi,
	},
	{
		code: "sensitive.local_path",
		label: "absolute local path",
		pattern:
			/(?:file:\/\/)?(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)[^"',\s)]+/g,
	},
];

/**
 * Detects sensitive or local-only text in the provided string and returns metadata for each detector that matches.
 *
 * @returns An array of findings; each finding contains the detector `code` and human-readable `label` for a pattern that matched the input.
 */
export function detectSensitiveText(value: string): SensitiveTextFinding[] {
	const findings: SensitiveTextFinding[] = [];
	for (const detector of SENSITIVE_PATTERNS) {
		detector.pattern.lastIndex = 0;
		if (detector.pattern.test(value)) {
			findings.push({ code: detector.code, label: detector.label });
		}
	}
	return findings;
}

/**
 * Redacts sensitive or local-only substrings in the provided text by replacing each match with a fixed redaction marker.
 *
 * @param value - The input text to scan and redact
 * @returns The input text with all detected sensitive or local-only substrings replaced by "[REDACTED]"
 */
export function redactSensitiveText(value: string): string {
	let redacted = value;
	for (const detector of SENSITIVE_PATTERNS) {
		detector.pattern.lastIndex = 0;
		redacted = redacted.replace(detector.pattern, SENSITIVE_TEXT_REDACTION);
	}
	return redacted;
}
