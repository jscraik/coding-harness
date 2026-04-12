export interface CommandHelpRow {
	name: string;
	summary: string;
	category?: string;
}

const COMMAND_COLUMN_WIDTH = 24;
const CATEGORY_HEADING_ORDER = [
	"discovery",
	"bootstrap-governance",
	"review-policy",
	"workflow-linear",
	"pilot-remediation",
	"drift-search-evidence",
	"uncategorized",
] as const;
const CATEGORY_LABELS: Readonly<Record<string, string>> = {
	discovery: "Discovery",
	"bootstrap-governance": "Bootstrap & Governance",
	"review-policy": "Review & Policy",
	"workflow-linear": "Linear & Workflow",
	"pilot-remediation": "Pilot & Remediation",
	"drift-search-evidence": "Drift, Search & Evidence",
	uncategorized: "Other",
};

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
		...CATEGORY_HEADING_ORDER.filter((category) => grouped.has(category)),
	];
	const knownCategories = new Set<string>(CATEGORY_HEADING_ORDER);
	orderedCategories.push(
		...[...grouped.keys()]
			.filter((category) => !knownCategories.has(category))
			.sort(),
	);

	const lines: string[] = [];
	for (const [index, category] of orderedCategories.entries()) {
		const categoryLabel = CATEGORY_LABELS[category] ?? category;
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
