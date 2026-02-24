/**
 * Plan artifact detector
 *
 * Detects and validates plan documents.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
	DEFAULTS,
	EXIT_CODES,
	type PlanArtifact,
	type PlanError,
	type PlanFrontmatter,
	type PlanGateOptions,
	type PlanGateResult,
} from "./types.js";

// Re-export types for consumers
export type { PlanGateOptions } from "./types.js";

/**
 * Parse frontmatter from markdown content
 */
function parseFrontmatter(content: string): {
	frontmatter: PlanFrontmatter;
	body: string;
} {
	const frontmatter: PlanFrontmatter = {
		title: "",
		date: "",
		type: "feature",
		status: "draft",
	};
	let body = content;

	// Check for YAML frontmatter
	const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
	if (match?.[1]) {
		const yamlContent = match[1];
		body = match[2] ?? "";

		// Simple YAML parsing
		const titleMatch = yamlContent.match(/^title:\s*(.+)$/m);
		if (titleMatch?.[1]) {
			frontmatter.title = titleMatch[1].trim().replace(/['"]/g, "");
		}

		const dateMatch = yamlContent.match(/^date:\s*(.+)$/m);
		if (dateMatch?.[1]) {
			frontmatter.date = dateMatch[1].trim();
		}

		const typeMatch = yamlContent.match(/^type:\s*(.+)$/m);
		if (typeMatch?.[1]) {
			const typeVal = typeMatch[1].trim();
			if (
				["feature", "refactor", "bugfix", "docs", "architecture"].includes(
					typeVal,
				)
			) {
				frontmatter.type = typeVal as PlanFrontmatter["type"];
			}
		}

		const statusMatch = yamlContent.match(/^status:\s*(.+)$/m);
		if (statusMatch?.[1]) {
			const statusVal = statusMatch[1].trim();
			if (
				["draft", "approved", "implemented", "superseded"].includes(statusVal)
			) {
				frontmatter.status = statusVal as PlanFrontmatter["status"];
			}
		}

		const originMatch = yamlContent.match(/^origin:\s*(.+)$/m);
		if (originMatch?.[1]) {
			frontmatter.origin = originMatch[1].trim();
		}
	}

	return { frontmatter, body };
}

/**
 * Check if content has required sections
 */
function hasRequiredSections(body: string): {
	hasImplementationSteps: boolean;
	hasAcceptanceCriteria: boolean;
} {
	return {
		hasImplementationSteps:
			body.includes("## Implementation Steps") ||
			body.includes("## Steps") ||
			body.includes("# Implementation Steps"),
		hasAcceptanceCriteria:
			body.includes("## Acceptance Criteria") ||
			body.includes("# Acceptance Criteria"),
	};
}

/**
 * Extract title from filename
 * Format: YYYY-MM-DD-<type>-<title>-plan.md
 */
function extractTitleFromFilename(filename: string): string {
	const match = filename.match(/^\d{4}-\d{2}-\d{2}-\w+-(.+?)-plan\.md$/);
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
 * Find plan documents in the directory
 */
function findPlanDocs(plansPath: string): string[] {
	const docs: string[] = [];

	try {
		const entries = readdirSync(plansPath);
		for (const entry of entries) {
			if (entry.match(/^\d{4}-\d{2}-\d{2}-.*-plan\.md$/)) {
				docs.push(join(plansPath, entry));
			}
		}
	} catch {
		// Directory doesn't exist or can't be read
	}

	// Sort by date (newest first)
	return docs.sort().reverse();
}

/**
 * Load and validate a plan document
 */
function loadPlanDoc(
	filePath: string,
	maxAgeDays: number,
	requireOrigin: boolean,
): { artifact?: PlanArtifact; error?: PlanError } {
	try {
		const stats = statSync(filePath);
		const content = readFileSync(filePath, "utf-8");
		const { frontmatter, body } = parseFrontmatter(content);
		const sections = hasRequiredSections(body);

		// Check age (only for non-draft plans)
		if (frontmatter.status !== "draft") {
			const fileDate = frontmatter.date
				? new Date(frontmatter.date)
				: stats.mtime;
			const daysOld = daysBetween(fileDate, new Date());

			if (daysOld > maxAgeDays) {
				return {
					error: {
						code: "STALE",
						message: `Plan is ${daysOld} days old (max: ${maxAgeDays})`,
						path: filePath,
					},
				};
			}
		}

		// Check origin reference
		if (requireOrigin && !frontmatter.origin) {
			return {
				error: {
					code: "ORIGIN_MISSING",
					message: "Plan missing origin reference to brainstorm",
					path: filePath,
				},
			};
		}

		const filenameParts = filePath.split("/");
		const filename = filenameParts[filenameParts.length - 1] ?? filePath;

		return {
			artifact: {
				path: filePath,
				title: frontmatter.title || extractTitleFromFilename(filename),
				type: frontmatter.type,
				date: frontmatter.date || stats.mtime.toISOString().slice(0, 10),
				status: frontmatter.status,
				hasOrigin: !!frontmatter.origin,
				hasImplementationSteps: sections.hasImplementationSteps,
				hasAcceptanceCriteria: sections.hasAcceptanceCriteria,
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
 * Run plan gate validation
 */
export function runPlanGate(options: PlanGateOptions): PlanGateResult {
	const plansPath = resolve(options.plansPath || DEFAULTS.PLANS_PATH);
	const maxAgeDays = options.maxAge ?? DEFAULTS.MAX_AGE_DAYS;
	const requireOrigin = options.requireOrigin ?? false;

	const artifacts: PlanArtifact[] = [];
	const errors: PlanError[] = [];

	// Find all plan documents
	const docs = findPlanDocs(plansPath);

	if (docs.length === 0) {
		return {
			passed: false,
			artifacts: [],
			errors: [
				{
					code: "MISSING",
					message: `No plan documents found in ${plansPath}`,
				},
			],
		};
	}

	// Load and validate each document
	for (const docPath of docs) {
		const result = loadPlanDoc(docPath, maxAgeDays, requireOrigin);

		if (result.error) {
			errors.push(result.error);
		}

		if (result.artifact) {
			artifacts.push(result.artifact);
		}
	}

	// Filter artifacts by type if specified
	let filteredArtifacts = artifacts;
	if (options.type) {
		const typeLower = options.type.toLowerCase();
		filteredArtifacts = artifacts.filter(
			(a) =>
				a.type.toLowerCase() === typeLower ||
				a.title.toLowerCase().includes(typeLower),
		);
	}

	// Check for incomplete sections in strict mode
	if (options.strict) {
		for (const artifact of filteredArtifacts) {
			if (!artifact.hasImplementationSteps || !artifact.hasAcceptanceCriteria) {
				errors.push({
					code: "INCOMPLETE",
					message:
						"Plan missing required sections: Implementation Steps, Acceptance Criteria",
					path: artifact.path,
				});
			}
		}
	}

	// Calculate days since most recent plan
	let daysSincePlan: number | undefined;
	if (filteredArtifacts.length > 0) {
		const mostRecent = filteredArtifacts[0];
		if (mostRecent?.date) {
			daysSincePlan = daysBetween(mostRecent.date, new Date());
		}
	}

	// Determine if passed
	// Pass if we have at least one valid, non-stale artifact
	const passed =
		filteredArtifacts.length > 0 &&
		errors.filter(
			(e) =>
				e.code === "MISSING" ||
				e.code === "STALE" ||
				e.code === "ORIGIN_MISSING",
		).length === 0;

	// Build result object conditionally
	const result: PlanGateResult = {
		passed,
		artifacts: filteredArtifacts,
		errors,
	};

	if (daysSincePlan !== undefined) {
		result.daysSincePlan = daysSincePlan;
	}

	return result;
}

export { EXIT_CODES };
