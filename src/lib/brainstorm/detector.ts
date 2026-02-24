/**
 * Brainstorm artifact detector
 *
 * Detects and validates brainstorm documents.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
	type BrainstormArtifact,
	type BrainstormError,
	type BrainstormFrontmatter,
	type BrainstormGateOptions,
	type BrainstormGateResult,
	DEFAULTS,
	EXIT_CODES,
	REQUIRED_SECTIONS,
} from "./types.js";

// Re-export types for consumers
export type { BrainstormGateOptions } from "./types.js";

/**
 * Parse frontmatter from markdown content
 */
function parseFrontmatter(content: string): {
	frontmatter: BrainstormFrontmatter;
	body: string;
} {
	const frontmatter: BrainstormFrontmatter = {
		topic: "",
		date: "",
	};
	let body = content;

	// Check for YAML frontmatter
	const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
	if (match?.[1]) {
		const yamlContent = match[1];
		body = match[2] ?? "";

		// Simple YAML parsing for topic and date
		const topicMatch = yamlContent.match(/^topic:\s*(.+)$/m);
		if (topicMatch?.[1]) {
			frontmatter.topic = topicMatch[1].trim();
		}

		const dateMatch = yamlContent.match(/^date:\s*(.+)$/m);
		if (dateMatch?.[1]) {
			frontmatter.date = dateMatch[1].trim();
		}

		// Parse tags if present
		const tagsMatch = yamlContent.match(/^tags:\s*\[(.*?)\]$/m);
		if (tagsMatch?.[1]) {
			frontmatter.tags = tagsMatch[1]
				.split(",")
				.map((t) => t.trim().replace(/['"]/g, ""));
		}
	}

	return { frontmatter, body };
}

/**
 * Check if content has required sections (Compound Engineering workflow)
 */
function hasRequiredSections(body: string): {
	hasWhat: boolean;
	hasWhy: boolean;
	hasDecisions: boolean;
} {
	return {
		hasWhat:
			body.includes("## What We're Building") ||
			body.includes("# What We're Building"),
		hasWhy:
			body.includes("## Why This Approach") ||
			body.includes("# Why This Approach") ||
			body.includes("## Why This Matters") ||
			body.includes("# Why This Matters"),
		hasDecisions:
			body.includes("## Key Decisions") || body.includes("# Key Decisions"),
	};
}

/**
 * Extract topic from filename
 * Format: YYYY-MM-DD-<topic>-brainstorm.md
 */
function extractTopicFromFilename(filename: string): string {
	const match = filename.match(/^\d{4}-\d{2}-\d{2}-(.+?)-brainstorm\.md$/);
	return match?.[1]
		? match[1].replace(/-/g, " ")
		: filename.replace(/\.md$/, "");
}

/**
 * Calculate days between two dates
 */
function daysBetween(date1: string | Date, date2: string | Date): number {
	const d1 = typeof date1 === "string" ? new Date(date1) : date1;
	const d2 = typeof date2 === "string" ? new Date(date2) : date2;
	const msPerDay = 24 * 60 * 60 * 1000;
	return Math.floor((d2.getTime() - d1.getTime()) / msPerDay);
}

/**
 * Find brainstorm documents in the directory
 */
function findBrainstormDocs(brainstormsPath: string): string[] {
	const docs: string[] = [];

	try {
		const entries = readdirSync(brainstormsPath);
		for (const entry of entries) {
			if (entry.match(/^\d{4}-\d{2}-\d{2}-.*-brainstorm\.md$/)) {
				docs.push(join(brainstormsPath, entry));
			}
		}
	} catch {
		// Directory doesn't exist or can't be read
	}

	// Sort by date (newest first)
	return docs.sort().reverse();
}

/**
 * Load and validate a brainstorm document
 */
function loadBrainstormDoc(
	filePath: string,
	maxAgeDays: number,
): { artifact?: BrainstormArtifact; error?: BrainstormError } {
	try {
		const stats = statSync(filePath);
		const content = readFileSync(filePath, "utf-8");
		const { frontmatter, body } = parseFrontmatter(content);
		const sections = hasRequiredSections(body);

		// Check age
		const fileDate = frontmatter.date
			? new Date(frontmatter.date)
			: stats.mtime;
		const daysOld = daysBetween(fileDate, new Date());

		if (daysOld > maxAgeDays) {
			return {
				error: {
					code: "STALE",
					message: `Brainstorm is ${daysOld} days old (max: ${maxAgeDays})`,
					path: filePath,
				},
			};
		}

		const filenameParts = filePath.split("/");
		const filename = filenameParts[filenameParts.length - 1] ?? filePath;

		return {
			artifact: {
				path: filePath,
				topic: frontmatter.topic || extractTopicFromFilename(filename),
				date: frontmatter.date || stats.mtime.toISOString().slice(0, 10),
				hasWhat: sections.hasWhat,
				hasWhy: sections.hasWhy,
				hasDecisions: sections.hasDecisions,
				frontmatter,
			},
		};
	} catch (error) {
		return {
			error: {
				code: "SYSTEM_ERROR",
				message: `Failed to read ${filePath}: ${(error as Error).message}`,
				path: filePath,
			},
		};
	}
}

/**
 * Run brainstorm gate validation
 */
export function runBrainstormGate(
	options: BrainstormGateOptions,
): BrainstormGateResult {
	const brainstormsPath = resolve(
		options.brainstormsPath || DEFAULTS.BRAINSTORMS_PATH,
	);
	const maxAgeDays = options.maxAgeDays || DEFAULTS.MAX_AGE_DAYS;

	const artifacts: BrainstormArtifact[] = [];
	const errors: BrainstormError[] = [];

	// Find all brainstorm documents
	const docs = findBrainstormDocs(brainstormsPath);

	if (docs.length === 0) {
		return {
			passed: false,
			artifacts: [],
			errors: [
				{
					code: "MISSING",
					message: `No brainstorm documents found in ${brainstormsPath}`,
				},
			],
		};
	}

	// Load and validate each document
	for (const docPath of docs) {
		const result = loadBrainstormDoc(docPath, maxAgeDays);

		if (result.error) {
			errors.push(result.error);
		}

		if (result.artifact) {
			artifacts.push(result.artifact);
		}
	}

	// Filter artifacts by topic if specified
	let filteredArtifacts = artifacts;
	if (options.topic) {
		const topicLower = options.topic.toLowerCase();
		filteredArtifacts = artifacts.filter(
			(a) =>
				a.topic.toLowerCase().includes(topicLower) ||
				a.path.toLowerCase().includes(topicLower),
		);
	}

	// Check for incomplete sections in strict mode
	if (options.strict) {
		for (const artifact of filteredArtifacts) {
			if (!artifact.hasWhat || !artifact.hasWhy || !artifact.hasDecisions) {
				errors.push({
					code: "INCOMPLETE",
					message: `Brainstorm missing required sections: ${REQUIRED_SECTIONS.join(", ")}`,
					path: artifact.path,
				});
			}
		}
	}

	// Calculate days since most recent brainstorm
	let daysSinceBrainstorm: number | undefined;
	if (filteredArtifacts.length > 0) {
		const mostRecent = filteredArtifacts[0];
		if (mostRecent?.date) {
			daysSinceBrainstorm = daysBetween(mostRecent.date, new Date());
		}
	}

	// Determine if passed
	// Pass if we have at least one valid, non-stale artifact
	const passed =
		filteredArtifacts.length > 0 &&
		errors.filter((e) => e.code === "MISSING" || e.code === "STALE").length ===
			0;

	// Build result object conditionally to satisfy strict TypeScript
	const result: BrainstormGateResult = {
		passed,
		artifacts: filteredArtifacts,
		errors,
	};

	if (daysSinceBrainstorm !== undefined) {
		result.daysSinceBrainstorm = daysSinceBrainstorm;
	}

	return result;
}

export { EXIT_CODES };
