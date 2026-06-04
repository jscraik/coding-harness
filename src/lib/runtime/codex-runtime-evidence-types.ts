import type {
	EvidenceReceipt,
	EvidenceReceiptStatus,
} from "../evidence/evidence-receipt.js";

/** Schema version for Codex runtime evidence packets admitted by Coding Harness. */
export const CODEX_RUNTIME_EVIDENCE_SCHEMA_VERSION =
	"codex-runtime-evidence/v1" as const;

/** Source families that can inform a Codex runtime evidence packet. */
export const CODEX_RUNTIME_SOURCE_KINDS = [
	"sdk_typescript",
	"sdk_python",
	"app_server_protocol",
	"analytics",
	"wrapper",
	"unknown",
] as const;

/** Runtime goal state projected from Codex when available. */
export const CODEX_RUNTIME_GOAL_STATES = [
	"none",
	"active",
	"blocked",
	"complete",
	"unknown",
] as const;

/** Permission posture supported by Codex runtime evidence packets. */
export const CODEX_RUNTIME_PERMISSION_PROFILES = [
	"read_only",
	"workspace_write",
	"network_enabled",
	"escalated",
	"unknown",
] as const;

/** Network availability states for the current Codex execution. */
export const CODEX_RUNTIME_NETWORK_STATES = [
	"enabled",
	"disabled",
	"unknown",
] as const;

/** Executor families that may produce Codex runtime evidence. */
export const CODEX_RUNTIME_EXECUTOR_KINDS = [
	"codex_desktop",
	"codex_cli",
	"harness_wrapper",
	"subagent",
	"ci",
	"unknown",
] as const;

/** Approval scope visible to the runtime evidence producer. */
export const CODEX_RUNTIME_APPROVAL_SCOPES = [
	"none",
	"auto_review",
	"user_review",
	"guardian_review",
	"escalated",
	"unknown",
] as const;

/** Environment-scoped stale classifications for permission evidence. */
export const CODEX_RUNTIME_ENVIRONMENT_STATES = [
	"current",
	"stale_cwd",
	"approval_scope_mismatch",
	"sandbox_policy_missing",
	"unknown",
] as const;

/** MCP server availability states observed by Codex runtime evidence. */
export const CODEX_RUNTIME_MCP_SERVER_STATUSES = [
	"available",
	"unavailable",
	"unknown",
] as const;

/** External or review-state availability within a Codex runtime evidence packet. */
export const CODEX_RUNTIME_OPTIONAL_STATE_STATUSES = [
	"provided",
	"unknown",
] as const;

/** Stale-state classifications carried by Codex runtime evidence. */
export const CODEX_RUNTIME_STALE_STATE_CLASSIFICATIONS = [
	"current",
	"stale",
	"missing",
	"unknown",
] as const;

/** Runtime source family derived from a Codex source path or producer ref. */
export type CodexRuntimeSourceKind =
	(typeof CODEX_RUNTIME_SOURCE_KINDS)[number];

/** Runtime goal state derived from Codex goal metadata. */
export type CodexRuntimeGoalState = (typeof CODEX_RUNTIME_GOAL_STATES)[number];

/** Permission posture derived from explicit Codex permission evidence. */
export type CodexRuntimePermissionProfile =
	(typeof CODEX_RUNTIME_PERMISSION_PROFILES)[number];

/** Network availability for the active Codex execution. */
export type CodexRuntimeNetworkState =
	(typeof CODEX_RUNTIME_NETWORK_STATES)[number];

/** Executor family that produced or wrapped the Codex runtime evidence. */
export type CodexRuntimeExecutorKind =
	(typeof CODEX_RUNTIME_EXECUTOR_KINDS)[number];

/** Approval scope that governed the execution lane. */
export type CodexRuntimeApprovalScope =
	(typeof CODEX_RUNTIME_APPROVAL_SCOPES)[number];

/** Environment-scoped stale classification for permission claims. */
export type CodexRuntimeEnvironmentState =
	(typeof CODEX_RUNTIME_ENVIRONMENT_STATES)[number];

/** MCP server availability classification. */
export type CodexRuntimeMcpServerStatus =
	(typeof CODEX_RUNTIME_MCP_SERVER_STATUSES)[number];

/** Optional external/review state availability classification. */
export type CodexRuntimeOptionalStateStatus =
	(typeof CODEX_RUNTIME_OPTIONAL_STATE_STATUSES)[number];

/** Stale-state classification for claim-relevant runtime inputs. */
export type CodexRuntimeStaleStateClassification =
	(typeof CODEX_RUNTIME_STALE_STATE_CLASSIFICATIONS)[number];

/** Provenance for source-derived Codex runtime evidence fixtures and packets. */
export interface CodexRuntimeSourceProvenance {
	/** Classified source family for the evidence input. */
	sourceKind: CodexRuntimeSourceKind;
	/** Repo-relative or absolute Codex source path used to derive the evidence. */
	codexRepoPath: string;
	/** Codex repository commit SHA when known. */
	commitSha: string | null;
	/** Dirty-state classification for the Codex checkout at capture time. */
	dirtyState: "clean" | "dirty" | "unknown";
	/** Per-source SHA-256 checksums keyed by source path. */
	sourceFileChecksums: Record<string, string>;
	/** Timestamp when the source evidence was captured. */
	capturedAt: string;
}

