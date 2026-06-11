import { detectIssueKey } from "./issue-key.js";

export const MARKDOWN_CODE_MARKER = String.fromCharCode(96);

export function hasCodePath(line: string, path: string): boolean {
	return line.includes(MARKDOWN_CODE_MARKER + path);
}

export function extractCodePath(line: string, prefix: string): string | null {
	const expression = new RegExp(
		`${MARKDOWN_CODE_MARKER}([^${MARKDOWN_CODE_MARKER}]+)${MARKDOWN_CODE_MARKER}`,
		"gu",
	);
	for (const match of line.matchAll(expression)) {
		const path = match[1];
		if (path?.startsWith(prefix)) return path;
	}
	return null;
}

function detectStandaloneIssueKey(
	...values: Array<string | null | undefined>
): string | null {
	for (const value of values) {
		const cell = value?.trim();
		const issueKey = detectIssueKey(cell);
		if (issueKey && issueKey === cell) return issueKey;
	}
	return null;
}

export function extractRowIssueKey(line: string): string | null {
	const [firstContentCell, ...remainingCells] = line
		.split("|")
		.map((cell) => cell.trim())
		.filter(Boolean);
	return (
		detectStandaloneIssueKey(...remainingCells) ??
		detectStandaloneIssueKey(firstContentCell) ??
		detectIssueKey(...remainingCells) ??
		detectIssueKey(firstContentCell)
	);
}
