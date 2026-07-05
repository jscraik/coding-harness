import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	PathTraversalError,
	detectEvidenceFormat,
	detectImageFormat,
	detectVideoFormat,
	getEvidenceType,
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

describe("detectVideoFormat", () => {
	it("detects MP4 format from magic bytes", () => {
		// MP4: [size (4 bytes)] 'ftyp' [brand]
		// Common MP4 header: 00 00 00 20 66 74 79 70 (ftyp at offset 4)
		const mp4Buffer = Buffer.from([
			0x00,
			0x00,
			0x00,
			0x20, // size
			0x66,
			0x74,
			0x79,
			0x70, // 'ftyp'
			0x69,
			0x73,
			0x6f,
			0x6d, // 'isom' brand
		]);
		expect(detectVideoFormat(mp4Buffer)).toBe("mp4");
	});

	it("detects WebM format from magic bytes", () => {
		// WebM: EBML header 1A 45 DF A3
		const webmBuffer = Buffer.from([
			0x1a, 0x45, 0xdf, 0xa3, 0x93, 0x00, 0x00, 0x00,
		]);
		expect(detectVideoFormat(webmBuffer)).toBe("webm");
	});

	it("returns null for image formats", () => {
		// PNG magic bytes should not be detected as video
		const pngBuffer = Buffer.from([
			0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
		]);
		expect(detectVideoFormat(pngBuffer)).toBeNull();
	});

	it("returns null for invalid video format", () => {
		const invalidBuffer = Buffer.from([
			0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		]);
		expect(detectVideoFormat(invalidBuffer)).toBeNull();
	});

	it("returns null for buffer too small", () => {
		const smallBuffer = Buffer.from([0x1a, 0x45]);
		expect(detectVideoFormat(smallBuffer)).toBeNull();
	});

	it("returns null for buffer with exactly 7 bytes (one less than minimum)", () => {
		const sevenBytes = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00, 0x00]);
		expect(detectVideoFormat(sevenBytes)).toBeNull();
	});

	it("returns null for text file", () => {
		const textBuffer = Buffer.from("Hello, World!");
		expect(detectVideoFormat(textBuffer)).toBeNull();
	});
});

describe("detectEvidenceFormat", () => {
	it("detects PNG as image format", () => {
		const pngBuffer = Buffer.from([
			0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
		]);
		expect(detectEvidenceFormat(pngBuffer)).toBe("png");
	});

	it("detects JPEG as image format", () => {
		const jpegBuffer = Buffer.from([
			0xff, 0xd8, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00,
		]);
		expect(detectEvidenceFormat(jpegBuffer)).toBe("jpeg");
	});

	it("detects MP4 as video format", () => {
		const mp4Buffer = Buffer.from([
			0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
		]);
		expect(detectEvidenceFormat(mp4Buffer)).toBe("mp4");
	});

	it("detects WebM as video format", () => {
		const webmBuffer = Buffer.from([
			0x1a, 0x45, 0xdf, 0xa3, 0x93, 0x00, 0x00, 0x00,
		]);
		expect(detectEvidenceFormat(webmBuffer)).toBe("webm");
	});

	it("returns null for unrecognized format", () => {
		const invalidBuffer = Buffer.from([
			0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		]);
		expect(detectEvidenceFormat(invalidBuffer)).toBeNull();
	});
});

describe("getEvidenceType", () => {
	it("returns screenshot for PNG", () => {
		expect(getEvidenceType("png")).toBe("screenshot");
	});

	it("returns screenshot for JPEG", () => {
		expect(getEvidenceType("jpeg")).toBe("screenshot");
	});

	it("returns video for MP4", () => {
		expect(getEvidenceType("mp4")).toBe("video");
	});

	it("returns video for WebM", () => {
		expect(getEvidenceType("webm")).toBe("video");
	});
});

describe("validatePath", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "harness-test-"));
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

	it("allows non-existent nested paths under base directory", () => {
		const result = validatePath(tempDir, "missing/a/b/c/file.txt");
		expect(result).toContain(tempDir);
	});
});

