import type { AgentReadinessContextHealth } from "../agent-readiness/types.js";
import type { HarnessDecision } from "../decision/harness-decision.js";
import type {
	SessionContextReport,
	SessionContextStaleState,
	SessionContextTraversalHint,
} from "../session-context/types.js";

/** Overall status for the cold-start orientation packet. */
export type HarnessOrientStatus = "pass" | "warn" | "fail";

/** Local preflight receipt status consumed by the orientation packet. */
export type HarnessOrientPreflightStatus =
	| "pass"
	| "warn"
	| "fail"
	| "blocked"
	| "unobserved"
	| "invalid";

/** Bounded evidence role for orientation output. */
export type HarnessOrientEvidenceUse = "orientation";

/** Compact reference to a repository context file an agent may read next. */
export interface HarnessOrientContextRef {
	/** Repository-relative path to the context surface. */
	path: string;
	/** Whether the path exists in the current checkout. */
	status: "present" | "missing";
	/** Why the context surface matters during cold start. */
	reason: string;
}

/** Read-only command an agent can run to deepen a specific context lane. */
export interface HarnessOrientContextCommand {
	/** Stable command label for downstream display. */
	id: string;
	/** Exact command to run from the repository root. */
	command: string;
	/** Why this command belongs in the cold-start rail. */
	reason: string;
}

/** Conditional context rule for architecture-sensitive or docs-sensitive work. */
export interface HarnessOrientConditionalContext {
	/** File or task pattern that activates the context rule. */
	when: string;
	/** Repository-relative file to read when the rule applies. */
	read: string;
	/** Optional validation command for the context rule. */
	validate: string | null;
}

/** Minimal projection of harness next inside the cold-start packet. */
export interface HarnessOrientNextDecision {
	/** Schema version emitted by the source harness next decision. */
	schemaVersion: HarnessDecision["schemaVersion"];
	/** Current next decision status. */
	status: HarnessDecision["status"];
	/** Decision phase. */
	phase: HarnessDecision["phase"];
	/** Product cockpit lane, when present. */
	cockpitLane: HarnessDecision["cockpitLane"] | null;
	/** Human-readable decision summary. */
	summary: string;
	/** Suggested next action. */
	nextAction: string;
	/** Exact next command, if one is available. */
	nextCommand: string | null;
	/** Failure class when the decision is blocked or failed. */
	failureClass: string | null;
	/** Evidence refs required before closeout or handoff claims. */
	requiredEvidence: string[];
	/** Conditions that should stop the agent. */
	stopConditions: string[];
	/** Follow-up command hints from the source decision. */
	followUpCommands: string[];
}

/** Minimal projection of session-context/v1 inside the cold-start packet. */
export interface HarnessOrientSessionContext {
	/** Source packet schema version. */
	schemaVersion: SessionContextReport["schemaVersion"];
	/** Source packet status. */
	status: SessionContextReport["status"];
	/** Repository display name. */
	repository: string;
	/** Current branch, when git can provide it. */
	branch: string | null;
	/** Current HEAD SHA, when git can provide it. */
	headSha: string | null;
	/** Issue key inferred from local evidence, when available. */
	issueRef: string | null;
	/** Number of changed files seen by session-context. */
	changedFileCount: number;
	/** Number of active artifact refs discovered. */
	activeArtifactCount: number;
	/** Number of runtime-card refs discovered. */
	runtimeCardCount: number;
	/** Number of review artifact refs discovered. */
	reviewArtifactCount: number;
	/** Stale or missing local evidence surfaces. */
	staleState: SessionContextStaleState[];
	/** Read-only traversal hints from session-context. */
	nextTraversalHints: SessionContextTraversalHint[];
}

/** Preflight receipt projection for the cold-start packet. */
export interface HarnessOrientPreflightReceipt {
	/** Stable receipt path read by orient. */
	path: string;
	/** Receipt status or unobserved/invalid when no usable receipt exists. */
	status: HarnessOrientPreflightStatus;
	/** Receipt schema version, when present. */
	schemaVersion: string | null;
	/** Receipt generation timestamp, when present. */
	generatedAt: string | null;
	/** Preflight mode, when present. */
	mode: string | null;
	/** Command recorded by the receipt or recommended by orient. */
	command: string;
	/** Human-readable reason for unobserved or invalid receipt state. */
	reason: string | null;
}

