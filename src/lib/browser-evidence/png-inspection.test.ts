import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { inspectPng } from "./png-inspection.js";
import {
	grayscaleAlphaPngWithPixels,
	indexedPngWithPaletteIndexes,
	pngWithDeclaredSize,
	pngWithPixels,
	pngWithUnsupportedIhdrMethods,
	pngWithoutIend,
} from "./png-test-fixtures.js";

describe("inspectPng", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "browser-png-inspection-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("rejects PNGs whose declared dimensions exceed the bounded inflate budget", () => {
		const path = join(tempDir, "oversized-declared-pixels.png");
		writeFileSync(path, pngWithDeclaredSize(10_000, 10_000));

		expect(inspectPng(path)).toBeNull();
	});

	it("rejects PNGs missing the required terminal IEND chunk", () => {
		const path = join(tempDir, "missing-iend.png");
		writeFileSync(path, pngWithoutIend(2, 2));

		expect(inspectPng(path)).toBeNull();
	});

	it("rejects PNGs with unsupported IHDR compression or filter methods", () => {
		const path = join(tempDir, "unsupported-ihdr-methods.png");
		writeFileSync(path, pngWithUnsupportedIhdrMethods(2, 2));

		expect(inspectPng(path)).toBeNull();
	});

	it("caps unique color tracking at the requested nonblank proof threshold", () => {
		const path = join(tempDir, "high-entropy.png");
		writeFileSync(
			path,
			pngWithPixels(2, 2, [
				[255, 0, 0, 255],
				[0, 255, 0, 255],
				[0, 0, 255, 255],
				[255, 255, 0, 255],
			]),
		);

		expect(inspectPng(path, { minUniqueColors: 2 })?.uniqueColors).toBe(2);
	});

	it("rejects indexed-color PNGs until palette colors can be resolved", () => {
		const path = join(tempDir, "indexed-palette.png");
		writeFileSync(path, indexedPngWithPaletteIndexes(2, 2, [0, 1, 0, 1]));

		expect(inspectPng(path)).toBeNull();
	});

	it("does not count fully transparent RGBA pixels as visible color proof", () => {
		const path = join(tempDir, "transparent-rgba.png");
		writeFileSync(
			path,
			pngWithPixels(2, 2, [
				[255, 0, 0, 0],
				[0, 255, 0, 0],
				[0, 0, 255, 0],
				[255, 255, 0, 0],
			]),
		);

		expect(inspectPng(path, { minUniqueColors: 2 })?.uniqueColors).toBe(0);
	});

	it("does not count fully transparent grayscale-alpha pixels as visible color proof", () => {
		const path = join(tempDir, "transparent-grayscale-alpha.png");
		writeFileSync(
			path,
			grayscaleAlphaPngWithPixels(2, 2, [
				[0, 0],
				[85, 0],
				[170, 0],
				[255, 0],
			]),
		);

		expect(inspectPng(path, { minUniqueColors: 2 })?.uniqueColors).toBe(0);
	});
});
