export interface DocParityResult {
	missingInReadme: string[];
	extraInReadme: string[];
}

const README_COMMAND_ROW_REGEX = /^\|\s*`([^`]+)`\s*\|/;

export function extractReadmeCommandNames(readmeContent: string): string[] {
	const commands: string[] = [];
	for (const line of readmeContent.split(/\r?\n/)) {
		const match = README_COMMAND_ROW_REGEX.exec(line);
		if (!match) {
			continue;
		}
		const command = match[1]?.trim();
		if (!command) {
			continue;
		}
		commands.push(command);
	}
	return commands;
}

export function compareRegistryToReadme(
	registryCommands: string[],
	readmeCommands: string[],
): DocParityResult {
	const registry = new Set(registryCommands);
	const readme = new Set(readmeCommands);

	const missingInReadme = [...registry].filter(
		(command) => !readme.has(command),
	);
	const extraInReadme = [...readme].filter((command) => !registry.has(command));

	return {
		missingInReadme,
		extraInReadme,
	};
}
