/** Find required Markdown sections in prompt templates. */
export function hasSection(content: string, sectionName: string): boolean {
	const escaped = escapeRegExp(sectionName);
	return new RegExp(
		`(?:^|\\r?\\n)#{2,3}\\s+${escaped}\\s*(?=\\r?\\n|$)`,
		"i",
	).test(content);
}

/** Count completed checklist items inside a required Markdown section. */
export function countCheckedItems(
	content: string,
	sectionName: string,
): number {
	const escaped = escapeRegExp(sectionName);
	const sectionPattern = new RegExp(
		`(?:^|\\r?\\n)#{2,3}\\s+${escaped}\\s*\\r?\\n([\\s\\S]*?)(?=(?:\\r?\\n)#{2,3}\\s+|$)`,
		"i",
	);
	const match = content.match(sectionPattern);
	if (!match) return 0;

	const sectionContent = match[1] ?? "";
	const checked = sectionContent.match(/- \[x\]/gi);
	return checked?.length ?? 0;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^{}()|[\]\\]/g, "\\$&");
}
