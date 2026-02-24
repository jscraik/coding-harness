import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	PathTraversalError,
	detectImageFormat,
	loadEvidenceFile,
	validatePath,
} from "./validator.js";

describe("detectImageFormat", () => {
	it("detects PNG format from magic bytes", () => {
		// PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
		const pngBuffer = Buffer.from([
			0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
		]);
		expect(detectImageFormat(pngBuffer)).toBe("png");
	});

	it("detects JPEG format from magic bytes", () => {
		// JPEG magic bytes: FF D8 FF
		const jpegBuffer = Buffer.from([
			0xff, 0xd8, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00,
		]);
		expect(detectImageFormat(jpegBuffer)).toBe("jpeg");
	});

	it("returns null for invalid image format", () => {
		const invalidBuffer = Buffer.from([
			0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		]);
		expect(detectImageFormat(invalidBuffer)).toBeNull();
	});

	it("returns null for buffer too small", () => {
		const smallBuffer = Buffer.from([0x89, 0x50]);
		expect(detectImageFormat(smallBuffer)).toBeNull();
	});

	it("returns null for text file", () => {
		const textBuffer = Buffer.from("Hello, World!");
		expect(detectImageFormat(textBuffer)).toBeNull();
	});
});

describe("validatePath", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `harness-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("allows paths within base directory", () => {
		const validPath = "test.txt";
		const result = validatePath(tempDir, validPath);
		expect(result).toContain(tempDir);
	});

	it("allows nested paths within base directory", () => {
		// Create the subdirectory first (parent must exist for validation)
		mkdirSync(join(tempDir, "subdir"), { recursive: true });
		const validPath = "subdir/test.txt";
		const result = validatePath(tempDir, validPath);
		expect(result).toContain(tempDir);
	});

	it("throws PathTraversalError for path traversal attempt", () => {
		expect(() => validatePath(tempDir, "../../../etc/passwd")).toThrow(
			PathTraversalError,
		);
	});

	it("throws PathTraversalError for absolute path escape", () => {
		expect(() => validatePath(tempDir, "/etc/passwd")).toThrow(
			PathTraversalError,
		);
	});

	it("handles non-existent paths via parent directory", () => {
		// Create the parent directory first (required for validation)
		mkdirSync(join(tempDir, "nonexistent"), { recursive: true });
		const result = validatePath(tempDir, "nonexistent/file.txt");
		expect(result).toContain(tempDir);
	});
});

describe("loadEvidenceFile", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `harness-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("returns FILE_NOT_FOUND for missing file", () => {
		const result = loadEvidenceFile("missing.png", tempDir);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.code).toBe("FILE_NOT_FOUND");
			expect(result.path).toBe("missing.png");
		}
	});

	it("returns INVALID_FORMAT for non-image file", () => {
		const textFile = join(tempDir, "test.txt");
		writeFileSync(textFile, "Hello, World!");

		const result = loadEvidenceFile("test.txt", tempDir);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.code).toBe("INVALID_FORMAT");
		}
	});

	it("returns INVALID_FORMAT for corrupted PNG", () => {
		const corruptedPng = join(tempDir, "corrupted.png");
		// Write PNG extension but wrong magic bytes
		writeFileSync(
			corruptedPng,
			Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
		);

		const result = loadEvidenceFile("corrupted.png", tempDir);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.code).toBe("INVALID_FORMAT");
		}
	});

	it("returns FILE_TOO_LARGE for oversized file", () => {
		const largeFile = join(tempDir, "large.png");
		// Create a valid PNG header + extra data
		const pngHeader = Buffer.from([
			0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
		]);
		const largeContent = Buffer.concat([pngHeader, Buffer.alloc(2000)]);
		writeFileSync(largeFile, largeContent);

		// Set max size to 100 bytes (smaller than file)
		const result = loadEvidenceFile("large.png", tempDir, 100);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.code).toBe("FILE_TOO_LARGE");
		}
	});

	it("returns PATH_TRAVERSAL for path escape attempt", () => {
		const result = loadEvidenceFile("../../../etc/passwd", tempDir);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.code).toBe("PATH_TRAVERSAL");
		}
	});

	it("validates valid PNG file", () => {
		const pngFile = join(tempDir, "valid.png");
		// Minimal valid PNG header
		const pngHeader = Buffer.from([
			0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
		]);
		writeFileSync(pngFile, pngHeader);

		const result = loadEvidenceFile("valid.png", tempDir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.file.type).toBe("png");
			expect(result.file.sizeBytes).toBe(8);
		}
	});

	it("validates valid JPEG file", () => {
		const jpegFile = join(tempDir, "valid.jpg");
		// Minimal valid JPEG header
		const jpegHeader = Buffer.from([
			0xff, 0xd8, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00,
		]);
		writeFileSync(jpegFile, jpegHeader);

		const result = loadEvidenceFile("valid.jpg", tempDir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.file.type).toBe("jpeg");
			expect(result.file.sizeBytes).toBe(8);
		}
	});

	it("handles .jpeg extension", () => {
		const jpegFile = join(tempDir, "valid.jpeg");
		const jpegHeader = Buffer.from([
			0xff, 0xd8, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00,
		]);
		writeFileSync(jpegFile, jpegHeader);

		const result = loadEvidenceFile("valid.jpeg", tempDir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.file.type).toBe("jpeg");
		}
	});
});
