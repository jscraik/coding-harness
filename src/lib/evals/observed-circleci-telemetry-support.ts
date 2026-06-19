import { readdirSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

const MAX_FILES = 200;

/** Return whether telemetry traversal should continue within the file cap. */
export function shouldInspectTelemetry(
	pending: string[],
	files: string[],
	inspected: number,
): boolean {
	return (
		pending.length > 0 && files.length < MAX_FILES && inspected < MAX_FILES
	);
}

/** Read a directory deterministically, returning no entries when it is unreadable. */
export function safeReadDir(path: string): string[] {
	try {
		return readdirSync(path).sort();
	} catch {
		return [];
	}
}

/** Return whether a child path resolves inside a parent path. */
export function isPathInside(parentPath: string, childPath: string): boolean {
	const relativePath = relative(resolve(parentPath), resolve(childPath));
	return (
		relativePath === "" ||
		(relativePath !== "" &&
			!relativePath.startsWith("..") &&
			!isAbsolute(relativePath))
	);
}

/** Return the first non-empty string-like field from a record. */
export function firstString(
	record: Record<string, unknown>,
	keys: string[],
): string | null {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "string" && value.trim() !== "") return value.trim();
		if (typeof value === "number" || typeof value === "boolean") {
			return String(value);
		}
	}
	return null;
}

/** Return the first array field found on a record. */
export function firstArray(
	record: Record<string, unknown>,
	keys: string[],
): unknown[] | null {
	for (const key of keys) {
		const value = record[key];
		if (Array.isArray(value)) return value;
	}
	return null;
}

/** Return only string items from an unknown array value. */
export function arrayStrings(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === "string");
}

/** Return unique non-empty strings while preserving first-seen order. */
export function uniqueStrings(values: string[]): string[] {
	return [...new Set(values.filter(Boolean))];
}

/** Convert an arbitrary label into a stable lowercase identifier. */
export function safeLabel(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");
}

/** Return whether an unknown value is a plain record. */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Redact common token, key, secret, password, header, URL, and JWT strings. */
export function redactSecrets(value: string): string {
	return value
		.replace(
			/\b([A-Z0-9_]*(?:TOKEN|KEY|SECRET|PASSWORD)[A-Z0-9_]*)=\S+/gi,
			"$1=<redacted>",
		)
		.replace(
			/\b([A-Z0-9_-]*(?:TOKEN|KEY|SECRET|PASSWORD)[A-Z0-9_-]*\s*:\s*)\S+/gi,
			"$1<redacted>",
		)
		.replace(/(\bAuthorization:\s*)(?:Bearer|Basic)\s+\S+/gi, "$1<redacted>")
		.replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi, "$1 <redacted>")
		.replace(/Circle-Token:\s*\S+/gi, "Circle-Token: <redacted>")
		.replace(
			/([?&](?:token|api[_-]?key|key|secret|password|circle-token)=)[^&\s]+/gi,
			"$1<redacted>",
		)
		.replace(
			/(["'](?:token|api[_-]?key|secret|password)["']\s*:\s*)["'][^"']*["']/gi,
			'$1"<redacted>"',
		)
		.replace(
			/\b((?:token|api[_-]?key|secret|password)\s*[:=]\s*)[^"',\s}]+/gi,
			"$1<redacted>",
		)
		.replace(
			/\b(?:ghp|github_pat|glpat|xox[baprs]?)-[A-Za-z0-9_-]+/gi,
			"<redacted-token>",
		)
		.replace(
			/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
			"<redacted-jwt>",
		);
}
