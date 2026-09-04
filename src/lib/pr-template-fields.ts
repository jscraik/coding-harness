/** Normalize a PR-template field for comparison with its placeholder. */
export function normalizeFieldValue(value: string): string {
	let normalized = value.trim();
	const fencedMatch = normalized.match(/^```[\w-]*\s*([\s\S]*?)\s*```$/);
	if (fencedMatch) normalized = fencedMatch[1] ?? "";
	const inlineCodeMatch = normalized.match(/^`([^`]+)`$/);
	if (inlineCodeMatch) normalized = inlineCodeMatch[1] ?? "";
	return normalized.replace(/\s+/g, " ").trim();
}

/** Remove complete and unterminated HTML comments without reparsing remnants. */
export function stripHtmlComments(value: string): string {
	let result = "";
	let cursor = 0;
	while (cursor < value.length) {
		const commentStart = value.indexOf("<!--", cursor);
		if (commentStart === -1) return result + value.slice(cursor);
		result += value.slice(cursor, commentStart);
		const commentEnd = value.indexOf("-->", commentStart + 4);
		if (commentEnd === -1) return result;
		cursor = commentEnd + 3;
	}
	return result;
}

/** Normalize a multiline field and discard embedded guidance comments. */
function normalizeFieldBlockValue(value: string): string {
	let normalized = value.trim();
	const fencedMatch = normalized.match(/^```[\w-]*\s*([\s\S]*?)\s*```$/);
	if (fencedMatch) normalized = fencedMatch[1] ?? "";
	const inlineCodeMatch = normalized.match(/^`([^`]+)`$/);
	if (inlineCodeMatch) normalized = inlineCodeMatch[1] ?? "";
	return stripHtmlComments(normalized).trim();
}

/** Extract the markdown content below a named PR-template heading. */
export function extractSectionBody(
	body: string,
	heading: string,
): string | null {
	const visibleBody = stripHtmlComments(body);
	const escapedHeading = heading.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
	const pattern = new RegExp(
		`(?:^|\\n)${escapedHeading}[ \\t]*(?:\\r?\\n)([\\s\\S]*?)(?=\\r?\\n## |\\r?\\n# |$)`,
		"i",
	);
	return visibleBody.match(pattern)?.[1] ?? null;
}

/** Extract and normalize a named field from a bounded PR-template section. */
export function extractFieldBlockValue(
	body: string,
	sectionHeading: string,
	label: string,
): string | null {
	const sectionBody = extractSectionBody(body, sectionHeading);
	if (sectionBody === null) return null;
	const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const pattern = new RegExp(
		`^-\\s*${escapedLabel}:[ \\t]*([\\s\\S]*?)(?=\\r?\\n-\\s*[A-Za-z][^\\n:]{0,80}:|\\r?\\n##\\s|(?![\\s\\S]))`,
		"im",
	);
	const match = sectionBody.match(pattern);
	return match ? normalizeFieldBlockValue(match[1] ?? "") : null;
}

/** Collect missing or placeholder-valued fields from a named section. */
export function collectFieldErrors(
	body: string,
	sectionHeading: string,
	fields: ReadonlyArray<{ label: string; placeholder: string }>,
	errorPrefix: string,
): string[] {
	if (extractSectionBody(body, sectionHeading) === null) {
		return [`Missing ${errorPrefix} block.`];
	}
	const errors: string[] = [];
	for (const field of fields) {
		const value = extractFieldBlockValue(body, sectionHeading, field.label);
		if (value === null) {
			errors.push(`Missing required ${errorPrefix} field: ${field.label}`);
			continue;
		}
		if (
			normalizeFieldValue(value).length === 0 ||
			normalizeFieldValue(value) === normalizeFieldValue(field.placeholder)
		) {
			errors.push(`Replace ${errorPrefix} field placeholder: ${field.label}`);
		}
	}
	return errors;
}
