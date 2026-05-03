import {
	COMMAND_CATEGORY_LABELS,
	COMMAND_CATEGORY_ORDER,
} from "./registry/command-capabilities.js";

/** Minimal command metadata needed to render human-facing CLI help. */
export interface CommandHelpRow {
	name: string;
	summary: string;
	category?: string;
	tier?: string;
}

const COMMAND_COLUMN_WIDTH = 24;

/** Return help rows with duplicate command names removed while preserving order. */
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

/** Render a flat command list for full help output. */
export function renderCommandHelpRows(rows: CommandHelpRow[]): string[] {
	const deduped = dedupeCommandHelpRows(rows);
	return deduped.map((row) => {
		const paddedName = row.name.padEnd(COMMAND_COLUMN_WIDTH, " ");
		return `  ${paddedName} ${row.summary}`;
	});
}

/** Render focused help with cockpit commands first, followed by category groups. */
export function renderGroupedCommandHelpRows(rows: CommandHelpRow[]): string[] {
	const deduped = dedupeCommandHelpRows(rows);
	const grouped = new Map<string, CommandHelpRow[]>();
	const cockpitRows = deduped.filter((row) => row.tier === "cockpit");

	for (const row of deduped) {
		if (row.tier === "cockpit") {
			continue;
		}
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
	if (cockpitRows.length > 0) {
		lines.push("  Agent Cockpit:");
		for (const row of cockpitRows) {
			const paddedName = row.name.padEnd(COMMAND_COLUMN_WIDTH, " ");
			lines.push(`    ${paddedName} ${row.summary}`);
		}
	}
	for (const [index, category] of orderedCategories.entries()) {
		const categoryLabel =
			COMMAND_CATEGORY_LABELS[
				category as keyof typeof COMMAND_CATEGORY_LABELS
			] ?? category;
		if (index > 0 || lines.length > 0) {
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
