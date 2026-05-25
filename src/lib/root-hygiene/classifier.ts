import { buildRootHygieneReceipt } from "./receipt.js";
import { ROOT_HYGIENE_CLASSIFICATION_SCHEMA_VERSION } from "./types.js";
import { readGitTrackedPaths } from "./git-tracked-paths.js";
import { freezeRootHygieneReport } from "./report-freeze.js";
import { rootHygieneRepositoryIdentity } from "./repository-identity.js";
import { ROOT_SURFACE_POLICY_SOURCE_REF } from "./policy.js";
import {
	classifyRootHygieneEntries,
	summarizeRootHygieneEntries,
} from "./entry-classification.js";
import {
	completeRootHygieneInventory,
	rootSurfaceEntryDigest,
} from "./inventory.js";
import { rootSurfaceEntriesFromTrackedPaths } from "./tracked-paths.js";
import type {
	ClassifyGitTrackedRootInput,
	ClassifyRootSurfaceInput,
	RootHygieneReport,
} from "./types.js";

const verifierOwnedReports = new WeakSet<RootHygieneReport>();

/** Classify live git-tracked root paths and emit claim-support evidence. */
export function classifyGitTrackedRoot(
	input: ClassifyGitTrackedRootInput,
): RootHygieneReport {
	const trackedPaths = readGitTrackedPaths(input.repoRoot);
	const entries = rootSurfaceEntriesFromTrackedPaths(trackedPaths);
	return classifyRootSurfaceInternal(
		{
			entries,
			generatedAt: input.generatedAt,
			inventory: completeRootHygieneInventory(entries, "git_tracked_paths"),
			repository: rootHygieneRepositoryIdentity(input.repoRoot),
			headSha: input.headSha ?? null,
		},
		true,
	);
}

/** Classify caller-supplied root entries as non-claim-support evidence. */
export function classifyRootSurface(
	input: ClassifyRootSurfaceInput,
): RootHygieneReport {
	return classifyRootSurfaceInternal(input, false);
}

function classifyRootSurfaceInternal(
	input: ClassifyRootSurfaceInput,
	allowGitTrackedInventory: boolean,
): RootHygieneReport {
	const entries = classifyRootHygieneEntries(input.entries);
	const blockers = entries.filter((entry) => entry.blocking);
	const inputDigest = rootSurfaceEntryDigest(input.entries);
	const coverage = {
		...input.inventory,
		digest: inputDigest,
		valid:
			allowGitTrackedInventory &&
			input.inventory.source === "git_tracked_paths" &&
			input.inventory.completeness === "complete" &&
			input.inventory.entryCount === input.entries.length &&
			input.inventory.digest === inputDigest,
	};
	const status = blockers.length === 0 && coverage.valid ? "pass" : "fail";
	const report: RootHygieneReport = {
		schemaVersion: ROOT_HYGIENE_CLASSIFICATION_SCHEMA_VERSION,
		generatedAt: input.generatedAt,
		sourceRef: ROOT_SURFACE_POLICY_SOURCE_REF,
		repository: input.repository ?? null,
		status,
		entries,
		summary: summarizeRootHygieneEntries(entries),
		coverage,
		blockers,
		deferredEntries: entries.filter(
			(entry) => entry.classification === "should_move",
		),
		receipt: buildRootHygieneReceipt({
			checksum: inputDigest,
			generatedAt: input.generatedAt,
			headSha: input.headSha ?? null,
			status,
		}),
	};
	return markVerifierOwnedRootHygieneReport(report);
}

/** Return whether the report object came from the live verifier seam. */
export function isVerifierOwnedRootHygieneReport(
	report: RootHygieneReport,
): boolean {
	return verifierOwnedReports.has(report);
}

function markVerifierOwnedRootHygieneReport(
	report: RootHygieneReport,
): RootHygieneReport {
	freezeRootHygieneReport(report);
	verifierOwnedReports.add(report);
	return report;
}
