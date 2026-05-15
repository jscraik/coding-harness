import { join } from "node:path";
import { readTextFile } from "./drift-gate-types.js";

/** Extract command names dispatched by the legacy direct CLI branch style. */
export function extractDispatchCommands(cliSource: string): string[] {
	const commands = new Set<string>();
	const regex = /if \(command === "([^"]+)"(?: \|\| command === "([^"]+)")?/g;
	let match: RegExpExecArray | null = regex.exec(cliSource);
	while (match) {
		if (match[1]) commands.add(match[1]);
		if (match[2]) commands.add(match[2]);
		match = regex.exec(cliSource);
	}
	commands.delete("--help");
	commands.delete("--version");
	return Array.from(commands).sort();
}

/** Extract canonical command names from registry spec source fragments. */
export function extractRegistryCommands(commandSpecsSource: string): string[] {
	const commands = new Set<string>();
	const nameRegex = /name:\s*"([a-z][a-z0-9:-]*)"/g;
	let match: RegExpExecArray | null = nameRegex.exec(commandSpecsSource);
	while (match) {
		if (match[1]) commands.add(match[1]);
		match = nameRegex.exec(commandSpecsSource);
	}
	return Array.from(commands).sort();
}

/** Resolve command registry source, including registry fragments composed outside the re-export entrypoint. */
export function resolveRegistryCommandSpecsSource(
	repoRoot: string,
	commandSpecsPath: string,
): string | undefined {
	const commandSpecsSource = readTextFile(commandSpecsPath);
	if (!commandSpecsSource) return undefined;
	if (extractRegistryCommands(commandSpecsSource).length > 0) {
		return commandSpecsSource;
	}
	return [
		commandSpecsSource,
		...[
			"src/lib/cli/command-registry.ts",
			"src/lib/cli/registry/command-specs-core.ts",
			"src/lib/cli/registry/learning-evidence-command-specs.ts",
			"src/lib/cli/registry/source-outline-spec.ts",
		].map((path) => readTextFile(join(repoRoot, path))),
	]
		.filter((source): source is string => typeof source === "string")
		.join("\n");
}

/** Extract command names printed by legacy hand-written help rows. */
export function extractHelpCommands(cliSource: string): {
	commands: string[];
	duplicates: string[];
} {
	const helpRegex = /console\.info\("\s{2}([a-z][a-z0-9:-]*)\s+/gi;
	const seen = new Set<string>();
	const duplicates = new Set<string>();
	let match: RegExpExecArray | null = helpRegex.exec(cliSource);
	while (match) {
		const command = match[1];
		if (command) {
			if (seen.has(command)) duplicates.add(command);
			seen.add(command);
		}
		match = helpRegex.exec(cliSource);
	}
	return {
		commands: Array.from(seen).sort(),
		duplicates: Array.from(duplicates).sort(),
	};
}

/** Extract command names from the README command index table. */
export function extractReadmeCommands(readmeSource: string): string[] {
	const commands = new Set<string>();
	const regex = /^\|\s+`([^`]+)`\s+\|/gm;
	let match: RegExpExecArray | null = regex.exec(readmeSource);
	while (match) {
		if (match[1]) commands.add(match[1]);
		match = regex.exec(readmeSource);
	}
	return Array.from(commands).sort();
}
