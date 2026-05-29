export const PROMPT_CONTEXT_DRIFT_REPORT_SCHEMA_VERSION =
	"prompt-context-drift-report/v1" as const;

export const PROMPT_CONTEXT_DRIFT_STATUSES = [
	"pass",
	"warn",
	"fail",
	"blocked",
] as const;

export const PROMPT_CONTEXT_DRIFT_EVIDENCE_USES = [
	"orientation",
	"audit_trail",
	"claim_support",
] as const;

export const PROMPT_CONTEXT_DRIFT_FRESHNESS = [
	"current",
	"stale",
	"missing",
	"unknown",
	"not_applicable",
] as const;

export const PROMPT_CONTEXT_DRIFT_SURFACES = [
	"prompt_context",
	"active_artifacts",
	"active_route",
	"project_brain_memory",
	"project_brain_knowledge",
	"runtime_card_or_handoff",
	"receipt_head_sha",
] as const;

export const PROMPT_CONTEXT_DRIFT_REF_KINDS = [
	"repo_file",
	"prompt_context_receipt",
	"runtime_card",
	"receipt",
	"external_metadata",
] as const;

export const PROMPT_CONTEXT_DRIFT_BLOCKER_CLASSES = [
	"none",
	"stale_prompt_context",
	"stale_active_route",
	"missing_project_brain_ref",
	"stale_project_brain_ref",
	"stale_runtime_card",
	"advisory_runtime_card",
	"head_sha_mismatch",
	"missing_source_hash",
	"digest_mismatch",
	"external_only_required_surface",
	"unsafe_ref",
	"raw_or_secret_content",
	"unknown_schema_field",
] as const;

export const PROMPT_CONTEXT_DRIFT_NEXT_ACTION_CLASSES = [
	"none",
	"refresh_prompt_context",
	"refresh_active_artifacts",
	"refresh_project_brain",
	"refresh_runtime_card",
	"refresh_receipts",
	"rerun_validator",
] as const;

/** Overall or per-surface status emitted by a prompt-context drift report. */
export type PromptContextDriftStatus =
	(typeof PROMPT_CONTEXT_DRIFT_STATUSES)[number];
/** How report evidence may be used by downstream cockpit or claim logic. */
export type PromptContextDriftEvidenceUse =
	(typeof PROMPT_CONTEXT_DRIFT_EVIDENCE_USES)[number];
/** Freshness classification for a context surface or source reference. */
export type PromptContextDriftFreshness =
	(typeof PROMPT_CONTEXT_DRIFT_FRESHNESS)[number];
/** Stable identifier for a context surface that can drift from live execution. */
export type PromptContextDriftSurfaceId =
	(typeof PROMPT_CONTEXT_DRIFT_SURFACES)[number];
/** Kind of pointer used to prove a context surface without embedding raw content. */
export type PromptContextDriftRefKind =
	(typeof PROMPT_CONTEXT_DRIFT_REF_KINDS)[number];
/** Machine-readable reason a report or surface cannot support a claim. */
export type PromptContextDriftBlockerClass =
	(typeof PROMPT_CONTEXT_DRIFT_BLOCKER_CLASSES)[number];
/** Recommended refresh or repair lane for the blocking condition. */
export type PromptContextDriftNextActionClass =
	(typeof PROMPT_CONTEXT_DRIFT_NEXT_ACTION_CLASSES)[number];

/** Pointer to the repo-local artifact or metadata backing one context surface. */
export interface PromptContextDriftRef {
	refId: string;
	surfaceId: PromptContextDriftSurfaceId;
	refKind: PromptContextDriftRefKind;
	ref: string;
	hashAlgorithm: "sha256" | null;
	sha256: string | null;
	freshness: PromptContextDriftFreshness;
	evidenceUse: PromptContextDriftEvidenceUse;
	requiredForClaimSupport: boolean;
	requiresFilesystemExistence: boolean;
}

/** Blocking condition that prevents prompt-context evidence from supporting a claim. */
export interface PromptContextDriftBlocker {
	blockerClass: PromptContextDriftBlockerClass;
	reason: string;
	nextActionClass: PromptContextDriftNextActionClass;
}

/** Drift status for one required or advisory context surface. */
export interface PromptContextDriftSurface {
	surfaceId: PromptContextDriftSurfaceId;
	status: PromptContextDriftStatus;
	evidenceUse: PromptContextDriftEvidenceUse;
	freshness: PromptContextDriftFreshness;
	requiredForClaimSupport: boolean;
	observedHeadSha: string | null;
	currentHeadSha: string | null;
	sourceRefs: PromptContextDriftRef[];
	blockers: PromptContextDriftBlocker[];
}

/** Full prompt-context drift report consumed by agent-readiness and validators. */
export interface PromptContextDriftReport {
	schemaVersion: typeof PROMPT_CONTEXT_DRIFT_REPORT_SCHEMA_VERSION;
	generatedAt: string;
	producer: string;
	repoRootRef: string;
	currentHeadSha: string | null;
	evidenceUse: PromptContextDriftEvidenceUse;
	overallStatus: PromptContextDriftStatus;
	surfaces: PromptContextDriftSurface[];
	blockers: PromptContextDriftBlocker[];
	nextAction: string;
}

/** Validation result for semantic prompt-context drift report checks. */
export interface PromptContextDriftValidationResult {
	status: "pass" | "fail";
	errors: string[];
}

/** Options that bind prompt-context drift validation to a repository root. */
export interface PromptContextDriftValidationOptions {
	repoRoot?: string | undefined;
	now?: Date | undefined;
}
