/**
 * Plan artifact detector
 *
 * Detects and validates plan documents.
 */

import { lstatSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import {
	type AcceptanceItem,
	DEFAULTS,
	EXIT_CODES,
	type PlanArtifact,
	type PlanError,
	type PlanFrontmatter,
	type PlanGateOptions,
	type PlanGateResult,
} from "./types.js";

// Re-export types for consumers
/** Public API export. */
export type { PlanGateOptions } from "./types.js";

/**
 * Parse frontmatter from markdown content
 */
function parseFrontmatter(content: string): {
	frontmatter: PlanFrontmatter;
	body: string;
} {
	const normalizedContent = content.replace(/^\uFEFF/, "");
	const frontmatter: PlanFrontmatter = {
		title: "",
		date: "",
		type: "feature",
		status: "draft",
	};
	let body = normalizedContent;

	// Check for YAML frontmatter
	const match = normalizedContent.match(
		/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*)|$)/,
	);
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
			const typeVal = typeMatch[1].trim().replace(/['"]/g, "");
			if (typeVal) {
				frontmatter.type = typeVal;
			}
		}

		const statusMatch = yamlContent.match(/^status:\s*(.+)$/m);
		if (statusMatch?.[1]) {
			const statusVal = statusMatch[1].trim().replace(/['"]/g, "");
			if (
				[
					"draft",
					"future",
					"active",
					"approved",
					"completed",
					"implemented",
					"superseded",
				].includes(statusVal)
			) {
				frontmatter.status = statusVal as PlanFrontmatter["status"];
			}
		}

		const planIdMatch = yamlContent.match(/^plan_id:\s*(.+)$/m);
		if (planIdMatch?.[1]) {
			frontmatter.planId = planIdMatch[1].trim().replace(/['"]/g, "");
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

function extractAcceptanceItems(body: string): AcceptanceItem[] {
	const lines = body.split("\n");
	const items: AcceptanceItem[] = [];
	let inAcceptanceSection = false;
	let currentHeadingLevel = 0;

	for (const [index, rawLine] of lines.entries()) {
		const line = rawLine.trim();
		const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
		if (headingMatch?.[1] && headingMatch[2]) {
			const headingLevel = headingMatch[1].length;
			const headingText = headingMatch[2].trim().toLowerCase();
			const isAcceptanceHeading =
				headingText === "acceptance checklist" ||
				headingText === "acceptance criteria";
			if (isAcceptanceHeading) {
				inAcceptanceSection = true;
				currentHeadingLevel = headingLevel;
				continue;
			}
			if (inAcceptanceSection && headingLevel <= currentHeadingLevel) {
				inAcceptanceSection = false;
			}
		}

		if (!inAcceptanceSection) {
			continue;
		}

		const itemMatch = rawLine.match(/^\s*[-*]\s+\[(x|X| )\]\s+(.+)$/);
		if (!itemMatch?.[1] || !itemMatch[2]) {
			continue;
		}
		const text = itemMatch[2].trim();
		const completed = itemMatch[1].toLowerCase() === "x";
		const hasEvidence =
			/\[[^\]]+\]\([^)]+\)/.test(text) ||
			/\b(?:evidence|ref|refs):/i.test(text) ||
			/`[^`]+`/.test(text);
		items.push({
			text,
			completed,
			hasEvidence,
			line: index + 1,
		});
	}

	return items;
}

function normalizePlanId(planId: string): string {
	return planId.trim().toLowerCase();
}

/** Public API export. */
export function extractPlanIdsFromText(
	...segments: Array<string | undefined>
): string[] {
	const planIds = new Set<string>();
	for (const segment of segments) {
		if (!segment) {
			continue;
		}
		for (const match of segment.matchAll(
			/(?:^|\n)\s*(?:-\s*)?Plan IDs?:\s*([^\n]+)/gi,
		)) {
			const rawValue = match[1]?.trim();
			if (!rawValue || /^n\/a$/i.test(rawValue) || /^none$/i.test(rawValue)) {
				continue;
			}
			for (const token of rawValue.split(",")) {
				const cleaned = token.replace(/[`*[\]()]/g, "").trim();
				if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(cleaned)) {
					planIds.add(normalizePlanId(cleaned));
				}
			}
		}
	}

	return [...planIds];
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
 * Returns Infinity for invalid dates to treat them as stale
 */
function daysBetween(date1: string | Date, date2: string | Date): number {
	const d1 = typeof date1 === "string" ? new Date(date1) : date1;
	const d2 = typeof date2 === "string" ? new Date(date2) : date2;

	// Handle invalid dates - treat as infinitely old (stale)
	if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) {
		return Number.POSITIVE_INFINITY;
	}

	const msPerDay = 24 * 60 * 60 * 1000;
	return Math.floor((d2.getTime() - d1.getTime()) / msPerDay);
}

/**
 * Find plan documents in the directory
 */
