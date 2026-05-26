import { ROOT_SURFACE_POLICY } from "./policy.js";
import type {
	ClassifiedRootHygieneEntry,
	RootHygieneClassificationClass,
	RootHygieneSummary,
	RootSurfaceEntry,
} from "./types.js";

/** Classify root entries against the current root-surface policy. */
export function classifyRootHygieneEntries(
	entries: readonly RootSurfaceEntry[],
): ClassifiedRootHygieneEntry[] {
	const policyEntries = new Map(
		ROOT_SURFACE_POLICY.entries.map((entry) => [entryKey(entry), entry]),
	);
	return entries.map((entry) => classifyEntry(entry, policyEntries));
}

/** Summarize classified root entries for operator-facing reports. */
export function summarizeRootHygieneEntries(
	entries: readonly ClassifiedRootHygieneEntry[],
): RootHygieneSummary {
	return {
		total: entries.length,
		canonicalRoot: countClassification(entries, "canonical_root"),
		shouldMove: countClassification(entries, "should_move"),
		generatedTrackedIntentionally: countClassification(
			entries,
			"generated_tracked_intentionally",
		),
		legacyDrift: countClassification(entries, "legacy_drift"),
		unclassified: countClassification(entries, "unclassified"),
		blocking: entries.filter((entry) => entry.blocking).length,
	};
}

function classifyEntry(
	entry: RootSurfaceEntry,
	policyEntries: Map<string, (typeof ROOT_SURFACE_POLICY)["entries"][number]>,
): ClassifiedRootHygieneEntry {
	const policyEntry = policyEntries.get(entryKey(entry));
	const classification = policyEntry?.classification ?? "unclassified";
	return {
		...entry,
		classification,
		reason: policyEntry?.reason ?? "not present in root surface policy",
		blocking:
			classification === "legacy_drift" || classification === "unclassified",
	};
}

function countClassification(
	entries: readonly ClassifiedRootHygieneEntry[],
	classification: RootHygieneClassificationClass,
): number {
	return entries.filter((entry) => entry.classification === classification)
		.length;
}

function entryKey(entry: RootSurfaceEntry): string {
	return `${entry.kind}:${entry.path.replace(/\/$/u, "")}`;
}
