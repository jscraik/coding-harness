/**
 * Finding Normalizer
 *
 * Normalizes findings from multiple providers (CodeQL, Codex) into a canonical
 * CanonicalFinding format. Uses type guards for safe type narrowing and
 * reuses existing validators for path and SHA validation.
 */

import { isValidSha } from "../github/sha.js";
import { PathTraversalError, validatePath } from "../input/validator.js";
import type {
	CanonicalFinding,
	NormalizerOutcome,
	RemediationSeverity,
} from "./types.js";

// Constants
const MAX_ID_LENGTH = 256;
const MAX_LINE_NUMBER = 1000000;
const MAX_PATH_LENGTH = 4096;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
const SHELL_METACHAR_PATTERN = /[<>|&;$`\\]/;

/**
 * CodeQL finding input structure.
 */
export interface CodeqlFindingInput {
	id: string;
	rule?: { id?: string; name?: string; description?: string };
	location: { path: string; startLine: number; endLine?: number };
	commitSha: string;
	severity?: "note" | "warning" | "error";
	discoveredAt?: string;
	evidence?: string;
}

/**
 * Codex finding input structure.
 */
export interface CodexFindingInput {
	id: string;
	ruleName?: string;
	message?: string;
	filePath: string;
	line: number;
	commitSha: string;
	severity?: "info" | "warning" | "critical";
	timestamp?: string;
	evidence?: string;
}

/**
 * Type guard for CodeQL input.
 */
function isCodeqlFindingInput(value: unknown): value is CodeqlFindingInput {
	if (typeof value !== "object" || value === null) return false;
	const v = value as Record<string, unknown>;
	const location = v.location;
	return (
		typeof v.id === "string" &&
		typeof location === "object" &&
		location !== null &&
		typeof (location as Record<string, unknown>).path === "string" &&
		typeof (location as Record<string, unknown>).startLine === "number" &&
		typeof v.commitSha === "string"
	);
}

/**
 * Type guard for Codex input.
 */
function isCodexFindingInput(value: unknown): value is CodexFindingInput {
	if (typeof value !== "object" || value === null) return false;
	const v = value as Record<string, unknown>;
	return (
		typeof v.id === "string" &&
		typeof v.filePath === "string" &&
		typeof v.line === "number" &&
		typeof v.commitSha === "string"
	);
}

/**
 * Maps CodeQL severity to RemediationSeverity (high/medium/low).
 */
function mapCodeqlSeverity(
	severity: "note" | "warning" | "error" | undefined,
): RemediationSeverity {
	switch (severity) {
		case "error":
			return "high";
		case "warning":
			return "medium";
		default:
			return "low";
	}
}

/**
 * Maps Codex severity to RemediationSeverity (high/medium/low).
 */
function mapCodexSeverity(
	severity: "info" | "warning" | "critical" | undefined,
): RemediationSeverity {
	switch (severity) {
		case "critical":
			return "high";
		case "warning":
			return "medium";
		default:
			return "low";
	}
}

/**
 * Validates a timestamp string.
 */
function isValidTimestamp(timestamp: string): boolean {
	return ISO_TIMESTAMP.test(timestamp);
}

/**
 * Validates a finding ID.
 */
function validateId(id: string): { ok: true } | { ok: false; error: string } {
	if (id.length === 0) {
		return { ok: false, error: "ID cannot be empty" };
	}
	if (id.length > MAX_ID_LENGTH) {
		return {
			ok: false,
			error: `ID exceeds maximum length of ${MAX_ID_LENGTH}`,
		};
	}
	return { ok: true };
}

/**
 * Validates a line number.
 */
function validateLineNumber(
	line: number,
	fieldName: string,
): { ok: true } | { ok: false; error: string } {
	if (!Number.isInteger(line)) {
		return { ok: false, error: `${fieldName} must be an integer` };
	}
	if (line < 1) {
		return { ok: false, error: `${fieldName} must be at least 1` };
	}
	if (line > MAX_LINE_NUMBER) {
		return {
			ok: false,
			error: `${fieldName} exceeds maximum of ${MAX_LINE_NUMBER}`,
		};
	}
	return { ok: true };
}

/**
 * Validates a path with additional security checks.
 * Reuses existing validatePath with shell metacharacter blocking.
 */
function validateFindingPath(
	rawPath: string,
	repoRoot: string,
): { ok: true; safePath: string } | { ok: false; error: string; code: string } {
	if (rawPath.length === 0) {
		return { ok: false, error: "Path cannot be empty", code: "E_INVALID_PATH" };
	}

	if (rawPath.length > MAX_PATH_LENGTH) {
		return {
			ok: false,
			error: `Path exceeds maximum length of ${MAX_PATH_LENGTH}`,
			code: "E_INVALID_PATH",
		};
	}

	// Defense in depth: block shell metacharacters
	if (SHELL_METACHAR_PATTERN.test(rawPath)) {
		return {
			ok: false,
			error: "Path contains shell metacharacters",
			code: "E_INVALID_PATH",
		};
	}

	// Reuse existing battle-tested validator
	try {
		const safePath = validatePath(repoRoot, rawPath);
		return { ok: true, safePath };
	} catch (e) {
		if (e instanceof PathTraversalError) {
			return {
				ok: false,
				error: "Path traversal detected",
				code: "E_INVALID_PATH",
			};
		}
		return { ok: false, error: String(e), code: "E_INVALID_PATH" };
	}
}

/**
 * Normalizes a CodeQL finding into canonical format.
 *
 * @param input - Raw CodeQL finding data (unknown for safety)
 * @param repoRoot - Repository root directory for path validation
 * @returns NormalizerOutcome with canonical finding or error
 */
export function normalizeCodeqlFinding(
	input: unknown,
	repoRoot: string = process.cwd(),
): NormalizerOutcome {
	// Use type guard instead of unsafe `as`
	if (!isCodeqlFindingInput(input)) {
		return {
			ok: false,
			error: {
				code: "E_MISSING_FIELD",
				message: "Invalid CodeQL finding structure",
				raw: input,
			},
		};
	}

	// Validate ID
	const idResult = validateId(input.id);
	if (!idResult.ok) {
		return {
			ok: false,
			error: {
				code: "E_MISSING_FIELD",
				message: idResult.error,
				raw: input,
			},
		};
	}

	// Validate commit SHA
	if (!isValidSha(input.commitSha)) {
		return {
			ok: false,
			error: {
				code: "E_INVALID_SHA",
				message: `Invalid commit SHA: ${input.commitSha}`,
				raw: input,
			},
		};
	}

	// Validate path
	const pathResult = validateFindingPath(input.location.path, repoRoot);
	if (!pathResult.ok) {
		return {
			ok: false,
			error: {
				code: pathResult.code as "E_INVALID_PATH",
				message: pathResult.error,
				raw: input,
			},
		};
	}

	// Validate line numbers
	const startLineResult = validateLineNumber(
		input.location.startLine,
		"startLine",
	);
	if (!startLineResult.ok) {
		return {
			ok: false,
			error: {
				code: "E_PARSE_FAILURE",
				message: startLineResult.error,
				raw: input,
			},
		};
	}

	if (input.location.endLine !== undefined) {
		const endLineResult = validateLineNumber(input.location.endLine, "endLine");
		if (!endLineResult.ok) {
			return {
				ok: false,
				error: {
					code: "E_PARSE_FAILURE",
					message: endLineResult.error,
					raw: input,
				},
			};
		}
		if (input.location.endLine < input.location.startLine) {
			return {
				ok: false,
				error: {
					code: "E_PARSE_FAILURE",
					message: "endLine cannot be less than startLine",
					raw: input,
				},
			};
		}
	}

	// Validate timestamp if provided
	let discoveredAt: string;
	if (input.discoveredAt !== undefined) {
		if (!isValidTimestamp(input.discoveredAt)) {
			return {
				ok: false,
				error: {
					code: "E_PARSE_FAILURE",
					message: `Invalid timestamp format: ${input.discoveredAt}`,
					raw: input,
				},
			};
		}
		discoveredAt = input.discoveredAt;
	} else {
		discoveredAt = new Date().toISOString();
	}

	// Build canonical finding
	const finding: CanonicalFinding = {
		id: input.id,
		provider: "codeql",
		severity: mapCodeqlSeverity(input.severity),
		title: input.rule?.name ?? input.rule?.id ?? "Unknown CodeQL Rule",
		description:
			input.rule?.description ?? input.rule?.name ?? "No description available",
		filePath: pathResult.safePath,
		lineStart: input.location.startLine,
		lineEnd: input.location.endLine,
		commitSha: input.commitSha,
		discoveredAt,
		evidence: input.evidence,
	};

	return { ok: true, finding };
}

/**
 * Normalizes a Codex finding into canonical format.
 *
 * @param input - Raw Codex finding data (unknown for safety)
 * @param repoRoot - Repository root directory for path validation
 * @returns NormalizerOutcome with canonical finding or error
 */
export function normalizeCodexFinding(
	input: unknown,
	repoRoot: string = process.cwd(),
): NormalizerOutcome {
	// Use type guard instead of unsafe `as`
	if (!isCodexFindingInput(input)) {
		return {
			ok: false,
			error: {
				code: "E_MISSING_FIELD",
				message: "Invalid Codex finding structure",
				raw: input,
			},
		};
	}

	// Validate ID
	const idResult = validateId(input.id);
	if (!idResult.ok) {
		return {
			ok: false,
			error: {
				code: "E_MISSING_FIELD",
				message: idResult.error,
				raw: input,
			},
		};
	}

	// Validate commit SHA
	if (!isValidSha(input.commitSha)) {
		return {
			ok: false,
			error: {
				code: "E_INVALID_SHA",
				message: `Invalid commit SHA: ${input.commitSha}`,
				raw: input,
			},
		};
	}

	// Validate path
	const pathResult = validateFindingPath(input.filePath, repoRoot);
	if (!pathResult.ok) {
		return {
			ok: false,
			error: {
				code: pathResult.code as "E_INVALID_PATH",
				message: pathResult.error,
				raw: input,
			},
		};
	}

	// Validate line number
	const lineResult = validateLineNumber(input.line, "line");
	if (!lineResult.ok) {
		return {
			ok: false,
			error: {
				code: "E_PARSE_FAILURE",
				message: lineResult.error,
				raw: input,
			},
		};
	}

	// Validate timestamp if provided
	let discoveredAt: string;
	if (input.timestamp !== undefined) {
		if (!isValidTimestamp(input.timestamp)) {
			return {
				ok: false,
				error: {
					code: "E_PARSE_FAILURE",
					message: `Invalid timestamp format: ${input.timestamp}`,
					raw: input,
				},
			};
		}
		discoveredAt = input.timestamp;
	} else {
		discoveredAt = new Date().toISOString();
	}

	// Build canonical finding
	const finding: CanonicalFinding = {
		id: input.id,
		provider: "codex",
		severity: mapCodexSeverity(input.severity),
		title: input.ruleName ?? "Codex Finding",
		description: input.message ?? "No description available",
		filePath: pathResult.safePath,
		lineStart: input.line,
		commitSha: input.commitSha,
		discoveredAt,
		evidence: input.evidence,
	};

	return { ok: true, finding };
}
