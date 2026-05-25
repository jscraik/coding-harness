import type { EvidenceReceipt } from "../evidence/evidence-receipt.js";
import type { RootHygieneRepositoryIdentity } from "./repository-identity.js";

export const ROOT_HYGIENE_CLASSIFICATION_SCHEMA_VERSION =
	"root-hygiene-classification/v1" as const;
export const ROOT_HYGIENE_RECEIPT_REF =
	"root-hygiene:root-hygiene-classification/v1" as const;
export const ROOT_HYGIENE_RECEIPT_REF_POLICY_PREFIX =
	"root-hygiene:root-hygiene-classification/v1:policy:" as const;
export const ROOT_HYGIENE_RECEIPT_PRODUCER = "root-hygiene-classifier" as const;

export const ROOT_HYGIENE_ENTRY_KINDS = ["file", "directory"] as const;
export const ROOT_HYGIENE_CLASSIFICATION_CLASSES = [
	"canonical_root",
	"should_move",
	"generated_tracked_intentionally",
	"legacy_drift",
	"unclassified",
] as const;
export const ROOT_HYGIENE_INVENTORY_SOURCES = [
	"git_tracked_paths",
	"policy_fixture",
	"test_fixture",
] as const;

/** Kind of tracked top-level repository entry inspected by root hygiene. */
export type RootHygieneEntryKind = (typeof ROOT_HYGIENE_ENTRY_KINDS)[number];

/** Classification assigned to a tracked root entry by the policy contract. */
export type RootHygieneClassificationClass =
	(typeof ROOT_HYGIENE_CLASSIFICATION_CLASSES)[number];

/** Overall root-hygiene status emitted for delivery-truth claim support. */
export type RootHygieneStatus = "pass" | "fail";

/** Source used to prove the classifier input covered a complete root inventory. */
export type RootHygieneInventorySource =
	(typeof ROOT_HYGIENE_INVENTORY_SOURCES)[number];

/** Minimal tracked root entry input consumed by the classifier. */
export interface RootSurfaceEntry {
	path: string;
	kind: RootHygieneEntryKind;
}

/** Policy row that maps one root entry to its intended classification. */
export interface RootHygienePolicyEntry extends RootSurfaceEntry {
	classification: Exclude<RootHygieneClassificationClass, "unclassified">;
	reason: string;
}

/** Policy snapshot used to classify a root surface from a known source ref. */
export interface RootHygienePolicy {
	sourceRef: string;
	entries: readonly RootHygienePolicyEntry[];
}

/** Root entry after classifier lookup, including whether it blocks claims. */
export interface ClassifiedRootHygieneEntry extends RootSurfaceEntry {
	classification: RootHygieneClassificationClass;
	reason: string;
	blocking: boolean;
}

/** Count summary for operator-facing root-hygiene reports. */
export interface RootHygieneSummary {
	total: number;
	canonicalRoot: number;
	shouldMove: number;
	generatedTrackedIntentionally: number;
	legacyDrift: number;
	unclassified: number;
	blocking: number;
}

/** Coverage proof for the root entries supplied to the classifier. */
export interface RootHygieneInventory {
	source: RootHygieneInventorySource;
	completeness: "complete" | "partial" | "unknown";
	entryCount: number;
	digest: string;
}

/** Coverage proof plus classifier-side validity for the current report. */
export interface RootHygieneCoverage extends RootHygieneInventory {
	valid: boolean;
}

/** Claim-supporting report and receipt for the current root surface. */
export interface RootHygieneReport {
	schemaVersion: typeof ROOT_HYGIENE_CLASSIFICATION_SCHEMA_VERSION;
	generatedAt: string;
	sourceRef: string;
	repository: RootHygieneRepositoryIdentity | null;
	status: RootHygieneStatus;
	entries: ClassifiedRootHygieneEntry[];
	summary: RootHygieneSummary;
	coverage: RootHygieneCoverage;
	blockers: ClassifiedRootHygieneEntry[];
	deferredEntries: ClassifiedRootHygieneEntry[];
	receipt: EvidenceReceipt;
}

/** Inputs required to classify a root surface and produce a receipt. */
export interface ClassifyRootSurfaceInput {
	entries: readonly RootSurfaceEntry[];
	generatedAt: string;
	inventory: RootHygieneInventory;
	repository?: RootHygieneRepositoryIdentity | null;
	headSha?: string | null;
}

/** Inputs for verifier-owned classification from live git-tracked paths. */
export interface ClassifyGitTrackedRootInput {
	repoRoot: string;
	generatedAt: string;
	headSha?: string | null;
}
