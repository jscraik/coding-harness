export { validateRuntimeCard } from "./runtime-card-validation.js";
import type { HeValidationError } from "../decision/validators.js";

/** Schema version for the first local harness runtime state card. */
export const RUNTIME_CARD_SCHEMA_VERSION = "runtime-card/v1" as const;

/** Lifecycle state for the current work item as known by local evidence. */
export type RuntimeCardLifecycleState =
	| "planned"
	| "active"
	| "implemented"
	| "locally_validated"
	| "review_pending"
	| "ci_blocked"
	| "merge_ready"
	| "merged"
	| "closeout_pending"
	| "reconciled"
	| "closed"
	| "stale"
	| "superseded"
	| "blocked"
	| "unknown";

/** Freshness of an input source relative to the current work item. */
export type RuntimeCardFreshness = "current" | "stale" | "missing" | "unknown";

/** Usability state for a runtime source. */
export type RuntimeCardSourceStatus =
	| "usable"
	| "empty"
	| "invalid"
	| "blocked";

/** Source families allowed in runtime-card/v1. */
export type RuntimeCardSourceKind =
	| "git"
	| "pr"
	| "linear"
	| "artifact"
	| "validation"
	| "review"
	| "session"
	| "phase_exit";

/** Status for local spec/plan/artifact routing. */
export type RuntimeCardArtifactStatus =
	| "current"
	| "stale"
	| "missing"
	| "superseded"
	| "unknown";

/** Collapsed phase-exit posture carried by the runtime card. */
export type RuntimeCardPhaseExitStatus =
	| "pass"
	| "fail"
	| "blocked"
	| "not_run"
	| "unknown";

/** Owner expected to unblock a non-ready runtime-card attempt. */
export type RuntimeCardRecoveryOwner =
	| "codex"
	| "external_service"
	| "operator";

/** Retry posture for the current runtime-card attempt. */
export type RuntimeCardRetryDecision = "none" | "wait" | "stop";

/** Validation result for a runtime-card candidate. */
export interface RuntimeCardValidationResult {
	/** Whether the candidate satisfies runtime-card/v1. */
	valid: boolean;
	/** Structured validation errors, empty when valid. */
	errors: HeValidationError[];
}

/** Branch state snapshot for a runtime card. */
export interface RuntimeCardBranchState {
	/** Current branch name, or null when unavailable. */
	name: string | null;
	/** Whether the local worktree was clean when inspected, or null when unknown. */
	clean: boolean | null;
	/** Commit SHA or ref used by the evidence, or null when unknown. */
	ref: string | null;
}

/** Pull request state snapshot for a runtime card. */
export interface RuntimeCardPullRequestState {
	/** Pull request number, or null when no PR is known. */
	number: number | null;
	/** Pull request state, or null when unknown. */
	state: string | null;
	/** Whether the PR is draft, or null when unknown. */
	isDraft: boolean | null;
	/** Merge-state status from the PR host, or null when unknown. */
	mergeStateStatus: string | null;
	/** Pull request URL, or null when unknown. */
	url: string | null;
}

/** Spec/plan/artifact routing state for a runtime card. */
export interface RuntimeCardArtifactState {
	/** Active spec path or null when not known. */
	activeSpec: string | null;
	/** Active plan path or null when not known. */
	activePlan: string | null;
	/** Collapsed artifact freshness/status. */
	status: RuntimeCardArtifactStatus;
	/** Artifact refs known to be stale. */
	staleRefs: string[];
}

/** Linear or tracker state snapshot for a runtime card. */
export interface RuntimeCardLinearState {
	/** Issue key, or null when no tracker issue is known. */
	issueKey: string | null;
	/** Freshness of local tracker evidence relative to live state. */
	freshness: RuntimeCardFreshness;
	/** Human-readable tracker status, or null when not refreshed. */
	status?: string | null;
	/** Stable tracker status class, or null when not refreshed. */
	statusType?: string | null;
	/** Tracker issue URL, or null when unknown. */
	url?: string | null;
	/** Required tracker action, or null when none is known. */
	actionRequired: string | null;
}

/** Phase-exit state snapshot for a runtime card. */
export interface RuntimeCardPhaseExitState {
	/** Collapsed phase-exit status. */
	status: RuntimeCardPhaseExitStatus;
	/** Reason for the collapsed status, or null when none is known. */
	reason: string | null;
}

