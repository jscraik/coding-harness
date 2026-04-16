/**
 * Trace normalizer for simulation stability (JSC-132).
 *
 * Normalizes replay tracer outputs so simulation inputs are deterministic
 * across environments. Replaces absolute paths, real timestamps, and
 * potential secrets with stable substitutes.
 *
 * @module lib/replay/trace-normalizer
 */

import type { ExecutionTrace, TraceEvent } from "./tracer.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NormalizationOptions {
	/** Base directory to relativize paths against */
	baseDir: string;
	/** Whether to normalize timestamps to ordinal offsets */
	normalizeTimestamps: boolean;
	/** Whether to redact potential secrets from payloads */
	redactSecrets: boolean;
}

export interface NormalizedTrace {
	/** Stable trace ID */
	traceId: string;
	/** Normalized timestamp (T+0 for creation) */
	createdAt: string;
	/** Normalized working directory (relative) */
	workingDirectory: string;
	/** Sanitized environment */
	environment: Record<string, string>;
	/** Command */
	command: string;
	/** Arguments */
	args: string[];
	/** Normalized events */
	events: NormalizedTraceEvent[];
	/** Metadata */
	metadata: ExecutionTrace["metadata"];
}

export interface NormalizedTraceEvent {
	/** Event type */
	type: TraceEvent["type"];
	/** Normalized timestamp (T+N format or original) */
	timestamp: string;
	/** Sanitized payload */
	payload: unknown;
	/** Correlation ID */
	correlationId?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Patterns that indicate potential secret values in payloads */
const SECRET_PATTERNS = [
	/api[_-]?key/i,
	/token/i,
	/secret/i,
	/password/i,
	/auth[_-]?token/i,
	/bearer/i,
	/credentials/i,
	/private[_-]?key/i,
	/access[_-]?key/i,
	/connection[_-]?string/i,
];

/** Keys that should always be redacted */
const REDACTED_KEYS = new Set([
	"password",
	"token",
	"secret",
	"apiKey",
	"api_key",
	"accessToken",
	"access_token",
	"authToken",
	"auth_token",
	"privateKey",
	"private_key",
	"credentials",
	"connectionString",
	"connection_string",
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Relativize an absolute path against a base directory.
 * Returns the original path if it's already relative or cannot be relativized.
 */
function relativizePath(absolutePath: string, baseDir: string): string {
	if (!absolutePath.startsWith("/")) {
		return absolutePath;
	}
	// Simple prefix-based relativization
	if (absolutePath.startsWith(baseDir)) {
		const relative = absolutePath.slice(baseDir.length);
		if (relative === "") return ".";
		return relative.startsWith("/") ? `.${relative}` : relative;
	}
	// Replace home directory with ~
	if (absolutePath.startsWith("/home/") || absolutePath.startsWith("/Users/")) {
		const parts = absolutePath.split("/");
		return `~/${parts.slice(3).join("/")}`;
	}
	return absolutePath;
}

/**
 * Redact potential secret values in an object.
 * Returns a new object with secrets replaced with [REDACTED].
 */
function redactSecrets<T>(value: T): T {
	if (value === null || value === undefined) return value;
	if (typeof value === "string") {
		// Check if the string looks like a secret value (long base64 or hex)
		if (
			value.length > 20 &&
			/^[A-Za-z0-9+/=_-]+$/.test(value) &&
			!value.startsWith("http")
		) {
			return "[REDACTED]" as T;
		}
		return value;
	}
	if (Array.isArray(value)) {
		return value.map(redactSecrets) as T;
	}
	if (typeof value === "object") {
		const result: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
			const lowerKey = key.toLowerCase();
			const isSecretKey = REDACTED_KEYS.has(lowerKey);
			const matchesPattern = SECRET_PATTERNS.some((pattern) =>
				pattern.test(key),
			);
			if (isSecretKey || matchesPattern) {
				result[key] = "[REDACTED]";
			} else {
				result[key] = redactSecrets(val);
			}
		}
		return result as T;
	}
	return value;
}

/**
 * Normalize a timestamp to ordinal offset format (T+N).
 */
function normalizeTimestamp(
	timestamp: string,
	referenceTimestamp: string,
): string {
	const ts = new Date(timestamp).getTime();
	const ref = new Date(referenceTimestamp).getTime();
	if (Number.isNaN(ts) || Number.isNaN(ref)) {
		return timestamp;
	}
	const offsetMs = ts - ref;
	const offsetSec = Math.round(offsetMs / 1000);
	if (offsetSec === 0) return "T+0";
	if (offsetSec > 0) return `T+${offsetSec}`;
	return `T${offsetSec}`;
}

/**
 * Normalize paths within an arbitrary payload value.
 * Walks objects and arrays, relativizing any string value that looks
 * like an absolute path against the given base directory.
 */
function normalizePayloadPaths<T>(value: T, baseDir: string): T {
	if (typeof value === "string" && value.startsWith("/")) {
		return relativizePath(value, baseDir) as T;
	}
	if (Array.isArray(value)) {
		return value.map((item) => normalizePayloadPaths(item, baseDir)) as T;
	}
	if (value !== null && typeof value === "object") {
		const result: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
			result[key] = normalizePayloadPaths(val, baseDir);
		}
		return result as T;
	}
	return value;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Normalize a trace for deterministic cross-environment replay.
 *
 * - Relativizes absolute paths against baseDir
 * - Replaces timestamps with ordinal offsets from creation time
 * - Redacts potential secrets from event payloads
 */
export function normalizeTrace(
	trace: ExecutionTrace,
	options: Partial<NormalizationOptions> = {},
): NormalizedTrace {
	const fullOptions: NormalizationOptions = {
		baseDir: options.baseDir ?? trace.workingDirectory,
		normalizeTimestamps: options.normalizeTimestamps ?? true,
		redactSecrets: options.redactSecrets ?? true,
	};

	const normalizedEvents: NormalizedTraceEvent[] = trace.events.map((event) => {
		let payload = normalizePayloadPaths(event.payload, fullOptions.baseDir);
		if (fullOptions.redactSecrets) {
			payload = redactSecrets(payload);
		}
		return {
			type: event.type,
			timestamp: fullOptions.normalizeTimestamps
				? normalizeTimestamp(event.timestamp, trace.createdAt)
				: event.timestamp,
			payload,
			...(event.correlationId ? { correlationId: event.correlationId } : {}),
		};
	});

	return {
		traceId: trace.traceId,
		createdAt: fullOptions.normalizeTimestamps ? "T+0" : trace.createdAt,
		workingDirectory: relativizePath(
			trace.workingDirectory,
			fullOptions.baseDir,
		),
		environment: fullOptions.redactSecrets
			? redactSecrets(trace.environment)
			: trace.environment,
		command: trace.command,
		args: trace.args,
		events: normalizedEvents,
		metadata: trace.metadata,
	};
}
