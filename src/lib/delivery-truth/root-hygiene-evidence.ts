import type { DeliveryTruthEvidence } from "./types.js";
import { rootSurfaceEntryDigest } from "../root-hygiene/inventory.js";
import { ROOT_SURFACE_POLICY_SOURCE_REF } from "../root-hygiene/policy.js";
import { isCurrentRootHygieneReceiptRef } from "../root-hygiene/receipt.js";
import {
	ROOT_HYGIENE_CLASSIFICATION_SCHEMA_VERSION,
	ROOT_HYGIENE_RECEIPT_PRODUCER,
} from "../root-hygiene/types.js";
import { missingRequiredPolicyBlockers } from "../root-hygiene/policy-coverage.js";
import type { ClassifiedRootHygieneEntry } from "../root-hygiene/types.js";
import { isVerifierOwnedRootHygieneReport } from "../root-hygiene/classifier.js";
import { ROOT_HYGIENE_REPOSITORY_ID_KIND } from "../root-hygiene/repository-identity.js";

/** Verify root-hygiene evidence came from the current classifier report. */
export function isTrustedRootHygieneEvidence(
	evidence: DeliveryTruthEvidence,
): boolean {
	const report = evidence.rootHygieneReport;
	return (
		isCurrentRootHygieneReceiptRef(evidence.receipt.ref) &&
		evidence.receipt.producer === ROOT_HYGIENE_RECEIPT_PRODUCER &&
		isSha256Checksum(evidence.receipt.checksum) &&
		report !== undefined &&
		isVerifierOwnedRootHygieneReport(report) &&
		report.schemaVersion === ROOT_HYGIENE_CLASSIFICATION_SCHEMA_VERSION &&
		report.sourceRef === ROOT_SURFACE_POLICY_SOURCE_REF &&
		isRootHygieneRepositoryIdentity(report.repository) &&
		rootHygieneCoverageMatchesReport(evidence) &&
		rootHygieneReportInternalsMatch(evidence) &&
		report.receipt.ref === evidence.receipt.ref &&
		report.receipt.producer === evidence.receipt.producer &&
		report.receipt.checksum === evidence.receipt.checksum &&
		report.receipt.headSha === evidence.receipt.headSha &&
		report.receipt.status === evidence.receipt.status
	);
}

/**
 * Validates internal consistency of a root-hygiene report within the given evidence.
 *
 * Checks that the report exists and that its status, summary totals, per-classification
 * counts, blocking count, ordered blockers list, and deferred-entries count align with
 * the report's entries and derived policy blockers.
 *
 * @param evidence - The delivery truth evidence containing the root-hygiene report and receipt
 * @returns `true` if all internal consistency checks pass, `false` otherwise
 */
function rootHygieneReportInternalsMatch(
	evidence: DeliveryTruthEvidence,
): boolean {
	const report = evidence.rootHygieneReport;
	if (report === undefined) {
		return false;
	}
	const blockingEntries = report.entries.filter((entry) => entry.blocking);
	const expectedBlockers = [
		...blockingEntries,
		...missingRequiredPolicyBlockers(report.entries),
	];
	const deferredEntries = report.entries.filter(
		(entry) => entry.classification === "should_move",
	);
	return (
		report.status === evidence.receipt.status &&
		report.summary.total === report.entries.length &&
		report.summary.canonicalRoot ===
			countRootHygieneClassification(report.entries, "canonical_root") &&
		report.summary.shouldMove ===
			countRootHygieneClassification(report.entries, "should_move") &&
		report.summary.generatedTrackedIntentionally ===
			countRootHygieneClassification(
				report.entries,
				"generated_tracked_intentionally",
			) &&
		report.summary.legacyDrift ===
			countRootHygieneClassification(report.entries, "legacy_drift") &&
		report.summary.unclassified ===
			countRootHygieneClassification(report.entries, "unclassified") &&
		report.summary.blocking === expectedBlockers.length &&
		rootHygieneBlockersMatch(report.blockers, expectedBlockers) &&
		report.deferredEntries.length === deferredEntries.length
	);
}

/**
 * Determine whether two blocker arrays match exactly in length and in element-by-element content.
 *
 * @param actual - Blocker entries reported in the root-hygiene report
 * @param expected - Blocker entries expected (computed from entries and policy-derived blockers)
 * @returns `true` if `actual` and `expected` have the same length and each element at the same index matches, `false` otherwise.
 */
function rootHygieneBlockersMatch(
	actual: readonly ClassifiedRootHygieneEntry[],
	expected: readonly ClassifiedRootHygieneEntry[],
): boolean {
	return (
		actual.length === expected.length &&
		actual.every((entry, index) =>
			rootHygieneEntryMatches(entry, expected[index]),
		)
	);
}

/**
 * Determines whether two root-hygiene entries match exactly across all identifying fields.
 *
 * @param actual - The observed entry to compare
 * @param expected - The expected entry; if `undefined`, the entries do not match
 * @returns `true` if `expected` is defined and `actual.path`, `kind`, `classification`, `reason`, and `blocking` all equal the corresponding fields on `expected`, `false` otherwise
 */
function rootHygieneEntryMatches(
	actual: ClassifiedRootHygieneEntry,
	expected: ClassifiedRootHygieneEntry | undefined,
): boolean {
	return (
		expected !== undefined &&
		actual.path === expected.path &&
		actual.kind === expected.kind &&
		actual.classification === expected.classification &&
		actual.reason === expected.reason &&
		actual.blocking === expected.blocking
	);
}

/**
 * Count entries in a root-hygiene report that have a given classification.
 *
 * @param entries - The report entries to examine
 * @param classification - The classification value to count among `entries`
 * @returns The number of entries whose `classification` equals `classification`
 */
function countRootHygieneClassification(
	entries: NonNullable<DeliveryTruthEvidence["rootHygieneReport"]>["entries"],
	classification: NonNullable<
		DeliveryTruthEvidence["rootHygieneReport"]
	>["entries"][number]["classification"],
): number {
	return entries.filter((entry) => entry.classification === classification)
		.length;
}

function rootHygieneCoverageMatchesReport(
	evidence: DeliveryTruthEvidence,
): boolean {
	const report = evidence.rootHygieneReport;
	if (report === undefined) {
		return false;
	}
	const reportDigest = rootSurfaceEntryDigest(report.entries);
	return (
		report.coverage.source === "git_tracked_paths" &&
		report.coverage.valid &&
		report.coverage.completeness === "complete" &&
		report.coverage.entryCount === report.entries.length &&
		report.coverage.digest === reportDigest &&
		reportDigest === evidence.receipt.checksum
	);
}

function isSha256Checksum(checksum: string | null | undefined): boolean {
	return typeof checksum === "string" && /^[a-f0-9]{64}$/u.test(checksum);
}

function isRootHygieneRepositoryIdentity(
	repository: NonNullable<
		DeliveryTruthEvidence["rootHygieneReport"]
	>["repository"],
): boolean {
	return (
		repository !== null &&
		repository.kind === ROOT_HYGIENE_REPOSITORY_ID_KIND &&
		isSha256Checksum(repository.digest)
	);
}
