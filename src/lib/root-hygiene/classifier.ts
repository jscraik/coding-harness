import { formatRootHygieneError } from "./errors.js";
import { buildRootHygieneReceipt } from "./receipt.js";
import { ROOT_HYGIENE_CLASSIFICATION_SCHEMA_VERSION } from "./types.js";
import { readGitTrackedPathEntries } from "./git-tracked-paths.js";
import { freezeRootHygieneReport } from "./report-freeze.js";
import { rootHygieneRepositoryIdentity } from "./repository-identity.js";
import { ROOT_SURFACE_POLICY_SOURCE_REF } from "./policy.js";
import { missingRequiredPolicyBlockers } from "./policy-coverage.js";
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
	try {
		const trackedPaths =
			input.gitLsFilesMaxBufferBytes === undefined
				? readGitTrackedPathEntries(input.repoRoot)
				: readGitTrackedPathEntries(input.repoRoot, {
						maxBufferBytes: input.gitLsFilesMaxBufferBytes,
					});
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
	} catch (error) {
		throw new Error(
			`Failed to classify git-tracked root for repoRoot=${input.repoRoot}: ${formatRootHygieneError(error)}`,
		);
	}
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
	const missingPolicyBlockers = allowGitTrackedInventory
		? missingRequiredPolicyBlockers(input.entries)
		: [];
	const blockers = [
		...entries.filter((entry) => entry.blocking),
		...missingPolicyBlockers,
	];
	const inputDigest = rootSurfaceEntryDigest(input.entries);
	const summary = summarizeRootHygieneEntries(entries);
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
		summary: { ...summary, blocking: blockers.length },
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
	if (allowGitTrackedInventory) {
		return markVerifierOwnedRootHygieneReport(report);
	}
	freezeRootHygieneReport(report);
	return report;
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
