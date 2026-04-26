import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** Returns whether a command is discoverable on the current PATH. */
export function commandExists(cmd: string): boolean {
	const lookupCommand = process.platform === "win32" ? "where" : "which";
	const result = spawnSync(lookupCommand, [cmd], {
		stdio: "pipe",
		encoding: "utf-8",
	});
	return result.status === 0;
}

/** Reads the first line of a command version response, or null when unavailable. */
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

/** Parses a JSON file, returning null when the file is missing or invalid. */
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
 * Traverses obj following keys and verifies each key is an own property and each
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
