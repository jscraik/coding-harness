import { createHash } from "node:crypto";
import type {
	RootHygieneInventory,
	RootHygieneInventorySource,
	RootSurfaceEntry,
} from "./types.js";

/** Create complete coverage proof for a root-hygiene classifier input. */
export function completeRootHygieneInventory(
	entries: readonly RootSurfaceEntry[],
	source: RootHygieneInventorySource,
): RootHygieneInventory {
	return {
		source,
		completeness: "complete",
		entryCount: entries.length,
		digest: rootSurfaceEntryDigest(entries),
	};
}

/** Create a stable content digest for root-hygiene classifier input entries. */
export function rootSurfaceEntryDigest(
	entries: readonly RootSurfaceEntry[],
): string {
	const normalizedEntries = [...entries]
		.map((entry) => ({
			kind: entry.kind,
			path: entry.path.replace(/\/$/u, ""),
		}))
		.sort((left, right) =>
			left.kind === right.kind
				? left.path.localeCompare(right.path)
				: left.kind.localeCompare(right.kind),
		);
	return createHash("sha256")
		.update(JSON.stringify(normalizedEntries))
		.digest("hex");
}
