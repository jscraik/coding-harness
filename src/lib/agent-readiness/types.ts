/** Overall severity for an agent-readiness report or finding. */
export type AgentReadinessStatus = "pass" | "warn" | "fail";

/** Agent-readiness dimension covered by a finding. */
export type AgentReadinessCategory =
	| "instructions"
	| "artifacts"
	| "capabilities"
	| "approval_gates"
	| "traceability"
	| "context_health";

/** How a readiness surface may be used by downstream workflows. */
export type AgentReadinessEvidenceUse =
	| "orientation"
	| "claim_support"
	| "audit_trail";

/** Context surface covered by the lightweight agent-readiness projection. */
export type AgentReadinessContextSurfaceId =
	| "active_artifacts"
	| "active_route_refs"
	| "project_brain_memory"
	| "project_brain_knowledge"
	| "runtime_card"
	| "prompt_context_drift"
	| "external_horizon";

/** Single readiness check result with concrete file evidence. */
export interface AgentReadinessFinding {
	/** Stable finding identifier. */
	id: string;
	/** Dimension the finding belongs to. */
	category: AgentReadinessCategory;
	/** Severity for this finding. */
	status: AgentReadinessStatus;
	/** Human-readable explanation of the check result. */
	message: string;
	/** Repo-relative files that support the finding. */
	evidence: string[];
	/** Suggested repair when the finding is not already a clean pass. */
	recommendation?: string | undefined;
}

/** Count of findings by severity. */
export interface AgentReadinessSummary {
	/** Number of passing findings. */
	pass: number;
	/** Number of warning findings. */
	warn: number;
	/** Number of failing findings. */
	fail: number;
}

/** Lightweight status for a context surface agents commonly use before acting. */
export interface AgentReadinessContextSurface {
	/** Stable surface identifier. */
	id: AgentReadinessContextSurfaceId;
	/** Current surface status from local repository evidence. */
	status: AgentReadinessStatus;
	/** Context-health projection is orientation-only, not delivery proof. */
	evidenceUse: "orientation";
	/** Repo-relative evidence paths for this surface. */
	evidence: string[];
	/** Why the surface is stale, missing, or degraded. */
	staleReasons: string[];
	/** Source-attributed refs that are missing or degraded, when applicable. */
	missingRefs?: AgentReadinessMissingContextRef[] | undefined;
	/** Read-only commands an agent can run to refresh or inspect the surface. */
	suggestedRefreshCommands: string[];
}

/** Source-attributed context ref that could not be used for orientation. */
export interface AgentReadinessMissingContextRef {
	/** Original normalized repo-relative ref. */
	ref: string;
	/** Stable source that declared the ref. */
	declaredBy: string;
	/** Normalized repo-relative path tested against the checkout. */
	normalizedPath: string;
	/** Stable failure reason for the missing ref. */
	reason: "missing_ref";
}

/** Canonical deep context-health command availability from the readiness view. */
export interface AgentReadinessCanonicalContextReport {
	/** Deep report schema that remains owned by the context-health command. */
	schemaVersion: "context-health-report/v1";
	/** Read-only command to produce the deeper report when prerequisites exist. */
	command: string;
	/** Whether the deeper command source is discoverable in this checkout. */
	available: boolean;
	/** Whether this repo has enough contract metadata for the deeper report path. */
	prerequisiteStatus: AgentReadinessStatus;
	/** Repo-relative prerequisite evidence paths. */
	prerequisiteEvidence: string[];
}

/** Advisory context-health projection included inside agent-readiness reports. */
export interface AgentReadinessContextHealth {
	/** Projection schema; distinct from the canonical deep context-health report. */
	schemaVersion: "agent-readiness-context-health/v1";
	/** Overall projection status from local surface checks. */
	status: AgentReadinessStatus;
	/** Projection evidence is only allowed to orient future work. */
	evidenceUse: "orientation";
	/** Pointer to the canonical deep context-health report contract. */
	canonicalReport: AgentReadinessCanonicalContextReport;
	/** Individual context surfaces agents commonly rely on. */
	surfaces: AgentReadinessContextSurface[];
	/** Deduplicated read-only refresh commands for degraded surfaces. */
	suggestedRefreshCommands: string[];
}

/** Versioned read-only report for the agent-readiness command. */
export interface AgentReadinessReport {
	/** JSON schema identifier for downstream parsers. */
	schemaVersion: "agent-readiness/v1";
	/** Overall report status, derived from finding severities. */
	status: AgentReadinessStatus;
	/** Absolute repository root that was assessed. */
	repoRoot: string;
	/** ISO timestamp for when the assessment was generated. */
	generatedAt: string;
	/** Finding count by severity. */
	summary: AgentReadinessSummary;
	/** Advisory context-health projection for stale-state orientation. */
	contextHealth: AgentReadinessContextHealth;
	/** Detailed readiness findings. */
	findings: AgentReadinessFinding[];
}

/** Versioned usage-error payload for invalid agent-readiness CLI arguments. */
export interface AgentReadinessUsageError {
	/** JSON schema identifier for downstream parsers of usage errors. */
	schemaVersion: "agent-readiness-error/v1";
	/** Usage errors are not normal readiness reports. */
	status: "error";
	/** Structured error details for agents and automation. */
	error: {
		/** Stable machine-readable error code. */
		code: "agent-readiness.flag_value_required";
		/** Human-readable error message. */
		message: string;
	};
}

/** Options for running the read-only readiness assessment. */
export interface AgentReadinessOptions {
	/** Repository root to inspect; defaults to the current working directory. */
	repoRoot?: string | undefined;
	/** Optional deterministic clock for tests. */
	now?: Date;
}
