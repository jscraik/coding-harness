import type { RootSurfaceEntry } from "./types.js";

/** Project tracked repository paths into unique top-level root entries. */
export function rootSurfaceEntriesFromTrackedPaths(
	trackedPaths: readonly string[],
): RootSurfaceEntry[] {
	const entries = new Map<string, RootSurfaceEntry>();
	for (const trackedPath of trackedPaths) {
		const explicitDirectory = trackedPath.endsWith("/");
		const normalizedPath = trackedPath
			.replace(/^\.\//u, "")
			.replace(/\/$/u, "");
		const [rootEntry, ...rest] = normalizedPath.split("/");
		if (!rootEntry) {
			continue;
		}
		entries.set(rootEntry, {
			path: rootEntry,
			kind: explicitDirectory || rest.length > 0 ? "directory" : "file",
		});
	}
	return [...entries.values()].sort((left, right) =>
		left.path.localeCompare(right.path),
	);
}
