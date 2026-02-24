/**
 * Stale Document Detector
 *
 * Detects documents that need validation based on `last_validated` frontmatter.
 * Documents without `last_validated` are treated as stale immediately (bootstrap behavior).
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { validatePath } from "../input/sanitize.js";
import type { StaleDoc } from "./types.js";
import { DEFAULT_STALE_DAYS } from "./types.js";

// Re-export for convenience
export { DEFAULT_STALE_DAYS };

/**
 * Parse YAML frontmatter from markdown content
 * Returns null if no frontmatter found
 */
function parseFrontmatter(content: string): Record<string, string> | null {
	// Match frontmatter between --- delimiters
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (!match) {
		return null;
	}

	const frontmatter: Record<string, string> = {};
	const lines = match[1]?.split("\n");

	if (!lines) {
		return frontmatter;
	}

	for (const line of lines) {
		// Simple key: value parsing (handles basic YAML)
		const colonIndex = line.indexOf(":");
		if (colonIndex > 0) {
			const key = line.slice(0, colonIndex).trim();
			let value = line.slice(colonIndex + 1).trim();
			// Remove quotes if present
			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			}
			frontmatter[key] = value;
		}
	}

	return frontmatter;
}

/**
 * Calculate days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
	const msPerDay = 24 * 60 * 60 * 1000;
	const diffTime = Math.abs(date2.getTime() - date1.getTime());
	return Math.floor(diffTime / msPerDay);
}

/**
 * Recursively find all markdown files in a directory
 */
function findMarkdownFiles(dir: string, baseDir: string): string[] {
	const files: string[] = [];

	if (!existsSync(dir)) {
		return files;
	}

	const entries = readdirSync(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);

		if (entry.isDirectory()) {
			// Skip hidden directories and common non-doc directories
			if (entry.name.startsWith(".") || entry.name === "node_modules") {
				continue;
			}
			files.push(...findMarkdownFiles(fullPath, baseDir));
		} else if (entry.isFile() && entry.name.endsWith(".md")) {
			// Return relative path from base directory
			const relativePath = fullPath.slice(baseDir.length + 1);
			files.push(relativePath);
		}
	}

	return files;
}

/**
 * Detect stale documents in the specified directory
 *
 * @param basePath - Path to the docs directory
 * @param staleDays - Number of days before a doc is considered stale (default: 30)
 * @returns Array of stale documents
 */
export function detectStaleDocs(
	basePath: string,
	staleDays: number = DEFAULT_STALE_DAYS,
): StaleDoc[] {
	const stale: StaleDoc[] = [];

	// Validate path to prevent traversal attacks
	let validatedPath: string;
	try {
		validatedPath = validatePath(process.cwd(), basePath);
	} catch {
		return stale;
	}

	if (!existsSync(validatedPath)) {
		return stale;
	}

	const docs = findMarkdownFiles(validatedPath, validatedPath);
	const now = new Date();

	for (const doc of docs) {
		const fullPath = join(validatedPath, doc);

		try {
			const content = readFileSync(fullPath, "utf-8");
			const frontmatter = parseFrontmatter(content);

			if (!frontmatter?.last_validated) {
				// Never validated = immediately stale (bootstrap behavior)
				stale.push({
					path: doc,
					lastValidated: null,
					daysSinceValidation: Number.POSITIVE_INFINITY,
				});
				continue;
			}

			// Parse the last_validated date
			const lastDate = new Date(frontmatter.last_validated);

			// Check for invalid date
			if (Number.isNaN(lastDate.getTime())) {
				stale.push({
					path: doc,
					lastValidated: frontmatter.last_validated,
					daysSinceValidation: Number.POSITIVE_INFINITY,
				});
				continue;
			}

			const daysSince = daysBetween(lastDate, now);

			if (daysSince > staleDays) {
				stale.push({
					path: doc,
					lastValidated: frontmatter.last_validated,
					daysSinceValidation: daysSince,
				});
			}
		} catch {
			// Skip files that can't be read
		}
	}

	// Sort by days since validation (most stale first)
	return stale.sort((a, b) => b.daysSinceValidation - a.daysSinceValidation);
}

/**
 * Count total markdown files in directory
 */
export function countMarkdownFiles(basePath: string): number {
	// Validate path to prevent traversal attacks
	let validatedPath: string;
	try {
		validatedPath = validatePath(process.cwd(), basePath);
	} catch {
		return 0;
	}
	if (!existsSync(validatedPath)) {
		return 0;
	}
	return findMarkdownFiles(validatedPath, validatedPath).length;
}
