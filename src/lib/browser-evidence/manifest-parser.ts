import {
	browserError,
	isRecord,
	readStringArray,
	unexpectedPropertyErrors,
} from "./manifest-parser-helpers.js";
import {
	isConsoleLevel,
	parseConsoleEvent,
	parseScreenshot,
} from "./manifest-parser-items.js";
import {
	BROWSER_EVIDENCE_SCHEMA_VERSION,
	type BrowserBlankScreenshotPolicy,
	type BrowserConsoleEvent,
	type BrowserConsoleLevel,
	type BrowserConsolePolicy,
	type BrowserEvidenceManifest,
	type BrowserEvidenceScreenshot,
	type BrowserEvidenceValidationError,
} from "./types.js";

interface ParsedBrowserEvidenceManifest {
	manifest?: BrowserEvidenceManifest;
	errors: BrowserEvidenceValidationError[];
}

interface ParsedPolicy<TPolicy> {
	policy: TPolicy;
	errors: BrowserEvidenceValidationError[];
}

const TRUSTED_CONSOLE_FAIL_LEVEL_FLOOR: BrowserConsoleLevel[] = ["error"];
const TRUSTED_BLANK_POLICY_FLOOR: Required<BrowserBlankScreenshotPolicy> = {
	minWidth: 2,
	minHeight: 2,
	minBytes: 64,
	minUniqueColors: 2,
};

function parseConsolePolicy(
	value: unknown,
): ParsedPolicy<BrowserConsolePolicy> {
	const errors: BrowserEvidenceValidationError[] = [];
	if (!isRecord(value)) {
		return {
			policy: {},
			errors: [
				browserError(
					"BROWSER_CONSOLE_POLICY_VIOLATION",
					"Browser evidence manifest consolePolicy must be an object.",
				),
			],
		};
	}
	const policy: BrowserConsolePolicy = {};
	errors.push(
		...unexpectedPropertyErrors(
			value,
			new Set(["failOn", "allowedMessagePatterns"]),
			"consolePolicy",
		),
	);
	const failOn = readStringArray(value.failOn);
	if (!failOn || failOn.length === 0) {
		errors.push(
			browserError(
				"BROWSER_CONSOLE_POLICY_VIOLATION",
				"Browser evidence consolePolicy.failOn must be a non-empty string array.",
			),
		);
	} else {
		const invalidLevels = failOn.filter((level) => !isConsoleLevel(level));
		if (invalidLevels.length > 0) {
			errors.push(
				browserError(
					"BROWSER_CONSOLE_POLICY_VIOLATION",
					`Browser evidence consolePolicy.failOn contains unsupported levels: ${invalidLevels.join(
						", ",
					)}.`,
				),
			);
		} else {
			const missingTrustedLevels = TRUSTED_CONSOLE_FAIL_LEVEL_FLOOR.filter(
				(level) => !failOn.includes(level),
			);
			if (missingTrustedLevels.length > 0) {
				errors.push(
					browserError(
						"BROWSER_CONSOLE_POLICY_VIOLATION",
						"Browser evidence consolePolicy.failOn must include trusted failure levels: " +
							missingTrustedLevels.join(", ") +
							".",
					),
				);
			}
			policy.failOn = failOn as BrowserConsoleLevel[];
		}
	}
	if (Object.hasOwn(value, "allowedMessagePatterns")) {
		const allowedMessagePatterns = readStringArray(
			value.allowedMessagePatterns,
		);
		if (!allowedMessagePatterns) {
			errors.push(
				browserError(
					"BROWSER_CONSOLE_POLICY_VIOLATION",
					"Browser evidence consolePolicy.allowedMessagePatterns must be a string array when present.",
				),
			);
		} else {
			policy.allowedMessagePatterns = allowedMessagePatterns;
		}
	}
	return { policy, errors };
}

function parseBlankPolicy(
	value: unknown,
): ParsedPolicy<BrowserBlankScreenshotPolicy> {
	const errors: BrowserEvidenceValidationError[] = [];
	if (!isRecord(value)) {
		return {
			policy: {},
			errors: [
				browserError(
					"BROWSER_MANIFEST_SCHEMA_INVALID",
					"Browser evidence manifest blankScreenshotPolicy must be an object.",
				),
			],
		};
	}
	const policy: BrowserBlankScreenshotPolicy = {};
	errors.push(
		...unexpectedPropertyErrors(
			value,
			new Set(["minWidth", "minHeight", "minBytes", "minUniqueColors"]),
			"blankScreenshotPolicy",
		),
	);
	for (const key of [
		"minWidth",
		"minHeight",
		"minBytes",
		"minUniqueColors",
	] as const) {
		const candidate = value[key];
		const floor = TRUSTED_BLANK_POLICY_FLOOR[key];
		if (
			typeof candidate === "number" &&
			Number.isInteger(candidate) &&
			candidate >= floor
		) {
			policy[key] = candidate;
		} else {
			errors.push(
				browserError(
					"BROWSER_MANIFEST_SCHEMA_INVALID",
					"Browser evidence blankScreenshotPolicy." +
						key +
						" must be an integer greater than or equal to " +
						String(floor) +
						".",
				),
			);
		}
	}
	return { policy, errors };
}

