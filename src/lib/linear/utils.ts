/**
 * Shared utilities for Linear command modules.
 *
 * These helpers are used by both linear-workflow.ts and linear-prepare.ts
 * to avoid code duplication and ensure consistent behavior.
 */

import type { LinearIssueSummary } from "./client.js";

export const ISSUE_IDENTIFIER_PATTERN = /^[A-Z][A-Z0-9]+-\d+$/i;

/**
 * Normalize a token value, returning undefined for empty/whitespace/null-like strings.
 */
export function normalizeToken(value: string | undefined): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}
	const trimmed = value.trim();
	if (
		trimmed.length === 0 ||
		trimmed.toLowerCase() === "undefined" ||
		trimmed.toLowerCase() === "null"
	) {
		return undefined;
	}
	return trimmed;
}

/**
 * Normalize an issue reference, extracting the identifier from a URL if present.
 */
export function normalizeIssueReference(value: string): string {
	const trimmed = value.trim();
	const urlMatch = trimmed.match(/\/issue\/([A-Z][A-Z0-9]+-\d+)/i);
	if (urlMatch?.[1]) {
		return urlMatch[1].toUpperCase();
	}
	if (ISSUE_IDENTIFIER_PATTERN.test(trimmed)) {
		return trimmed.toUpperCase();
	}
	return trimmed;
}

/**
 * Normalize a team match string to lowercase for case-insensitive comparison.
 */
export function normalizeTeamMatch(
	value: string | undefined,
): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed.toLowerCase() : undefined;
}

/**
 * Check if an issue matches the given team filter.
 */
export function issueMatchesTeam(
	issue: LinearIssueSummary,
	team: string | undefined,
): boolean {
	if (!team) {
		return true;
	}
	return (
		issue.team.key.toLowerCase() === team ||
		issue.team.name.toLowerCase() === team
	);
}

/**
 * Select a unique issue from a list, filtering by team and matching identifier.
 */
export function selectIssue(
	issues: LinearIssueSummary[],
	issueRef: string,
	team: string | undefined,
): LinearIssueSummary | undefined {
	const teamFiltered = issues.filter((issue) => issueMatchesTeam(issue, team));
	if (teamFiltered.length === 0) {
		return undefined;
	}

	const exactIdentifier = teamFiltered.find(
		(issue) => issue.identifier.toLowerCase() === issueRef.toLowerCase(),
	);
	if (exactIdentifier) {
		return exactIdentifier;
	}

	if (teamFiltered.length === 1) {
		return teamFiltered[0];
	}

	return undefined;
}
