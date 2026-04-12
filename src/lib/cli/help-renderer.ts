import {
	COMMAND_CATEGORY_LABELS,
	COMMAND_CATEGORY_ORDER,
} from "./registry/command-capabilities.js";

export interface CommandHelpRow {
	name: string;
	summary: string;
	category?: string;
}

const COMMAND_COLUMN_WIDTH = 24;

export function dedupeCommandHelpRows(
	rows: CommandHelpRow[],
): CommandHelpRow[] {
	const seen = new Set<string>();
	const deduped: CommandHelpRow[] = [];
	for (const row of rows) {
		if (seen.has(row.name)) {
			continue;
		}
		seen.add(row.name);
		deduped.push(row);
	}
	return deduped;
}

export function renderCommandHelpRows(rows: CommandHelpRow[]): string[] {
	const deduped = dedupeCommandHelpRows(rows);
	return deduped.map((row) => {
		const paddedName = row.name.padEnd(COMMAND_COLUMN_WIDTH, " ");
		return `  ${paddedName} ${row.summary}`;
	});
}

export function renderGroupedCommandHelpRows(rows: CommandHelpRow[]): string[] {
	const deduped = dedupeCommandHelpRows(rows);
	const grouped = new Map<string, CommandHelpRow[]>();

	for (const row of deduped) {
		const category = row.category ?? "uncategorized";
		const existing = grouped.get(category);
		if (existing) {
			existing.push(row);
			continue;
		}
		grouped.set(category, [row]);
	}

	const orderedCategories: string[] = [
		...COMMAND_CATEGORY_ORDER.filter((category) => grouped.has(category)),
	];
	const knownCategories = new Set<string>(COMMAND_CATEGORY_ORDER);
	orderedCategories.push(
		...[...grouped.keys()]
			.filter((category) => !knownCategories.has(category))
			.sort(),
	);

	const lines: string[] = [];
	for (const [index, category] of orderedCategories.entries()) {
		const categoryLabel =
			COMMAND_CATEGORY_LABELS[
				category as keyof typeof COMMAND_CATEGORY_LABELS
			] ?? category;
		if (index > 0) {
			lines.push("");
		}
		lines.push(`  ${categoryLabel}:`);
		const categoryRows = grouped.get(category) ?? [];
		for (const row of categoryRows) {
			const paddedName = row.name.padEnd(COMMAND_COLUMN_WIDTH, " ");
			lines.push(`    ${paddedName} ${row.summary}`);
		}
	}

	return lines;
}
