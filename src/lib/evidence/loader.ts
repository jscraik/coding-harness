import { existsSync, statSync } from "node:fs";
import { realpathSync } from "node:fs";
import { dirname, normalize, resolve } from "node:path";

/**
 * Check if a file exists at the given path.
 */
export function fileExists(filePath: string): boolean {
	try {
		return existsSync(filePath);
	} catch {
		return false;
	}
}

/**
 * Get file size in bytes, or null if file doesn't exist.
 */
export function getFileSize(filePath: string): number | null {
	try {
		const stats = statSync(filePath);
		return stats.size;
	} catch {
		return null;
	}
}

/**
 * Resolve a path relative to a base directory with normalization.
 */
export function resolvePath(baseDir: string, userPath: string): string {
	return resolve(baseDir, normalize(userPath));
}

/**
 * Get the real (canonical) path, handling symlinks.
 * Returns null if the path doesn't exist.
 */
export function getRealPath(filePath: string): string | null {
	try {
		return realpathSync(filePath);
	} catch {
		return null;
	}
}

/**
 * Get the real path of the parent directory.
 * Returns null if the parent doesn't exist.
 */
export function getParentRealPath(filePath: string): string | null {
	try {
		const parent = dirname(filePath);
		return realpathSync(parent);
	} catch {
		return null;
	}
}
