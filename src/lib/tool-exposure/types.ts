export const TOOL_EXPOSURE_SCHEMA_VERSION =
	"tool-exposure-snapshot/v1" as const;

export const TOOL_EXPOSURE_KEY_TOOL_NAME_LIMIT = 12;

export const TOOL_EXPOSURE_EVIDENCE_USES = [
	"orientation",
	"audit_trail",
] as const;

export const TOOL_EXPOSURE_NETWORK_ACCESS = [
	"enabled",
	"restricted",
	"disabled",
	"unknown",
] as const;

export const TOOL_EXPOSURE_CLASS_NAMES = [
	"shell",
	"filesystem",
	"network",
	"mcp",
	"browser",
	"agent",
	"plugin",
	"app",
	"github",
	"linear",
	"unknown",
] as const;

export const TOOL_EXPOSURE_PERMISSION_KINDS = [
	"filesystem_read",
	"filesystem_write",
	"network",
	"escalated",
	"external_write",
	"credential",
	"unknown",
] as const;

export const TOOL_EXPOSURE_BLOCKED_REASONS = [
	"sandbox_policy",
	"approval_required",
	"user_denied",
	"not_requested",
	"capability_unavailable",
	"credential_missing",
	"unknown",
] as const;

/** Declares whether a tool exposure packet may orient agents or only support audit history. */
export type ToolExposureEvidenceUse =
	(typeof TOOL_EXPOSURE_EVIDENCE_USES)[number];

/** Classifies the network access posture visible to the runtime. */
export type ToolExposureNetworkAccess =
	(typeof TOOL_EXPOSURE_NETWORK_ACCESS)[number];

/** Groups exposed runtime capabilities without leaking raw tool payloads. */
export type ToolExposureClassName = (typeof TOOL_EXPOSURE_CLASS_NAMES)[number];

/** Classifies permission requests that can be summarized without raw arguments. */
export type ToolExposurePermissionKind =
	(typeof TOOL_EXPOSURE_PERMISSION_KINDS)[number];

/** Explains why a permission attempt could not be used by the runtime. */
export type ToolExposureBlockedReason =
	(typeof TOOL_EXPOSURE_BLOCKED_REASONS)[number];

/** Count summary for a single tool class across visible, deferred, blocked, and failed states. */
export interface ToolExposureClassCounts {
	visible: number;
	deferred: number;
	hidden: number;
	unavailable: number;
	notAttempted: number;
	claimFailed: number;
}

/** Compact per-class projection of tool availability and any class-level failure reason. */
export interface ToolExposureClassSummary {
	className: ToolExposureClassName;
	statusCounts: ToolExposureClassCounts;
	keyToolNames: string[];
	originalKeyToolNameCount: number;
	namesTruncated: boolean;
	failureClass: string | null;
}

/** Receipt-like summary for a blocked permission attempt without raw command or argument detail. */
export interface ToolExposureBlockedPermissionAttempt {
	attemptId: string;
	permissionKind: ToolExposurePermissionKind;
	reason: ToolExposureBlockedReason;
	evidenceRef: string;
	failureClass: string;
}

/** Aggregate counts used by runtime cards and claim-verifier routing. */
export interface ToolExposureSummary extends ToolExposureClassCounts {
	totalToolClassCount: number;
	blockedPermissionAttemptCount: number;
	writableRootCount: number;
	keyToolNameCount: number;
	originalKeyToolNameCount: number;
	namesTruncated: boolean;
}

/** Tool exposure packet admitted by the runtime evidence cockpit before live emitters exist. */
export interface ToolExposureSnapshot {
	schemaVersion: typeof TOOL_EXPOSURE_SCHEMA_VERSION;
	generatedAt: string;
	producer: string;
	runtimeStatus: "not_yet_emitted";
	evidenceUse: ToolExposureEvidenceUse;
	evidenceRef: string;
	sandboxMode: string;
	approvalPolicy: string;
	networkAccess: ToolExposureNetworkAccess;
	writableRootCount: number;
	toolClasses: ToolExposureClassSummary[];
	blockedPermissionAttempts: ToolExposureBlockedPermissionAttempt[];
	summary: ToolExposureSummary;
	blockedBy: string;
}

/** Runtime-card-safe projection of tool exposure state with no raw tool arguments or paths. */
export interface RuntimeCardToolExposureProjection {
	evidenceRef: string;
	evidenceUse: ToolExposureEvidenceUse;
	sandboxMode: string;
	approvalPolicy: string;
	networkAccess: ToolExposureNetworkAccess;
	visibleToolCount: number;
	deferredToolCount: number;
	hiddenToolCount: number;
	unavailableToolCount: number;
	notAttemptedToolCount: number;
	claimFailedToolCount: number;
	blockedPermissionAttemptCount: number;
	writableRootCount: number;
	keyToolNames: string[];
	originalKeyToolNameCount: number;
	namesTruncated: boolean;
}

/** Validation error emitted by the tool exposure packet validator. */
export interface ToolExposureValidationError {
	code: string;
	path: string;
	severity: "error";
}

/** Validation result for tool exposure packets and runtime-card projections. */
export interface ToolExposureValidationResult {
	valid: boolean;
	errors: ToolExposureValidationError[];
}
