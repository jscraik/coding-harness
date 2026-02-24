/**
 * Quality Score Calculator
 *
 * Calculates and updates documentation quality score based on:
 * - Stale documents (deduction: 5 points each)
 * - Broken links (deduction: 10 points each)
 */

import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validatePath } from "../input/sanitize.js";
import type { BrokenLink, QualityScore, StaleDoc } from "./types.js";
import {
	BROKEN_LINK_DEDUCTION,
	MAX_QUALITY_SCORE,
	STALE_DOC_DEDUCTION,
} from "./types.js";

/**
 * Calculate quality score from stale docs and broken links
 */
export function calculateQualityScore(
	staleDocs: StaleDoc[],
	brokenLinks: BrokenLink[],
): QualityScore {
	const staleDeduction = staleDocs.length * STALE_DOC_DEDUCTION;
	const brokenLinkDeduction = brokenLinks.length * BROKEN_LINK_DEDUCTION;
	const totalDeduction = staleDeduction + brokenLinkDeduction;

	const score = Math.max(0, MAX_QUALITY_SCORE - totalDeduction);

	return {
		score,
		calculatedAt: new Date().toISOString(),
		staleDocCount: staleDocs.length,
		brokenLinkCount: brokenLinks.length,
		staleDeduction,
		brokenLinkDeduction,
	};
}

/**
 * Render stale documents list as markdown
 */
function renderStaleDocsList(staleDocs: StaleDoc[]): string {
	if (staleDocs.length === 0) {
		return "*No stale documents found.*";
	}

	return staleDocs
		.map((doc) => {
			if (doc.daysSinceValidation === Number.POSITIVE_INFINITY) {
				return `1. \`${doc.path}\` (never validated)`;
			}
			return `1. \`${doc.path}\` (${doc.daysSinceValidation} days since validation)`;
		})
		.join("\n");
}

/**
 * Render broken links list as markdown
 */
function renderBrokenLinksList(brokenLinks: BrokenLink[]): string {
	if (brokenLinks.length === 0) {
		return "*No broken links found.*";
	}

	return brokenLinks
		.map((link) => {
			const status = link.statusCode ? ` [${link.statusCode}]` : "";
			const error = link.error ? ` - ${link.error}` : "";
			return `1. [${link.file}](${link.file}): ${link.link}${status}${error}`;
		})
		.join("\n");
}

/**
 * Generate quality score markdown content
 */
export function generateQualityScoreMarkdown(
	score: QualityScore,
	staleDocs: StaleDoc[],
	brokenLinks: BrokenLink[],
): string {
	const date = score.calculatedAt.split("T")[0];

	return `---
last_updated: ${date}
calculated_by: harness-gardener
---

# Documentation Quality Score

**Score:** ${score.score}/100

**Last Updated:** ${date}

## Breakdown

| Category | Count | Deduction |
|----------|-------|-----------|
| Stale Docs | ${score.staleDocCount} | -${score.staleDeduction} |
| Broken Links | ${score.brokenLinkCount} | -${score.brokenLinkDeduction} |

## Stale Documents

${renderStaleDocsList(staleDocs)}

## Broken Links

${renderBrokenLinksList(brokenLinks)}
`;
}

/**
 * Update the quality score file in the docs directory
 */
export function updateQualityScoreFile(
	docsPath: string,
	score: QualityScore,
	staleDocs: StaleDoc[],
	brokenLinks: BrokenLink[],
): { ok: true; path: string } | { ok: false; error: string } {
	// Validate docsPath to prevent path traversal
	let validatedPath: string;
	try {
		validatedPath = validatePath(process.cwd(), docsPath);
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "Invalid docs path",
		};
	}

	try {
		// Re-validate path immediately before use to minimize TOCTOU window
		const realValidatedPath = realpathSync(validatedPath);
		const realCwd = realpathSync(process.cwd());
		if (!realValidatedPath.startsWith(realCwd)) {
			throw new Error("Path traversal detected");
		}
		const realFilePath = join(realValidatedPath, "QUALITY_SCORE.md");

		const content = generateQualityScoreMarkdown(score, staleDocs, brokenLinks);
		writeFileSync(realFilePath, content, "utf-8");

		return { ok: true, path: realFilePath };
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Read current quality score from file
 */
export function readQualityScore(docsPath: string): QualityScore | null {
	// Validate docsPath to prevent path traversal
	let validatedPath: string;
	try {
		validatedPath = validatePath(process.cwd(), docsPath);
	} catch {
		return null;
	}

	try {
		// Re-validate path immediately before use to minimize TOCTOU window
		const realValidatedPath = realpathSync(validatedPath);
		const realCwd = realpathSync(process.cwd());
		if (!realValidatedPath.startsWith(realCwd)) {
			return null;
		}
		const realFilePath = join(realValidatedPath, "QUALITY_SCORE.md");

		const content = readFileSync(realFilePath, "utf-8");

		// Extract score from markdown
		const scoreMatch = content.match(/\*\*Score:\*\*\s*(\d+)\/100/);
		if (!scoreMatch) {
			return null;
		}

		// Extract date from frontmatter
		const dateMatch = content.match(/last_updated:\s*(\d{4}-\d{2}-\d{2})/);

		return {
			score: Number.parseInt(scoreMatch[1] ?? "0", 10),
			calculatedAt: dateMatch?.[1] ?? new Date().toISOString(),
			staleDocCount: 0,
			brokenLinkCount: 0,
			staleDeduction: 0,
			brokenLinkDeduction: 0,
		};
	} catch {
		return null;
	}
}