describe("loadEvidenceFile", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "harness-test-"));
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

	it("returns FILE_NOT_FOUND for missing nested file with absent parent chain", () => {
		const result = loadEvidenceFile("missing/deep/path/file.png", tempDir);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.code).toBe("FILE_NOT_FOUND");
			expect(result.path).toBe("missing/deep/path/file.png");
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

	it("never throws for fuzzed malformed path inputs", () => {
		const validPng = join(tempDir, "seed.png");
		writeFileSync(
			validPng,
			Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		);

		let seed = 9001;
		const rand = (): number => {
			seed = (seed * 1664525 + 1013904223) >>> 0;
			return seed / 0x100000000;
		};

		const alphabet = "abcABC0123/._- \\\\..\0";
		for (let i = 0; i < 250; i++) {
			const len = 1 + Math.floor(rand() * 16);
			let candidate = "";
			for (let j = 0; j < len; j++) {
				candidate +=
					alphabet[Math.floor(rand() * alphabet.length)] ?? alphabet[0] ?? "a";
			}

			expect(() => loadEvidenceFile(candidate, tempDir)).not.toThrow();
			const result = loadEvidenceFile(candidate, tempDir);
			expect(result.ok === true || result.ok === false).toBe(true);
		}
	});

	it("validates valid MP4 file", () => {
		const mp4File = join(tempDir, "valid.mp4");
		// Minimal valid MP4 header (ftyp box)
		const mp4Header = Buffer.from([
			0x00,
			0x00,
			0x00,
			0x20, // size
			0x66,
			0x74,
			0x79,
			0x70, // 'ftyp'
			0x69,
			0x73,
			0x6f,
			0x6d, // 'isom' brand
			0x00,
			0x00,
			0x00,
			0x00,
		]);
		writeFileSync(mp4File, mp4Header);

		const result = loadEvidenceFile("valid.mp4", tempDir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.file.type).toBe("mp4");
			expect(result.file.evidenceType).toBe("video");
			expect(result.file.sizeBytes).toBe(16);
		}
	});

	it("validates valid WebM file", () => {
		const webmFile = join(tempDir, "valid.webm");
		// Minimal valid WebM header (EBML)
		const webmHeader = Buffer.from([
			0x1a, 0x45, 0xdf, 0xa3, 0x93, 0x00, 0x00, 0x00,
		]);
		writeFileSync(webmFile, webmHeader);

		const result = loadEvidenceFile("valid.webm", tempDir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.file.type).toBe("webm");
			expect(result.file.evidenceType).toBe("video");
			expect(result.file.sizeBytes).toBe(8);
		}
	});

	it("includes evidenceType for image files", () => {
		const pngFile = join(tempDir, "valid.png");
		const pngHeader = Buffer.from([
			0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
		]);
		writeFileSync(pngFile, pngHeader);

		const result = loadEvidenceFile("valid.png", tempDir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.file.evidenceType).toBe("screenshot");
		}
	});

	it("applies video size limit to video files", () => {
		const mp4File = join(tempDir, "large.mp4");
		const mp4Header = Buffer.from([
			0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70,
		]);
		const largeContent = Buffer.concat([mp4Header, Buffer.alloc(2000)]);
		writeFileSync(mp4File, largeContent);

		// Video limit of 100 bytes - file should be too large
		const result = loadEvidenceFile("large.mp4", tempDir, 100, 100);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.code).toBe("FILE_TOO_LARGE");
		}
	});

	it("allows video files within video size limit", () => {
		const mp4File = join(tempDir, "small.mp4");
		const mp4Header = Buffer.from([
			0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
		]);
		writeFileSync(mp4File, mp4Header);

		// Video limit of 1000 bytes - file should pass
		const result = loadEvidenceFile("small.mp4", tempDir, 100, 1000);
		expect(result.ok).toBe(true);
	});

	it("applies image size limit to image files even with higher video limit", () => {
		const pngFile = join(tempDir, "large.png");
		const pngHeader = Buffer.from([
			0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
		]);
		const largeContent = Buffer.concat([pngHeader, Buffer.alloc(2000)]);
		writeFileSync(pngFile, largeContent);

		// Image limit of 100, video limit of 10000 - PNG should fail
		const result = loadEvidenceFile("large.png", tempDir, 100, 10000);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.code).toBe("FILE_TOO_LARGE");
		}
	});
});
