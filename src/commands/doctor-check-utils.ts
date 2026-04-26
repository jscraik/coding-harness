import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Checks whether an executable with the given name is available on the current PATH.
 *
 * @param cmd - The executable or command name to locate, for example `node` or `git`
 * @returns `true` if the command is found on PATH, `false` otherwise
 */
export function commandExists(cmd: string): boolean {
	const lookupCommand = process.platform === "win32" ? "where" : "which";
	const result = spawnSync(lookupCommand, [cmd], {
		stdio: "pipe",
		encoding: "utf-8",
	});
	return result.status === 0;
}

/**
 * Gets the first line of a command version response.
 *
 * @param cmd - The executable name to run, for example `node`, `git`, or `pnpm`
 * @param versionArg - Argument used to request version information
 * @returns The first trimmed stdout line when the command succeeds, otherwise null
 */
export function getCommandVersion(
	cmd: string,
	versionArg = "--version",
): string | null {
	const result = spawnSync(cmd, [versionArg], {
		stdio: "pipe",
		encoding: "utf-8",
		timeout: 5000,
	});
	if (result.status !== 0) return null;
	return (result.stdout ?? "").trim().split("\n")[0] ?? null;
}

/**
 * Reads and parses a JSON file from disk.
 *
 * @param path - Filesystem path to the JSON file, read using UTF-8 encoding
 * @returns The parsed JSON value, or null when the file is missing or invalid
 */
export function readJsonFile(path: string): unknown | null {
	try {
		const content = readFileSync(path, "utf-8");
		return JSON.parse(content);
	} catch {
		return null;
	}
}

/**
 * Checks whether a nested path of own properties exists in a JSON-like object.
 *
 * Traverses `obj` following `keys` and verifies each key is an own property and each
 * intermediate value is a non-null object.
 */
export function hasJsonKey(obj: unknown, ...keys: string[]): boolean {
	let cursor: unknown = obj;
	for (const key of keys) {
		if (
			typeof cursor !== "object" ||
			cursor === null ||
			!Object.hasOwn(cursor, key)
		) {
			return false;
		}
		cursor = (cursor as Record<string, unknown>)[key];
	}
	return true;
}