/** Normalized evidence source that contributed to the runtime card. */
export interface RuntimeCardSource {
	/** Source family. */
	kind: RuntimeCardSourceKind;
	/** Stable file, command, URL, or artifact reference. */
	ref: string;
	/** Source freshness relative to the runtime card. */
	freshness: RuntimeCardFreshness;
	/** Whether the source is usable as evidence. */
	status: RuntimeCardSourceStatus;
	/** Stable reason when the source cannot be used. */
	failureClass: string | null;
}

/** Replayable attempt metadata for runtime-card generation. */
export interface RuntimeCardAttemptLedger {
	schemaVersion: "attempt-ledger/v1";
	command: "runtime-card";
	attempt: number;
	maxAttempts: number;
	firstFailure: {
		attempt: number;
		lifecycle: RuntimeCardLifecycleState;
		nextSafeAction: string;
	} | null;
	retryDecision: RuntimeCardRetryDecision;
	owner: RuntimeCardRecoveryOwner;
	stopReason: string | null;
	nextAction: string;
	evidenceRefs: string[];
}

/** Failure/recovery event emitted when runtime-card evidence blocks continuation. */
export interface RuntimeCardRecoveryEvent {
	schemaVersion: "recovery-event/v1";
	eventId: string;
	command: "runtime-card";
	attempt: number;
	owner: RuntimeCardRecoveryOwner;
	failureClass: string;
	stopReason: string;
	nextAction: string;
	retryDecision: RuntimeCardRetryDecision;
	evidenceRefs: string[];
}

/** Local runtime state card consumed by agent cockpit commands. */
export interface RuntimeCard {
	/** Schema version for this runtime state contract. */
	schemaVersion: typeof RUNTIME_CARD_SCHEMA_VERSION;
	/** ISO-like creation time for the card. */
	generatedAt: string;
	/** Optional tracker key for the work item. */
	issueKey: string | null;
	/** Current lifecycle state. */
	lifecycle: RuntimeCardLifecycleState;
	/** Concise operator-facing summary. */
	summary: string;
	/** Safe next action derived from current evidence. */
	nextSafeAction: string;
	/** Branch state used by the card. */
	branch: RuntimeCardBranchState;
	/** Pull request state used by the card. */
	pullRequest: RuntimeCardPullRequestState;
	/** Local artifact routing state. */
	artifacts: RuntimeCardArtifactState;
	/** Tracker state used by the card. */
	linear: RuntimeCardLinearState;
	/** Phase-exit state used by the card. */
	phaseExit: RuntimeCardPhaseExitState;
	/** Evidence sources inspected to produce the card. */
	sources: RuntimeCardSource[];
	/** Blocking conditions that must be resolved before moving on. */
	blockers: string[];
	/** Attempt/retry metadata for the runtime-card generation pass. */
	attemptLedger: RuntimeCardAttemptLedger;
	/** Recovery event for blocked runtime-card output, or null when ready. */
	recoveryEvent: RuntimeCardRecoveryEvent | null;
}

const BLOCKING_LIFECYCLES = new Set<RuntimeCardLifecycleState>([
	"ci_blocked",
	"blocked",
	"stale",
]);

/** Return true when runtime card evidence says the caller must stop first. */
export function runtimeCardBlocksContinuation(card: RuntimeCard): boolean {
	return card.blockers.length > 0 || BLOCKING_LIFECYCLES.has(card.lifecycle);
}

/** Build a compact metadata payload for HarnessDecision.meta.runtimeCard. */
export function normaliseRuntimeCard(
	card: RuntimeCard,
): Record<string, unknown> {
	return {
		schemaVersion: card.schemaVersion,
		issueKey: card.issueKey,
		lifecycle: card.lifecycle,
		summary: card.summary,
		nextSafeAction: card.nextSafeAction,
		branch: card.branch,
		pullRequest: card.pullRequest,
		artifacts: card.artifacts,
		linear: card.linear,
		phaseExit: card.phaseExit,
		blockers: card.blockers,
		attemptLedger: card.attemptLedger,
		recoveryEvent: card.recoveryEvent,
		sourceCount: card.sources.length,
		sources: card.sources,
	};
}
