import type { GitTrackedPathEntry } from "./tracked-paths.js";

/** Parse one NUL-delimited `git ls-files --stage` record. */
export function parseGitTrackedPathEntry(record: string): GitTrackedPathEntry {
	const separatorIndex = record.indexOf("\t");
	if (separatorIndex === -1) {
		throw new Error(`Unexpected git ls-files --stage record: ${record}`);
	}
	const [mode] = record.slice(0, separatorIndex).split(" ");
	return {
		mode: mode ?? null,
		path: record.slice(separatorIndex + 1),
	};
}
