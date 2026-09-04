/** Normalize a PR-template field for comparison with its placeholder. */
export function normalizeFieldValue(value: string): string {
	let normalized = value.trim();
	const fencedMatch = normalized.match(/^```[\w-]*\s*([\s\S]*?)\s*```$/);
	if (fencedMatch) normalized = fencedMatch[1] ?? "";
	const inlineCodeMatch = normalized.match(/^`([^`]+)`$/);
	if (inlineCodeMatch) normalized = inlineCodeMatch[1] ?? "";
	return normalized.replace(/\s+/g, " ").trim();
}

type Fence = { marker: string; length: number };

/** Advance fenced-code state for one Markdown line. */
function advanceFence(fence: Fence | null, marker?: string): Fence | null {
	if (!marker) return fence;
	if (fence === null)
		return { marker: marker[0] ?? "`", length: marker.length };
	if (marker[0] === fence.marker && marker.length >= fence.length) return null;
	return fence;
}

/** Mask fenced code while preserving offsets and line boundaries. */
function maskFencedCode(value: string): string[] {
	const chars = [...value];
	const masked = [...value];
	let fence: Fence | null = null;
	for (let lineStart = 0; lineStart <= chars.length; ) {
		const lineEnd = value.indexOf("\n", lineStart);
		const end = lineEnd === -1 ? chars.length : lineEnd;
		const line = value.slice(lineStart, end);
		const marker = line.match(/^ {0,3}(`{3,}|~{3,})/)?.[1];
		if (fence !== null || marker) {
			for (let index = lineStart; index < end; index += 1) masked[index] = " ";
		}
		fence = advanceFence(fence, marker);
		if (lineEnd === -1) break;
		lineStart = lineEnd + 1;
	}
	return masked;
}

/** Mask fenced and inline code while preserving offsets and line boundaries. */
function maskMarkdownCode(value: string): string {
	const chars = [...value];
	const masked = maskFencedCode(value);
	const fenceMasked = masked.join("");
	for (let cursor = 0; cursor < chars.length; cursor += 1) {
		if (chars[cursor] !== "`" || fenceMasked[cursor] === " ") continue;
		let runEnd = cursor;
		while (chars[runEnd] === "`") runEnd += 1;
		const delimiter = "`".repeat(runEnd - cursor);
		const close = fenceMasked.indexOf(delimiter, runEnd);
		if (close === -1) continue;
		for (let index = cursor; index < close + delimiter.length; index += 1) {
			if (masked[index] !== "\n") masked[index] = " ";
		}
		cursor = close + delimiter.length - 1;
	}
	return masked.join("");
}

/** Remove complete and unterminated HTML comments without reparsing remnants. */
export function stripHtmlComments(value: string): string {
	const structuralText = maskMarkdownCode(value);
	let result = "";
	let cursor = 0;
	while (cursor < value.length) {
		const commentStart = structuralText.indexOf("<!--", cursor);
		if (commentStart === -1) return result + value.slice(cursor);
		result += value.slice(cursor, commentStart);
		const commentEnd = value.indexOf("-->", commentStart + 4);
		if (commentEnd === -1) return result;
		result += " ";
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
	const match = pattern.exec(maskMarkdownCode(visibleBody));
	if (!match || match.index === undefined) return null;
	const captureStart = match.index + match[0].length - (match[1]?.length ?? 0);
	return visibleBody.slice(
		captureStart,
		captureStart + (match[1]?.length ?? 0),
	);
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
	const match = pattern.exec(maskMarkdownCode(sectionBody));
	if (!match || match.index === undefined) return null;
	const captureStart = match.index + match[0].length - (match[1]?.length ?? 0);
	return normalizeFieldBlockValue(
		sectionBody.slice(captureStart, captureStart + (match[1]?.length ?? 0)),
	);
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