function findPlanDocs(
	plansPath: string,
	visited = new Set<string>(),
	contentCache = new Map<string, string>(),
): string[] {
	const docs: string[] = [];

	try {
		const rootStats = statSync(plansPath);
		const visitKey = `${rootStats.dev}:${rootStats.ino}`;
		if (visited.has(visitKey)) {
			return docs;
		}
		visited.add(visitKey);

		const entries = readdirSync(plansPath);
		for (const entry of entries) {
			const entryPath = join(plansPath, entry);
			let linkStats: ReturnType<typeof lstatSync>;
			let stats: ReturnType<typeof statSync>;
			try {
				linkStats = lstatSync(entryPath);
				if (linkStats.isSymbolicLink()) {
					continue;
				}
				stats = statSync(entryPath);
			} catch {
				continue;
			}
			if (stats.isDirectory()) {
				docs.push(...findPlanDocs(entryPath, visited, contentCache));
				continue;
			}
			if (stats.isFile() && entry.endsWith(".md")) {
				const discovery = inspectPlanDoc(entryPath, contentCache);
				if (
					discovery.isPlan ||
					isUnreadablePlanCandidate(entryPath, discovery)
				) {
					docs.push(entryPath);
				}
			}
		}
	} catch {
		// Directory doesn't exist or can't be read
	}

	// Sort by date (newest first)
	return docs.sort().reverse();
}

function inspectPlanDoc(
	filePath: string,
	contentCache: Map<string, string>,
): {
	isPlan: boolean;
	isUnreadable: boolean;
} {
	try {
		const content = readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
		contentCache.set(filePath, content);
		if (!content.match(/^---\s*\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/)) {
			return { isPlan: false, isUnreadable: false };
		}

		const { frontmatter, body } = parseFrontmatter(content);
		if (frontmatter.planId) {
			return { isPlan: true, isUnreadable: false };
		}

		const sections = hasRequiredSections(body);
		return {
			isPlan:
				hasPlanMetadata(frontmatter) ||
				sections.hasImplementationSteps ||
				sections.hasAcceptanceCriteria,
			isUnreadable: false,
		};
	} catch {
		return { isPlan: false, isUnreadable: true };
	}
}

function isUnreadablePlanCandidate(
	filePath: string,
	discovery: { isPlan: boolean; isUnreadable: boolean },
): boolean {
	if (!discovery.isUnreadable) {
		return false;
	}
	const filename = basename(filePath);
	return (
		/\bJSC-\d+\b/i.test(filename) ||
		/^\d{4}-\d{2}-\d{2}-.+-plan\.md$/i.test(filename)
	);
}

function hasPlanMetadata(frontmatter: PlanFrontmatter): boolean {
	return Boolean(frontmatter.title || frontmatter.date);
}

function resolvePlanSearchPaths(plansPath?: string): string[] {
	if (plansPath) {
		return [resolve(plansPath)];
	}

	return [DEFAULTS.PLANS_PATH, DEFAULTS.HARNESS_PLANS_PATH].map((path) =>
		resolve(path),
	);
}

function planArtifactTimestamp(artifact: PlanArtifact): number {
	const timestamp = Date.parse(artifact.date);
	return Number.isNaN(timestamp) ? 0 : timestamp;
}

function isNewerPlanArtifact(
	candidate: PlanArtifact,
	current: PlanArtifact,
): boolean {
	const candidateTimestamp = planArtifactTimestamp(candidate);
	const currentTimestamp = planArtifactTimestamp(current);

	if (candidateTimestamp !== currentTimestamp) {
		return candidateTimestamp > currentTimestamp;
	}

	return candidate.path > current.path;
}

/**
 * Load and validate a plan document
 */
function loadPlanDoc(
	filePath: string,
	maxAgeDays: number,
	requireOrigin: boolean,
	contentCache = new Map<string, string>(),
): { artifact?: PlanArtifact; errors: PlanError[] } {
	const errors: PlanError[] = [];
	try {
		const stats = statSync(filePath);
		const content =
			contentCache.get(filePath) ?? readFileSync(filePath, "utf-8");
		const { frontmatter, body } = parseFrontmatter(content);
		const sections = hasRequiredSections(body);
		const acceptanceItems = extractAcceptanceItems(body);

		// Check age (only for non-draft plans)
		if (frontmatter.status !== "draft") {
			const fileDate = frontmatter.date
				? new Date(frontmatter.date)
				: stats.mtime;
			const daysOld = daysBetween(fileDate, new Date());

			if (daysOld > maxAgeDays) {
				errors.push({
					code: "STALE",
					message: `Plan is ${daysOld} days old (max: ${maxAgeDays})`,
					path: filePath,
				});
			}
		}

		// Check origin reference
		if (requireOrigin && !frontmatter.origin) {
			errors.push({
				code: "ORIGIN_MISSING",
				message: "Plan missing origin reference to brainstorm",
				path: filePath,
			});
		}

		const filename = basename(filePath);

		return {
			artifact: {
				path: filePath,
				title: frontmatter.title || extractTitleFromFilename(filename),
				type: frontmatter.type,
				date: frontmatter.date || stats.mtime.toISOString().slice(0, 10),
				status: frontmatter.status,
				...(frontmatter.planId ? { planId: frontmatter.planId } : {}),
				hasOrigin: !!frontmatter.origin,
				hasImplementationSteps: sections.hasImplementationSteps,
				hasAcceptanceCriteria: sections.hasAcceptanceCriteria,
				acceptanceItems,
				frontmatter,
			},
			errors,
		};
	} catch (error) {
		return {
			errors: [
				{
					code: "SYSTEM_ERROR",
					message: `Failed to read ${filePath}: ${(error as Error).message}`,
					path: filePath,
				},
			],
		};
	}
}

