import { readFileSync } from "node:fs";
import {
	loadEvidenceFile,
	PathTraversalError,
	validatePath,
} from "../evidence/index.js";
import type { EvidenceFile } from "../evidence/types.js";
import { parseBrowserEvidenceManifest } from "./manifest-parser.js";
import { inspectPng, type PngInspection } from "./png-inspection.js";
import {
	DEFAULT_BROWSER_SCREENSHOT_MAX_FILE_SIZE_BYTES,
	type BrowserBlankScreenshotPolicy,
	type BrowserConsoleLevel,
	type BrowserEvidenceManifest,
	type BrowserEvidenceValidationError,
	type BrowserEvidenceValidationOptions,
	type BrowserEvidenceValidationReport,
} from "./types.js";

const DEFAULT_CONSOLE_FAIL_ON: BrowserConsoleLevel[] = ["error"];
const DEFAULT_BLANK_POLICY: Required<BrowserBlankScreenshotPolicy> = {
	minWidth: 2,
	minHeight: 2,
	minBytes: 64,
	minUniqueColors: 2,
};
function browserError(
	code: BrowserEvidenceValidationError["code"],
	message: string,
	path?: string,
	details?: Record<string, unknown>,
): BrowserEvidenceValidationError {
	return {
		code,
		message,
		...(path ? { path } : {}),
		...(details ? { details } : {}),
	};
}

function effectiveBlankPolicy(
	policy: BrowserBlankScreenshotPolicy | undefined,
): Required<BrowserBlankScreenshotPolicy> {
	return { ...DEFAULT_BLANK_POLICY, ...(policy ?? {}) };
}

function validateDistinctViewportArtifact(
	screenshot: BrowserEvidenceManifest["screenshots"][number],
	artifactPath: string,
	viewportByArtifactPath: Map<string, string>,
): BrowserEvidenceValidationError | null {
	const previousViewport = viewportByArtifactPath.get(artifactPath);
	if (previousViewport && previousViewport !== screenshot.viewportId) {
		return browserError(
			"BROWSER_VIEWPORT_COVERAGE_MISSING",
			"Browser evidence requires distinct screenshot artifacts for distinct viewport IDs.",
			screenshot.path,
			{ artifactPath, previousViewport, viewportId: screenshot.viewportId },
		);
	}
	viewportByArtifactPath.set(artifactPath, screenshot.viewportId);
	return null;
}

function validatePngInspection(
	screenshot: BrowserEvidenceManifest["screenshots"][number],
	file: EvidenceFile,
	blankPolicy: Required<BrowserBlankScreenshotPolicy>,
): { png: PngInspection | null; errors: BrowserEvidenceValidationError[] } {
	if (file.type !== "png") {
		return {
			png: null,
			errors: [
				browserError(
					"BROWSER_SCREENSHOT_INVALID_FORMAT",
					"Browser evidence screenshots must be inspectable PNG artifacts.",
					screenshot.path,
					{ actualType: file.type },
				),
			],
		};
	}
	let png: PngInspection | null = null;
	try {
		png = inspectPng(file.path, {
			minUniqueColors: blankPolicy.minUniqueColors,
		});
	} catch {
		return {
			png: null,
			errors: [
				browserError(
					"BROWSER_SCREENSHOT_INVALID_FORMAT",
					"Browser evidence PNG screenshot could not be inspected.",
					screenshot.path,
				),
			],
		};
	}
	if (!png) {
		return {
			png: null,
			errors: [
				browserError(
					"BROWSER_SCREENSHOT_INVALID_FORMAT",
					"Browser evidence PNG screenshot could not be inspected.",
					screenshot.path,
				),
			],
		};
	}
	if (png.width === screenshot.width && png.height === screenshot.height) {
		return { png, errors: [] };
	}
	return {
		png: null,
		errors: [
			browserError(
				"BROWSER_SCREENSHOT_INVALID_FORMAT",
				"Browser evidence screenshot dimensions must match the captured artifact.",
				screenshot.path,
				{
					declaredWidth: screenshot.width,
					declaredHeight: screenshot.height,
					actualWidth: png.width,
					actualHeight: png.height,
				},
			),
		],
	};
}

