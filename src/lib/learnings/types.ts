/** Schema version for local learning import artifacts. */
export const LEARNING_ARTIFACT_SCHEMA_VERSION = "harness-learnings/v1";

/** Schema version for `harness learnings import --json` results. */
export const LEARNING_IMPORT_RESULT_SCHEMA_VERSION =
	"learnings-import-result/v1";

/** Provider identifier supported by the Phase 1A import slice. */
export type LearningProvider = "coderabbit";

/** CSV provider identifier accepted by the Phase 1A import command. */
export type LearningImportProvider = "coderabbit-csv";

/** Source reference for a normalized learning item. */
export interface LearningSourceRef {
	/** Source format used to import the learning. */
	kind: "coderabbit_csv";
	/** Local source URI. Phase 1A local artifacts may include absolute file URIs. */
	uri: string;
	/** Physical CSV row number, including the header row offset. */
	row: number;
	/** CodeRabbit CSV exports are non-live evidence in Phase 1A. */
	live: false;
}

/** Provisional learning classification used for future promotion analysis. */
export type LearningClassification =
	| "guardrail"
	| "validation_contract"
	| "source_of_truth"
	| "generated_artifact"
	| "scaffold_default"
	| "ci_ownership"
	| "review_context"
	| "memory_only";

/** Provisional enforcement level derived from usage signal and classification. */
export type LearningEnforcement = "error" | "warning" | "none";

/** Promotion lifecycle state recorded by the enforcement-status ledger. */
export type LearningPromotionStatus =
	| "unreviewed"
	| "candidate"
	| "accepted"
	| "enforced"
	| "rejected"
	| "deferred"
	| "non_goal";

/** Normalized learning item consumed by future gates and review-context phases. */
export interface LearningItem {
	/** Deterministic provider/repository/topic identifier. */
	id: string;
	/** Learning provider after normalization. */
	provider: LearningProvider;
	/** Evidence source for this normalized row. */
	source: LearningSourceRef;
	/** Repository slug, normalized to lower-case hyphenated form. */
	repository: string;
	/** Optional file path associated with the CodeRabbit learning. */
	file?: string;
	/** Optional pull request number as exported by CodeRabbit. */
	pullRequest?: string;
	/** Optional URL, synthesized from repository and pull request when absent. */
	githubUrl?: string;
	/** Non-negative usage count. */
	usage: number;
	/** Learning text from the CSV row, with any target prefix removed. */
	learning: string;
	/** Optional author exported by CodeRabbit. */
	createdBy?: string;
	/** Last-used timestamp string, or null when CodeRabbit exports `Never`. */
	lastUsed?: string | null;
	/** Optional created-at timestamp string preserved from the CSV. */
	createdAt?: string;
	/** Optional updated-at timestamp string preserved from the CSV. */
	updatedAt?: string;
	/** Optional target patterns extracted from `Applies to <path-or-glob> :`. */
	targetPatterns?: string[];
	/** Non-blocking Phase 1A classification hint. */
	classification: LearningClassification;
	/** Non-blocking Phase 1A enforcement hint. */
	enforcement: LearningEnforcement;
	/** Promotion lifecycle status for routing repeated learnings into durable rules. */
	promotionStatus: LearningPromotionStatus;
	/** Concrete implementation or test paths enforcing this learning. */
	enforcedBy?: string[];
}

/** Machine-readable warning emitted during import. */
export interface LearningImportWarning {
	/** Optional CSV row number when the warning is row-scoped. */
	row?: number;
	/** Stable warning code. */
	code: string;
	/** Human-readable warning message. */
	message: string;
}

/** Summary counts emitted for a learning import. */
export interface LearningImportSummary {
	/** Total data rows observed after the header. */
	totalRows: number;
	/** Number of valid rows imported for the requested repository. */
	imported: number;
	/** Number of valid rows skipped because they target a different repository. */
	skipped: number;
	/** Number of invalid rows skipped with warnings. */
	invalid: number;
	/** Warning count. */
	warnings: number;
	/** Stable count map by provisional classification. */
	byClassification: Partial<Record<LearningClassification, number>>;
	/** Stable count map by provisional enforcement level. */
	byEnforcement: Partial<Record<LearningEnforcement, number>>;
}

/** Local artifact written by `harness learnings import`. */
export interface LearningImportArtifact {
	/** Artifact schema version. */
	schemaVersion: typeof LEARNING_ARTIFACT_SCHEMA_VERSION;
	/** Import provider. */
	provider: LearningImportProvider;
	/** Target repository slug. */
	repository: string;
	/** Local CSV source metadata. */
	source: {
		kind: "coderabbit_csv";
		uri: string;
		live: false;
	};
	/** SHA-256 fingerprint of the source input. */
	inputFingerprint: string;
	/** Deterministically ordered learning items. */
	items: LearningItem[];
	/** Deterministically ordered warnings. */
	warnings: LearningImportWarning[];
	/** Import summary. */
	summary: LearningImportSummary;
	/** Optional coarse provider metadata that is not row-level learning evidence. */
	liveCompanion?: import("./live-companion.js").LearningLiveCompanion;
}

/** JSON result emitted by the import command. */
export interface LearningImportResult {
	/** Result schema version. */
	schemaVersion: typeof LEARNING_IMPORT_RESULT_SCHEMA_VERSION;
	/** Import status. */
	status: "success" | "partial" | "error";
	/** Artifact path when a write completed. */
	artifactPath?: string;
	/** Target repository slug. */
	repository?: string;
	/** Import summary when available. */
	summary?: LearningImportSummary;
	/** Warnings emitted during import. */
	warnings: LearningImportWarning[];
	/** Stable error code for failures. */
	errorCode?: string;
	/** Human-readable error message for failures. */
	message?: string;
}

/** Result from loading a local learning artifact for matching. */
export type LearningArtifactLoadResult =
	| {
			ok: true;
			artifact: LearningImportArtifact;
			warnings: LearningImportWarning[];
	  }
	| { ok: false; code: string; message: string; fix?: string };

/** Internal normalized row emitted by the CodeRabbit CSV parser. */
export interface ParsedCodeRabbitLearningRow {
	/** Physical CSV row number, including the header row offset. */
	row: number;
	/** Normalized repository slug. */
	repository: string;
	/** Optional file path. */
	file?: string;
	/** Optional pull request number. */
	pullRequest?: string;
	/** Optional URL. */
	url?: string;
	/** Non-negative usage count. */
	usage: number;
	/** Learning text without extracted target prefix. */
	learning: string;
	/** Optional author. */
	createdBy?: string;
	/** Nullable last-used value. */
	lastUsed?: string | null;
	/** Optional created-at value. */
	createdAt?: string;
	/** Optional updated-at value. */
	updatedAt?: string;
	/** Extracted target patterns. */
	targetPatterns?: string[];
}
