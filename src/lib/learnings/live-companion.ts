import { redactSensitiveText } from "./sensitive-text.js";

/** Schema version for optional live companion metadata. */
export const LEARNING_LIVE_COMPANION_SCHEMA_VERSION = "live-companion/v1";

/** Optional coarse provider metadata that is not row-level learning evidence. */
export interface LearningLiveCompanion {
	/** Schema version for live companion metadata. */
	schemaVersion: typeof LEARNING_LIVE_COMPANION_SCHEMA_VERSION;
	/** Provider that produced the companion metadata. */
	provider: "coderabbit";
	/** Explicit evidence boundary for consumers. */
	evidenceLevel: "coarse_provider_metadata";
	/** Live companion metadata must never be treated as row-level evidence. */
	rowLevelEvidence: false;
	/** Optional public or operator-readable source label. */
	sourceLabel?: string;
	/** Optional collection timestamp from the provider or local run. */
	collectedAt?: string;
	/** Optional coarse provider statistics. */
	stats?: Record<string, string | number | boolean | null>;
}

/** Live companion load result. */
export type LearningLiveCompanionLoadResult =
	| { ok: true; companion: LearningLiveCompanion }
	| { ok: false; code: string; message: string; fix?: string };

/** Redact live-companion diagnostics before they are emitted to command output. */
export function sanitizeLearningLiveCompanionDiagnostic(value: string): string {
	return redactSensitiveText(value);
}

/**
 * Parse and validate a JSON string containing optional live companion metadata.
 *
 * @param raw - The raw JSON string containing live companion metadata
 * @returns A success result with the validated `LearningLiveCompanion` on success, or a failure result with an error `code`, human-readable `message`, and optional `fix` on failure
 */
export function parseLearningLiveCompanion(
	raw: string,
): LearningLiveCompanionLoadResult {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (error) {
		return {
			ok: false,
			code: "learnings.live_companion.invalid_json",
			message: `Live companion metadata must be JSON: ${sanitizeLearningLiveCompanionDiagnostic(error instanceof Error ? error.message : String(error))}`,
			fix: "Provide a live-companion/v1 JSON object, or omit --live-companion.",
		};
	}
	return validateLearningLiveCompanion(parsed);
}

/**
 * Validate and normalize a parsed live companion payload to the supported schema.
 *
 * @param value - The parsed JSON value to validate.
 * @returns An object with `ok: true` and the validated, sanitized `LearningLiveCompanion` on success; otherwise `ok: false` with `code`, `message`, and an optional `fix` explaining how to correct the input.
 */
export function validateLearningLiveCompanion(
	value: unknown,
): LearningLiveCompanionLoadResult {
	if (!isRecord(value)) {
		return invalid("Live companion metadata must be a JSON object.");
	}
	if (value.schemaVersion !== LEARNING_LIVE_COMPANION_SCHEMA_VERSION) {
		return invalid(
			`Unsupported live companion schemaVersion: ${safeDiagnosticValue(value.schemaVersion)}.`,
		);
	}
	if (value.provider !== "coderabbit") {
		return invalid("Live companion provider must be coderabbit.");
	}
	if (value.evidenceLevel !== "coarse_provider_metadata") {
		return invalid(
			"Live companion evidenceLevel must be coarse_provider_metadata.",
		);
	}
	if (value.rowLevelEvidence !== false) {
		return invalid("Live companion rowLevelEvidence must be false.");
	}
	if (
		value.sourceLabel !== undefined &&
		typeof value.sourceLabel !== "string"
	) {
		return invalid("Live companion sourceLabel must be a string.");
	}
	if (
		value.collectedAt !== undefined &&
		typeof value.collectedAt !== "string"
	) {
		return invalid("Live companion collectedAt must be a string.");
	}
	if (value.stats !== undefined && !isStatsRecord(value.stats)) {
		return invalid(
			"Live companion stats must be an object of string, number, boolean, or null values.",
		);
	}
	return {
		ok: true,
		companion: {
			schemaVersion: LEARNING_LIVE_COMPANION_SCHEMA_VERSION,
			provider: "coderabbit",
			evidenceLevel: "coarse_provider_metadata",
			rowLevelEvidence: false,
			...(typeof value.sourceLabel === "string"
				? {
						sourceLabel: sanitizeLearningLiveCompanionDiagnostic(
							value.sourceLabel,
						),
					}
				: {}),
			...(typeof value.collectedAt === "string"
				? { collectedAt: value.collectedAt }
				: {}),
			...(isStatsRecord(value.stats)
				? { stats: sanitizeStats(value.stats) }
				: {}),
		},
	};
}

/**
 * Create a standardized failure result for invalid LearningLiveCompanion data.
 *
 * @param message - Human-readable diagnostic message explaining why the value is invalid
 * @returns A failure `LearningLiveCompanionLoadResult` with `code` set to `"learnings.live_companion.invalid"`, the provided `message`, and a `fix` describing the required `live-companion/v1` shape
 */
function invalid(message: string): LearningLiveCompanionLoadResult {
	return {
		ok: false,
		code: "learnings.live_companion.invalid",
		message,
		fix: "Provide a live-companion/v1 JSON object with provider=coderabbit, evidenceLevel=coarse_provider_metadata, and rowLevelEvidence=false.",
	};
}

/**
 * Determines whether a value is a non-null, non-array object.
 *
 * @returns `true` if `value` is an object (not `null` and not an array), `false` otherwise.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Determines whether a value is an object whose property values are only string, number, boolean, or null.
 *
 * @param value - The value to test
 * @returns `true` if `value` is a non-null, non-array object and every property value is a `string`, `number`, `boolean`, or `null`, `false` otherwise.
 */
function isStatsRecord(
	value: unknown,
): value is Record<string, string | number | boolean | null> {
	return (
		isRecord(value) &&
		Object.values(value).every(
			(item) =>
				typeof item === "string" ||
				typeof item === "number" ||
				typeof item === "boolean" ||
				item === null,
		)
	);
}

/**
 * Sanitize a stats record by redacting sensitive text from its string values.
 *
 * @param stats - A record whose values are strings, numbers, booleans, or null; string values will be redacted.
 * @returns A new record with the same keys where string values have been sanitized and non-string values are unchanged.
 */
function sanitizeStats(
	stats: Record<string, string | number | boolean | null>,
): Record<string, string | number | boolean | null> {
	const sanitized: Record<string, string | number | boolean | null> = {};
	for (const [key, value] of Object.entries(stats)) {
		const sanitizedKey = uniqueStatsKey(
			sanitized,
			sanitizeLearningLiveCompanionDiagnostic(key) || "[REDACTED]",
		);
		sanitized[sanitizedKey] =
			typeof value === "string"
				? sanitizeLearningLiveCompanionDiagnostic(value)
				: value;
	}
	return sanitized;
}

function uniqueStatsKey(
	stats: Record<string, string | number | boolean | null>,
	key: string,
): string {
	if (!(key in stats)) return key;
	let suffix = 2;
	while (`${key}_${suffix}` in stats) suffix += 1;
	return `${key}_${suffix}`;
}

function safeDiagnosticValue(value: unknown): string {
	if (
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean"
	) {
		return sanitizeLearningLiveCompanionDiagnostic(String(value));
	}
	if (value === null) return "null";
	if (Array.isArray(value)) return "[array]";
	return `[${typeof value}]`;
}