/** Architecture map projection for the cold-start packet. */
export interface HarnessOrientArchitectureContext {
	/** Generated architecture context path. */
	path: string;
	/** Whether the architecture context exists. */
	status: "present" | "missing";
	/** Manifest path used by focused diagram consumers. */
	manifestPath: string;
	/** When agents should spend context on the architecture map. */
	readWhen: string;
	/** Command to validate generated diagram freshness. */
	validateWhenChangedCommand: string;
}

/** Project Brain trust projection for the cold-start packet. */
export interface HarnessOrientProjectBrain {
	/** Whether Project Brain files could be inspected. */
	brainStatus: "observed" | "unobserved";
	/** Whether stale-state scanning could be inspected. */
	brainStale: "pass" | "warn" | "unobserved";
	/** Orientation-only authority boundary for Project Brain evidence. */
	authority: "orientation_only";
	/** Project Brain references an agent can read next. */
	refs: string[];
	/** Validation summary from Project Brain, when available. */
	validationSummary: Record<string, unknown> | null;
	/** Number of stale files reported by Project Brain, when available. */
	staleFileCount: number | null;
	/** Reason Project Brain was unobserved, when applicable. */
	reason: string | null;
}

/** Local truth-lane caveat that prevents over-claiming from orientation output. */
export interface HarnessOrientTruthLaneWarning {
	/** Stable truth lane identifier. */
	lane:
		| "local_code"
		| "runtime_artifact"
		| "pr_ci"
		| "review_threads"
		| "tracker"
		| "merge_readiness";
	/** Claim boundary for the lane. */
	warning: string;
}

/** Cold-start orientation packet emitted by harness orient --json. */
export interface HarnessOrientReport {
	/** Versioned orientation packet schema. */
	schemaVersion: "harness-orient/v1";
	/** ISO timestamp for packet generation. */
	generatedAt: string;
	/** Packet producer. */
	producer: "harness:orient";
	/** Overall packet status for local orientation usefulness. */
	status: HarnessOrientStatus;
	/** Orientation output is not delivery or closeout proof. */
	evidenceUse: HarnessOrientEvidenceUse;
	/** Repository root inspected by the packet. */
	repoRoot: string;
	/** Compact harness next decision projection. */
	nextDecision: HarnessOrientNextDecision;
	/** Compact session-context projection. */
	sessionContext: HarnessOrientSessionContext;
	/** Advisory context-health projection from agent-readiness. */
	agentReadinessContextHealth: AgentReadinessContextHealth;
	/** Preflight receipt observation. */
	preflightReceipt: HarnessOrientPreflightReceipt;
	/** Conditional architecture context guidance. */
	architectureContext: HarnessOrientArchitectureContext;
	/** Project Brain trust and stale-state projection. */
	projectBrain: HarnessOrientProjectBrain;
	/** Files to read next when the task touches their lane. */
	orientationRefs: HarnessOrientContextRef[];
	/** Commands to deepen context without mutating repo state. */
	contextCommands: HarnessOrientContextCommand[];
	/** Conditional context and validation rules. */
	conditionalContext: HarnessOrientConditionalContext[];
	/** Explicit non-claims for separated truth lanes. */
	truthLaneWarnings: HarnessOrientTruthLaneWarning[];
}

/** Versioned usage-error payload for invalid orient CLI arguments. */
export interface HarnessOrientUsageError {
	/** Error schema version. */
	schemaVersion: "harness-orient-error/v1";
	/** Usage-error status. */
	status: "error";
	/** Structured usage error. */
	error: {
		/** Stable machine-readable error code. */
		code: "orient.flag_value_required" | "orient.invalid_repo_root";
		/** Human-readable error message. */
		message: string;
	};
}

/** Inputs passed to the command-owned provider that supplies harness-next evidence. */
export interface HarnessOrientNextDecisionProviderInput {
	/** Canonical repository root being oriented. */
	repoRoot: string;
	/** Agent-readiness context health already collected for the same repo. */
	contextHealth: AgentReadinessContextHealth;
}

/** Provider seam that keeps lib/orient from importing command-layer next code. */
export type HarnessOrientNextDecisionProvider = (
	input: HarnessOrientNextDecisionProviderInput,
) => HarnessDecision;

/** Options for collecting the cold-start orientation packet. */
export interface HarnessOrientOptions {
	/** Repository root to inspect; defaults to the current directory. */
	repoRoot?: string | undefined;
	/** Optional deterministic clock for tests. */
	now?: Date | undefined;
	/** Command-owned provider for the next decision included in orient output. */
	nextDecisionProvider: HarnessOrientNextDecisionProvider;
}
