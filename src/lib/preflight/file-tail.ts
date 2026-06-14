import { closeSync, openSync, readSync, statSync } from "node:fs";

/**
 * Reads the final bytes from a text file without loading the whole file.
 *
 * @param filePath - Text file path to inspect
 * @param maxBytes - Maximum bytes to read from the end of the file
 * @returns UTF-8 text decoded from the final byte window
 */
export function readTextTail(filePath: string, maxBytes: number): string {
	const fileSize = statSync(filePath).size;
	const bytesToRead = Math.min(fileSize, maxBytes);
	const start = fileSize - bytesToRead;
	const buffer = Buffer.allocUnsafe(bytesToRead);
	const fd = openSync(filePath, "r");

	try {
		const bytesRead = readSync(fd, buffer, 0, bytesToRead, start);
		return buffer.subarray(0, bytesRead).toString("utf-8");
	} finally {
		closeSync(fd);
	}
}
