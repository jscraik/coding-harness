import { deflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
	let crc = index;
	for (let bit = 0; bit < 8; bit++) {
		crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
	}
	return crc >>> 0;
});

function crc32(data: Buffer): number {
	let crc = 0xffffffff;
	for (const byte of data) {
		crc = (crc >>> 8) ^ (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length, 0);
	const typeBytes = Buffer.from(type, "ascii");
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
	return Buffer.concat([length, typeBytes, data, crc]);
}

function pngHeader(
	width: number,
	height: number,
	colorType = 6,
	compressionMethod = 0,
	filterMethod = 0,
): Buffer {
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8;
	ihdr[9] = colorType;
	ihdr[10] = compressionMethod;
	ihdr[11] = filterMethod;
	ihdr[12] = 0;
	return ihdr;
}

/** Build a structurally valid PNG with declared dimensions and tiny payload. */
export function pngWithDeclaredSize(width: number, height: number): Buffer {
	return Buffer.concat([
		PNG_SIGNATURE,
		chunk("IHDR", pngHeader(width, height)),
		chunk("IDAT", deflateSync(Buffer.from([0]))),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

/** Build a structurally valid RGBA PNG from explicit pixel rows. */
export function pngWithPixels(
	width: number,
	height: number,
	pixels: number[][],
): Buffer {
	const rows: number[] = [];
	for (let row = 0; row < height; row++) {
		rows.push(0);
		for (let col = 0; col < width; col++) {
			const pixel = pixels[row * width + col] ?? [0, 0, 0, 255];
			rows.push(pixel[0] ?? 0, pixel[1] ?? 0, pixel[2] ?? 0, pixel[3] ?? 255);
		}
	}
	return Buffer.concat([
		PNG_SIGNATURE,
		chunk("IHDR", pngHeader(width, height)),
		chunk("IDAT", deflateSync(Buffer.from(rows))),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

/** Build an otherwise valid RGBA PNG missing the required terminal IEND chunk. */
export function pngWithoutIend(width: number, height: number): Buffer {
	const rows: number[] = [];
	for (let row = 0; row < height; row++) {
		rows.push(0);
		for (let col = 0; col < width; col++) {
			rows.push(255, 0, 0, 255);
		}
	}
	return Buffer.concat([
		PNG_SIGNATURE,
		chunk("IHDR", pngHeader(width, height)),
		chunk("IDAT", deflateSync(Buffer.from(rows))),
	]);
}

/** Build an RGBA PNG whose IHDR declares unsupported compression/filter methods. */
export function pngWithUnsupportedIhdrMethods(
	width: number,
	height: number,
): Buffer {
	const rows: number[] = [];
	for (let row = 0; row < height; row++) {
		rows.push(0);
		for (let col = 0; col < width; col++) {
			rows.push(255, 0, 0, 255);
		}
	}
	return Buffer.concat([
		PNG_SIGNATURE,
		chunk("IHDR", pngHeader(width, height, 6, 1, 1)),
		chunk("IDAT", deflateSync(Buffer.from(rows))),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

/** Build an otherwise valid PNG whose first IDAT chunk has a corrupted CRC. */
export function pngWithInvalidChunkCrc(width: number, height: number): Buffer {
	const valid = pngWithPixels(width, height, [
		[255, 0, 0, 255],
		[0, 255, 0, 255],
		[0, 0, 255, 255],
		[255, 255, 0, 255],
	]);
	const mutated = Buffer.from(valid);
	const idatOffset = PNG_SIGNATURE.length + 4 + 4 + 13 + 4;
	const idatLength = mutated.readUInt32BE(idatOffset);
	const crcOffset = idatOffset + 4 + 4 + idatLength;
	mutated[crcOffset + 3] = (mutated[crcOffset + 3] ?? 0) ^ 0xff;
	return mutated;
}

/** Build a structurally valid grayscale-alpha PNG from explicit pixel rows. */
export function grayscaleAlphaPngWithPixels(
	width: number,
	height: number,
	pixels: number[][],
): Buffer {
	const rows: number[] = [];
	for (let row = 0; row < height; row++) {
		rows.push(0);
		for (let col = 0; col < width; col++) {
			const pixel = pixels[row * width + col] ?? [0, 255];
			rows.push(pixel[0] ?? 0, pixel[1] ?? 255);
		}
	}
	return Buffer.concat([
		PNG_SIGNATURE,
		chunk("IHDR", pngHeader(width, height, 4)),
		chunk("IDAT", deflateSync(Buffer.from(rows))),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

/** Build a structurally valid PNG whose inflated rows use an invalid filter. */
export function pngWithInvalidFilter(width: number, height: number): Buffer {
	const rows: number[] = [];
	for (let row = 0; row < height; row++) {
		rows.push(9);
		for (let col = 0; col < width; col++) {
			rows.push(0, 0, 0, 255);
		}
	}
	return Buffer.concat([
		PNG_SIGNATURE,
		chunk("IHDR", pngHeader(width, height)),
		chunk("IDAT", deflateSync(Buffer.from(rows))),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

/** Build a valid indexed-color PNG for fail-closed palette coverage. */
export function indexedPngWithPaletteIndexes(
	width: number,
	height: number,
	indexes: number[],
): Buffer {
	const rows: number[] = [];
	for (let row = 0; row < height; row++) {
		rows.push(0);
		for (let col = 0; col < width; col++) {
			rows.push(indexes[row * width + col] ?? 0);
		}
	}
	return Buffer.concat([
		PNG_SIGNATURE,
		chunk("IHDR", pngHeader(width, height, 3)),
		chunk("PLTE", Buffer.from([0, 0, 0, 255, 255, 255])),
		chunk("IDAT", deflateSync(Buffer.from(rows))),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

/** Build a malformed PNG-like buffer for invalid-format validator coverage. */
export function truncatedPngHeader(): Buffer {
	return Buffer.concat([PNG_SIGNATURE, chunk("IHDR", Buffer.alloc(4))]);
}

/** Build a valid high-entropy RGBA PNG for file-size and blankness checks. */
export function largePng(width: number, height: number): Buffer {
	const rows = Buffer.alloc(height * (1 + width * 4));
	let offset = 0;
	for (let row = 0; row < height; row++) {
		rows[offset++] = 0;
		for (let col = 0; col < width; col++) {
			rows[offset++] = (row * 17 + col * 31) % 256;
			rows[offset++] = (row * 43 + col * 11) % 256;
			rows[offset++] = (row * 7 + col * 59) % 256;
			rows[offset++] = 255;
		}
	}
	return Buffer.concat([
		PNG_SIGNATURE,
		chunk("IHDR", pngHeader(width, height)),
		chunk("IDAT", deflateSync(rows)),
		chunk("IEND", Buffer.alloc(0)),
	]);
}