function validateNonblankScreenshot(
	screenshot: BrowserEvidenceManifest["screenshots"][number],
	file: EvidenceFile,
	png: PngInspection,
	blankPolicy: Required<BrowserBlankScreenshotPolicy>,
): BrowserEvidenceValidationError | null {
	if (file.sizeBytes < blankPolicy.minBytes) {
		return browserError(
			"BROWSER_SCREENSHOT_BLANK",
			"Browser evidence screenshot is too small to prove a rendered state.",
			screenshot.path,
			{ sizeBytes: file.sizeBytes, minBytes: blankPolicy.minBytes },
		);
	}
	if (
		png.width >= blankPolicy.minWidth &&
		png.height >= blankPolicy.minHeight &&
		png.uniqueColors >= blankPolicy.minUniqueColors
	) {
		return null;
	}
	return browserError(
		"BROWSER_SCREENSHOT_BLANK",
		"Browser evidence screenshot does not meet nonblank render thresholds.",
		screenshot.path,
		{
			width: png.width,
			height: png.height,
			uniqueColors: png.uniqueColors,
			policy: blankPolicy,
		},
	);
}

function validateScreenshots(
	manifest: BrowserEvidenceManifest,
	baseDir: string,
): BrowserEvidenceValidationError[] {
	const errors: BrowserEvidenceValidationError[] = [];
	const viewportByArtifactPath = new Map<string, string>();
	const blankPolicy = effectiveBlankPolicy(manifest.blankScreenshotPolicy);
	for (const screenshot of manifest.screenshots) {
		const loaded = loadEvidenceFile(
			screenshot.path,
			baseDir,
			DEFAULT_BROWSER_SCREENSHOT_MAX_FILE_SIZE_BYTES,
		);
		if (!loaded.ok) {
			const code =
				loaded.code === "PATH_TRAVERSAL"
					? "BROWSER_SCREENSHOT_PATH_UNSAFE"
					: loaded.code === "FILE_NOT_FOUND"
						? "BROWSER_SCREENSHOT_MISSING"
						: "BROWSER_SCREENSHOT_INVALID_FORMAT";
			errors.push(browserError(code, loaded.message, screenshot.path));
			continue;
		}
		const distinctArtifactError = validateDistinctViewportArtifact(
			screenshot,
			loaded.file.path,
			viewportByArtifactPath,
		);
		if (distinctArtifactError) {
			errors.push(distinctArtifactError);
			continue;
		}
		if (loaded.file.evidenceType !== "screenshot") {
			errors.push(
				browserError(
					"BROWSER_SCREENSHOT_INVALID_FORMAT",
					"Browser evidence screenshot must be an image artifact.",
					screenshot.path,
				),
			);
			continue;
		}
		const pngInspection = validatePngInspection(
			screenshot,
			loaded.file,
			blankPolicy,
		);
		errors.push(...pngInspection.errors);
		if (pngInspection.errors.length > 0) continue;
		const { png } = pngInspection;
		if (!png) continue;
		const blankError = validateNonblankScreenshot(
			screenshot,
			loaded.file,
			png,
			blankPolicy,
		);
		if (blankError) errors.push(blankError);
	}
	return errors;
}

function validateConsolePolicy(
	manifest: BrowserEvidenceManifest,
): BrowserEvidenceValidationError[] {
	const policy = manifest.consolePolicy ?? {};
	const failOn = policy.failOn ?? DEFAULT_CONSOLE_FAIL_ON;
	const allowedPatterns = policy.allowedMessagePatterns ?? [];
	return manifest.consoleEvents.flatMap((event) => {
		if (!failOn.includes(event.level)) return [];
		const message = event.message ?? event.text ?? "";
		const allowed = allowedPatterns.some((pattern) =>
			message.includes(pattern),
		);
		return allowed
			? []
			: [
					browserError(
						"BROWSER_CONSOLE_ERROR_DISALLOWED",
						`Browser evidence console event at level ${event.level} violates console policy.`,
						undefined,
						{ level: event.level, message },
					),
				];
	});
}

