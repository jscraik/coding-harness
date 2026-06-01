import {
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_MAX_FILE_SIZE_BYTES } from "../evidence/types.js";
import { expectBehavior } from "../testing/expect-behavior.js";
import {
	largePng,
	pngWithInvalidFilter,
	pngWithPixels as png,
	truncatedPngHeader,
} from "./png-test-fixtures.js";
import { DEFAULT_BROWSER_SCREENSHOT_MAX_FILE_SIZE_BYTES } from "./types.js";
import { validateBrowserEvidenceManifest } from "./validator.js";

describe("validateBrowserEvidenceManifest", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "browser-evidence-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	function writeManifest(
		name: string,
		overrides: Record<string, unknown> = {},
	): string {
		const manifest = {
			schemaVersion: "browser-evidence/v1",
			screenshots: [
				{
					path: "desktop.png",
					viewportId: "desktop",
					width: 2,
					height: 2,
				},
			],
			requiredViewportIds: ["desktop"],
			consoleEvents: [],
			consolePolicy: { failOn: ["error"] },
			blankScreenshotPolicy: {
				minWidth: 2,
				minHeight: 2,
				minBytes: 64,
				minUniqueColors: 2,
			},
			...overrides,
		};
		const path = join(tempDir, name);
		writeFileSync(path, JSON.stringify(manifest, null, 2));
		return name;
	}

	it("passes a manifest with viewport coverage and no disallowed console events", () => {
		writeFileSync(
			join(tempDir, "desktop.png"),
			png(2, 2, [
				[255, 0, 0, 255],
				[0, 255, 0, 255],
				[255, 0, 0, 255],
				[0, 255, 0, 255],
			]),
		);
		const report = validateBrowserEvidenceManifest({
			manifestPath: writeManifest("browser-evidence.json"),
			baseDir: tempDir,
			requiredViewportIds: ["desktop"],
		});

		expect(report.passed).toBe(true);
		expectBehavior({
			given: "browser evidence manifest with one nonblank desktop screenshot",
			should: "produce a passing browser-evidence validation report",
			actual: report.passed,
			expected: true,
		});
		expect(report.errors).toEqual([]);
		expect(report.screenshotsChecked).toBe(1);
	});

	it("fails when a referenced screenshot is missing", () => {
		const report = validateBrowserEvidenceManifest({
			manifestPath: writeManifest("browser-evidence.json", {
				blankScreenshotPolicy: {
					minWidth: 2,
					minHeight: 2,
					minBytes: 64,
					minUniqueColors: 2,
				},
			}),
			baseDir: tempDir,
		});

		expect(report.passed).toBe(false);
		expect(report.errors.map((error) => error.code)).toContain(
			"BROWSER_SCREENSHOT_MISSING",
		);
	});

	it("keeps the schema console fail policy aligned with parser validation", () => {
		const schema = JSON.parse(
			readFileSync(
				join(process.cwd(), "contracts/browser-evidence.schema.json"),
				"utf-8",
			),
		) as {
			properties?: {
				consolePolicy?: {
					properties?: { failOn?: Record<string, unknown> };
				};
			};
		};

		expect(schema.properties?.consolePolicy?.properties?.failOn).toMatchObject({
			type: "array",
			minItems: 1,
			contains: { const: "error" },
		});
	});

	it("keeps schema blank screenshot policy floors aligned with parser validation", () => {
		const schema = JSON.parse(
			readFileSync(
				join(process.cwd(), "contracts/browser-evidence.schema.json"),
				"utf-8",
			),
		) as {
			properties?: {
				blankScreenshotPolicy?: {
					properties?: Record<string, Record<string, unknown>>;
				};
			};
		};

		expect(schema.properties?.blankScreenshotPolicy?.properties).toMatchObject({
			minWidth: { minimum: 2 },
			minHeight: { minimum: 2 },
			minBytes: { minimum: 64 },
			minUniqueColors: { minimum: 2 },
		});
	});

	it("keeps schema console timestamp format aligned with parser validation", () => {
		writeFileSync(
			join(tempDir, "desktop.png"),
			png(2, 2, [
				[255, 0, 0, 255],
				[0, 255, 0, 255],
				[255, 0, 0, 255],
				[0, 255, 0, 255],
			]),
		);
		const report = validateBrowserEvidenceManifest({
			manifestPath: writeManifest("browser-evidence.json", {
				consoleEvents: [{ level: "info", timestamp: "not-a-date" }],
			}),
			baseDir: tempDir,
		});

		expect(report.passed).toBe(false);
		expect(report.errors.map((error) => error.code)).toContain(
			"BROWSER_MANIFEST_SCHEMA_INVALID",
		);
		expect(report.errors.map((error) => error.message)).toContain(
			"Browser evidence console event timestamp must be an RFC3339 date-time string.",
		);
	});

	it("rejects normalized invalid console timestamp calendar values", () => {
		for (const timestamp of ["2026-02-31T00:00:00Z", "2026-01-01T24:00:00Z"]) {
			writeFileSync(
				join(tempDir, "desktop.png"),
				png(2, 2, [
					[255, 0, 0, 255],
					[0, 255, 0, 255],
					[255, 0, 0, 255],
					[0, 255, 0, 255],
				]),
			);
			const report = validateBrowserEvidenceManifest({
				manifestPath: writeManifest("browser-evidence.json", {
					consoleEvents: [{ level: "info", timestamp }],
				}),
				baseDir: tempDir,
			});

			expect(report.passed).toBe(false);
			expect(report.errors.map((error) => error.message)).toContain(
				"Browser evidence console event timestamp must be an RFC3339 date-time string.",
			);
		}
	});

	it("rejects empty screenshot arrays before evidence can pass", () => {
		const report = validateBrowserEvidenceManifest({
			manifestPath: writeManifest("browser-evidence.json", {
				screenshots: [],
			}),
			baseDir: tempDir,
		});

		expect(report.passed).toBe(false);
		expect(report.errors.map((error) => error.message)).toContain(
			"Browser evidence manifest screenshots must include path, viewportId, width, and height.",
		);
	});

	it("rejects non-string optional fields instead of dropping them", () => {
		writeFileSync(
			join(tempDir, "desktop.png"),
			png(2, 2, [
				[255, 0, 0, 255],
				[0, 255, 0, 255],
				[255, 0, 0, 255],
				[0, 255, 0, 255],
			]),
		);
		const report = validateBrowserEvidenceManifest({
			manifestPath: writeManifest("browser-evidence.json", {
				screenshots: [
					{
						path: "desktop.png",
						viewportId: "desktop",
						width: 2,
						height: 2,
						description: 123,
					},
				],
				consoleEvents: [
					{
						level: "info",
						message: 123,
						source: false,
						text: { value: "not-string" },
						timestamp: 123,
					},
				],
			}),
			baseDir: tempDir,
		});

		expect(report.passed).toBe(false);
		expect(report.errors.map((error) => error.message)).toEqual(
			expect.arrayContaining([
				"Browser evidence manifest screenshots[].description must be a string when present.",
				"Browser evidence manifest consoleEvents[].message must be a string when present.",
				"Browser evidence manifest consoleEvents[].source must be a string when present.",
				"Browser evidence manifest consoleEvents[].text must be a string when present.",
				"Browser evidence manifest consoleEvents[].timestamp must be a string when present.",
			]),
		);
	});

	it("classifies manifest paths outside the repo as unsafe", () => {
		const report = validateBrowserEvidenceManifest({
			manifestPath: "../browser-evidence.json",
			baseDir: tempDir,
		});

		expect(report.passed).toBe(false);
		expect(report.errors.map((error) => error.code)).toContain(
			"BROWSER_MANIFEST_PATH_UNSAFE",
		);
	});

	it("fails blank screenshots with deterministic screenshot thresholds", () => {
		writeFileSync(
			join(tempDir, "desktop.png"),
			png(2, 2, [
				[255, 255, 255, 255],
				[255, 255, 255, 255],
				[255, 255, 255, 255],
				[255, 255, 255, 255],
			]),
		);
		const report = validateBrowserEvidenceManifest({
			manifestPath: writeManifest("browser-evidence.json"),
			baseDir: tempDir,
		});

		expect(report.passed).toBe(false);
		expect(report.errors.map((error) => error.code)).toContain(
			"BROWSER_SCREENSHOT_BLANK",
		);
	});

	it("does not let manifests lower the trusted nonblank screenshot floor", () => {
		writeFileSync(join(tempDir, "desktop.png"), png(1, 1, [[255, 0, 0, 255]]));
		const report = validateBrowserEvidenceManifest({
			manifestPath: writeManifest("browser-evidence.json", {
				screenshots: [
					{ path: "desktop.png", viewportId: "desktop", width: 1, height: 1 },
				],
				blankScreenshotPolicy: {
					minWidth: 1,
					minHeight: 1,
					minBytes: 1,
					minUniqueColors: 1,
				},
			}),
			baseDir: tempDir,
		});

		expect(report.passed).toBe(false);
		expect(report.errors.map((error) => error.code)).toContain(
			"BROWSER_MANIFEST_SCHEMA_INVALID",
		);
	});

	it("does not let manifests disable error-level console failures", () => {
		writeFileSync(
			join(tempDir, "desktop.png"),
			png(2, 2, [
				[255, 0, 0, 255],
				[0, 255, 0, 255],
				[255, 0, 0, 255],
				[0, 255, 0, 255],
			]),
		);
		const report = validateBrowserEvidenceManifest({
			manifestPath: writeManifest("browser-evidence.json", {
				consoleEvents: [{ level: "error", message: "render failed" }],
				consolePolicy: { failOn: ["warning"] },
			}),
			baseDir: tempDir,
		});

		expect(report.passed).toBe(false);
		expect(report.errors.map((error) => error.code)).toContain(
			"BROWSER_CONSOLE_POLICY_VIOLATION",
		);
	});

	it("fails when required viewport coverage is missing", () => {
		writeFileSync(
			join(tempDir, "desktop.png"),
			png(2, 2, [
				[255, 0, 0, 255],
				[0, 255, 0, 255],
				[255, 0, 0, 255],
				[0, 255, 0, 255],
			]),
		);
		const report = validateBrowserEvidenceManifest({
			manifestPath: writeManifest("browser-evidence.json"),
			baseDir: tempDir,
			requiredViewportIds: ["desktop", "mobile"],
		});

		expect(report.passed).toBe(false);
		expect(report.missingViewportIds).toEqual(["mobile"]);
		expect(report.errors.map((error) => error.code)).toContain(
			"BROWSER_VIEWPORT_COVERAGE_MISSING",
		);
	});

	it("does not let CLI-required viewports weaken manifest coverage", () => {
		writeFileSync(
			join(tempDir, "desktop.png"),
			png(2, 2, [
				[255, 0, 0, 255],
				[0, 255, 0, 255],
				[255, 0, 0, 255],
				[0, 255, 0, 255],
			]),
		);
		const report = validateBrowserEvidenceManifest({
			manifestPath: writeManifest("browser-evidence.json", {
				requiredViewportIds: ["desktop", "mobile"],
			}),
			baseDir: tempDir,
			requiredViewportIds: ["desktop"],
		});

		expect(report.passed).toBe(false);
		expect(report.requiredViewportIds).toEqual(["desktop", "mobile"]);
		expect(report.missingViewportIds).toEqual(["mobile"]);
		expect(report.errors.map((error) => error.code)).toContain(
			"BROWSER_VIEWPORT_COVERAGE_MISSING",
		);
	});

	it("rejects unknown manifest properties at every object boundary", () => {
		writeFileSync(
			join(tempDir, "desktop.png"),
			png(2, 2, [
				[255, 0, 0, 255],
				[0, 255, 0, 255],
				[255, 0, 0, 255],
				[0, 255, 0, 255],
			]),
		);
		const report = validateBrowserEvidenceManifest({
			manifestPath: writeManifest("browser-evidence.json", {
				unexpectedRoot: true,
				screenshots: [
					{
						path: "desktop.png",
						viewportId: "desktop",
						width: 2,
						height: 2,
						unexpectedScreenshot: true,
					},
				],
				consoleEvents: [{ level: "info", unexpectedEvent: true }],
				consolePolicy: { failOn: ["error"], unexpectedPolicy: true },
				blankScreenshotPolicy: {
					minWidth: 2,
					minHeight: 2,
					minBytes: 64,
					minUniqueColors: 2,
					unexpectedBlankPolicy: true,
				},
			}),
			baseDir: tempDir,
		});

		expect(report.passed).toBe(false);
		expect(report.errors.map((error) => error.message)).toEqual(
			expect.arrayContaining([
				expect.stringContaining("unsupported property: unexpectedRoot"),
				expect.stringContaining("unsupported property: unexpectedScreenshot"),
				expect.stringContaining("unsupported property: unexpectedEvent"),
				expect.stringContaining("unsupported property: unexpectedPolicy"),
				expect.stringContaining("unsupported property: unexpectedBlankPolicy"),
			]),
		);
	});

	it("rejects empty console fail policies before treating evidence as valid", () => {
		writeFileSync(
			join(tempDir, "desktop.png"),
			png(2, 2, [
				[255, 0, 0, 255],
				[0, 255, 0, 255],
				[255, 0, 0, 255],
				[0, 255, 0, 255],
			]),
		);
		const report = validateBrowserEvidenceManifest({
			manifestPath: writeManifest("browser-evidence.json", {
				consolePolicy: { failOn: [] },
			}),
			baseDir: tempDir,
		});

		expect(report.passed).toBe(false);
		expect(report.errors.map((error) => error.code)).toContain(
			"BROWSER_CONSOLE_POLICY_VIOLATION",
		);
	});

	it("rejects fractional pixel and threshold fields", () => {
		writeFileSync(
			join(tempDir, "desktop.png"),
			png(2, 2, [
				[255, 0, 0, 255],
				[0, 255, 0, 255],
				[255, 0, 0, 255],
				[0, 255, 0, 255],
			]),
		);
		const report = validateBrowserEvidenceManifest({
			manifestPath: writeManifest("browser-evidence.json", {
				screenshots: [
					{ path: "desktop.png", viewportId: "desktop", width: 2.5, height: 2 },
				],
				blankScreenshotPolicy: {
					minWidth: 2,
					minHeight: 2,
					minBytes: 64.5,
					minUniqueColors: 2,
				},
			}),
			baseDir: tempDir,
		});

		expect(report.passed).toBe(false);
		expect(report.errors.map((error) => error.code)).toContain(
			"BROWSER_MANIFEST_SCHEMA_INVALID",
		);
	});

	it("fails when multiple required viewports reuse the same screenshot artifact", () => {
		writeFileSync(
			join(tempDir, "shared.png"),
			png(2, 2, [
				[255, 0, 0, 255],
				[0, 255, 0, 255],
				[255, 0, 0, 255],
				[0, 255, 0, 255],
			]),
		);
		const report = validateBrowserEvidenceManifest({
			manifestPath: writeManifest("browser-evidence.json", {
				screenshots: [
					{ path: "shared.png", viewportId: "desktop", width: 2, height: 2 },
					{ path: "./shared.png", viewportId: "mobile", width: 2, height: 2 },
				],
				requiredViewportIds: ["desktop", "mobile"],
			}),
			baseDir: tempDir,
		});

		expect(report.passed).toBe(false);
		expect(report.errors.map((error) => error.code)).toContain(
			"BROWSER_VIEWPORT_COVERAGE_MISSING",
		);
	});

	it("accepts valid browser PNG screenshots above the generic evidence size limit", () => {
		writeFileSync(join(tempDir, "desktop.png"), largePng(1200, 1200));
		const sizeBytes = statSync(join(tempDir, "desktop.png")).size;
		expect(sizeBytes).toBeGreaterThan(DEFAULT_MAX_FILE_SIZE_BYTES);
		expect(sizeBytes).toBeLessThan(
			DEFAULT_BROWSER_SCREENSHOT_MAX_FILE_SIZE_BYTES,
		);

		const report = validateBrowserEvidenceManifest({
			manifestPath: writeManifest("browser-evidence.json", {
				screenshots: [
					{
						path: "desktop.png",
						viewportId: "desktop",
						width: 1200,
						height: 1200,
					},
				],
			}),
			baseDir: tempDir,
		});

		expect(report.passed).toBe(true);
		expect(report.errors).toEqual([]);
	});

	it("fails uninspectable PNG artifacts without escaping as a system error", () => {
		writeFileSync(join(tempDir, "desktop.png"), pngWithInvalidFilter(2, 2));

		const report = validateBrowserEvidenceManifest({
			manifestPath: writeManifest("browser-evidence.json"),
			baseDir: tempDir,
		});

		expect(report.passed).toBe(false);
		expect(report.errors.map((error) => error.code)).toContain(
			"BROWSER_SCREENSHOT_INVALID_FORMAT",
		);
	});

	it("fails non-PNG screenshots instead of trusting declared dimensions", () => {
		writeFileSync(
			join(tempDir, "desktop.jpg"),
			Buffer.concat([
				Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
				Buffer.alloc(80, 0),
				Buffer.from([0xff, 0xd9]),
			]),
		);
		const report = validateBrowserEvidenceManifest({
			manifestPath: writeManifest("browser-evidence.json", {
				screenshots: [
					{ path: "desktop.jpg", viewportId: "desktop", width: 2, height: 2 },
				],
			}),
			baseDir: tempDir,
		});

		expect(report.passed).toBe(false);
		expect(report.errors.map((error) => error.code)).toContain(
			"BROWSER_SCREENSHOT_INVALID_FORMAT",
		);
	});

	it("fails malformed PNG screenshots without throwing", () => {
		writeFileSync(join(tempDir, "desktop.png"), truncatedPngHeader());
		const report = validateBrowserEvidenceManifest({
			manifestPath: writeManifest("browser-evidence.json"),
			baseDir: tempDir,
		});

		expect(report.passed).toBe(false);
		expect(report.errors.map((error) => error.code)).toContain(
			"BROWSER_SCREENSHOT_INVALID_FORMAT",
		);
	});

	it("fails when console telemetry is omitted", () => {
		writeFileSync(
			join(tempDir, "desktop.png"),
			png(2, 2, [
				[255, 0, 0, 255],
				[0, 255, 0, 255],
				[255, 0, 0, 255],
				[0, 255, 0, 255],
			]),
		);
		const manifest = {
			schemaVersion: "browser-evidence/v1",
			screenshots: [
				{ path: "desktop.png", viewportId: "desktop", width: 2, height: 2 },
			],
			requiredViewportIds: ["desktop"],
			consolePolicy: { failOn: ["error"] },
			blankScreenshotPolicy: {
				minWidth: 2,
				minHeight: 2,
				minBytes: 64,
				minUniqueColors: 2,
			},
		};
		writeFileSync(
			join(tempDir, "browser-evidence.json"),
			JSON.stringify(manifest, null, 2),
		);

		const report = validateBrowserEvidenceManifest({
			manifestPath: "browser-evidence.json",
			baseDir: tempDir,
		});

		expect(report.passed).toBe(false);
		expect(report.errors.map((error) => error.code)).toContain(
			"BROWSER_CONSOLE_TELEMETRY_MISSING",
		);
	});

	it("fails closed when required policy objects are omitted", () => {
		writeFileSync(
			join(tempDir, "desktop.png"),
			png(2, 2, [
				[255, 0, 0, 255],
				[0, 255, 0, 255],
				[255, 0, 0, 255],
				[0, 255, 0, 255],
			]),
		);
		const manifest = {
			schemaVersion: "browser-evidence/v1",
			screenshots: [
				{ path: "desktop.png", viewportId: "desktop", width: 2, height: 2 },
			],
			requiredViewportIds: ["desktop"],
			consoleEvents: [],
		};
		writeFileSync(
			join(tempDir, "browser-evidence.json"),
			JSON.stringify(manifest, null, 2),
		);

		const report = validateBrowserEvidenceManifest({
			manifestPath: "browser-evidence.json",
			baseDir: tempDir,
		});

		expect(report.passed).toBe(false);
		expect(report.errors.map((error) => error.code)).toContain(
			"BROWSER_MANIFEST_SCHEMA_INVALID",
		);
	});

	it("fails closed when console policy levels are malformed", () => {
		writeFileSync(
			join(tempDir, "desktop.png"),
			png(2, 2, [
				[255, 0, 0, 255],
				[0, 255, 0, 255],
				[255, 0, 0, 255],
				[0, 255, 0, 255],
			]),
		);
		const report = validateBrowserEvidenceManifest({
			manifestPath: writeManifest("browser-evidence.json", {
				consolePolicy: { failOn: ["warn"] },
			}),
			baseDir: tempDir,
		});

		expect(report.passed).toBe(false);
		expect(report.errors.map((error) => error.code)).toContain(
			"BROWSER_CONSOLE_POLICY_VIOLATION",
		);
	});

	it("fails disallowed console errors by default", () => {
		writeFileSync(
			join(tempDir, "desktop.png"),
			png(2, 2, [
				[255, 0, 0, 255],
				[0, 255, 0, 255],
				[255, 0, 0, 255],
				[0, 255, 0, 255],
			]),
		);
		const report = validateBrowserEvidenceManifest({
			manifestPath: writeManifest("browser-evidence.json", {
				consoleEvents: [{ level: "error", message: "render failed" }],
			}),
			baseDir: tempDir,
		});

		expect(report.passed).toBe(false);
		expect(report.errors.map((error) => error.code)).toContain(
			"BROWSER_CONSOLE_ERROR_DISALLOWED",
		);
	});

	it("redacts sensitive console event text before reporting policy failures", () => {
		writeFileSync(
			join(tempDir, "desktop.png"),
			png(2, 2, [
				[255, 0, 0, 255],
				[0, 255, 0, 255],
				[255, 0, 0, 255],
				[0, 255, 0, 255],
			]),
		);
		const report = validateBrowserEvidenceManifest({
			manifestPath: writeManifest("browser-evidence.json", {
				consoleEvents: [
					{
						level: "error",
						message: "request failed with token=TEST_TOKEN_PLACEHOLDER",
					},
				],
			}),
			baseDir: tempDir,
		});
		const rendered = JSON.stringify(report);

		expect(rendered).toContain("[REDACTED]");
		expect(rendered).not.toContain("TEST_TOKEN_PLACEHOLDER");
	});
});
