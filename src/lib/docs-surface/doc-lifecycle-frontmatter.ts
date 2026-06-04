import type { DocLifecycleMetadata } from "./doc-lifecycle-types.js";

/** Parse the lifecycle YAML frontmatter subset used by governed Markdown docs. */
export function parseMarkdownFrontmatter(
	content: string,
): Partial<DocLifecycleMetadata> | null {
	if (!content.startsWith("---\n") && !content.startsWith("---\r\n"))
		return null;
	const lines = content.split(/\r?\n/);
	const closingIndex = lines.findIndex(
		(line, index) => index > 0 && line === "---",
	);
	if (closingIndex < 0) return null;
	const metadata: Record<string, string | string[] | null> = {};
	let currentKey: string | null = null;
	for (const line of lines.slice(1, closingIndex)) {
		const keyValue = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
		if (keyValue) {
			const key = keyValue[1];
			if (!key) continue;
			currentKey = key;
			const rawValue = keyValue[2] ?? "";
			metadata[currentKey] = parseYamlScalar(rawValue);
			continue;
		}
		const listValue = line.match(/^\s+-\s+(.+?)\s*$/);
		if (listValue && currentKey) {
			const existing = metadata[currentKey];
			const values = Array.isArray(existing) ? existing : [];
			const value = listValue[1];
			if (!value) continue;
			values.push(stripYamlQuotes(value));
			metadata[currentKey] = values;
		}
	}
	return metadata as Partial<DocLifecycleMetadata>;
}

function parseYamlScalar(value: string): string | string[] | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
		return trimmed
			.slice(1, -1)
			.split(",")
			.map((item) => stripYamlQuotes(item.trim()))
			.filter(Boolean);
	}
	return stripYamlQuotes(trimmed);
}

function stripYamlQuotes(value: string): string {
	return value.replace(/^["']|["']$/g, "");
}
