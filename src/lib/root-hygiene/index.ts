export { classifyGitTrackedRoot, classifyRootSurface } from "./classifier.js";
export { rootHygieneGitEnv } from "./git-env.js";
export { readGitTrackedPaths } from "./git-tracked-paths.js";
export {
	completeRootHygieneInventory,
	rootSurfaceEntryDigest,
} from "./inventory.js";
export {
	ROOT_SURFACE_POLICY,
	ROOT_SURFACE_POLICY_DIGEST,
	ROOT_SURFACE_POLICY_SOURCE_REF,
	policyRootSurfaceEntries,
} from "./policy.js";
export { rootHygienePolicyDigest } from "./policy-digest.js";
export {
	buildRootHygieneReceipt,
	isCurrentRootHygieneReceiptRef,
	rootHygieneReceiptRef,
} from "./receipt.js";
export { rootSurfaceEntriesFromTrackedPaths } from "./tracked-paths.js";
export {
	ROOT_HYGIENE_CLASSIFICATION_CLASSES,
	ROOT_HYGIENE_CLASSIFICATION_SCHEMA_VERSION,
	ROOT_HYGIENE_ENTRY_KINDS,
	ROOT_HYGIENE_INVENTORY_SOURCES,
	ROOT_HYGIENE_RECEIPT_PRODUCER,
	ROOT_HYGIENE_RECEIPT_REF,
	ROOT_HYGIENE_RECEIPT_REF_POLICY_PREFIX,
} from "./types.js";
export type {
	ClassifiedRootHygieneEntry,
	ClassifyGitTrackedRootInput,
	ClassifyRootSurfaceInput,
	RootHygieneClassificationClass,
	RootHygieneEntryKind,
	RootHygieneInventory,
	RootHygieneInventorySource,
	RootHygienePolicy,
	RootHygienePolicyEntry,
	RootHygieneReport,
	RootHygieneStatus,
	RootHygieneSummary,
	RootSurfaceEntry,
} from "./types.js";
