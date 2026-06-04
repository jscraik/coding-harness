import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readTextFile } from "./drift-gate-types.js";

/**
 * Extracts command names used in legacy `if (command === "...")` dispatch branches.
 *
 * @param cliSource - Source code text to scan for legacy dispatch conditionals
 * @returns Sorted unique command names found in the source; `--help` and `--version` are excluded
 */
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

/**
 * Extract canonical command names from registry spec fragments in the provided source.
 *
 * @param commandSpecsSource - Source text containing one or more registry spec fragments.
 * @returns Sorted array of unique command names found (matching the pattern `[a-z][a-z0-9:-]*`).
 */
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

/**
 * Produce the effective registry command specs source by concatenating the primary
 * specs content with known registry fragment files.
 *
 * `@param` repoRoot - Repository root used to resolve additional registry fragment file paths.
 * `@param` commandSpecsPath - Path to the primary command specs file to read.
 * `@returns` `undefined` if the primary file cannot be read; otherwise the primary
 * file content concatenated with any available registry fragment files.
 */
export function resolveRegistryCommandSpecsSource(
	repoRoot: string,
	commandSpecsPath: string,
): string | undefined {
	const commandSpecsSource = readTextFile(commandSpecsPath);
	if (typeof commandSpecsSource !== "string") return undefined;
	if (extractRegistryCommands(commandSpecsSource).length > 0) {
		return commandSpecsSource;
	}
	return [commandSpecsSource, ...collectRegistryFragmentSources(repoRoot)]
		.filter((source): source is string => typeof source === "string")
		.join("\n");
}

function collectRegistryFragmentSources(
	repoRoot: string,
): Array<string | undefined> {
	const registryDir = join(repoRoot, "src/lib/cli/registry");
	if (!existsSync(registryDir)) {
		return [readTextFile(join(repoRoot, "src/lib/cli/command-registry.ts"))];
	}
	const registryFiles = readdirSync(registryDir)
		.filter(
			(file) =>
				file.endsWith(".ts") &&
				!file.endsWith(".test.ts") &&
				!file.endsWith(".d.ts"),
		)
		.sort();
	return [
		readTextFile(join(repoRoot, "src/lib/cli/command-registry.ts")),
		...registryFiles.map((file) => readTextFile(join(registryDir, file))),
	];
}

/**
 * Extract command names from legacy console.info help rows and identify duplicates.
 *
 * @param cliSource - Source text containing legacy help output
 * @returns An object with `commands`: a sorted array of unique command names found, and `duplicates`: a sorted array of command names that appeared more than once
 */
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

/**
 * Extracts command names listed in a README command index table.
 *
 * @param readmeSource - README text containing a Markdown table whose rows start with a first-column inline-code command (e.g., `| `command` | ...`)
 * @returns A sorted array of unique command names found in the table's first column
 */
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
