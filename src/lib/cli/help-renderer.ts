export interface CommandHelpRow {
	name: string;
	summary: string;
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
