import { ROOT_SURFACE_POLICY } from "./policy.js";
import type { ClassifiedRootHygieneEntry, RootSurfaceEntry } from "./types.js";

/** Return blocking required policy entries missing from observed root evidence. */
export function missingRequiredPolicyBlockers(
	entries: readonly RootSurfaceEntry[],
): ClassifiedRootHygieneEntry[] {
	const observed = new Set(entries.map(rootSurfaceEntryKey));
	return ROOT_SURFACE_POLICY.entries
		.filter(
			(policyEntry) =>
				policyEntry.classification !== "should_move" &&
				!observed.has(rootSurfaceEntryKey(policyEntry)),
		)
		.map((policyEntry) => ({
			path: policyEntry.path,
			kind: policyEntry.kind,
			classification: "legacy_drift",
			reason: `required policy root entry missing: ${policyEntry.reason}`,
			blocking: true,
		}));
}

function rootSurfaceEntryKey(entry: RootSurfaceEntry): string {
	return `${entry.kind}:${entry.path.replace(/\/$/u, "")}`;
}