/**
 * Run plan gate validation
 */
export function runPlanGate(options: PlanGateOptions): PlanGateResult {
	const planSearchPaths = resolvePlanSearchPaths(options.plansPath);
	const plansPathLabel = planSearchPaths.join(", ");
	const maxAgeDays =
		typeof options.maxAge === "number" && Number.isFinite(options.maxAge)
			? options.maxAge
			: DEFAULTS.MAX_AGE_DAYS;
	const requireOrigin = options.requireOrigin ?? false;
	const requirePlanId = options.requirePlanId ?? false;
	const changedFiles = options.changedFiles ?? [];
	const requestedPlanIds = options.planIds?.length
		? options.planIds.map(normalizePlanId)
		: extractPlanIdsFromText(options.prTitle, options.prBody);

	const artifacts: PlanArtifact[] = [];
	const errors: PlanError[] = [];
	const contentCache = new Map<string, string>();
	const visitedPlanDirs = new Set<string>();

	// Find all plan documents
	const docs = planSearchPaths
		.flatMap((planPath) =>
			findPlanDocs(planPath, visitedPlanDirs, contentCache),
		)
		.sort()
		.reverse();

	if (docs.length === 0) {
		return {
			passed: false,
			artifacts: [],
			errors: [
				{
					code: "MISSING",
					message: `No plan documents found in ${plansPathLabel}`,
				},
			],
		};
	}

	// Load and validate each document
	for (const docPath of docs) {
		const result = loadPlanDoc(
			docPath,
			maxAgeDays,
			requireOrigin,
			contentCache,
		);
		errors.push(...result.errors);

		if (result.artifact) {
			artifacts.push(result.artifact);
		}
	}

	if (options.requireTraceability && changedFiles.length > 0) {
		if (requestedPlanIds.length === 0) {
			errors.push({
				code: "TRACEABILITY_MISSING",
				message:
					"Changed work cannot be mapped to plan IDs; add plan IDs to the PR title/body or pass --plan-ids",
			});
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

	const artifactsByPlanId = new Map<string, PlanArtifact>();
	for (const artifact of artifacts) {
		if (artifact.planId) {
			const planId = normalizePlanId(artifact.planId);
			const current = artifactsByPlanId.get(planId);
			if (!current || isNewerPlanArtifact(artifact, current)) {
				artifactsByPlanId.set(planId, artifact);
			}
		}
	}

	if (requestedPlanIds.length > 0) {
		filteredArtifacts = requestedPlanIds
			.map((planId) => artifactsByPlanId.get(planId))
			.filter((artifact): artifact is PlanArtifact => artifact !== undefined);

		for (const planId of requestedPlanIds) {
			if (!artifactsByPlanId.has(planId)) {
				errors.push({
					code: "PLAN_ID_NOT_FOUND",
					message: `Referenced plan ID '${planId}' does not exist in ${plansPathLabel}`,
				});
			}
		}
	}

	if (requirePlanId) {
		for (const artifact of filteredArtifacts) {
			if (!artifact.planId) {
				errors.push({
					code: "PLAN_ID_MISSING",
					message: "Plan missing required plan_id frontmatter",
					path: artifact.path,
				});
			}
		}
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

	if (options.requireAcceptanceEvidence) {
		for (const artifact of filteredArtifacts) {
			for (const item of artifact.acceptanceItems) {
				if (!item.completed || item.hasEvidence) {
					continue;
				}
				errors.push({
					code: "ACCEPTANCE_EVIDENCE_MISSING",
					message: `Completed acceptance item is missing evidence refs at line ${item.line}: ${item.text}`,
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

	// Determine if passed.
	// Any validation error should fail the gate.
	const passed = filteredArtifacts.length > 0 && errors.length === 0;

	// Build result object conditionally
	const result: PlanGateResult = {
		passed,
		artifacts: filteredArtifacts,
		errors,
		traceability: {
			planIds: requestedPlanIds,
			matchedPlanIds: filteredArtifacts
				.map((artifact) => artifact.planId)
				.filter((planId): planId is string => typeof planId === "string")
				.map(normalizePlanId),
			changedFiles,
		},
	};

	if (daysSincePlan !== undefined) {
		result.daysSincePlan = daysSincePlan;
	}

	return result;
}

export { EXIT_CODES };
