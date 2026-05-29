/** ArtifactRuntimeSurface/v1 packet schema version. */
export const ARTIFACT_RUNTIME_SURFACE_SCHEMA_VERSION =
	"artifact-runtime-surface/v1" as const;

/** Runtime emission status for the first contract slice. */
export type ArtifactRuntimeStatus = "not_yet_emitted";

/** How an artifact runtime surface may be used by downstream verifiers. */
export type ArtifactRuntimeEvidenceUse =
	| "orientation"
	| "audit_trail"
	| "claim_support";

/** Inspectable artifact families that may steer execution or support claims. */
export type ArtifactSurfaceKind =
	| "implementation_notes"
	| "review_artifact"
	| "screenshot"
	| "csv"
	| "pdf"
	| "document"
	| "runtime_card"
	| "report"
	| "lifecycle_artifact"
	| "other";

/** Freshness classification for the artifact runtime surface. */
export type ArtifactRuntimeFreshness =
	| "current"
	| "stale"
	| "missing"
	| "unknown"
	| "not_applicable";

/** Artifact front-matter validation status. */
export type ArtifactFrontMatterStatus =
	| "current"
	| "stale"
	| "missing"
	| "not_applicable";

/** Preview availability for the inspectable artifact. */
export type ArtifactPreviewStatus =
	| "current"
	| "missing"
	| "broken"
	| "not_applicable";

/** Claim support verdict for the artifact. */
export type ArtifactClaimSupportStatus =
	| "supported"
	| "unsupported"
	| "blocked";

/** Why the artifact cannot support a claim. */
export type ArtifactRuntimeBlockerClass =
	| "missing_path"
	| "zero_size"
	| "missing_checksum"
	| "stale_front_matter"
	| "broken_preview"
	| "unsupported_claim"
	| "mismatched_lineage"
	| "stale_surface"
	| "unsafe_reference";

/** Bounded artifact metadata. Contents are intentionally excluded. */
export interface ArtifactRuntimeFile {
	path: string;
	exists: boolean;
	sizeBytes: number;
	sha256: string | null;
	mediaType: string;
	frontMatterStatus: ArtifactFrontMatterStatus;
	producedAt: string;
}

/** Verifier artifact or receipt that checked the inspected artifact. */
export interface ArtifactRuntimeVerifierRef {
	ref: string;
	verifiedAt: string;
}

/** Artifact provenance and current-head binding. */
export interface ArtifactRuntimeLineage {
	producer: string;
	sourceRefs: string[];
	runtimeIdentityRefs: string[];
	verifierRefs: ArtifactRuntimeVerifierRef[];
	headSha: string | null;
}

/** Bounded preview pointer and preview freshness. */
export interface ArtifactRuntimePreview {
	status: ArtifactPreviewStatus;
	ref: string | null;
	checkedAt: string | null;
}

/** Claim refs that the artifact may support when all semantic checks pass. */
export interface ArtifactRuntimeClaimSupport {
	status: ArtifactClaimSupportStatus;
	supportedClaimRefs: string[];
	reason: string;
}

/** Machine-readable blocker for artifact claim support. */
export interface ArtifactRuntimeBlocker {
	class: ArtifactRuntimeBlockerClass;
	reason: string;
	nextAction: string;
}

/** Inspectable artifact surface packet for runtime cockpit evidence. */
export interface ArtifactRuntimeSurface {
	schemaVersion: typeof ARTIFACT_RUNTIME_SURFACE_SCHEMA_VERSION;
	surfaceId: string;
	generatedAt: string;
	producer: string;
	runtimeStatus: ArtifactRuntimeStatus;
	evidenceUse: ArtifactRuntimeEvidenceUse;
	surfaceKind: ArtifactSurfaceKind;
	headSha: string | null;
	currentHeadSha: string | null;
	artifact: ArtifactRuntimeFile;
	lineage: ArtifactRuntimeLineage;
	preview: ArtifactRuntimePreview;
	claimSupport: ArtifactRuntimeClaimSupport;
	freshness: ArtifactRuntimeFreshness;
	blockers: ArtifactRuntimeBlocker[];
	nextAction: string;
}

/** Machine-readable validation failure for an ArtifactRuntimeSurface packet. */
export interface ArtifactRuntimeSurfaceValidationError {
	code: string;
	path: string;
	message: string;
}

/** Aggregate validation result returned by ArtifactRuntimeSurface validators. */
export interface ArtifactRuntimeSurfaceValidationResult {
	valid: boolean;
	errors: ArtifactRuntimeSurfaceValidationError[];
}
