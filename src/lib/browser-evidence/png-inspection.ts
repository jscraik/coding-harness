import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const MAX_BROWSER_SCREENSHOT_INFLATED_BYTES = 64 * 1024 * 1024;

/** Minimal PNG dimensions and color diversity used for nonblank checks. */
export interface PngInspection {
	width: number;
	height: number;
	uniqueColors: number;
}

/** Optional bounds for PNG inspection proof collection. */
export interface PngInspectionOptions {
	minUniqueColors?: number;
}

interface PngMetadata {
	width: number;
	height: number;
	bitDepth: number;
	colorType: number;
	compressionMethod: number;
	filterMethod: number;
	interlace: number;
	hasIend: boolean;
	idatParts: Buffer[];
}

function bytesPerPixel(colorType: number): number | null {
	if (colorType === 0) return 1;
	if (colorType === 4) return 2;
	if (colorType === 2) return 3;
	if (colorType === 6) return 4;
	return null;
}

function expectedInflatedLayout(
	width: number,
	height: number,
	pixelBytes: number,
): { stride: number; inflatedBytes: number } | null {
	const stride = width * pixelBytes;
	const inflatedBytes = (stride + 1) * height;
	if (!Number.isSafeInteger(stride) || !Number.isSafeInteger(inflatedBytes)) {
		return null;
	}
	return { stride, inflatedBytes };
}

function readPngMetadata(file: Buffer): PngMetadata | null {
	if (file.length < 33 || !file.subarray(0, 8).equals(PNG_SIGNATURE))
		return null;
	let offset = 8;
	const metadata: PngMetadata = {
		width: 0,
		height: 0,
		bitDepth: 0,
		colorType: 0,
		compressionMethod: 0,
		filterMethod: 0,
		interlace: 0,
		hasIend: false,
		idatParts: [],
	};
	while (offset + 12 <= file.length) {
		const length = file.readUInt32BE(offset);
		const type = file.subarray(offset + 4, offset + 8).toString("ascii");
		const dataStart = offset + 8;
		const dataEnd = dataStart + length;
		if (dataEnd + 4 > file.length) return null;
		const data = file.subarray(dataStart, dataEnd);
		if (type === "IHDR") {
			if (data.length < 13) return null;
			metadata.width = data.readUInt32BE(0);
			metadata.height = data.readUInt32BE(4);
			metadata.bitDepth = data[8] ?? 0;
			metadata.colorType = data[9] ?? 0;
			metadata.compressionMethod = data[10] ?? 0;
			metadata.filterMethod = data[11] ?? 0;
			metadata.interlace = data[12] ?? 0;
		} else if (type === "IDAT") {
			metadata.idatParts.push(Buffer.from(data));
		} else if (type === "IEND") {
			if (data.length !== 0) return null;
			metadata.hasIend = true;
			break;
		}
		offset = dataEnd + 4;
	}
	return metadata.hasIend ? metadata : null;
}

function paeth(left: number, above: number, upperLeft: number): number {
	const estimate = left + above - upperLeft;
	const leftDistance = Math.abs(estimate - left);
	const aboveDistance = Math.abs(estimate - above);
	const upperLeftDistance = Math.abs(estimate - upperLeft);
	if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) {
		return left;
	}
	return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function targetUniqueColors(options: PngInspectionOptions | undefined): number {
	const target = options?.minUniqueColors ?? Number.POSITIVE_INFINITY;
	return Number.isSafeInteger(target) && target > 0
		? target
		: Number.POSITIVE_INFINITY;
}

function visiblePixelKey(
	row: Buffer,
	index: number,
	pixelBytes: number,
	colorType: number,
): string | null {
	if (
		(colorType === 4 || colorType === 6) &&
		row[index + pixelBytes - 1] === 0
	) {
		return null;
	}
	return row.subarray(index, index + pixelBytes).toString("hex");
}

function hasSupportedPngMetadata(
	metadata: PngMetadata,
	pixelBytes: number | null,
): pixelBytes is number {
	return (
		Boolean(metadata.width) &&
		Boolean(metadata.height) &&
		metadata.bitDepth === 8 &&
		metadata.compressionMethod === 0 &&
		metadata.filterMethod === 0 &&
		metadata.interlace === 0 &&
		pixelBytes !== null &&
		metadata.idatParts.length > 0
	);
}

/** Inspect a simple noninterlaced 8-bit PNG without treating logs as proof. */
export function inspectPng(
	filePath: string,
	options?: PngInspectionOptions,
): PngInspection | null {
	try {
		const metadata = readPngMetadata(readFileSync(filePath));
		if (!metadata) return null;
		const pixelBytes = bytesPerPixel(metadata.colorType);
		if (!hasSupportedPngMetadata(metadata, pixelBytes)) return null;
		const layout = expectedInflatedLayout(
			metadata.width,
			metadata.height,
			pixelBytes,
		);
		if (
			!layout ||
			layout.inflatedBytes > MAX_BROWSER_SCREENSHOT_INFLATED_BYTES
		) {
			return null;
		}
		const inflated = inflateSync(Buffer.concat(metadata.idatParts), {
			maxOutputLength: layout.inflatedBytes + 1,
		});
		const { stride } = layout;
		if (inflated.length !== layout.inflatedBytes) return null;
		const previous = Buffer.alloc(stride);
		let cursor = 0;
		const unique = new Set<string>();
		const uniqueTarget = targetUniqueColors(options);
		for (let row = 0; row < metadata.height; row++) {
			const filter = inflated[cursor++];
			const current = Buffer.from(inflated.subarray(cursor, cursor + stride));
			cursor += stride;
			for (let index = 0; index < current.length; index++) {
				const left =
					index >= pixelBytes ? (current[index - pixelBytes] ?? 0) : 0;
				const above = previous[index] ?? 0;
				const upperLeft =
					index >= pixelBytes ? (previous[index - pixelBytes] ?? 0) : 0;
				if (filter === 1) current[index] = (current[index] ?? 0) + left;
				else if (filter === 2) current[index] = (current[index] ?? 0) + above;
				else if (filter === 3) {
					current[index] =
						(current[index] ?? 0) + Math.floor((left + above) / 2);
				} else if (filter === 4) {
					current[index] =
						(current[index] ?? 0) + paeth(left, above, upperLeft);
				} else if (filter !== 0) return null;
			}
			for (let index = 0; index < current.length; index += pixelBytes) {
				if (unique.size >= uniqueTarget) break;
				const pixelKey = visiblePixelKey(
					current,
					index,
					pixelBytes,
					metadata.colorType,
				);
				if (pixelKey) unique.add(pixelKey);
			}
			current.copy(previous);
		}
		return {
			width: metadata.width,
			height: metadata.height,
			uniqueColors: unique.size,
		};
	} catch {
		return null;
	}
}
