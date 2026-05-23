const ISSUE_KEY_PATTERN = /\b[A-Z][A-Z0-9]+-\d+\b/iu;

function extractIssueKeyDisplayValue(
	value: string | null | undefined,
): string | null {
	const match = value?.match(ISSUE_KEY_PATTERN);
	return match ? match[0] : null;
}

/**
 * Returns the canonical issue-key value used for comparisons, or null when no issue key is present.
 */
export function normalizeIssueKeyForMatch(
	value: string | null | undefined,
): string | null {
	return extractIssueKeyDisplayValue(value)?.toUpperCase() ?? null;
}

/**
 * Detects the first issue key in the provided values without rewriting its display form.
 */
export function detectIssueKey(
	...values: Array<string | null | undefined>
): string | null {
	for (const value of values) {
		const issueKey = extractIssueKeyDisplayValue(value);
		if (issueKey) return issueKey;
	}
	return null;
}

/**
 * Compares issue keys case-insensitively without rewriting either source value.
 */
export function issueKeysMatch(
	left: string | null | undefined,
	right: string | null | undefined,
): boolean {
	const normalizedLeft = normalizeIssueKeyForMatch(left);
	const normalizedRight = normalizeIssueKeyForMatch(right);
	return normalizedLeft !== null && normalizedLeft === normalizedRight;
}
