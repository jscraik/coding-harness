import { realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import type { FrontMatter } from "./harness-artifact-routine.js";
import type { ArtifactHandlingFinding } from "./harness-artifact-routine.js";

/**
 * Split a markdown table row into its constituent cells and trim surrounding whitespace.
 *
 * @param row - A markdown table row string (for example, `"| col1 | col2 |"`)
 * @returns The trimmed cell values in order
 */
export function parseMarkdownTableCells(row: string): string[] {
	return row
		.split("|")
		.slice(1, -1)
		.map((cell) => cell.trim());
}

/**
 * Extracts top-of-file YAML-like front matter into a flat fields map.
 *
 * Parses the first `--- ... ---` block at the start of `text` and returns its
 * key/value pairs as plain strings. Only lines matching `key: value` are
 * captured; surrounding single or double quotes around values are removed.
 *
 * @returns An object with a `fields` map where each front-matter key maps to its unquoted string value. Missing or non-matching lines are omitted from the map.
 */
export function parseFrontMatter(text: string): FrontMatter {
	const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	const raw = match?.[1] ?? "";
	const fields: Record<string, string> = {};
	for (const line of raw.split(/\r?\n/)) {
		const fieldMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*?)\s*$/);
		if (!fieldMatch) continue;
		const [, key, value] = fieldMatch;
		if (key === undefined || value === undefined) continue;
		fields[key] = value.replace(/^['"]|['"]$/g, "");
	}
	return { fields };
}

/**
 * Extracts the content under the markdown "## <heading>" section.
 *
 * @param text - The full markdown text to search.
 * @param heading - The section heading text (without leading `## `).
 * @returns The lines between the matching `## <heading>` and the next `## ` heading joined by newlines, or an empty string if the heading is not present.
 */
export function section(text: string, heading: string): string {
	const lines = text.split("\n");
	const headingLine = `## ${heading}`;
	const start = lines.findIndex((line) => line.trim() === headingLine);
	if (start < 0) return "";
	const nextHeading = lines.findIndex(
		(line, index) => index > start && line.startsWith("## "),
	);
	return lines
		.slice(start + 1, nextHeading === -1 ? undefined : nextHeading)
		.join("\n");
}

/**
 * Extract backtick-quoted paths from `text` and keep only likely repo-relative locations.
 *
 * @param text - The input content to scan for backtick-quoted paths
 * @returns An array of extracted paths that start with `.harness/`, `docs/`, `src/`, `scripts/`, `e2e/`, or `artifacts/`
 */
export function extractBacktickPaths(text: string): string[] {
	return Array.from(text.matchAll(/`([^`]+)`/g))
		.map((match) => match[1])
		.filter((value): value is string => value !== undefined)
		.filter((value) =>
			/^(\.harness|docs|src|scripts|e2e|artifacts)\//.test(value),
		);
}

/**
 * Determines whether a path pattern contains glob tokens.
 *
 * @param path - The path or pattern to inspect
 * @returns `true` if `path` contains any of the glob tokens `*`, `?`, or `[`, `false` otherwise.
 */
export function containsGlobToken(path: string): boolean {
	return path.includes("*") || path.includes("?") || path.includes("[");
}

/**
 * Converts an input path into a normalized repo-relative POSIX-style path.
 *
 * @param repoRoot - The repository root directory used as the base for resolution.
 * @param path - The input path to normalize; may be absolute or relative.
 * @returns The repo-relative path with forward slashes (`/`); may be an empty string when the input resolves to `repoRoot`.
 */
export function normalizeRepoPath(repoRoot: string, path: string): string {
	const absolute = resolve(repoRoot, path);
	return relative(repoRoot, absolute)
		.split(/[/\\]+/)
		.join("/");
}

/**
 * Determines if a repo-relative path refers to a location inside the repository.
 *
 * @param repoRelativePath - Path expressed relative to the repository root
 * @returns `true` if the path is non-empty, does not start with `..`, and is not absolute; `false` otherwise.
 */
export function isPathInsideRepo(repoRelativePath: string): boolean {
	return (
		repoRelativePath.length > 0 &&
		!repoRelativePath.startsWith("..") &&
		!isAbsolute(repoRelativePath)
	);
}

/** Check whether a resolved filesystem path remains inside the repository root. */
export function resolvedPathStaysInsideRepo(
	repoRoot: string,
	absolutePath: string,
): boolean {
	try {
		const resolvedRepoRoot = realpathSync(repoRoot);
		const resolvedPath = realpathSync(absolutePath);
		const repoRelativePath = relative(resolvedRepoRoot, resolvedPath)
			.split(/[/\\]+/)
			.join("/");
		return isPathInsideRepo(repoRelativePath) || repoRelativePath.length === 0;
	} catch {
		return false;
	}
}

/**
 * Validate the "Artifact Index" markdown table for a "Local Status" column and report rows that use draft/unknown/maybe.
 *
 * @param activeIndexPath - Repository-relative path to the active index file.
 * @param artifactIndexText - The markdown text of the "Artifact Index" section.
 * @param fail - Callback to record an ArtifactHandlingFinding when the table is missing or unclassified.
 */
export function validateHistoricalRows(
	activeIndexPath: string,
	artifactIndexText: string,
	fail: (finding: ArtifactHandlingFinding) => void,
): void {
	const rows = artifactIndexText
		.split(/\r?\n/)
		.filter((line) => line.startsWith("|") && !line.includes("---"));
	const header = rows[0];
	if (header === undefined) {
		fail({
			check: "stale_frontmatter_guard",
			code: "artifact_index_missing",
			message:
				"Active artifact index must include an Artifact Index table for stale artifact classification.",
			path: activeIndexPath,
		});
		return;
	}
	const headerCells = parseMarkdownTableCells(header);
	const localStatusIndex = headerCells.findIndex(
		(cell) => cell.toLowerCase() === "local status",
	);
	if (localStatusIndex < 0) {
		fail({
			check: "stale_frontmatter_guard",
			code: "artifact_status_column_missing",
			message:
				"Artifact Index table must include a Local Status column for stale artifact classification.",
			path: activeIndexPath,
		});
		return;
	}
	for (const row of rows.slice(1)) {
		const cells = parseMarkdownTableCells(row);
		const localStatus = cells[localStatusIndex]?.trim().toLowerCase() ?? "";
		if (
			localStatus.length === 0 ||
			localStatus.includes("draft") ||
			localStatus.includes("unknown") ||
			localStatus.includes("maybe")
		) {
			fail({
				check: "stale_frontmatter_guard",
				code: "artifact_status_unclassified",
				message:
					"Artifact Index rows must classify route-driving status instead of leaving blank/draft/unknown/maybe state.",
				path: activeIndexPath,
			});
		}
	}
}

/**
 * Determine whether a string value should be treated as blank for validation.
 *
 * @param value - The string to test; may be `undefined`
 * @returns `true` if `value` is `undefined`, an empty string, contains only whitespace, or is exactly `"n.a."`, `false` otherwise
 */
export function isBlank(value: string | undefined): boolean {
	return value === undefined || value.trim().length === 0 || value === "n.a.";
}

/** Format a Date as a local YYYY-MM-DD string for active-index freshness checks. */
export function formatLocalDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}
