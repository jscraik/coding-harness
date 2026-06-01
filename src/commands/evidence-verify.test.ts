import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	EXIT_CODES,
	runEvidenceVerify,
	runEvidenceVerifyCLI,
} from "./evidence-verify.js";
import { pngWithPixels } from "../lib/browser-evidence/png-test-fixtures.js";

function nonblankPng(): Buffer {
	return pngWithPixels(2, 2, [
		[255, 0, 0, 255],
		[0, 255, 0, 255],
		[0, 0, 255, 255],
		[255, 255, 0, 255],
	]);
}

describe("evidence-verify", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "harness-test-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	describe("runEvidenceVerify", () => {
		function writeBrowserManifest(
			overrides: Record<string, unknown> = {},
		): void {
			writeFileSync(
				join(tempDir, "browser-evidence.json"),
				JSON.stringify(
					{
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
					},
					null,
					2,
				),
			);
		}

		it("returns success for valid PNG file", () => {
			const pngFile = join(tempDir, "test.png");
			const pngHeader = Buffer.from([
				0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
			]);
			writeFileSync(pngFile, pngHeader);

			const result = runEvidenceVerify({
				files: ["test.png"],
				baseDir: tempDir,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.verified).toBe(1);
				expect(result.output.failed).toBe(0);
				expect(result.output.files).toHaveLength(1);
				expect(result.output.files[0]?.type).toBe("png");
			}
		});

		it("returns success for valid JPEG file", () => {
			const jpegFile = join(tempDir, "test.jpg");
			const jpegHeader = Buffer.from([
				0xff, 0xd8, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00,
			]);
			writeFileSync(jpegFile, jpegHeader);

			const result = runEvidenceVerify({
				files: ["test.jpg"],
				baseDir: tempDir,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.verified).toBe(1);
				expect(result.output.files[0]?.type).toBe("jpeg");
			}
		});

		it("handles multiple files with mixed results", () => {
			const pngFile = join(tempDir, "valid.png");
			const jpegFile = join(tempDir, "valid.jpg");
			const txtFile = join(tempDir, "invalid.txt");

			const pngHeader = Buffer.from([
				0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
			]);
			const jpegHeader = Buffer.from([
				0xff, 0xd8, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00,
			]);

			writeFileSync(pngFile, pngHeader);
			writeFileSync(jpegFile, jpegHeader);
			writeFileSync(txtFile, "not an image");

			const result = runEvidenceVerify({
				files: ["valid.png", "valid.jpg", "invalid.txt"],
				baseDir: tempDir,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.verified).toBe(2);
				expect(result.output.failed).toBe(1);
				expect(result.output.files).toHaveLength(2);
				expect(result.output.errors).toHaveLength(1);
				expect(result.output.errors[0]?.code).toBe("INVALID_FORMAT");
			}
		});

		it("returns FILE_NOT_FOUND error for missing files", () => {
			const result = runEvidenceVerify({
				files: ["missing.png"],
				baseDir: tempDir,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.verified).toBe(0);
				expect(result.output.failed).toBe(1);
				expect(result.output.errors[0]?.code).toBe("FILE_NOT_FOUND");
			}
		});

		it("returns error for missing contract file", () => {
			const result = runEvidenceVerify({
				files: [],
				contract: "missing.contract.json",
				baseDir: tempDir,
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("FILE_NOT_FOUND");
			}
		});

		it("handles empty files array", () => {
			const result = runEvidenceVerify({
				files: [],
				baseDir: tempDir,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.verified).toBe(0);
				expect(result.output.failed).toBe(0);
			}
		});

		it("includes browser evidence report for valid browser manifests", () => {
			writeFileSync(join(tempDir, "desktop.png"), nonblankPng());
			writeBrowserManifest();

			const result = runEvidenceVerify({
				files: [],
				browserEvidence: "browser-evidence.json",
				browserRequiredViewports: ["desktop"],
				baseDir: tempDir,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.browserEvidence?.passed).toBe(true);
				expect(result.output.browserEvidence?.errors).toEqual([]);
			}
		});

		it("fails browser evidence manifests with missing screenshots", () => {
			writeBrowserManifest();

			const result = runEvidenceVerify({
				files: [],
				browserEvidence: "browser-evidence.json",
				baseDir: tempDir,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.browserEvidence?.passed).toBe(false);
				expect(
					result.output.browserEvidence?.errors.map((error) => error.code),
				).toContain("BROWSER_SCREENSHOT_MISSING");
			}
		});
	});

	describe("runEvidenceVerifyCLI", () => {
		it("returns SUCCESS (0) for all valid files", () => {
			const pngFile = join(tempDir, "test.png");
			const pngHeader = Buffer.from([
				0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
			]);
			writeFileSync(pngFile, pngHeader);

			const exitCode = runEvidenceVerifyCLI({
				files: ["test.png"],
				baseDir: tempDir,
			});

			expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		});

		it("returns VALIDATION_ERROR (1) for invalid format", () => {
			const txtFile = join(tempDir, "test.txt");
			writeFileSync(txtFile, "not an image");

			const exitCode = runEvidenceVerifyCLI({
				files: ["test.txt"],
				baseDir: tempDir,
			});

			expect(exitCode).toBe(EXIT_CODES.VALIDATION_ERROR);
		});

		it("returns FILE_NOT_FOUND (2) for missing file", () => {
			const exitCode = runEvidenceVerifyCLI({
				files: ["missing.png"],
				baseDir: tempDir,
			});

			expect(exitCode).toBe(EXIT_CODES.FILE_NOT_FOUND);
		});

		it("returns FILE_NOT_FOUND (2) for missing nested file with absent parent chain", () => {
			const exitCode = runEvidenceVerifyCLI({
				files: ["missing/deep/path/file.png"],
				baseDir: tempDir,
			});

			expect(exitCode).toBe(EXIT_CODES.FILE_NOT_FOUND);
		});

		it("returns PATH_TRAVERSAL (3) for path escape attempt", () => {
			const exitCode = runEvidenceVerifyCLI({
				files: ["../../../etc/passwd"],
				baseDir: tempDir,
			});

			expect(exitCode).toBe(EXIT_CODES.PATH_TRAVERSAL);
		});

		it("prioritizes PATH_TRAVERSAL over FILE_NOT_FOUND", () => {
			const pngFile = join(tempDir, "test.png");
			const pngHeader = Buffer.from([
				0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
			]);
			writeFileSync(pngFile, pngHeader);

			const exitCode = runEvidenceVerifyCLI({
				files: ["test.png", "../../../etc/passwd"],
				baseDir: tempDir,
			});

			expect(exitCode).toBe(EXIT_CODES.PATH_TRAVERSAL);
		});

		it("prioritizes FILE_NOT_FOUND over VALIDATION_ERROR", () => {
			const txtFile = join(tempDir, "test.txt");
			writeFileSync(txtFile, "not an image");

			const exitCode = runEvidenceVerifyCLI({
				files: ["test.txt", "missing.png"],
				baseDir: tempDir,
			});

			expect(exitCode).toBe(EXIT_CODES.FILE_NOT_FOUND);
		});

		it("returns VALIDATION_ERROR (1) when browser evidence validation fails", () => {
			writeFileSync(
				join(tempDir, "browser-evidence.json"),
				JSON.stringify({
					schemaVersion: "browser-evidence/v1",
					screenshots: [
						{
							path: "missing.png",
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
				}),
			);

			const exitCode = runEvidenceVerifyCLI({
				files: [],
				baseDir: tempDir,
				browserEvidence: "browser-evidence.json",
			});

			expect(exitCode).toBe(EXIT_CODES.VALIDATION_ERROR);
		});

		it("preserves path traversal precedence when browser evidence also fails", () => {
			writeFileSync(
				join(tempDir, "browser-evidence.json"),
				JSON.stringify({
					schemaVersion: "browser-evidence/v1",
					screenshots: [
						{
							path: "missing.png",
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
				}),
			);

			const exitCode = runEvidenceVerifyCLI({
				files: ["../../../etc/passwd"],
				baseDir: tempDir,
				browserEvidence: "browser-evidence.json",
			});

			expect(exitCode).toBe(EXIT_CODES.PATH_TRAVERSAL);
		});
	});

	describe("EXIT_CODES", () => {
		it("defines correct exit codes", () => {
			expect(EXIT_CODES.SUCCESS).toBe(0);
			expect(EXIT_CODES.VALIDATION_ERROR).toBe(1);
			expect(EXIT_CODES.FILE_NOT_FOUND).toBe(2);
			expect(EXIT_CODES.PATH_TRAVERSAL).toBe(3);
			expect(EXIT_CODES.SYSTEM_ERROR).toBe(10);
		});
	});
});
