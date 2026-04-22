import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONTRACT } from "../lib/contract/types.js";
import {
	EXIT_CODES,
	runEvidenceVerify,
	runEvidenceVerifyCLI,
} from "./evidence-verify.js";

describe("evidence-verify", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `harness-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
	});

	afterEach(() => {
		vi.restoreAllMocks();
		rmSync(tempDir, { recursive: true, force: true });
	});

	describe("runEvidenceVerify", () => {
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

		it("enforces policy when contract and changed files are provided", () => {
			const contractFile = join(tempDir, "harness.contract.json");
			writeFileSync(
				contractFile,
				JSON.stringify(
					{
						...DEFAULT_CONTRACT,
						evidencePolicy: {
							requiredFor: ["src/ui/**"],
							allowedTypes: ["png"],
							maxFileSizeBytes: 1024 * 1024,
						},
					},
					null,
					2,
				),
			);

			const pngFile = join(tempDir, "button.png");
			const pngHeader = Buffer.from([
				0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
			]);
			writeFileSync(pngFile, pngHeader);

			const passing = runEvidenceVerify({
				files: ["button.png"],
				contract: "harness.contract.json",
				changed: ["src/ui/button.tsx"],
				baseDir: tempDir,
			});
			expect(passing.ok).toBe(true);
			if (passing.ok) {
				expect(passing.output.failed).toBe(0);
				expect(passing.output.verified).toBe(1);
			}

			const missingEvidence = runEvidenceVerify({
				files: ["button.png"],
				contract: "harness.contract.json",
				changed: ["src/ui/card.tsx"],
				baseDir: tempDir,
			});
			expect(missingEvidence.ok).toBe(true);
			if (missingEvidence.ok) {
				expect(missingEvidence.output.failed).toBeGreaterThan(0);
				expect(
					missingEvidence.output.errors.some(
						(error) =>
							error.code === "FILE_NOT_FOUND" &&
							error.path === "src/ui/card.tsx",
					),
				).toBe(true);
			}
		});

		it("propagates disallowed evidence format violations at command level", () => {
			const contractFile = join(tempDir, "harness.contract.json");
			writeFileSync(
				contractFile,
				JSON.stringify(
					{
						...DEFAULT_CONTRACT,
						evidencePolicy: {
							requiredFor: ["src/ui/**"],
							allowedTypes: ["png"],
							maxFileSizeBytes: 1024 * 1024,
						},
					},
					null,
					2,
				),
			);

			const jpegFile = join(tempDir, "button.jpg");
			const jpegHeader = Buffer.from([
				0xff, 0xd8, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00,
			]);
			writeFileSync(jpegFile, jpegHeader);

			const result = runEvidenceVerify({
				files: ["button.jpg"],
				contract: "harness.contract.json",
				changed: ["src/ui/button.tsx"],
				baseDir: tempDir,
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(
					result.output.errors.some((error) => error.code === "INVALID_FORMAT"),
				).toBe(true);
			}
		});

		it("maps malformed contract files to VALIDATION_ERROR", () => {
			const invalidContract = join(tempDir, "invalid.contract.json");
			writeFileSync(invalidContract, "{invalid-json", "utf-8");

			const result = runEvidenceVerify({
				files: [],
				contract: "invalid.contract.json",
				baseDir: tempDir,
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("VALIDATION_ERROR");
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

		it("prints structured JSON output in --json mode for successful verification", () => {
			const pngFile = join(tempDir, "test.png");
			const pngHeader = Buffer.from([
				0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
			]);
			writeFileSync(pngFile, pngHeader);

			const infoSpy = vi
				.spyOn(console, "info")
				.mockImplementation(() => undefined);

			const exitCode = runEvidenceVerifyCLI({
				files: ["test.png"],
				baseDir: tempDir,
				json: true,
			});

			expect(exitCode).toBe(EXIT_CODES.SUCCESS);
			const payload = JSON.parse(
				String(infoSpy.mock.calls[infoSpy.mock.calls.length - 1]?.[0]),
			) as {
				verified: number;
				failed: number;
				files: unknown[];
				errors: unknown[];
			};
			expect(payload.verified).toBe(1);
			expect(payload.failed).toBe(0);
			expect(payload.files).toHaveLength(1);
			expect(payload.errors).toHaveLength(0);
		});

		it("prints structured JSON output in --json mode for failing verification", () => {
			const txtFile = join(tempDir, "test.txt");
			writeFileSync(txtFile, "not an image");

			const infoSpy = vi
				.spyOn(console, "info")
				.mockImplementation(() => undefined);

			const exitCode = runEvidenceVerifyCLI({
				files: ["test.txt"],
				baseDir: tempDir,
				json: true,
			});

			expect(exitCode).toBe(EXIT_CODES.VALIDATION_ERROR);
			const payload = JSON.parse(
				String(infoSpy.mock.calls[infoSpy.mock.calls.length - 1]?.[0]),
			) as {
				verified: number;
				failed: number;
				files: unknown[];
				errors: Array<{ code?: string }>;
			};
			expect(payload.verified).toBe(0);
			expect(payload.failed).toBe(1);
			expect(payload.files).toHaveLength(0);
			expect(
				payload.errors.some((error) => error.code === "INVALID_FORMAT"),
			).toBe(true);
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
