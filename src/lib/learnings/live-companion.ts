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

/** Parse and validate optional live companion metadata. */
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

/** Validate parsed live companion metadata. */
export function validateLearningLiveCompanion(
	value: unknown,
): LearningLiveCompanionLoadResult {
	if (!isRecord(value)) {
		return invalid("Live companion metadata must be a JSON object.");
	}
	if (value.schemaVersion !== LEARNING_LIVE_COMPANION_SCHEMA_VERSION) {
		return invalid(
			`Unsupported live companion schemaVersion: ${String(value.schemaVersion)}.`,
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

function invalid(message: string): LearningLiveCompanionLoadResult {
	return {
		ok: false,
		code: "learnings.live_companion.invalid",
		message,
		fix: "Provide a live-companion/v1 JSON object with provider=coderabbit, evidenceLevel=coarse_provider_metadata, and rowLevelEvidence=false.",
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

function sanitizeStats(
	stats: Record<string, string | number | boolean | null>,
): Record<string, string | number | boolean | null> {
	return Object.fromEntries(
		Object.entries(stats).map(([key, value]) => [
			key,
			typeof value === "string"
				? sanitizeLearningLiveCompanionDiagnostic(value)
				: value,
		]),
	);
}
