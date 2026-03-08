/**
 * Scan cache for org-audit performance optimization
 *
 * Caches scan results to avoid re-reading unchanged repositories.
 * Uses file modification times to detect staleness.
 */

import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface CacheEntry {
	/** Repository path */
	path: string;
	/** Hash of contract file content */
	contractHash: string;
	/** Last modification time of contract file */
	mtimeMs: number;
	/** Cached scan result */
	result: unknown;
	/** Cache entry timestamp */
	cachedAt: number;
}

export interface ScanCache {
	version: number;
	entries: CacheEntry[];
}

const CACHE_VERSION = 1;
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB - prevent hashing huge files

/**
 * Compute SHA-256 hash of file content.
 * Returns undefined for files larger than MAX_FILE_SIZE_BYTES to prevent memory issues.
 */
function hashFile(path: string): string | undefined {
	try {
		const stats = statSync(path);
		if (stats.size > MAX_FILE_SIZE_BYTES) {
			// Fall back to mtime-only for large files
			return `size-${stats.size}-mtime-${stats.mtimeMs}`;
		}
		const content = readFileSync(path);
		return createHash("sha256").update(content).digest("hex");
	} catch {
		return undefined;
	}
}

/**
 * Get modification time of a file.
 */
function getMtimeMs(path: string): number | undefined {
	try {
		return statSync(path).mtimeMs;
	} catch {
		return undefined;
	}
}

/**
 * Load scan cache from disk.
 */
export function loadScanCache(cachePath: string): ScanCache {
	try {
		if (!existsSync(cachePath)) {
			return { version: CACHE_VERSION, entries: [] };
		}
		const content = readFileSync(cachePath, "utf-8");
		const parsed = JSON.parse(content) as ScanCache;
		if (parsed.version !== CACHE_VERSION) {
			return { version: CACHE_VERSION, entries: [] };
		}
		return parsed;
	} catch {
		return { version: CACHE_VERSION, entries: [] };
	}
}

/**
 * Save scan cache to disk.
 * Creates parent directories if they don't exist.
 */
export function saveScanCache(cachePath: string, cache: ScanCache): void {
	try {
		const dir = dirname(cachePath);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		writeFileSync(cachePath, JSON.stringify(cache, null, 2));
	} catch {
		// Silently fail - cache is optional optimization
	}
}

/**
 * Normalize path for cache key comparison.
 * Resolves to absolute path to handle different path representations.
 */
function normalizeCacheKey(path: string): string {
	try {
		return resolve(path);
	} catch {
		return path;
	}
}

/**
 * Get cached entry for a repository if valid.
 */
export function getCachedEntry(
	cache: ScanCache,
	repoPath: string,
	contractPath: string,
	ttlMs = DEFAULT_CACHE_TTL_MS,
): CacheEntry | undefined {
	const now = Date.now();
	const normalizedPath = normalizeCacheKey(repoPath);
	const entry = cache.entries.find(
		(e) => normalizeCacheKey(e.path) === normalizedPath,
	);

	if (!entry) return undefined;

	// Check TTL
	if (now - entry.cachedAt > ttlMs) return undefined;

	// Verify contract hasn't changed
	const currentMtime = getMtimeMs(contractPath);
	const currentHash = hashFile(contractPath);

	if (currentMtime !== entry.mtimeMs) return undefined;
	if (currentHash !== entry.contractHash) return undefined;

	return entry;
}

/**
 * Update cache with a new entry.
 */
export function setCachedEntry(
	cache: ScanCache,
	repoPath: string,
	contractPath: string,
	result: unknown,
): void {
	const hash = hashFile(contractPath);
	const mtime = getMtimeMs(contractPath);

	if (!hash || !mtime) return;

	const normalizedPath = normalizeCacheKey(repoPath);

	// Remove existing entry
	cache.entries = cache.entries.filter(
		(e) => normalizeCacheKey(e.path) !== normalizedPath,
	);

	// Add new entry
	cache.entries.push({
		path: normalizedPath,
		contractHash: hash,
		mtimeMs: mtime,
		result,
		cachedAt: Date.now(),
	});

	// Prune old entries (keep last 100)
	if (cache.entries.length > 100) {
		cache.entries = cache.entries
			.sort((a, b) => b.cachedAt - a.cachedAt)
			.slice(0, 100);
	}
}

/**
 * Clear expired entries from cache.
 */
export function pruneCache(
	cache: ScanCache,
	ttlMs = DEFAULT_CACHE_TTL_MS,
): void {
	const now = Date.now();
	cache.entries = cache.entries.filter((e) => now - e.cachedAt <= ttlMs);
}

/**
 * Get default cache path in user's home directory.
 */
export function getDefaultCachePath(): string {
	const homeDir = process.env.HOME || process.env.USERPROFILE || "/tmp";
	return join(homeDir, ".cache", "harness", "org-audit-cache.json");
}
