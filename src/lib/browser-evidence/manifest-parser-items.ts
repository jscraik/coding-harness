import { sanitizeEvidenceText } from "../input/sanitize.js";
import {
	browserError,
	isNonEmptyString,
	isRecord,
	isRfc3339DateTime,
	readOptionalStringProperty,
	unexpectedPropertyErrors,
} from "./manifest-parser-helpers.js";
import type {
	BrowserConsoleEvent,
	BrowserConsoleLevel,
	BrowserEvidenceScreenshot,
	BrowserEvidenceValidationError,
} from "./types.js";

/** Parse one screenshot entry from a browser evidence manifest. */
export function parseScreenshot(
	value: unknown,
	errors: BrowserEvidenceValidationError[],
): BrowserEvidenceScreenshot | null {
	if (!isRecord(value)) return null;
	errors.push(
		...unexpectedPropertyErrors(
			value,
			new Set(["path", "viewportId", "width", "height", "description"]),
			"screenshots[]",
		),
	);
	const { path, viewportId, width, height } = value;
	const parsedDescription = readOptionalStringProperty(
		value,
		"description",
		"screenshots[]",
		errors,
	);
	if (
		!isNonEmptyString(path) ||
		!isNonEmptyString(viewportId) ||
		typeof width !== "number" ||
		typeof height !== "number" ||
		!Number.isInteger(width) ||
		!Number.isInteger(height) ||
		width <= 0 ||
		height <= 0
	) {
		return null;
	}
	return {
		path: path.trim(),
		viewportId: viewportId.trim(),
		width,
		height,
		...(isNonEmptyString(parsedDescription)
			? { description: parsedDescription.trim() }
			: {}),
	};
}

/** Parse one browser console event from a browser evidence manifest. */
export function parseConsoleEvent(
	value: unknown,
	errors: BrowserEvidenceValidationError[],
): BrowserConsoleEvent | null {
	if (!isRecord(value) || !isNonEmptyString(value.level)) return null;
	errors.push(
		...unexpectedPropertyErrors(
			value,
			new Set(["level", "message", "text", "source", "timestamp"]),
			"consoleEvents[]",
		),
	);
	const message = readOptionalStringProperty(
		value,
		"message",
		"consoleEvents[]",
		errors,
	);
	const text = readOptionalStringProperty(
		value,
		"text",
		"consoleEvents[]",
		errors,
	);
	const source = readOptionalStringProperty(
		value,
		"source",
		"consoleEvents[]",
		errors,
	);
	const timestamp = readOptionalStringProperty(
		value,
		"timestamp",
		"consoleEvents[]",
		errors,
	);
	if (timestamp !== undefined && !isRfc3339DateTime(timestamp)) {
		errors.push(
			browserError(
				"BROWSER_MANIFEST_SCHEMA_INVALID",
				"Browser evidence console event timestamp must be an RFC3339 date-time string.",
			),
		);
		return null;
	}
	const level = value.level.trim();
	if (!isConsoleLevel(level)) return null;
	return {
		level,
		...(isNonEmptyString(message)
			? { message: sanitizeEvidenceText(message.trim()) }
			: {}),
		...(isNonEmptyString(text)
			? { text: sanitizeEvidenceText(text.trim()) }
			: {}),
		...(isNonEmptyString(source)
			? { source: sanitizeEvidenceText(source.trim()) }
			: {}),
		...(isRfc3339DateTime(timestamp) ? { timestamp: timestamp.trim() } : {}),
	};
}

/** Return true for console levels supported by browser evidence manifests. */
export function isConsoleLevel(value: string): value is BrowserConsoleLevel {
	return ["error", "warning", "info", "log", "debug"].includes(value);
}
