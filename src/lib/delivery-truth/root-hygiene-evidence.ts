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