function emptyReport(
	options: BrowserEvidenceValidationOptions,
	error: BrowserEvidenceValidationError,
): BrowserEvidenceValidationReport {
	return {
		checked: true,
		manifestPath: options.manifestPath,
		passed: false,
		requiredViewportIds: options.requiredViewportIds ?? [],
		capturedViewportIds: [],
		missingViewportIds: [],
		screenshotsChecked: 0,
		consoleEventsChecked: 0,
		errors: [error],
	};
}

function readManifestText(
	options: BrowserEvidenceValidationOptions,
	baseDir: string,
): { raw: string } | { report: BrowserEvidenceValidationReport } {
	try {
		const manifestPath = validatePath(baseDir, options.manifestPath);
		return { raw: readFileSync(manifestPath, "utf-8") };
	} catch (error) {
		const pathUnsafe = error instanceof PathTraversalError;
		return {
			report: emptyReport(
				options,
				browserError(
					pathUnsafe
						? "BROWSER_MANIFEST_PATH_UNSAFE"
						: "BROWSER_MANIFEST_NOT_FOUND",
					pathUnsafe
						? "Browser evidence manifest path must stay inside the repository."
						: `Browser evidence manifest not found: ${options.manifestPath}`,
					options.manifestPath,
				),
			),
		};
	}
}

function parseManifestJson(
	options: BrowserEvidenceValidationOptions,
	raw: string,
): { parsed: unknown } | { report: BrowserEvidenceValidationReport } {
	try {
		return { parsed: JSON.parse(raw) };
	} catch {
		return {
			report: emptyReport(
				options,
				browserError(
					"BROWSER_MANIFEST_INVALID_JSON",
					"Browser evidence manifest must be valid JSON.",
					options.manifestPath,
				),
			),
		};
	}
}

/** Validate browser evidence manifest structure, screenshot proof, and console policy. */
export function validateBrowserEvidenceManifest(
	options: BrowserEvidenceValidationOptions,
): BrowserEvidenceValidationReport {
	const baseDir = options.baseDir ?? process.cwd();
	const errors: BrowserEvidenceValidationError[] = [];
	const manifestText = readManifestText(options, baseDir);
	if ("report" in manifestText) return manifestText.report;
	const manifestJson = parseManifestJson(options, manifestText.raw);
	if ("report" in manifestJson) return manifestJson.report;
	const parsed = manifestJson.parsed;
	const parsedManifest = parseBrowserEvidenceManifest(parsed);
	errors.push(...parsedManifest.errors);
	const manifest = parsedManifest.manifest;
	const requiredViewportIds = Array.from(
		new Set([
			...(manifest?.requiredViewportIds ?? []),
			...(options.requiredViewportIds ?? []),
		]),
	);
	const capturedViewportIds =
		manifest?.screenshots.map((item) => item.viewportId) ?? [];
	const missingViewportIds = requiredViewportIds.filter(
		(viewportId) => !capturedViewportIds.includes(viewportId),
	);
	if (missingViewportIds.length > 0) {
		errors.push(
			browserError(
				"BROWSER_VIEWPORT_COVERAGE_MISSING",
				"Browser evidence is missing required viewport coverage.",
				options.manifestPath,
				{ missingViewportIds, requiredViewportIds, capturedViewportIds },
			),
		);
	}
	if (manifest) {
		errors.push(...validateScreenshots(manifest, baseDir));
		errors.push(...validateConsolePolicy(manifest));
	}
	return {
		checked: true,
		manifestPath: options.manifestPath,
		passed: errors.length === 0,
		requiredViewportIds,
		capturedViewportIds,
		missingViewportIds,
		screenshotsChecked: manifest?.screenshots.length ?? 0,
		consoleEventsChecked: manifest?.consoleEvents.length ?? 0,
		errors,
	};
}
