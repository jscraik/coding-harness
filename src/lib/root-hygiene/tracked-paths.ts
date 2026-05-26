import type { RootSurfaceEntry } from "./types.js";

/** Git index path plus optional mode metadata used for root-entry projection. */
export interface GitTrackedPathEntry {
	path: string;
	mode?: string | null;
}

type TrackedPathInput = string | GitTrackedPathEntry;

/** Project tracked repository paths into unique top-level root entries. */
export function rootSurfaceEntriesFromTrackedPaths(
	trackedPaths: readonly TrackedPathInput[],
): RootSurfaceEntry[] {
	const entries = new Map<string, RootSurfaceEntry>();
	for (const trackedPathInput of trackedPaths) {
		const trackedPath =
			typeof trackedPathInput === "string"
				? trackedPathInput
				: trackedPathInput.path;
		const explicitDirectory =
			trackedPath.endsWith("/") ||
			(typeof trackedPathInput !== "string" &&
				trackedPathInput.mode === "160000");
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