function validateManifestHeader(
	value: Record<string, unknown>,
): BrowserEvidenceValidationError[] {
	if (value.schemaVersion === BROWSER_EVIDENCE_SCHEMA_VERSION) return [];
	return [
		browserError(
			"BROWSER_MANIFEST_SCHEMA_INVALID",
			"Browser evidence manifest schemaVersion must be " +
				BROWSER_EVIDENCE_SCHEMA_VERSION +
				".",
		),
	];
}

function parseManifestScreenshots(
	value: Record<string, unknown>,
	errors: BrowserEvidenceValidationError[],
): Array<BrowserEvidenceScreenshot | null> | null {
	const screenshots = Array.isArray(value.screenshots)
		? value.screenshots.map((item) => parseScreenshot(item, errors))
		: null;
	if (
		!screenshots ||
		screenshots.length === 0 ||
		screenshots.some((item) => item === null)
	) {
		errors.push(
			browserError(
				"BROWSER_MANIFEST_SCHEMA_INVALID",
				"Browser evidence manifest screenshots must include path, viewportId, width, and height.",
			),
		);
	}
	return screenshots;
}

function parseManifestRequiredViewports(
	value: Record<string, unknown>,
	errors: BrowserEvidenceValidationError[],
): string[] | null {
	const requiredViewportIds = readStringArray(value.requiredViewportIds);
	if (!requiredViewportIds || requiredViewportIds.length === 0) {
		errors.push(
			browserError(
				"BROWSER_MANIFEST_SCHEMA_INVALID",
				"Browser evidence manifest requiredViewportIds must be a non-empty string array.",
			),
		);
	}
	return requiredViewportIds;
}

function parseManifestConsoleEvents(
	value: Record<string, unknown>,
	errors: BrowserEvidenceValidationError[],
): Array<BrowserConsoleEvent | null> | null {
	if (!Object.hasOwn(value, "consoleEvents")) {
		errors.push(
			browserError(
				"BROWSER_CONSOLE_TELEMETRY_MISSING",
				"Browser evidence manifest must include consoleEvents, even when empty.",
			),
		);
	}
	const consoleEvents = Array.isArray(value.consoleEvents)
		? value.consoleEvents.map((item) => parseConsoleEvent(item, errors))
		: null;
	if (
		Object.hasOwn(value, "consoleEvents") &&
		(!consoleEvents || consoleEvents.some((item) => item === null))
	) {
		errors.push(
			browserError(
				"BROWSER_MANIFEST_SCHEMA_INVALID",
				"Browser evidence manifest consoleEvents must be an array of typed console event objects.",
			),
		);
	}
	return consoleEvents;
}

function parseManifestPolicies(
	value: Record<string, unknown>,
	errors: BrowserEvidenceValidationError[],
): {
	consolePolicy: ParsedPolicy<BrowserConsolePolicy>;
	blankScreenshotPolicy: ParsedPolicy<BrowserBlankScreenshotPolicy>;
} {
	if (!Object.hasOwn(value, "consolePolicy")) {
		errors.push(
			browserError(
				"BROWSER_MANIFEST_SCHEMA_INVALID",
				"Browser evidence manifest must include consolePolicy.",
			),
		);
	}
	if (!Object.hasOwn(value, "blankScreenshotPolicy")) {
		errors.push(
			browserError(
				"BROWSER_MANIFEST_SCHEMA_INVALID",
				"Browser evidence manifest must include blankScreenshotPolicy.",
			),
		);
	}
	const consolePolicy = Object.hasOwn(value, "consolePolicy")
		? parseConsolePolicy(value.consolePolicy)
		: { policy: {}, errors: [] };
	const blankScreenshotPolicy = Object.hasOwn(value, "blankScreenshotPolicy")
		? parseBlankPolicy(value.blankScreenshotPolicy)
		: { policy: {}, errors: [] };
	errors.push(...consolePolicy.errors, ...blankScreenshotPolicy.errors);
	return { consolePolicy, blankScreenshotPolicy };
}

/** Parse and validate browser evidence manifest structure from JSON data. */
export function parseBrowserEvidenceManifest(
	value: unknown,
): ParsedBrowserEvidenceManifest {
	const errors: BrowserEvidenceValidationError[] = [];
	if (!isRecord(value)) {
		return {
			errors: [
				browserError(
					"BROWSER_MANIFEST_SCHEMA_INVALID",
					"Browser evidence manifest must be an object.",
				),
			],
		};
	}
	errors.push(
		...unexpectedPropertyErrors(
			value,
			new Set([
				"schemaVersion",
				"screenshots",
				"requiredViewportIds",
				"consoleEvents",
				"consolePolicy",
				"blankScreenshotPolicy",
			]),
			"root",
		),
	);
	errors.push(...validateManifestHeader(value));
	const screenshots = parseManifestScreenshots(value, errors);
	const requiredViewportIds = parseManifestRequiredViewports(value, errors);
	const consoleEvents = parseManifestConsoleEvents(value, errors);
	const policies = parseManifestPolicies(value, errors);
	if (errors.length > 0) return { errors };
	return {
		manifest: {
			schemaVersion: BROWSER_EVIDENCE_SCHEMA_VERSION,
			screenshots: screenshots as BrowserEvidenceScreenshot[],
			requiredViewportIds: requiredViewportIds as string[],
			consoleEvents: (consoleEvents ?? []) as BrowserConsoleEvent[],
			consolePolicy: policies.consolePolicy.policy,
			blankScreenshotPolicy: policies.blankScreenshotPolicy.policy,
		},
		errors,
	};
}
