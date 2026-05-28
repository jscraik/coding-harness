import type { HeValidationError } from "../decision/validators.js";
import type { RuntimeCardFreshness } from "./runtime-card.js";

/** Schema version for durable runtime-card handoff receipts. */
export const RUNTIME_CARD_HANDOFF_SCHEMA_VERSION =
	"runtime-card-handoff/v1" as const;

/** Handoff receipts are advisory and cannot directly support delivery claims. */
export const VALID_RUNTIME_CARD_HANDOFF_EVIDENCE_USES = [
	"orientation",
	"audit_trail",
] as const;

/** Admitted freshness classifications for runtime-card handoff receipts. */
export const VALID_RUNTIME_CARD_HANDOFF_FRESHNESS: readonly RuntimeCardFreshness[] =
	["current", "stale", "missing", "unknown"];

/** Admitted uses for runtime-card handoff evidence. */
export type RuntimeCardHandoffEvidenceUse =
	(typeof VALID_RUNTIME_CARD_HANDOFF_EVIDENCE_USES)[number];

/** Immutable file metadata captured for a paired runtime artifact. */
export interface RuntimeCardHandoffArtifactRef {
	/** Repository-relative artifact path. */
	path: string;
	/** Schema version found in the paired artifact. */
	schemaVersion: string;
	/** Artifact size in bytes at handoff generation time. */
	sizeBytes: number;
	/** SHA-256 digest over the persisted artifact bytes. */
	sha256: string;
	/** Generation timestamp bound into the paired artifact. */
	generatedAt: string;
	/** Head SHA projected by the runtime card at handoff time. */
	headSha: string | null;
	/** Runtime source references carried by the artifact. */
	sourceRefs: string[];
	/** Provenance references that produced or identify the artifact. */
	provenanceRefs: string[];
}

/** Shared runtime identity that must match across paired handoff artifacts. */
export interface RuntimeCardHandoffIdentity {
	/** Tracker key projected by the runtime card and evidence bundle. */
	issueKey: string | null;
	/** Head SHA projected by the runtime card. */
	headSha: string | null;
	/** Shared generation timestamp for both paired artifacts. */
	generatedAt: string;
	/** Runtime-evidence producer reference. */
	provenanceRef: string;
	/** Union of source refs used to build the handoff. */
	sourceRefs: string[];
}

/** Durable handoff receipt that binds runtime-card/v1 to its evidence bundle. */
export interface RuntimeCardHandoff {
	/** Contract schema version. */
	schemaVersion: typeof RUNTIME_CARD_HANDOFF_SCHEMA_VERSION;
	/** Receipt generation timestamp. */
	generatedAt: string;
	/** Expiry for using this receipt as orientation evidence. */
	expiresAt: string;
	/** Tracker key this handoff orients. */
	issueKey: string | null;
	/** Head SHA this handoff orients. */
	headSha: string | null;
	/** Handoffs are advisory; they cannot support delivery claims directly. */
	evidenceUse: RuntimeCardHandoffEvidenceUse;
	/** Current freshness classification for the handoff. */
	freshness: RuntimeCardFreshness;
	/** Shared runtime identity for the paired artifacts. */
	runtimeIdentity: RuntimeCardHandoffIdentity;
	/** Runtime-card artifact bound into the handoff. */
	runtimeCard: RuntimeCardHandoffArtifactRef;
	/** Runtime-evidence-bundle artifact bound into the handoff. */
	evidenceBundle: RuntimeCardHandoffArtifactRef;
	/** Union of source refs used by paired artifacts. */
	sourceRefs: string[];
	/** Union of provenance refs used by paired artifacts. */
	provenanceRefs: string[];
	/** Blocking conditions present at handoff time. */
	blockers: string[];
}

/** Validation result for runtime-card-handoff/v1. */
export interface RuntimeCardHandoffValidationResult {
	/** Whether the value satisfies the handoff contract. */
	valid: boolean;
	/** Contract errors found while validating the value. */
	errors: HeValidationError[];
}