/** Codex runtime identity fields used by runtime-card projection. */
export interface CodexRuntimeIdentity {
	/** Codex thread identifier, when the source exposes one. */
	threadId: string | null;
	/** Codex turn identifier; required because claim support is turn-scoped. */
	turnId: string;
	/** Client user-message identifier when the producer can prove the initiating message. */
	clientUserMessageId: string | null;
	/** W3C trace identifier or equivalent trace handle, when available. */
	traceId: string | null;
	/** Required blocker class when traceId is unavailable. */
	traceFailureClass: string | null;
	/** Current Codex goal state if visible to the producer. */
	goalState: CodexRuntimeGoalState;
	/** Model identifier when visible to the producer. */
	model?: string | null;
}

/** Permission and network evidence for the current Codex execution. */
export interface CodexRuntimePermissionSnapshot {
	/** Explicit permission posture; unknown must include a failure class. */
	profile: CodexRuntimePermissionProfile;
	/** Writable roots visible to the producer. */
	writableRoots: string[];
	/** Network availability visible to the producer. */
	network: CodexRuntimeNetworkState;
	/** Evidence receipt ref that supports the permission profile, when present. */
	evidenceRef: string | null;
	/** Required when permission or network state is unknown. */
	failureClass: string | null;
}

/** Environment identity that scopes permission and sandbox evidence. */
export interface CodexRuntimeEnvironmentSnapshot {
	/** Runtime environment identifier when the producer can prove one. */
	environmentId: string | null;
	/** Working directory for the execution lane when explicitly observed. */
	cwd: string | null;
	/** Expected working directory for the lane, when policy provides one. */
	expectedCwd: string | null;
	/** Executor family that produced or wrapped this packet. */
	executorKind: CodexRuntimeExecutorKind;
	/** Approval scope that governed this execution lane. */
	approvalScope: CodexRuntimeApprovalScope;
	/** Expected approval scope, when policy provides one. */
	expectedApprovalScope: CodexRuntimeApprovalScope | null;
	/** Receipt ref for the sandbox policy snapshot, when permission facts are known. */
	sandboxPolicyRef: string | null;
	/** Environment freshness classification for permission claim support. */
	state: CodexRuntimeEnvironmentState;
	/** Required when the environment state is not current. */
	failureClass: string | null;
}

/** MCP environment summary for Codex runtime evidence. */
export interface CodexRuntimeMcpSnapshot {
	/** MCP servers visible to the producer. */
	servers: CodexRuntimeMcpServerSnapshot[];
}

/** Single MCP server availability record. */
export interface CodexRuntimeMcpServerSnapshot {
	/** Server name as reported by Codex. */
	name: string;
	/** Server availability status. */
	status: CodexRuntimeMcpServerStatus;
	/** Required when the server status is not available. */
	failureClass: string | null;
}

/** Validation result summary emitted by Codex or a Harness verifier. */
export interface CodexRuntimeValidationResult {
	/** Stable validation name or command family. */
	name: string;
	/** Validation status using the shared receipt status vocabulary. */
	status: EvidenceReceiptStatus;
	/** Evidence receipt ref for the validation output, when present. */
	evidenceRef: string | null;
	/** Verification timestamp, or null when unavailable. */
	verifiedAt: string | null;
}

/** Optional external-state or review-state pointer carried by Codex evidence. */
export interface CodexRuntimeOptionalState {
	/** Whether a stronger verifier supplied this state. */
	status: CodexRuntimeOptionalStateStatus;
	/** Evidence receipt ref; required when status is provided. */
	evidenceRef: string | null;
	/** Required when status is unknown. */
	failureClass: string | null;
}

/** Classification for stale, missing, or unknown claim-relevant state. */
export interface CodexRuntimeStaleState {
	/** State subject, for example trace, permissions, external_state, or review_state. */
	subject: string;
	/** Current stale-state classification. */
	classification: CodexRuntimeStaleStateClassification;
	/** Human-readable reason when state cannot support a claim. */
	reason: string | null;
	/** Evidence receipt ref that supports the classification, when present. */
	evidenceRef: string | null;
}

/** Codex runtime evidence packet normalized before runtime-card projection. */
export interface CodexRuntimeEvidence {
	/** Schema version for this packet. */
	schemaVersion: typeof CODEX_RUNTIME_EVIDENCE_SCHEMA_VERSION;
	/** Packet generation timestamp. */
	generatedAt: string;
	/** Source provenance for the packet. */
	sourceProvenance: CodexRuntimeSourceProvenance;
	/** Codex thread, turn, trace, goal, and model identity. */
	codex: CodexRuntimeIdentity;
	/** Permission and network posture. */
	permissions: CodexRuntimePermissionSnapshot;
	/** Environment facts that scope the permission and sandbox posture. */
	environment: CodexRuntimeEnvironmentSnapshot;
	/** MCP environment summary. */
	mcp: CodexRuntimeMcpSnapshot;
	/** Shared evidence receipts referenced by this packet. */
	receipts: EvidenceReceipt[];
	/** Validation summaries carried by this packet. */
	validationResults: CodexRuntimeValidationResult[];
	/** Optional external-state snapshot pointer. */
	externalState?: CodexRuntimeOptionalState;
	/** Optional PR review-state pointer. */
	reviewState?: CodexRuntimeOptionalState;
	/** Stale-state classifications for claim-relevant inputs. */
	staleState: CodexRuntimeStaleState[];
}

/** Classify a Codex source path into a runtime source family. */
export function classifyCodexRuntimeSourceKind(
	ref: string,
): CodexRuntimeSourceKind {
	if (ref.includes("sdk/typescript/")) return "sdk_typescript";
	if (ref.includes("sdk/python/")) return "sdk_python";
	if (ref.includes("app-server-protocol/")) return "app_server_protocol";
	if (ref.includes("analytics/")) return "analytics";
	if (ref.includes("wrapper")) return "wrapper";
	return "unknown";
}
